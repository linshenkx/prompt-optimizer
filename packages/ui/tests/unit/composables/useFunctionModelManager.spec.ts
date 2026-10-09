import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { FUNCTION_MODEL_KEYS } from '@prompt-optimizer/core'
import { resetFunctionModelManagerSingleton, useFunctionModelManager } from '../../../src/composables/model/useFunctionModelManager'
import type { AppServices } from '../../../src/types/services'

const createServices = () => {
  const saved = new Map<string, string>()
  const models = ref(['evaluation', 'global', 'test'].map(id => ({ id, enabled: true })))
  const modelManager = { getAllModels: vi.fn(async () => models.value) }
  const preferenceService = {
    get: vi.fn(async (key: string, fallback: string) => saved.get(key) ?? fallback),
    set: vi.fn(async (key: string, value: string) => { saved.set(key, value) }),
  }
  return { saved, models, modelManager, preferenceService,
    services: ref({ modelManager, preferenceService } as unknown as AppServices) }
}

describe('useFunctionModelManager recovery and availability', () => {
  beforeEach(resetFunctionModelManagerSingleton)
  afterEach(resetFunctionModelManagerSingleton)

  it('allows a later queued save to succeed after an earlier save fails', async () => {
    const { services, preferenceService, saved } = createServices()
    const manager = useFunctionModelManager(services)
    await manager.initialize()
    preferenceService.set.mockRejectedValueOnce(new Error('first save failed'))
    const results = await Promise.allSettled([
      manager.setEvaluationModel('evaluation'), manager.setEvaluationModel('test'),
    ])
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(manager.evaluationModel.value).toBe('test')
    expect(saved.get(FUNCTION_MODEL_KEYS.EVALUATION_MODEL)).toBe('test')
  })

  it('refreshes settings after a pending save has completed', async () => {
    const { services, preferenceService, saved } = createServices()
    const manager = useFunctionModelManager(services)
    await manager.initialize()
    let finishSave!: () => void
    preferenceService.set.mockImplementationOnce((key, value) => new Promise(resolve => {
      finishSave = () => { saved.set(key, value); resolve() }
    }))
    const save = manager.setEvaluationModel('test')
    await flushPromises()
    const refresh = manager.refresh()
    await flushPromises()
    expect(preferenceService.get).toHaveBeenCalledTimes(2)
    finishSave()
    await Promise.all([save, refresh])
    expect(manager.evaluationModel.value).toBe('test')
  })

  it.each(['evaluation', 'recognition'])('keeps the latest %s choice when rapid changes finish loading out of order', async (kind) => {
    const { services, modelManager, models, saved } = createServices()
    const manager = useFunctionModelManager(services)
    await manager.initialize()
    let resumeFirst!: (models: typeof models.value) => void
    modelManager.getAllModels.mockImplementationOnce(() => new Promise(resolve => { resumeFirst = resolve }))
    const setModel = kind === 'evaluation' ? manager.setEvaluationModel : manager.setImageRecognitionModel
    const key = kind === 'evaluation' ? FUNCTION_MODEL_KEYS.EVALUATION_MODEL : FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL
    const selected = kind === 'evaluation' ? manager.evaluationModel : manager.imageRecognitionModel
    const first = setModel('evaluation')
    const second = setModel('test')
    await flushPromises()
    resumeFirst(models.value)
    await Promise.all([first, second])
    expect(selected.value).toBe('test')
    expect(saved.get(key)).toBe('test')
  })

  it.each(['success', 'failure'])('ignores an older availability %s after models were disabled', async (outcome) => {
    const { services, modelManager, models } = createServices()
    const manager = useFunctionModelManager(services, ref('global'))
    await manager.initialize()
    let resolveOlder!: (value: typeof models.value) => void
    let rejectOlder!: (error: Error) => void
    const oldSnapshot = models.value.map(model => ({ ...model }))
    modelManager.getAllModels.mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolveOlder = resolve
      rejectOlder = reject
    }))
    const older = manager.initialize()
    models.value = []
    await manager.initialize()
    if (outcome === 'success') resolveOlder(oldSnapshot)
    else rejectOlder(new Error('obsolete read failure'))
    await expect(older).resolves.toBeUndefined()
    expect(manager.resolveEvaluationModelKey('test')).toBe('')
  })

  it.each(['disabled', 'deleted'])('rejects a %s image recognition model while preserving its saved choice', async (status) => {
    const { services, saved, models } = createServices()
    saved.set(FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL, 'evaluation')
    const manager = useFunctionModelManager(services)
    await manager.initialize()
    expect(manager.effectiveImageRecognitionModel.value).toBe('evaluation')
    if (status === 'disabled') models.value[0].enabled = false
    else models.value = models.value.filter(model => model.id !== 'evaluation')
    await manager.initialize()
    expect(manager.isImageRecognitionModelAvailable.value).toBe(false)
    expect(manager.effectiveImageRecognitionModel.value).toBe('')
    expect(saved.get(FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL)).toBe('evaluation')
    models.value = [{ id: 'evaluation', enabled: true }]
    await manager.initialize()
    expect(manager.effectiveImageRecognitionModel.value).toBe('evaluation')
  })

  it('skips removed and disabled models on the next evaluation without reopening settings', async () => {
    const { services, saved, models } = createServices()
    saved.set(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, 'evaluation')
    const manager = useFunctionModelManager(services, ref('global'))
    await manager.initialize()
    expect(manager.resolveEvaluationModelKey('test')).toBe('evaluation')

    models.value = models.value.filter(model => model.id !== 'evaluation')
    await manager.initialize()
    expect(manager.isEvaluationModelAvailable.value).toBe(false)
    expect(manager.resolveEvaluationModelKey('test')).toBe('global')

    models.value.find(model => model.id === 'global')!.enabled = false
    await manager.initialize()
    expect(manager.resolveEvaluationModelKey('test')).toBe('test')

    models.value.find(model => model.id === 'test')!.enabled = false
    await manager.initialize()
    expect(manager.resolveEvaluationModelKey('test')).toBe('')
  })

  it('retains a disabled override so re-enabling the model restores the explicit choice', async () => {
    const { services, saved, models } = createServices()
    saved.set(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, 'evaluation')
    models.value[0].enabled = false
    const manager = useFunctionModelManager(services, ref('global'))
    await manager.initialize()
    expect(manager.resolveEvaluationModelKey('test')).toBe('global')
    expect(saved.get(FUNCTION_MODEL_KEYS.EVALUATION_MODEL)).toBe('evaluation')

    models.value[0].enabled = true
    await manager.initialize()
    expect(manager.resolveEvaluationModelKey('test')).toBe('evaluation')
    expect(manager.isEvaluationModelAvailable.value).toBe(true)
  })

  it('retries after a temporary settings read failure', async () => {
    const { services, preferenceService } = createServices()
    const manager = useFunctionModelManager(services, ref('global'))
    await manager.initialize()
    preferenceService.get.mockRejectedValueOnce(new Error('temporary read failure'))
    await expect(manager.refresh()).rejects.toThrow('temporary read failure')
    expect(manager.isInitialized.value).toBe(false)
    expect(manager.isLoading.value).toBe(false)

    await expect(manager.initialize()).resolves.toBeUndefined()
    expect(manager.isInitialized.value).toBe(true)
    expect(manager.resolveEvaluationModelKey('test')).toBe('global')
  })

  it('does not publish unsaved choices or lose the previous persisted override', async () => {
    const { services, saved, preferenceService } = createServices()
    const manager = useFunctionModelManager(services, ref('global'))
    await manager.initialize()
    await manager.setEvaluationModel('evaluation')
    preferenceService.set.mockRejectedValueOnce(new Error('write failed'))
    await expect(manager.setEvaluationModel('test')).rejects.toThrow('write failed')
    expect(manager.evaluationModel.value).toBe('evaluation')
    expect(saved.get(FUNCTION_MODEL_KEYS.EVALUATION_MODEL)).toBe('evaluation')
    await manager.refresh()
    expect(manager.resolveEvaluationModelKey('test')).toBe('evaluation')
  })
})
