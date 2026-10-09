import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { FUNCTION_MODEL_KEYS } from '@prompt-optimizer/core'
import FunctionModelManager from '../../../src/components/FunctionModelManager.vue'
import SelectWithConfig from '../../../src/components/SelectWithConfig.vue'
import { resetFunctionModelManagerSingleton, useFunctionModelManager } from '../../../src/composables/model/useFunctionModelManager'
import type { AppServices } from '../../../src/types/services'

describe('FunctionModelManager default evaluation model', () => {
  beforeEach(resetFunctionModelManagerSingleton)
  afterEach(resetFunctionModelManagerSingleton)

  it('lets users clear a saved override and preserves automatic selection after reopening', async () => {
    const saved = new Map<string, string>([[FUNCTION_MODEL_KEYS.EVALUATION_MODEL, 'deepseek']])
    const services = ref({
      modelManager: {
        getAllModels: vi.fn().mockResolvedValue([]),
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
})
