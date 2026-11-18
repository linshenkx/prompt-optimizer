import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { setActivePinia } from 'pinia'
import type { ComparisonViewer, SavedComparisonResult } from '@prompt-optimizer/core'
import type { AppServices } from '../../src/types/services'

import BasicUserWorkspace from '../../src/components/basic-mode/BasicUserWorkspace.vue'
import ContextUserWorkspace from '../../src/components/context-mode/ContextUserWorkspace.vue'
import { resetFunctionModelManagerSingleton } from '../../src/composables/model/useFunctionModelManager'
import { useBasicUserSession } from '../../src/stores/session/useBasicUserSession'
import { useProVariableSession } from '../../src/stores/session/useProVariableSession'
import { useSessionManager } from '../../src/stores/session/useSessionManager'
import { createPreferenceServiceStub, createTestPinia } from '../utils/pinia-test-helpers'

const confirmComparisonDeletion = vi.hoisted(() => vi.fn())

vi.mock('../../src/composables/ui/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ warning: confirmComparisonDeletion }),
}))

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

  const passthrough = (name: string) => defineComponent({
    name,
    template: `<div class="${name}" v-bind="$attrs"><slot /><slot name="header" /><slot name="header-extra" /><slot name="footer" /><slot name="icon" /></div>`,
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
    NTooltip: defineComponent({
      name: 'NTooltip',
      template: `<div class="NTooltip" v-bind="$attrs"><slot name="trigger" /><slot /></div>`,
    }),
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

const commonStubs = {
  PromptPanelUI: true,
  PromptPreviewPanel: true,
  ConversationTestPanel: true,
  ContextUserTestPanel: true,
  OutputDisplay: true,
  SelectWithConfig: true,
  // Exercise the workspace binding at the selector's public boundary. Its
  // popover and model catalog have their own component tests.
  TextModelSelector: true,
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

const buildBasicUserSessionSnapshot = () => ({
  prompt: 'restored basic user prompt',
  optimizedPrompt: 'restored basic user optimized prompt',
  reasoning: '',
  chainId: '',
  versionId: '',
  testContent: '',
  layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
  testVariants: [
    { id: 'a', version: 0, modelKey: 'basic-model' },
    { id: 'b', version: 'workspace', modelKey: 'basic-model' },
    { id: 'c', version: 'workspace', modelKey: '' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ],
  testVariantResults: {
    a: { result: 'OLD-A', reasoning: '' },
    b: { result: 'OLD-B', reasoning: '' },
    c: { result: '', reasoning: '' },
    d: { result: '', reasoning: '' },
  },
  testVariantLastRunFingerprint: {
    a: 'old-a',
    b: 'old-b',
    c: '',
    d: '',
  },
  evaluationResults: {},
  compareSnapshotRoles: {},
  compareSnapshotRoleSignatures: {},
  selectedOptimizeModelKey: '',
  selectedTestModelKey: 'basic-model',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
})

const buildProVariableSessionSnapshot = () => ({
  prompt: 'restored context user prompt',
  optimizedPrompt: 'restored context user optimized prompt',
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
    a: { result: 'OLD-A', reasoning: '' },
    b: { result: 'OLD-B', reasoning: '' },
    c: { result: '', reasoning: '' },
    d: { result: '', reasoning: '' },
  },
  testVariantLastRunFingerprint: {
    a: 'old-a',
    b: 'old-b',
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

const readSavedSnapshot = (raw: unknown) =>
  typeof raw === 'string' ? JSON.parse(raw) : raw

describe('workspace session reactivity regression', () => {
  afterEach(() => {
    resetFunctionModelManagerSingleton()
    vi.restoreAllMocks()
  })

  it('basic-user keeps latest variant results after restoreSession replaces the session objects', async () => {
    const set = vi.fn(async () => {})
    const get = vi.fn(async (key: string, defaultValue: unknown) => {
      if (key === 'session/v1/basic-user') {
        return buildBasicUserSessionSnapshot()
      }
      return defaultValue
    })

    const testPromptStream = vi.fn(async (_systemPrompt: string, userPrompt: string, modelKey: string, handlers: any) => {
      expect(userPrompt).toBe('restored basic user prompt')
      expect(modelKey).toBe('basic-model')
      handlers.onToken('NEW-BASIC')
      handlers.onComplete()
    })

    const modelManager = createModelManager()
    const { pinia, services } = createTestPinia({
      preferenceService: createPreferenceServiceStub({ get, set }),
      modelManager: modelManager as any,
      promptService: {
        testPromptStream,
      } as any,
    })
    setActivePinia(pinia)
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => 'basic',
      getBasicSubMode: () => 'user',
      getProSubMode: () => 'variable',
      getImageSubMode: () => 'text2image',
    })

    const store = useBasicUserSession(pinia)
    const wrapper = mount(BasicUserWorkspace, {
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

    const split = wrapper.get('.split-divider')
    const root = wrapper.get('.basic-user-split').element
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as DOMRect)
    const commitSplit = vi.spyOn(store, 'setMainSplitLeftPct')
    split.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 300, bubbles: true }))
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 }))
    await nextTick()
    expect(split.attributes('aria-valuenow')).toBe('30')
    expect(store.layout.mainSplitLeftPct).toBe(50)
    expect(commitSplit).not.toHaveBeenCalled()
    document.dispatchEvent(new MouseEvent('pointerup'))
    expect(commitSplit).toHaveBeenCalledExactlyOnceWith(30)
    await split.trigger('keydown', { key: 'Home' })
    expect(store.layout.mainSplitLeftPct).toBe(25)
    await split.trigger('keydown', { key: 'ArrowRight' })
    expect(store.layout.mainSplitLeftPct).toBe(26)

    await wrapper.getComponent({ name: 'NRadioGroup' }).vm.$emit('update:value', 4)
    await nextTick()
    const versions = wrapper.findAllComponents({ name: 'TestPanelVersionSelect' })
    expect(versions).toHaveLength(4)
    versions[2]!.vm.$emit('update:value', 'previous')
    await wrapper.getComponent('[data-testid="basic-user-test-variant-d-model-select"]').vm.$emit('update:modelValue', 'draft-model')
    expect(store.testVariants.find(item => item.id === 'c')?.version).toBe('previous')
    expect(store.testVariants.find(item => item.id === 'd')?.modelKey).toBe('draft-model')
    // Restore replaces both layout and testVariants. The mounted controls must
    // keep reading and updating the new objects, including hidden C/D groups.
    const oldVariants = store.testVariants
    await store.restoreSession()
    await flushPromises()
    expect(store.testVariants).not.toBe(oldVariants)
    expect(split.attributes('aria-valuenow')).toBe('50')
    await wrapper.getComponent({ name: 'NRadioGroup' }).vm.$emit('update:value', 4)
    await nextTick()
    wrapper.findAllComponents({ name: 'TestPanelVersionSelect' })[2]!.vm.$emit('update:value', 2)
    expect(store.testVariants.find(item => item.id === 'c')?.version).toBe(2)
    expect(oldVariants.find(item => item.id === 'c')?.version).toBe('previous')

    await wrapper.get('[data-testid="basic-user-test-run-a"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(testPromptStream).toHaveBeenCalledTimes(1)
    expect(store.testVariantResults.a.result).toBe('NEW-BASIC')

    const saved = readSavedSnapshot(set.mock.calls.at(-1)?.[1])
    expect(saved?.testVariantResults?.a?.result).toBe('NEW-BASIC')
    wrapper.unmount()
  })

  it('pro-variable keeps latest variant results after restoreSession replaces the session objects', async () => {
    const set = vi.fn(async () => {})
    const get = vi.fn(async (key: string, defaultValue: unknown) => {
      if (key === 'session/v1/pro-variable') {
        return buildProVariableSessionSnapshot()
      }
      return defaultValue
    })

    const testCustomConversationStream = vi.fn(async (request: any, handlers: any) => {
      expect(request.modelKey).toBe('context-model')
      expect(request.messages).toMatchObject([
        { role: 'user', content: 'restored context user prompt' },
      ])
      handlers.onToken('NEW-CONTEXT')
      handlers.onComplete()
    })

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
        isCompareMode: false,
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

    await wrapper.get('[data-testid="pro-variable-test-run-a"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(testCustomConversationStream).toHaveBeenCalledTimes(1)
    expect(store.testVariantResults.a.result).toBe('NEW-CONTEXT')

    const saved = readSavedSnapshot(set.mock.calls.at(-1)?.[1])
    expect(saved?.testVariantResults?.a?.result).toBe('NEW-CONTEXT')
  })

  it('reopens a saved comparison beside the current variable workspace draft', async () => {
    const comparisonId = '11111111-1111-4111-8111-111111111111'
    const name = 'Saved review'
    const fixture: SavedComparisonResult = {
      revision: 'saved-v1:1',
      comparison: {
        schemaVersion: 'saved-comparison/v1',
        id: comparisonId,
        savedAt: 1000,
        executionSource: { kind: 'desktop', sourceId: 'desktop', label: 'Desktop', sourceEpoch: 'source:1', connectionGeneration: 'generation:1' },
        source: { favoriteId: 'favorite', assetId: 'asset', versionId: 'v2', expectedRevision: 'asset:2', title: name },
        request: {
          rawPrompt: 'Explain {{topic}}',
          messages: [{ role: 'user', content: 'Explain the moon' }],
          variables: { topic: 'the moon' },
        },
        runs: [
          {
            id: 'a', runId: 'run-a', status: 'success', output: 'Answer A', reasoning: 'Reasoning A',
            startedAt: 100, completedAt: 200,
            model: { configKey: 'first', name: 'First model', providerId: 'openai', modelId: 'model-a' },
            effective: {
              parameterCoverage: 'declared', parameters: { temperature: 0.2 }, omittedParameterNames: [],
              requestEvidence: 'captured',
              request: { modelId: 'model-a', api: 'chat-completions', parameters: { temperature: 0.2 }, omittedParameterNames: [] },
            },
          },
          {
            id: 'b', runId: 'run-b', status: 'cancelled', output: 'Partial answer B', reasoning: '',
            startedAt: 100, completedAt: 150,
            model: { configKey: 'second', name: 'Second model', providerId: 'openai-compatible', modelId: 'model-b' },
            effective: { parameterCoverage: 'declared', parameters: {}, omittedParameterNames: [], requestEvidence: 'pending' },
          },
        ],
      },
    }
    const viewer: ComparisonViewer = {
      list: vi.fn<ComparisonViewer['list']>(async () => ({
        items: [{ id: comparisonId, title: name, savedAt: 1000, statuses: ['success', 'cancelled'], revision: fixture.revision }],
      })),
      get: vi.fn(async () => fixture),
      delete: vi.fn(async () => ({ deleted: true, alreadyDeleted: false })),
    }
    const draft = { ...buildProVariableSessionSnapshot(), temporaryVariables: { topic: 'my draft value' } }
    const { pinia, services } = createTestPinia({
      modelManager: createModelManager() as unknown as AppServices['modelManager'],
      preferenceService: createPreferenceServiceStub({
        get: async <T,>(key: string, fallback: T) => key === 'session/v1/pro-variable' ? draft as T : fallback,
      }),
      savedComparisons: viewer,
    })
    setActivePinia(pinia)
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => 'pro',
      getBasicSubMode: () => 'user',
      getProSubMode: () => 'variable',
      getImageSubMode: () => 'text2image',
    })
    const store = useProVariableSession(pinia)
    await store.restoreSession()

    const wrapper = mount(ContextUserWorkspace, {
      props: { isCompareMode: true, globalVariables: {}, predefinedVariables: {} },
      global: {
        plugins: [pinia],
        provide: { services: ref(services) },
        stubs: {
          ...commonStubs,
          OutputDisplay: {
            props: ['content', 'reasoning'],
            template: '<pre>{{ content }} {{ reasoning }}</pre>',
          },
        },
      },
    })

    await flushPromises()
    await wrapper.get('[data-testid="open-saved-comparisons"]').trigger('click')
    await flushPromises()
    expect(viewer.list).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-testid="saved-comparison-list-item"]').trigger('click')
    await flushPromises()

    expect(viewer.get).toHaveBeenCalledWith(comparisonId)
    expect(wrapper.get('[data-testid="saved-comparison-detail"]').text()).toContain('Explain {{topic}}')
    expect(wrapper.get('[data-testid="saved-comparison-input"]').text()).toBe('Explain the moon')
    const runA = wrapper.get('[data-testid="saved-comparison-run-a"]')
    expect(runA.text()).toContain('Reasoning A')
    expect(runA.text()).toContain('chat-completions')
    expect(runA.text()).toContain('temperature')
    const runB = wrapper.get('[data-testid="saved-comparison-run-b"]')
    expect(runB.text()).toContain('Partial answer B')
    expect(runB.text()).toContain('contextMode.savedComparisons.status.cancelled')

    await wrapper.get('[data-testid="saved-comparisons-drawer"] .n-drawer-header__close').trigger('click')
    await wrapper.get('[data-testid="open-saved-comparisons"]').trigger('click')
    await flushPromises()
    const lookup = wrapper.get('[data-testid="saved-comparison-id"] input')
    await lookup.setValue(comparisonId)
    await wrapper.get('[data-testid="saved-comparisons-drawer"] form').trigger('submit')
    await flushPromises()
    expect(viewer.list).toHaveBeenCalledTimes(2)
    expect(viewer.get).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="saved-comparison-detail"]').text()).toContain(comparisonId)

    expect(viewer.delete).not.toHaveBeenCalled()
    confirmComparisonDeletion.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    await wrapper.get('[data-testid="saved-comparison-delete"]').trigger('click')
    await flushPromises()
    expect(viewer.delete).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="saved-comparison-delete"]').trigger('click')
    await flushPromises()
    expect(viewer.delete).toHaveBeenCalledExactlyOnceWith(comparisonId, fixture.revision)
    expect(wrapper.find('[data-testid="saved-comparison-detail"]').exists()).toBe(false)

    expect(store.prompt).toBe(draft.prompt)
    expect(store.optimizedPrompt).toBe(draft.optimizedPrompt)
    expect(store.temporaryVariables).toEqual(draft.temporaryVariables)
    expect(store.testVariantResults.a.result).toBe('OLD-A')
    wrapper.unmount()
  })
})
