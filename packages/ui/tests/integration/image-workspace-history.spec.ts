import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { setActivePinia } from 'pinia'
import type { PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import ImageText2ImageWorkspace from '../../src/components/image-mode/ImageText2ImageWorkspace.vue'
import ImageImage2ImageWorkspace from '../../src/components/image-mode/ImageImage2ImageWorkspace.vue'
import ImageMultiImageWorkspace from '../../src/components/image-mode/ImageMultiImageWorkspace.vue'
import { useImageText2ImageSession } from '../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../src/stores/session/useImageMultiImageSession'
import { resetFunctionModelManagerSingleton } from '../../src/composables/model/useFunctionModelManager'
import { createTestPinia } from '../utils/pinia-test-helpers'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('../../src/composables/ui/useToast', () => ({ useToast: () => toast }))
vi.mock('naive-ui', async (original) => ({
  ...await original<typeof import('naive-ui')>(),
  useMessage: () => toast,
}))
vi.mock('vue-i18n', async (original) => ({
  ...await original<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, locale: ref('en-US') }),
}))

const modes = [
  { name: 'text2image', component: ImageText2ImageWorkspace, useStore: useImageText2ImageSession, metadata: { hasInputImage: false } },
  { name: 'image2image', component: ImageImage2ImageWorkspace, useStore: useImageImage2ImageSession, metadata: { hasInputImage: true } },
  { name: 'multiimage', component: ImageMultiImageWorkspace, useStore: useImageMultiImageSession, metadata: { inputImageCount: 2 } },
] as const

const template = (id: string) => ({ id, name: id, content: 'template', isBuiltin: false, metadata: { templateType: id, version: '1', lastModified: 1 } })
const record = (id: string, extra: Partial<PromptRecord> = {}): PromptRecord => ({
  id, chainId: 'chain', originalPrompt: 'source', optimizedPrompt: id, type: 'iterate',
  version: 1, timestamp: 1, modelKey: 'history-model', templateId: 'history-template', ...extra,
})
const chain = (id: string): PromptRecordChain => {
  const currentRecord = record(id)
  return { chainId: 'chain', rootRecord: currentRecord, currentRecord, versions: [currentRecord] }
}
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const mounted: VueWrapper[] = []
const removeListeners: Array<() => void> = []

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  removeListeners.splice(0).forEach(remove => remove())
  resetFunctionModelManagerSingleton()
  vi.restoreAllMocks()
})

async function setup(mode: typeof modes[number]) {
  const order: string[] = []
  const historyManager = {
    createNewChain: vi.fn(async () => { order.push('history'); return chain('created') }),
    addIteration: vi.fn(async () => { order.push('history'); return chain('iteration') }),
    getChain: vi.fn(async () => chain('restored')),
  }
  const promptService = { optimizePromptStream: vi.fn(), iteratePromptStream: vi.fn() }
  const { pinia, services } = createTestPinia({
    historyManager: historyManager as never,
    promptService: promptService as never,
    imageStorageService: { getImage: vi.fn(async () => undefined) } as never,
    modelManager: { ensureInitialized: async () => {}, getAllModels: async () => [], getEnabledModels: async () => [] } as never,
    templateManager: {
      listTemplatesByType: async (type: string) => [template(type)],
      getTemplate: async (id: string) => template(id),
    } as never,
  })
  setActivePinia(pinia)
  const store = mode.useStore(pinia)
  const serviceRef = ref(services)
  const wrapper = shallowMount(mode.component, {
    global: {
      plugins: [pinia],
      provide: { services: serviceRef, openModelManager: vi.fn(), openTemplateManager: vi.fn() },
      stubs: { OptimizeWorkspaceLayout: false, TestWorkspaceLayout: false, VariantTestWorkspaceLayout: false },
    },
  })
  mounted.push(wrapper)
  await flushPromises()
  // Use the actual page handlers with real session stores; only model transport
  // and history storage are controlled so ordering/failure paths are observable.
  const page = wrapper.vm.$.setupState as Record<string, any>
  store.originalPrompt = 'source'
  store.optimizedPrompt = 'edited'
  store.reasoning = 'old reasoning'
  store.selectedTextModelKey = 'selected-model'
  store.selectedImageModelKey = 'image-model'
  store.assetBinding = { assetId: 'asset', versionId: 'asset-v1', status: 'linked' }
  store.origin = { kind: 'favorite', id: 'favorite-id' }
  if ('inputImageB64' in store) { store.inputImageB64 = 'input'; store.inputImageMime = 'image/png' }
  if ('inputImages' in store) store.inputImages = [
    { id: 'one', b64: 'first', mimeType: 'image/png' },
    { id: 'two', b64: 'second', mimeType: 'image/jpeg' },
  ]
  await nextTick()
  const save = vi.spyOn(store, 'saveSession').mockImplementation(async () => { order.push('save'); return true })
  const refresh = vi.fn(() => order.push('refresh'))
  window.addEventListener('prompt-optimizer:history-refresh', refresh)
  removeListeners.push(() => window.removeEventListener('prompt-optimizer:history-refresh', refresh))
  order.length = 0
  return { store, page, historyManager, promptService, save, order, refresh, serviceRef }
}

describe.each(modes)('$name image history behavior', (mode) => {
  it('creates a local-edit chain with its mode metadata and commits before notifying', async () => {
    const { page, store, historyManager, save, order } = await setup(mode)
    const pending = deferred<PromptRecordChain>()
    historyManager.createNewChain.mockImplementationOnce(() => { order.push('history'); return pending.promise })
    const action = page.handleSaveLocalEdit({ note: 'manual note' })
    expect(save).not.toHaveBeenCalled()
    expect(store.versionId).toBe('')
    const input = historyManager.createNewChain.mock.calls[0]![0] as any
    expect(input).toMatchObject({
      originalPrompt: 'source', optimizedPrompt: 'edited', type: `${mode.name}Optimize`,
      modelKey: 'selected-model', templateId: 'imageIterate',
      metadata: {
        optimizationMode: 'user', functionMode: 'image', imageModelKey: 'image-model',
        ...mode.metadata, localEdit: true, localEditSource: 'manual',
        assetBinding: { assetId: 'asset', versionId: 'asset-v1', status: 'linked' },
        origin: { kind: 'favorite', id: 'favorite-id' },
      },
    })
    expect(input.id).toEqual(expect.any(String))
    expect(input.timestamp).toEqual(expect.any(Number))
    expect(input).not.toHaveProperty('iterationNote')
    store.optimizedPrompt = 'subsequent edit while saving'
    pending.resolve(chain('created'))
    await action
    expect(store).toMatchObject({ chainId: 'chain', versionId: 'created', optimizedPrompt: 'edited', reasoning: '' })
    expect(order).toEqual(['history', 'save', 'refresh'])
    expect(toast.success).toHaveBeenCalledWith('toast.success.localEditSaved')
  })

  it('does not save blank text and reports an unavailable history service', async () => {
    const { page, store, historyManager, save, serviceRef } = await setup(mode)
    store.optimizedPrompt = ' \n '
    await page.handleSaveLocalEdit({})
    expect(historyManager.createNewChain).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    serviceRef.value.historyManager = undefined as never
    await page.handleSaveLocalEdit({})
    expect(toast.error).toHaveBeenCalledWith('toast.error.historyUnavailable')
    expect(save).not.toHaveBeenCalled()
  })

  it('reads restored chain/selection state and preserves the no-model/template fallback', async () => {
    const { page, store, historyManager, serviceRef } = await setup(mode)
    serviceRef.value.preferenceService.get = vi.fn(async (_key: string, defaultValue: unknown) => {
      return _key.startsWith('session/')
        ? { originalPrompt: 'restored source', optimizedPrompt: 'restored edit', chainId: 'restored-chain', versionId: 'restored-version' }
        : defaultValue
    }) as never
    await store.restoreSession()
    await flushPromises()
    page.currentChainId = ''
    page.currentVersions = []
    page.currentVersionId = ''
    store.selectedTextModelKey = ''
    page.selectedTemplate = null
    page.selectedIterateTemplate = null
    await page.handleSaveLocalEdit({})
    expect(historyManager.addIteration).toHaveBeenLastCalledWith(expect.objectContaining({
      chainId: 'restored-chain', originalPrompt: 'restored source', optimizedPrompt: 'restored edit',
      modelKey: 'local-edit', templateId: 'local-edit',
    }))
  })

  it('appends local edits using the selected historical model/template and session chain fallback', async () => {
    const { page, store, historyManager } = await setup(mode)
    store.chainId = 'restored-chain'
    page.currentVersions = [record('chosen')]
    page.currentVersionId = 'chosen'
    await page.handleSaveLocalEdit({ note: 'manual note' })
    expect(historyManager.createNewChain).not.toHaveBeenCalled()
    expect(historyManager.addIteration).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 'restored-chain', modelKey: 'history-model', templateId: 'history-template', iterationNote: 'manual note',
    }))
    expect(store.versionId).toBe('iteration')
  })

  it('distinguishes a failed history write from a failed session checkpoint', async () => {
    const { page, store, historyManager, save, refresh } = await setup(mode)
    historyManager.createNewChain.mockRejectedValueOnce(new Error('history failed'))
    await page.handleSaveLocalEdit({})
    expect(store.versionId).toBe('')
    expect(save).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    save.mockRejectedValueOnce(new Error('session failed'))
    await page.handleSaveLocalEdit({})
    expect(store.versionId).toBe('created')
    expect(refresh).toHaveBeenCalledOnce()
    expect(toast.warning).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('toast.success.localEditSaved')
  })

  it('preserves optimize and iterate stream/commit ordering, metadata and failure rollback', async () => {
    const { page, store, historyManager, promptService, save, order } = await setup(mode)
    promptService.optimizePromptStream.mockImplementationOnce(async (request, handlers) => {
      expect(request.targetPrompt).toBe('source')
      if (mode.name === 'image2image') expect(request.inputImages).toEqual([{ b64: 'input', mimeType: 'image/png' }])
      if (mode.name === 'multiimage') expect(request.inputImages).toEqual([{ b64: 'first', mimeType: 'image/png' }, { b64: 'second', mimeType: 'image/jpeg' }])
      if (mode.name === 'text2image') expect(request.inputImages).toBeUndefined()
      handlers.onToken('optimized')
      handlers.onReasoningToken('thought')
      expect(save).not.toHaveBeenCalled()
      expect(page.isOptimizing ?? page.optimizing).toBe(true)
      await handlers.onComplete()
    })
    await (page.handleOptimizePrompt ?? page.optimizePrompt)()
    expect(store).toMatchObject({ optimizedPrompt: 'optimized', reasoning: 'thought', versionId: 'created' })
    expect(order).toEqual(mode.name === 'multiimage' ? ['history', 'save', 'refresh', 'save'] : ['history', 'save', 'refresh'])
    expect(page.isOptimizing ?? page.optimizing).toBe(false)
    order.length = 0
    save.mockClear()
    store.assetBinding = { assetId: 'iteration-asset', status: 'linked' }
    store.origin = { kind: 'favorite', id: 'iteration-origin' }
    promptService.iteratePromptStream.mockImplementationOnce(async (_original, _optimized, _input, _model, handlers) => {
      handlers.onToken('iterated')
      handlers.onReasoningToken('new thought')
      expect(save).not.toHaveBeenCalled()
      expect(page.isIterating).toBe(true)
      await handlers.onComplete()
    })
    const payload = { originalPrompt: 'source', optimizedPrompt: 'optimized', iterateInput: 'shorter' }
    await page.handleIteratePrompt(payload)
    expect(order).toEqual(['history', 'save', 'refresh'])
    expect(store).toMatchObject({ optimizedPrompt: 'iterated', reasoning: 'new thought', versionId: 'iteration' })
    const iteration = historyManager.addIteration.mock.calls[0]![0] as any
    expect(iteration.metadata).toMatchObject({ assetBinding: store.assetBinding, origin: store.origin })
    if (mode.name === 'multiimage') expect(iteration.metadata).toMatchObject({ inputImageCount: 2, imageModelKey: 'image-model' })
    else expect(iteration.metadata).not.toHaveProperty('imageModelKey')
    promptService.iteratePromptStream.mockImplementationOnce(async (_a, _b, _c, _d, handlers) => {
      handlers.onToken('partial')
      handlers.onReasoningToken('partial thought')
      handlers.onError(new Error('stream failed'))
    })
    await page.handleIteratePrompt(payload)
    expect(store.optimizedPrompt).toBe('iterated')
    expect(store.reasoning).toBe('partial thought')
    expect(page.isIterating).toBe(false)
    expect(save).toHaveBeenCalledOnce()
    expect(toast.error).toHaveBeenCalled()
  })
})
