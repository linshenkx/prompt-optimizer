import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ImageText2ImageWorkspace from '../../src/components/image-mode/ImageText2ImageWorkspace.vue'
import { useImageText2ImageSession } from '../../src/stores/session/useImageText2ImageSession'
import { useSessionManager } from '../../src/stores/session/useSessionManager'
import { useFunctionModelManager, resetFunctionModelManagerSingleton } from '../../src/composables/model/useFunctionModelManager'
import { createTestPinia } from '../utils/pinia-test-helpers'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, locale: ref('en-US') }),
}))
vi.mock('../../src/composables/ui/useToast', () => ({
  useToast: () => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() }),
}))
vi.mock('naive-ui', async (importOriginal) => ({
  ...await importOriginal<typeof import('naive-ui')>(),
  useMessage: () => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() }),
}))

const LayoutStub = defineComponent({
  setup(_props, { slots, expose }) {
    expose({ getScrollTop: () => 0, setScrollTop: () => {}, scrollToSection: () => {} })
    return () => h('div', Object.values(slots).flatMap(slot => slot?.()))
  },
})

const createHarness = async () => {
  const evaluateStream = vi.fn(async (_request: unknown, callbacks: any) => {
    callbacks.onComplete({ score: { overall: 88 }, summary: 'ok', improvements: [] })
  })
  const model = { id: 'vision-model', name: 'Vision', enabled: true }
  const modelManager = {
    ensureInitialized: vi.fn(async () => {}),
    getAllModels: vi.fn(async () => [model]),
    getEnabledModels: vi.fn(async () => [model]),
  }
  const { pinia, services } = createTestPinia({
    modelManager: modelManager as any,
    evaluationService: { evaluateStream } as any,
    imageModelManager: { getEnabledConfigs: vi.fn(async () => []) } as any,
    templateManager: { listTemplatesByType: vi.fn(async () => []) } as any,
  })
  setActivePinia(pinia)
  useSessionManager().injectSubModeReaders({
    getFunctionMode: () => 'image', getBasicSubMode: () => 'system',
    getProSubMode: () => 'variable', getImageSubMode: () => 'text2image',
  })
  const store = useImageText2ImageSession(pinia)
  store.originalPrompt = 'original image prompt'
  store.optimizedPrompt = 'workspace image prompt'
  store.selectedTextModelKey = 'vision-model'
  store.saveSession = vi.fn(async () => {}) as typeof store.saveSession
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  const openModelManager = vi.fn()
  const wrapper = shallowMount(ImageText2ImageWorkspace, {
    global: {
      plugins: [pinia, router],
      provide: { services: ref(services), openModelManager },
      renderStubDefaultSlot: true,
      stubs: { OptimizeWorkspaceLayout: LayoutStub, VariantTestWorkspaceLayout: LayoutStub },
    },
  })
  await flushPromises()
  const functions = useFunctionModelManager(ref(services))
  await functions.initialize()
  return { wrapper, store, evaluateStream, openModelManager, functions }
}

describe('image workspace evaluation action boundaries', () => {
  afterEach(() => {
    resetFunctionModelManagerSingleton()
    vi.clearAllMocks()
  })

  it('requires both image evidence and an explicitly configured recognition model', async () => {
    const { wrapper, store, evaluateStream, openModelManager, functions } = await createHarness()
    const workspace = wrapper.vm as any
    await workspace.handleEvaluateResult('a')
    expect(evaluateStream).not.toHaveBeenCalled()
    expect(openModelManager).not.toHaveBeenCalled()

    store.testVariantResults.a = { images: [{ b64: 'aW1hZ2U=', mimeType: 'image/png' }] }
    await nextTick()
    await workspace.handleResultEvaluateWithFeedbackEvent('a', { feedback: 'look closely' })
    expect(evaluateStream).not.toHaveBeenCalled()
    expect(openModelManager).toHaveBeenCalledWith('function')

    await functions.setImageRecognitionModel('vision-model')
    await workspace.handleResultEvaluateWithFeedbackEvent('a', { feedback: 'look closely' })
    expect(evaluateStream).toHaveBeenCalledOnce()
    expect(evaluateStream.mock.calls[0]?.[0]).toMatchObject({
      type: 'result', evaluationModelKey: 'vision-model', focus: { content: 'look closely' },
      snapshot: { outputBlock: { kind: 'image' } },
    })
    wrapper.unmount()
  })

  it('refreshes image fingerprints after the active detail re-evaluates', async () => {
    const { wrapper, store, evaluateStream, functions } = await createHarness()
    const workspace = wrapper.vm as any
    await functions.setImageRecognitionModel('vision-model')
    store.testVariantResults.b = { images: [{ b64: 'aW1hZ2U=', mimeType: 'image/png' }] }
    await workspace.handleEvaluateResult('b')
    workspace.showResultDetail('b')
    expect(workspace.isResultEvaluationStale('b')).toBe(false)
    store.optimizedPrompt = 'updated workspace image prompt'
    await nextTick()
    expect(workspace.isResultEvaluationStale('b')).toBe(true)
    wrapper.getComponent({ name: 'EvaluationPanel' }).vm.$emit('re-evaluate')
    await flushPromises()
    expect(evaluateStream).toHaveBeenCalledTimes(2)
    expect(workspace.isResultEvaluationStale('b')).toBe(false)
    store.optimizedPrompt = 'another workspace image prompt'
    await nextTick()
    wrapper.getComponent({ name: 'EvaluationPanel' }).vm.$emit('evaluate-with-feedback', { feedback: 'detail check' })
    await flushPromises()
    expect(evaluateStream).toHaveBeenCalledTimes(3)
    expect(workspace.isResultEvaluationStale('b')).toBe(false)
    wrapper.unmount()
  })
})
