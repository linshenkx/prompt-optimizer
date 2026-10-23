import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { setActivePinia } from 'pinia'

import BasicSystemWorkspace from '../../src/components/basic-mode/BasicSystemWorkspace.vue'
import { resetFunctionModelManagerSingleton } from '../../src/composables/model/useFunctionModelManager'
import { useBasicSystemSession } from '../../src/stores/session/useBasicSystemSession'
import { createPreferenceServiceStub, createTestPinia } from '../utils/pinia-test-helpers'
import { createAppUpdatePreparation } from '../../src/composables/ui/useAppUpdatePreparation'

const toastError = vi.fn()

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('en-US'),
      t: (key: string) => key,
    }),
  }
})

vi.mock('../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: toastError,
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
    inheritAttrs: false,
    template: `<div :class="name" v-bind="$attrs"><slot /><slot name="header" /><slot name="footer" /><slot name="icon" /></div>`,
    setup: () => ({ name }),
  })

  return {
    ...actual,
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      template: `<button class="NButton" v-bind="$attrs" @click="$emit('click', $event)"><slot /><slot name="icon" /></button>`,
    }),
    NCard: passthrough('NCard'),
    NFlex: passthrough('NFlex'),
    NIcon: passthrough('NIcon'),
    NText: passthrough('NText'),
    NRadioGroup: passthrough('NRadioGroup'),
    NRadioButton: passthrough('NRadioButton'),
    NTag: passthrough('NTag'),
  }
})

const Passthrough = defineComponent({
  name: 'Passthrough',
  template: '<div><slot /><slot name="header-actions" /><slot name="toolbar-right-extra" /></div>',
})

const OutputDisplayStub = defineComponent({
  name: 'OutputDisplay',
  props: {
    content: { type: String, default: '' },
  },
  template: '<div class="output-display-stub">{{ content }}<slot name="toolbar-right-extra" /></div>',
})

const FocusAnalyzeButtonStub = defineComponent({
  name: 'FocusAnalyzeButton',
  props: {
    type: { type: String, required: true },
  },
  emits: ['evaluate', 'evaluate-with-feedback'],
  template: `
    <button
      type="button"
      class="focus-analyze-stub"
      :data-evaluation-type="type"
      @click="$emit('evaluate')"
    >
      evaluate-{{ type }}
    </button>
  `,
})

const SaveTestResultExampleButtonStub = defineComponent({
  name: 'SaveTestResultExampleButton',
  props: {
    disabled: { type: Boolean, default: false },
    testId: { type: String, default: '' },
  },
  template: '<button class="save-test-example-stub" :data-testid="testId" :disabled="disabled">save</button>',
})

const modelManager = {
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
  getAllModels: vi.fn().mockResolvedValue([]),
  getEnabledModels: vi.fn().mockResolvedValue([]),
}

type PromptStreamMock = ReturnType<typeof vi.fn>
type EvaluationStreamMock = ReturnType<typeof vi.fn>

type Harness = {
  wrapper: VueWrapper
  store: ReturnType<typeof useBasicSystemSession>
  testPromptStream: PromptStreamMock
  evaluateStream: EvaluationStreamMock
}

const createHarness = async (): Promise<Harness> => {
  const testPromptStream = vi.fn(async (...args: any[]) => {
    const callbacks = args[3]
    callbacks.onToken(`answer:${args[0]}`)
    callbacks.onComplete()
  })
  const evaluateStream = vi.fn(async (_request: unknown, callbacks: any) => {
    callbacks.onComplete({
      score: { overall: 88 },
      summary: 'ok',
      improvements: [],
    })
  })

  const { pinia, services } = createTestPinia({
    preferenceService: createPreferenceServiceStub(),
    modelManager: modelManager as any,
    promptService: { testPromptStream } as any,
    evaluationService: { evaluateStream } as any,
  })
  setActivePinia(pinia)

  const store = useBasicSystemSession(pinia)
  store.prompt = 'original system prompt'
  store.optimizedPrompt = 'optimized system prompt'
  store.testContent = 'What is shown in the image?'
  store.selectedTestModelKey = 'test-model'
  store.testVariants = [
    { id: 'a', version: 0, modelKey: 'test-model' },
    { id: 'b', version: 'workspace', modelKey: 'test-model' },
    { id: 'c', version: 'workspace', modelKey: '' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ]
  // Persistence is covered by the session-store suite. Keeping this integration
  // harness runtime-only also lets the b64 fallback case remain asset-less.
  store.saveSession = vi.fn(async () => {}) as typeof store.saveSession

  const wrapper = mount(BasicSystemWorkspace, {
    global: {
      plugins: [pinia],
      provide: {
        services: ref(services),
        openModelManager: vi.fn(),
        openTemplateManager: vi.fn(),
      },
      stubs: {
        InputPanelUI: true,
        PromptPanelUI: true,
        WorkspaceUtilityMenu: true,
        ThemedTooltip: Passthrough,
        TestInputSection: Passthrough,
        TestImageAttachmentControl: true,
        OutputDisplay: OutputDisplayStub,
        SaveTestResultExampleButton: SaveTestResultExampleButtonStub,
        AnalyzeActionIcon: true,
        CompareHelpButton: true,
        CompareRoleBadge: true,
        CompareRoleConfigDialog: true,
        EvaluationPanel: true,
        EvaluationScoreBadge: true,
        FocusAnalyzeButton: FocusAnalyzeButtonStub,
        SelectWithConfig: true,
        TextModelQuickSwitch: true,
        TestPanelVersionSelect: true,
        TestSourceLinkedCard: Passthrough,
        TestVariantSourceTag: true,
      },
    },
  })

  await flushPromises()
  await nextTick()

  return { wrapper, store, testPromptStream, evaluateStream }
}

const runAll = async (wrapper: VueWrapper) => {
  await wrapper.get('[data-testid="basic-system-test-run-all"]').trigger('click')
  await flushPromises()
  await nextTick()
}

const readEvaluationRequests = (evaluateStream: EvaluationStreamMock) =>
  evaluateStream.mock.calls.map((call) => call[0] as any)

describe('BasicSystemWorkspace single-image test flow', () => {
  it('keeps result and compare evaluation blocked until test content is restored', async () => {
    const { wrapper, store, evaluateStream } = await createHarness()
    await runAll(wrapper)
    const workspace = wrapper.vm as any
    store.testContent = ''
    await nextTick()
    await workspace.handleEvaluateResult('a')
    await workspace.handleResultEvaluateWithFeedbackEvent('a', { feedback: 'check' })
    await workspace.handleEvaluate('compare')
    expect(evaluateStream).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenLastCalledWith('test.error.noTestContent')

    store.testContent = 'restored input'
    await nextTick()
    await workspace.handleResultEvaluateWithFeedbackEvent('a', { feedback: 'check' })
    expect(evaluateStream).toHaveBeenCalledOnce()
    expect(readEvaluationRequests(evaluateStream)[0]).toMatchObject({ type: 'result', focus: { content: 'check' } })
    wrapper.unmount()
  })

  it('keeps text detail re-evaluation separate from result-action fingerprint refresh', async () => {
    const { wrapper, store, evaluateStream } = await createHarness()
    await runAll(wrapper)
    const workspace = wrapper.vm as any
    await workspace.handleEvaluateResult('a')
    workspace.showResultDetail('a')
    expect(workspace.isResultEvaluationStale('a')).toBe(false)
    store.testContent = 'changed input'
    await nextTick()
    expect(workspace.isResultEvaluationStale('a')).toBe(true)
    wrapper.getComponent({ name: 'EvaluationPanel' }).vm.$emit('re-evaluate')
    await flushPromises()
    expect(evaluateStream).toHaveBeenCalledTimes(2)
    expect(workspace.isResultEvaluationStale('a')).toBe(true)
    wrapper.getComponent({ name: 'EvaluationPanel' }).vm.$emit('evaluate-with-feedback', { feedback: 'focus' })
    await flushPromises()
    expect(evaluateStream).toHaveBeenCalledTimes(3)
    expect(workspace.isResultEvaluationStale('a')).toBe(true)
    await workspace.handleEvaluateResult('a')
    expect(workspace.isResultEvaluationStale('a')).toBe(false)
    wrapper.unmount()
  })

  it('blocks app updates while an evaluation continues after closing its panel', async () => {
    const { wrapper, evaluateStream } = await createHarness()
    await runAll(wrapper)
    let finish = () => {}
    evaluateStream.mockImplementationOnce(async (_request: unknown, callbacks: any) => {
      await new Promise<void>(resolve => {
        finish = () => {
          callbacks.onComplete({ score: { overall: 88 }, summary: 'ok', improvements: [] })
          resolve()
        }
      })
    })
    const workspace = wrapper.vm as any
    const evaluation = workspace.handleEvaluateResult('a')
    await flushPromises()
    workspace.evaluation.closePanel()
    const flush = vi.fn(async () => true)
    const prepare = createAppUpdatePreparation({ isBusy: workspace.isUpdateBusy, flush })
    try {
      expect(await prepare()).toBe('busy')
      expect(flush).not.toHaveBeenCalled()
      finish()
      await evaluation
      finish = () => {}
      expect(await prepare()).toBe('ready')
      expect(flush).toHaveBeenCalledOnce()
    } finally {
      finish()
      await evaluation
      wrapper.unmount()
    }
  })
  afterEach(() => {
    resetFunctionModelManagerSingleton()
    vi.clearAllMocks()
  })

  it('passes the same single image to A/B while preserving the four-argument text call', async () => {
    const withImage = await createHarness()
    withImage.store.testImageB64 = 'raw-image-one'
    withImage.store.testImageMimeType = 'image/png'
    withImage.store.testImageAssetId = 'asset-one'

    await runAll(withImage.wrapper)

    expect(withImage.testPromptStream).toHaveBeenCalledTimes(2)
    const imageCalls = withImage.testPromptStream.mock.calls
    expect(imageCalls.map((call) => call.length)).toEqual([5, 5])
    expect(imageCalls[0]?.[4]).toEqual([{ b64: 'raw-image-one', mimeType: 'image/png' }])
    expect(imageCalls[1]?.[4]).toEqual(imageCalls[0]?.[4])
    withImage.wrapper.unmount()

    const textOnly = await createHarness()
    await runAll(textOnly.wrapper)

    expect(textOnly.testPromptStream).toHaveBeenCalledTimes(2)
    expect(textOnly.testPromptStream.mock.calls.map((call) => call.length)).toEqual([4, 4])
    expect((textOnly.wrapper.vm as any).getVariantFingerprint('a')).not.toContain(':none')
    textOnly.wrapper.unmount()
  })

  it('marks an existing result stale after image add, replace, and delete', async () => {
    const { wrapper, store } = await createHarness()
    const workspace = wrapper.vm as any

    await wrapper.get('[data-testid="basic-system-test-run-a"]').trigger('click')
    await flushPromises()
    expect(workspace.isVariantStale('a')).toBe(false)
    expect((wrapper.get('[data-testid="save-test-example-basic-system-a"]').element as HTMLButtonElement).disabled).toBe(false)

    store.testImageB64 = 'first-image'
    store.testImageMimeType = 'image/png'
    store.testImageAssetId = 'asset-first'
    await nextTick()
    expect(workspace.isVariantStale('a')).toBe(true)
    expect((wrapper.get('[data-testid="save-test-example-basic-system-a"]').element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.get('[data-testid="basic-system-test-run-a"]').trigger('click')
    await flushPromises()
    expect(workspace.isVariantStale('a')).toBe(false)

    store.testImageB64 = 'replacement-image'
    store.testImageMimeType = 'image/jpeg'
    store.testImageAssetId = 'asset-replacement'
    await nextTick()
    expect(workspace.isVariantStale('a')).toBe(true)
    expect((wrapper.get('[data-testid="save-test-example-basic-system-a"]').element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.get('[data-testid="basic-system-test-run-a"]').trigger('click')
    await flushPromises()
    expect(workspace.isVariantStale('a')).toBe(false)

    store.testImageB64 = null
    store.testImageMimeType = ''
    store.testImageAssetId = null
    await nextTick()
    expect(workspace.isVariantStale('a')).toBe(true)

    wrapper.unmount()
  })

  it('keeps the run-start fingerprint when the image changes during a request', async () => {
    const { wrapper, store, testPromptStream } = await createHarness()
    let finishRequest: (() => void) | undefined
    testPromptStream.mockImplementationOnce(async (...args: any[]) => {
      const callbacks = args[3]
      await new Promise<void>((resolve) => {
        finishRequest = () => {
          callbacks.onToken('answer')
          callbacks.onComplete()
          resolve()
        }
      })
    })

    await wrapper.get('[data-testid="basic-system-test-run-a"]').trigger('click')
    await nextTick()
    store.testImageB64 = 'image-added-during-run'
    store.testImageMimeType = 'image/png'
    store.testImageAssetId = 'asset-added-during-run'
    finishRequest?.()
    await flushPromises()

    expect((wrapper.vm as any).isVariantStale('a')).toBe(true)
    wrapper.unmount()
  })

  it('shows a redacted provider error after image-bearing run-all fails', async () => {
    const { wrapper, store, testPromptStream } = await createHarness()
    const imagePayload = 'U0VDUkVUX0lNQUdFX1BBWUxPQUQ='
    store.testImageB64 = imagePayload
    store.testImageMimeType = 'image/png'
    store.testImageAssetId = 'asset-secret'
    testPromptStream.mockRejectedValue(
      new Error(`provider rejected data:image/png;base64,${imagePayload} for this model`),
    )

    await runAll(wrapper)

    expect(toastError).toHaveBeenCalledWith(
      'provider rejected [redacted-image] for this model',
    )
    expect(JSON.stringify(toastError.mock.calls)).not.toContain(imagePayload)
    wrapper.unmount()
  })

  it('uses assetId instead of b64 in result and compare evaluation media', async () => {
    const { wrapper, store, evaluateStream } = await createHarness()
    store.testImageB64 = 'runtime-only-b64'
    store.testImageMimeType = 'image/png'
    store.testImageAssetId = 'stored-asset-id'

    await runAll(wrapper)

    await wrapper.get('.focus-analyze-stub[data-evaluation-type="result"]').trigger('click')
    await flushPromises()
    await wrapper.get('.focus-analyze-stub[data-evaluation-type="compare"]').trigger('click')
    await flushPromises()

    const [resultRequest, compareRequest] = readEvaluationRequests(evaluateStream)
    expect(resultRequest.testCase.input.media).toEqual([{
      label: 'test.image.evaluationLabel',
      assetId: 'stored-asset-id',
      mimeType: 'image/png',
    }])
    expect(resultRequest.testCase.input.media[0]).not.toHaveProperty('b64')
    expect(compareRequest.testCases[0].input.media).toEqual([{
      label: 'test.image.evaluationLabel',
      assetId: 'stored-asset-id',
      mimeType: 'image/png',
    }])
    expect(compareRequest.testCases[0].input.media[0]).not.toHaveProperty('b64')

    wrapper.unmount()
  })

  it('falls back to runtime b64 in result and compare evaluation media without an asset', async () => {
    const { wrapper, store, evaluateStream } = await createHarness()
    store.testImageB64 = 'runtime-jpeg-b64'
    store.testImageMimeType = 'image/jpeg'
    store.testImageAssetId = null

    await runAll(wrapper)

    await wrapper.get('.focus-analyze-stub[data-evaluation-type="result"]').trigger('click')
    await flushPromises()
    await wrapper.get('.focus-analyze-stub[data-evaluation-type="compare"]').trigger('click')
    await flushPromises()

    const [resultRequest, compareRequest] = readEvaluationRequests(evaluateStream)
    const expectedMedia = [{
      label: 'test.image.evaluationLabel',
      b64: 'runtime-jpeg-b64',
      mimeType: 'image/jpeg',
    }]
    expect(resultRequest.testCase.input.media).toEqual(expectedMedia)
    expect(resultRequest.testCase.input.media[0]).not.toHaveProperty('assetId')
    expect(compareRequest.testCases[0].input.media).toEqual(expectedMedia)
    expect(compareRequest.testCases[0].input.media[0]).not.toHaveProperty('assetId')

    wrapper.unmount()
  })
})
