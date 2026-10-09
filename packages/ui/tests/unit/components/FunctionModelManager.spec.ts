import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { FUNCTION_MODEL_KEYS } from '@prompt-optimizer/core'
import FunctionModelManager from '../../../src/components/FunctionModelManager.vue'
import SelectWithConfig from '../../../src/components/SelectWithConfig.vue'
import { resetFunctionModelManagerSingleton, useFunctionModelManager } from '../../../src/composables/model/useFunctionModelManager'
import type { AppServices } from '../../../src/types/services'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({ error: toastError }),
}))

describe('FunctionModelManager default evaluation model', () => {
  beforeEach(() => {
    resetFunctionModelManagerSingleton()
    toastError.mockClear()
  })
  afterEach(resetFunctionModelManagerSingleton)

  const createListServices = () => {
    const models = [{ id: 'current', name: 'Current', enabled: true }]
    const getEnabledModels = vi.fn().mockResolvedValue(models)
    const services = ref({
      modelManager: { getAllModels: vi.fn().mockResolvedValue(models), getEnabledModels },
      preferenceService: { get: vi.fn(async (_key, fallback) => fallback), set: vi.fn() },
    } as unknown as AppServices)
    return { services, getEnabledModels }
  }

  it.each(['success', 'failure'])('ignores an older %s when a newer function model list is already displayed', async (outcome) => {
    const { services, getEnabledModels } = createListServices()
    const wrapper = mount(FunctionModelManager, { global: { provide: { services } } })
    await flushPromises()
    let resolveOlder!: (models: any[]) => void
    let rejectOlder!: (error: Error) => void
    getEnabledModels.mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolveOlder = resolve; rejectOlder = reject
    })).mockResolvedValueOnce([{ id: 'latest', name: 'Latest', enabled: true }])
    const refresh = () => (wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh()
    const older = refresh()
    await flushPromises()
    await refresh()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    if (outcome === 'success') resolveOlder([{ id: 'obsolete', name: 'Obsolete', enabled: true }])
    else rejectOlder(new Error('obsolete failure'))
    await older
    expect(wrapper.findAllComponents(SelectWithConfig)[0].props('options').map((option: any) => option.value)).toEqual(['latest'])
    expect(toastError).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('retains the displayed model list and reports a current reload failure', async () => {
    const { services, getEnabledModels } = createListServices()
    const wrapper = mount(FunctionModelManager, { global: { provide: { services } } })
    await flushPromises()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    getEnabledModels.mockRejectedValueOnce(new Error('temporary list failure'))
    await (wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh()
    expect(wrapper.findAllComponents(SelectWithConfig)[0].props('options').map((option: any) => option.value)).toEqual(['current'])
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('temporary list failure'))
    wrapper.unmount()
  })

  it('lets users clear a saved override and preserves automatic selection after reopening', async () => {
    const saved = new Map<string, string>([[FUNCTION_MODEL_KEYS.EVALUATION_MODEL, 'deepseek']])
    const services = ref({
      modelManager: {
        getAllModels: vi.fn().mockResolvedValue(['deepseek', 'gemini', 'test-model'].map(id => ({ id, enabled: true }))),
        getEnabledModels: vi.fn().mockResolvedValue([]),
      },
      preferenceService: {
        get: vi.fn(async (key: string, defaultValue: string) => saved.get(key) ?? defaultValue),
        set: vi.fn(async (key: string, value: string) => { saved.set(key, value) }),
      },
    } as unknown as AppServices)
    const globalModel = ref('gemini')
    let manager = useFunctionModelManager(services, globalModel)
    const mountManager = () => mount(FunctionModelManager, {
      global: {
        provide: { services },
      },
    })

    let wrapper = mountManager()
    await flushPromises()
    expect(manager.resolveEvaluationModelKey('test-model')).toBe('deepseek')
    expect(wrapper.findAllComponents(SelectWithConfig)[0].props('modelValue')).toBe('deepseek')

    const overrideSelect = wrapper.findAllComponents(SelectWithConfig)[0]
    await overrideSelect.get('.n-base-selection').trigger('mouseenter')
    await overrideSelect.get('[data-clear]').trigger('click')
    await flushPromises()

    expect(saved.get(FUNCTION_MODEL_KEYS.EVALUATION_MODEL)).toBe('')
    expect(manager.resolveEvaluationModelKey('test-model')).toBe('gemini')
    const evaluationSelect = wrapper.findAllComponents(SelectWithConfig)[0]
    expect(evaluationSelect.props('modelValue')).toBeNull()
    expect(evaluationSelect.text()).toContain('Default: use global optimization model')
    wrapper.unmount()

    resetFunctionModelManagerSingleton()
    manager = useFunctionModelManager(services, globalModel)
    wrapper = mountManager()
    await flushPromises()
    expect(manager.evaluationModel.value).toBe('')
    expect(manager.resolveEvaluationModelKey('test-model')).toBe('gemini')
    wrapper.unmount()
  })

  it('keeps the saved selection visible and shows an error when clearing cannot be saved', async () => {
    const services = ref({
      modelManager: {
        getAllModels: vi.fn().mockResolvedValue([{ id: 'deepseek', enabled: true }]),
        getEnabledModels: vi.fn().mockResolvedValue([]),
      },
      preferenceService: {
        get: vi.fn(async (key: string, fallback: string) =>
          key === FUNCTION_MODEL_KEYS.EVALUATION_MODEL ? 'deepseek' : fallback),
        set: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      },
    } as unknown as AppServices)
    const wrapper = mount(FunctionModelManager, { global: { provide: { services } } })
    await flushPromises()

    const evaluationSelect = wrapper.findAllComponents(SelectWithConfig)[0]
    await evaluationSelect.get('.n-base-selection').trigger('mouseenter')
    await evaluationSelect.get('[data-clear]').trigger('click')
    await flushPromises()

    expect(services.value.preferenceService.set).toHaveBeenCalledWith(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, '')
    expect(evaluationSelect.props('modelValue')).toBe('deepseek')
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('storage unavailable'))
    wrapper.unmount()
  })
})
