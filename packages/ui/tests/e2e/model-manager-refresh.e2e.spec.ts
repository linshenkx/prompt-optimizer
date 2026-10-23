import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { setActivePinia } from 'pinia'

import ContextSystemWorkspace from '../../src/components/context-mode/ContextSystemWorkspace.vue'
import ContextUserWorkspace from '../../src/components/context-mode/ContextUserWorkspace.vue'
import { resetFunctionModelManagerSingleton } from '../../src/composables/model/useFunctionModelManager'
import { useSessionManager } from '../../src/stores/session/useSessionManager'
import { createTestPinia } from '../utils/pinia-test-helpers'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@vueuse/core')>(),
  useElementSize: () => ({
    width: ref(0),
    height: ref(0),
  }),
}))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()

  const passthrough = (name: string) => defineComponent({
    name,
    template: `<div class="${name}" v-bind="$attrs"><slot /><slot name="header" /><slot name="footer" /><slot name="icon" /></div>`,
  })

  return {
    ...actual,
    NCard: passthrough('NCard'),
    NFlex: passthrough('NFlex'),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      template: `<button class="NButton" v-bind="$attrs" @click="$emit('click')"><slot /><slot name="icon" /></button>`,
    }),
    NText: passthrough('NText'),
    NEmpty: passthrough('NEmpty'),
    NSelect: defineComponent({
      name: 'NSelect',
      emits: ['update:value'],
      template: `<div class="NSelect" v-bind="$attrs"><slot /></div>`,
    }),
    NRadioGroup: passthrough('NRadioGroup'),
    NRadioButton: passthrough('NRadioButton'),
    NTooltip: passthrough('NTooltip'),
    NTag: passthrough('NTag'),
    NIcon: passthrough('NIcon'),
    NSpace: passthrough('NSpace'),
    NScrollbar: passthrough('NScrollbar'),
    NList: passthrough('NList'),
    NListItem: passthrough('NListItem'),
    NDropdown: passthrough('NDropdown'),
  }
})

const createModelManager = () => ({
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
  getAllModels: vi.fn().mockResolvedValue([]),
  getEnabledModels: vi.fn().mockResolvedValue([]),
})

const createServicesRef = () => {
  const modelManager = createModelManager()

  return {
    modelManager,
    services: ref({
      modelManager,
      preferenceService: {
        get: vi.fn().mockResolvedValue(''),
        set: vi.fn().mockResolvedValue(undefined),
      },
    }),
  }
}

const commonStubs = {
  PromptPanelUI: true,
  PromptPreviewPanel: true,
  ConversationTestPanel: true,
  ContextUserTestPanel: true,
  OutputDisplay: true,
  SelectWithConfig: true,
  ToolCallDisplay: true,
  EvaluationPanel: true,
  EvaluationScoreBadge: true,
  FocusAnalyzeButton: true,
  VariableAwareInput: true,
  InputPanelUI: true,
  ConversationManager: true,
}

describe('model manager refresh events', () => {
  afterEach(() => {
    resetFunctionModelManagerSingleton()
  })

  it('refreshes Pro multi model options when the manager close event is broadcast', async () => {
    const { pinia } = createTestPinia()
    setActivePinia(pinia)
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => 'pro',
      getBasicSubMode: () => 'system',
      getProSubMode: () => 'multi',
      getImageSubMode: () => 'text2image',
    })

    const { modelManager, services } = createServicesRef()
    const wrapper = mount(ContextSystemWorkspace, {
      global: {
        plugins: [pinia],
        provide: {
          services,
          openContextEditor: vi.fn(),
          openModelManager: vi.fn(),
          openTemplateManager: vi.fn(),
        },
        stubs: commonStubs,
      },
    })

    await flushPromises()
    const initialCalls = modelManager.getEnabledModels.mock.calls.length

    window.dispatchEvent(new Event('pro-workspace-refresh-text-models'))
    await flushPromises()

    expect(modelManager.getEnabledModels).toHaveBeenCalledTimes(initialCalls + 1)

    wrapper.unmount()
    window.dispatchEvent(new Event('pro-workspace-refresh-text-models'))
    await flushPromises()

    expect(modelManager.getEnabledModels).toHaveBeenCalledTimes(initialCalls + 1)
  })

  it('refreshes Pro variable model options when the manager close event is broadcast', async () => {
    const { pinia } = createTestPinia()
    setActivePinia(pinia)
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => 'pro',
      getBasicSubMode: () => 'user',
      getProSubMode: () => 'variable',
      getImageSubMode: () => 'text2image',
    })

    const { modelManager, services } = createServicesRef()
    const wrapper = mount(ContextUserWorkspace, {
      props: {
        isCompareMode: false,
        globalVariables: {},
        predefinedVariables: {},
      },
      global: {
        plugins: [pinia],
        provide: {
          services,
          openModelManager: vi.fn(),
          openTemplateManager: vi.fn(),
        },
        stubs: commonStubs,
      },
    })

    await flushPromises()
    const initialCalls = modelManager.getEnabledModels.mock.calls.length

    window.dispatchEvent(new Event('pro-workspace-refresh-text-models'))
    await flushPromises()

    expect(modelManager.getEnabledModels).toHaveBeenCalledTimes(initialCalls + 1)

    wrapper.unmount()
    window.dispatchEvent(new Event('pro-workspace-refresh-text-models'))
    await flushPromises()

    expect(modelManager.getEnabledModels).toHaveBeenCalledTimes(initialCalls + 1)
  })
})
