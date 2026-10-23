import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { setActivePinia } from 'pinia'

const batchToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))

vi.mock('vue-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRouter: () => ({ push: vi.fn() }),
}))

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
  useToast: () => batchToast,
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
    useMessage: () => batchToast,
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
import ContextSystemWorkspace from '../../src/components/context-mode/ContextSystemWorkspace.vue'
import BasicUserWorkspace from '../../src/components/basic-mode/BasicUserWorkspace.vue'
import BasicSystemWorkspace from '../../src/components/basic-mode/BasicSystemWorkspace.vue'
import ImageText2ImageWorkspace from '../../src/components/image-mode/ImageText2ImageWorkspace.vue'
import ImageImage2ImageWorkspace from '../../src/components/image-mode/ImageImage2ImageWorkspace.vue'
import ImageMultiImageWorkspace from '../../src/components/image-mode/ImageMultiImageWorkspace.vue'
import { useImageText2ImageSession } from '../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../src/stores/session/useImageMultiImageSession'
import { useBasicUserSession } from '../../src/stores/session/useBasicUserSession'
import { useBasicSystemSession } from '../../src/stores/session/useBasicSystemSession'
import { useProMultiMessageSession } from '../../src/stores/session/useProMultiMessageSession'
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
  TextModelQuickSwitch: true,
  TestVariantSourceTag: true,
  TestImageAttachmentControl: true,
  WorkspaceUtilityMenu: true,
  ImageTokenUsage: true,
  ImageResultDisplay: true,
  ReferenceImageCard: true,
  ImageUploadArea: true,
  TemporaryVariablesPanel: true,
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

const cases = [
  { mode: 'basic-user', component: BasicUserWorkspace, store: useBasicUserSession },
  { mode: 'basic-system', component: BasicSystemWorkspace, store: useBasicSystemSession },
  { mode: 'pro-variable', component: ContextUserWorkspace, store: useProVariableSession },
  { mode: 'pro-multi', component: ContextSystemWorkspace, store: useProMultiMessageSession },
] as const

const imageCases = [
  { mode: 'text2image', component: ImageText2ImageWorkspace, store: useImageText2ImageSession },
  { mode: 'image2image', component: ImageImage2ImageWorkspace, store: useImageImage2ImageSession },
  { mode: 'multiimage', component: ImageMultiImageWorkspace, store: useImageMultiImageSession },
] as const

describe('workspace run-all parallel regression', () => {
  afterEach(() => {
    resetFunctionModelManagerSingleton()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it.each(cases)('starts both $mode columns in parallel and saves only after both finish', async ({ mode, component, store: createStore }) => {
    const set = vi.fn(async () => {})
    const get = vi.fn(async (key: string, defaultValue: unknown) => {
      if (key === 'session/v1/' + mode) {
        return {
          ...buildProVariableSessionSnapshot(),
          testContent: 'test user input',
          conversationMessagesSnapshot: [{ id: 'message-1', role: 'user', content: 'original context prompt' }],
          selectedMessageId: 'message-1',
          messageChainMap: {},
        }
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

    const testPromptStream = vi.fn(async (_system: string, _user: string, _model: string, handlers: any) =>
      testCustomConversationStream({}, handlers))
    const modelManager = createModelManager()
    const { pinia, services } = createTestPinia({
      preferenceService: createPreferenceServiceStub({ get, set }),
      modelManager: modelManager as any,
      promptService: {
        testCustomConversationStream,
        testPromptStream,
      } as any,
    })

    setActivePinia(pinia)
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => mode.startsWith('basic') ? 'basic' : 'pro',
      getBasicSubMode: () => mode === 'basic-system' ? 'system' : 'user',
      getProSubMode: () => mode === 'pro-multi' ? 'multi' : 'variable',
      getImageSubMode: () => 'text2image',
    })

    const store = createStore(pinia)
    const wrapper = mount(component as typeof ContextUserWorkspace, {
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

    const saveSession = vi.spyOn(store, 'saveSession').mockResolvedValue(undefined)
    const clearEvaluation = vi.spyOn((wrapper.vm as any).evaluationHandler, 'clearBeforeTest')
    const optimizedPrompt = store.optimizedPrompt
    store.optimizedPrompt = ''
    store.testVariantResults.a.result = 'previous-a'
    store.testVariantResults.b.result = 'previous-b'
    await nextTick()
    await (wrapper.vm as any).runAllVariants()
    expect(testCustomConversationStream).not.toHaveBeenCalled()
    expect(saveSession).not.toHaveBeenCalled()
    expect(clearEvaluation).not.toHaveBeenCalled()
    expect(store.testVariantResults.a.result).toBe('previous-a')
    expect(store.testVariantResults.b.result).toBe('previous-b')
    expect(batchToast.error).toHaveBeenCalledTimes(1)
    batchToast.error.mockClear()
    store.optimizedPrompt = optimizedPrompt
    await nextTick()

    await wrapper.get('[data-testid="' + mode + '-test-run-all"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(testCustomConversationStream).toHaveBeenCalledTimes(2)
    expect(clearEvaluation).toHaveBeenCalledTimes(1)
    expect(saveSession).not.toHaveBeenCalled()
    expect(store.testVariantResults.a.result).toBe('')
    expect(store.testVariantResults.b.result).toBe('')

    // The busy guard must still prevent another batch while both columns stream.
    await (wrapper.vm as any).runAllVariants()
    expect(testCustomConversationStream).toHaveBeenCalledTimes(2)

    pendingResolvers[0]!()
    await flushPromises()
    expect(saveSession).not.toHaveBeenCalled()
    expect(store.testVariantResults.a.result).toBe('OK')
    expect(store.testVariantResults.b.result).toBe('')
    pendingResolvers[1]!()

    await flushPromises()
    await nextTick()
    expect(store.testVariantResults.b.result).toBe('OK')
    expect(saveSession).toHaveBeenCalledTimes(1)
    expect(batchToast.success).toHaveBeenCalledExactlyOnceWith('toast.success.testComplete')
    expect(batchToast.error).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('holds BasicSystem image/fingerprint snapshots for the entire batch and redacts the failed provider message', async () => {
    const imagePayload = 'U0VDUkVUX0lNQUdFX1BBWUxPQUQ='
    let store: ReturnType<typeof useBasicSystemSession>
    const testPromptStream = vi.fn(async (...args: any[]) => {
      if (testPromptStream.mock.calls.length === 1) {
        // Simulate the first dispatch causing an input change before B starts.
        store.testImageB64 = 'replacement-image'
        store.testImageAssetId = 'replacement-asset'
        store.testImageMimeType = 'image/jpeg'
      }
      args[3].onToken('partial answer')
      throw new Error(`provider rejected data:image/png;base64,${imagePayload}`)
    })
    const { pinia, services } = createTestPinia({
      modelManager: createModelManager() as any,
      promptService: { testPromptStream } as any,
    })
    setActivePinia(pinia)
    store = useBasicSystemSession(pinia)
    Object.assign(store, buildProVariableSessionSnapshot(), {
      testContent: 'describe image',
      testImageB64: imagePayload,
      testImageAssetId: 'original-asset',
      testImageMimeType: 'image/png',
    })
    const wrapper = mount(BasicSystemWorkspace, {
      global: {
        plugins: [pinia],
        provide: { services: ref(services), openModelManager: vi.fn(), openTemplateManager: vi.fn() },
        stubs: commonStubs,
      },
    })
    await flushPromises()
    const workspace = wrapper.vm as any
    const fingerprints = { a: workspace.getVariantFingerprint('a'), b: workspace.getVariantFingerprint('b') }
    const save = vi.spyOn(store, 'saveSession').mockResolvedValue(undefined)
    await wrapper.get('[data-testid="basic-system-test-run-all"]').trigger('click')
    await flushPromises()
    expect(testPromptStream).toHaveBeenCalledTimes(2)
    const firstImages = testPromptStream.mock.calls[0]![4]
    const secondImages = testPromptStream.mock.calls[1]![4]
    expect(firstImages).toBe(secondImages)
    expect(secondImages).toEqual([{ b64: imagePayload, mimeType: 'image/png' }])
    expect(store.testVariantLastRunFingerprint.a).toBe(`failed:${fingerprints.a}`)
    expect(store.testVariantLastRunFingerprint.b).toBe(`failed:${fingerprints.b}`)
    expect(save).toHaveBeenCalledTimes(1)
    expect(batchToast.success).not.toHaveBeenCalled()
    expect(batchToast.error).toHaveBeenCalledExactlyOnceWith('provider rejected [redacted-image]')
    wrapper.unmount()
  })

  it.each(imageCases)('preserves $mode results while running and saves partial success once', async ({ mode, component, store: createStore }) => {
    vi.stubGlobal('Image', class {
      width = 1
      height = 1
      naturalWidth = 1
      naturalHeight = 1
      onload: (() => void) | null = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    })
    const pending: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = []
    const generate = vi.fn((_request: unknown) => new Promise((resolve, reject) => { pending.push({ resolve, reject }) }))
    const validate = vi.fn(async () => {})
    const { pinia, services } = createTestPinia({
      modelManager: createModelManager() as any,
      imageModelManager: {
        getEnabledConfigs: async () => [{
          id: 'image-model', name: 'Image Model', providerId: 'test-provider', modelId: 'test-image',
          model: { capabilities: { text2image: true, image2image: true, multiImage: true } },
        }],
      } as any,
      imageService: {
        generateText2Image: generate, generateImage2Image: generate, generateMultiImage: generate,
        validateText2ImageRequest: validate, validateImage2ImageRequest: validate, validateMultiImageRequest: validate,
      } as any,
    })
    setActivePinia(pinia)
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => 'image', getBasicSubMode: () => 'user',
      getProSubMode: () => 'variable', getImageSubMode: () => mode,
    })
    const store = createStore(pinia)
    Object.assign(store, {
      originalPrompt: 'original image prompt', optimizedPrompt: 'optimized image prompt',
      selectedImageModelKey: 'image-model',
      inputImageB64: 'input-one', inputImageMime: 'image/png',
      inputImages: [
        { id: 'image-one', b64: 'input-one', mimeType: 'image/png' },
        { id: 'image-two', b64: 'input-two', mimeType: 'image/png' },
      ],
      testVariants: [
        { id: 'a', version: 0, modelKey: 'image-model' },
        { id: 'b', version: 'workspace', modelKey: 'image-model' },
      ],
      testVariantResults: {
        a: { images: [], text: 'old-a' }, b: { images: [], text: 'old-b' }, c: null, d: null,
      },
    })
    const wrapper = mount(component as typeof ImageText2ImageWorkspace, {
      global: {
        plugins: [pinia],
        provide: { services: ref(services), openModelManager: vi.fn(), openTemplateManager: vi.fn() },
        stubs: commonStubs,
      },
    })
    await flushPromises()
    const save = vi.spyOn(store, 'saveSession').mockResolvedValue(undefined)
    const clear = vi.spyOn((wrapper.vm as any).evaluationHandler, 'clearBeforeTest')
    await wrapper.get('[data-testid="image-' + mode + '-test-run-all"]').trigger('click')
    await flushPromises()
    expect(generate).toHaveBeenCalledTimes(2)
    expect(validate).toHaveBeenCalledTimes(2)
    expect(store.testVariantResults.a?.text).toBe('old-a')
    expect(store.testVariantResults.b?.text).toBe('old-b')
    expect(save).not.toHaveBeenCalled()
    expect(clear).toHaveBeenCalledTimes(mode === 'text2image' ? 1 : 0)
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ prompt: 'original image prompt', configId: 'image-model' })
    expect(generate.mock.calls[1]?.[0]).toMatchObject({ prompt: 'optimized image prompt', configId: 'image-model' })
    pending[0]!.resolve({ images: [], text: 'new-a' })
    await flushPromises()
    expect(save).not.toHaveBeenCalled()
    pending[1]!.reject(new Error('image request failed'))
    await flushPromises()
    expect(store.testVariantResults.a?.text).toBe('new-a')
    expect(store.testVariantResults.b?.text).toBe('old-b')
    expect(save).toHaveBeenCalledTimes(1)
    expect(batchToast.success).not.toHaveBeenCalled()
    expect(batchToast.error).toHaveBeenCalledExactlyOnceWith('imageWorkspace.generation.generateFailed')
    wrapper.unmount()
  })
})
