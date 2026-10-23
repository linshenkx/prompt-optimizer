import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { setActivePinia } from 'pinia'

vi.mock('../../src/utils/runTasksSequentially', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/runTasksSequentially')>()
  return {
    ...actual,
    runTasksWithExecutionMode: async <T, TResult>(
      items: readonly T[],
      task: (item: T, index: number) => Promise<TResult>,
    ) => Promise.all(items.map((item, index) => task(item, index))),
  }
})

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
    width: ref(1200),
    height: ref(800),
  }),
}))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()

  const passthrough = (name: string) =>
    defineComponent({
      name,
      template: `<div class="${name}" v-bind="$attrs"><slot /><slot name="header" /><slot name="footer" /><slot name="icon" /><slot name="trigger" /></div>`,
    })

  return {
    ...actual,
    NCard: passthrough('NCard'),
    NFlex: passthrough('NFlex'),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      template: `<button class="NButton" v-bind="$attrs" @click="$emit('click', $event)"><slot /><slot name="icon" /></button>`,
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

import ContextUserWorkspace from '../../src/components/context-mode/ContextUserWorkspace.vue'
import { resetFunctionModelManagerSingleton } from '../../src/composables/model/useFunctionModelManager'
import { useProVariableSession } from '../../src/stores/session/useProVariableSession'
import { useSessionManager } from '../../src/stores/session/useSessionManager'
import { createPreferenceServiceStub, createTestPinia } from '../utils/pinia-test-helpers'

const createModelManager = () => ({
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
  getAllModels: vi.fn().mockResolvedValue([]),
  getEnabledModels: vi.fn().mockResolvedValue([
    {
      key: 'context-model',
      name: 'Context Model',
      provider: 'deepseek',
    },
  ]),
})

const commonStubs = {
  PromptPanelUI: true,
  PromptPreviewPanel: true,
  ConversationTestPanel: true,
  ContextUserTestPanel: true,
  OutputDisplay: true,
  SelectWithConfig: true,
  TestPanelVersionSelect: true,
  ToolCallDisplay: true,
  EvaluationPanel: true,
  EvaluationScoreBadge: true,
  FocusAnalyzeButton: true,
  CompareRoleBadge: true,
  CompareHelpButton: true,
  AnalyzeActionIcon: true,
  VariableAwareInput: true,
  InputPanelUI: true,
  ConversationManager: true,
}

const buildProVariableSessionSnapshot = () => ({
  prompt: 'original context prompt',
  optimizedPrompt: 'optimized context prompt',
  reasoning: '',
  chainId: '',
  versionId: '',
  testContent: '',
  temporaryVariables: {},
  layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
  testVariants: [
    { id: 'a', version: 0, modelKey: 'context-model' },
    { id: 'b', version: 'workspace', modelKey: 'context-model' },
    { id: 'c', version: 'workspace', modelKey: '' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ],
  testVariantResults: {
    a: { result: '', reasoning: '' },
    b: { result: '', reasoning: '' },
    c: { result: '', reasoning: '' },
    d: { result: '', reasoning: '' },
  },
  testVariantLastRunFingerprint: {
    a: '',
    b: '',
    c: '',
    d: '',
  },
  evaluationResults: {},
  compareSnapshotRoles: {},
  compareSnapshotRoleSignatures: {},
  selectedOptimizeModelKey: '',
  selectedTestModelKey: 'context-model',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
})

describe('workspace run-all parallel regression', () => {
  afterEach(() => {
    resetFunctionModelManagerSingleton()
  })

  it('starts both pro-variable test variants when run-all dispatches in parallel', async () => {
    const set = vi.fn(async () => {})
    const get = vi.fn(async (key: string, defaultValue: unknown) => {
      if (key === 'session/v1/pro-variable') {
        return buildProVariableSessionSnapshot()
      }
      return defaultValue
    })

    const pendingResolvers: Array<() => void> = []
    const testCustomConversationStream = vi.fn(
      async (_request: any, handlers: any) =>
        await new Promise<void>((resolve) => {
          pendingResolvers.push(() => {
            handlers.onToken('OK')
            handlers.onComplete()
            resolve()
          })
        }),
    )

    const modelManager = createModelManager()
    const { pinia, services } = createTestPinia({
      preferenceService: createPreferenceServiceStub({ get, set }),
      modelManager: modelManager as any,
      promptService: {
        testCustomConversationStream,
      } as any,
    })

    setActivePinia(pinia)
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => 'pro',
      getBasicSubMode: () => 'user',
      getProSubMode: () => 'variable',
      getImageSubMode: () => 'text2image',
    })

    const store = useProVariableSession(pinia)
    const wrapper = mount(ContextUserWorkspace, {
      props: {
        isCompareMode: true,
        globalVariables: {},
        predefinedVariables: {},
      },
      global: {
        plugins: [pinia],
        provide: {
          services: ref(services),
          openModelManager: vi.fn(),
          openTemplateManager: vi.fn(),
        },
        stubs: commonStubs,
      },
    })

    await flushPromises()
    await store.restoreSession()
    await flushPromises()
    await nextTick()

    await wrapper.get('[data-testid="pro-variable-test-run-all"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(testCustomConversationStream).toHaveBeenCalledTimes(2)

    for (const resolvePending of pendingResolvers) {
      resolvePending()
    }

    await flushPromises()
    await nextTick()
  })
})
