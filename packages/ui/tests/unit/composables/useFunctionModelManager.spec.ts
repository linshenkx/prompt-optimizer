import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
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
