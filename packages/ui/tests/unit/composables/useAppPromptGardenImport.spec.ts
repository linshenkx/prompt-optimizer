import { describe, it, expect, afterEach, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type {
  LocationQuery,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  Router,
} from 'vue-router'
import type { ConversationMessage, FavoritePrompt, PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import type { MessageReactive } from 'naive-ui'

import { createTestPinia } from '../../utils/pinia-test-helpers'
import { useBasicSystemSession } from '../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../src/stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../src/stores/session/useProVariableSession'
import { useImageText2ImageSession } from '../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../../src/stores/session/useImageMultiImageSession'
import { useAppPromptGardenImport } from '../../../src/composables/app/useAppPromptGardenImport'
import { setGlobalMessageApi } from '../../../src/composables/ui/useToast'
import { i18n } from '../../../src/plugins/i18n'

const buildFullPath = (path: string, query: LocationQuery): string => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      params.append(key, value)
      continue
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string') params.append(key, v)
      }
    }
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

const makeRoute = (path: string, query: LocationQuery): RouteLocationNormalizedLoaded => {
  return {
    fullPath: buildFullPath(path, query),
    hash: '',
    query,
    params: {},
    name: undefined,
    path,
    meta: {},
    matched: [],
    redirectedFrom: undefined,
  }
}

const makeDummyRecord = (): PromptRecord => {
  return {
    id: 'v1',
    originalPrompt: 'orig',
    optimizedPrompt: 'opt',
    type: 'optimize',
    chainId: 'chain',
    version: 1,
    timestamp: Date.now(),
    modelKey: 'mock-model',
    templateId: 'mock-template',
  }
}

const applyNavigation = (
  currentRoute: { value: RouteLocationNormalizedLoaded },
  to: RouteLocationRaw
) => {
  if (typeof to === 'string') {
    currentRoute.value = makeRoute(to, {})
    return
  }

  if (to && typeof to === 'object' && 'path' in to && typeof to.path === 'string') {
    const nextQuery = (to as { query?: unknown }).query
    const query = (nextQuery && typeof nextQuery === 'object' ? (nextQuery as LocationQuery) : {})
    currentRoute.value = makeRoute(to.path, query)
    return
  }

  throw new Error('Unsupported navigation payload')
}

const waitForCondition = async (predicate: () => boolean, timeoutMs = 1500) => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise((r) => setTimeout(r, 0))
  }
}

describe('Garden Arena imports', () => {
  it.each(['example', 'explicit-target', 'missing-variable', 'busy', 'image-favorite'])('%s preserves the import contract', async scenario => {
    const { pinia } = createTestPinia()
    const message = () => ({ destroy: () => {} } as unknown as MessageReactive)
    const error = vi.fn(message)
    setGlobalMessageApi({ info: vi.fn(message), success: vi.fn(message), error, warning: vi.fn(message) })
    const query: LocationQuery = { importCode: 'BM-009', ...(scenario === 'explicit-target' ? { subModeKey: 'arena' } : {}), ...(scenario === 'image-favorite' ? { saveToFavorites: 'confirm' } : {}) }
    const currentRoute = ref(makeRoute('/arena', query))
    const router = {
      currentRoute,
      push: vi.fn(async (to: RouteLocationRaw) => { applyNavigation(currentRoute, to); return undefined }),
      replace: vi.fn(async (to: RouteLocationRaw) => { applyNavigation(currentRoute, to); return undefined }),
    }
    const replaceInput = vi.fn(async () => true)
    const openSaveFavoriteDialog = vi.fn()
    const basicUserSession = useBasicUserSession(pinia)
    basicUserSession.updatePrompt('Keep existing workspace')
    const missing = scenario === 'missing-variable'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      schema: 'prompt-garden.prompt.v1', schemaVersion: 1,
      optimizerTarget: { subModeKey: scenario === 'explicit-target' ? 'basic-user' : 'arena' },
      prompt: { format: 'text', text: scenario === 'image-favorite' ? 'Draw a scene' : 'Draw {{USER_INPUT}}' },
      variables: scenario === 'image-favorite' ? [] : [{ name: 'USER_INPUT', defaultValue: missing ? undefined : 'default article' }],
      assets: { examples: missing ? [] : [{ id: 'ex-001', parameters: { USER_INPUT: 'fixed article' } }] },
      meta: { type: scenario === 'image-favorite' ? 'image' : 'text' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const isLoadingExternalData = ref(false)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const scope = effectScope()
    try {
      scope.run(() => useAppPromptGardenImport({
        router, hasRestoredInitialState: ref(true), isLoadingExternalData,
        gardenBaseUrl: 'http://garden.local', arenaSession: { running: scenario === 'busy', replaceInput },
        basicSystemSession: useBasicSystemSession(pinia), basicUserSession,
        proMultiMessageSession: useProMultiMessageSession(pinia), proVariableSession: useProVariableSession(pinia),
        imageText2ImageSession: useImageText2ImageSession(pinia), imageImage2ImageSession: useImageImage2ImageSession(pinia),
        imageMultiImageSession: useImageMultiImageSession(pinia), optimizerCurrentVersions: ref([]), openSaveFavoriteDialog,
      }))
      await waitForCondition(() => router.replace.mock.calls.length > 0 || error.mock.calls.length > 0)
      if (missing || scenario === 'busy') {
        expect(replaceInput).not.toHaveBeenCalled()
        expect(currentRoute.value.query.importCode).toBe('BM-009')
        expect(error).toHaveBeenCalledTimes(1)
      } else if (scenario === 'image-favorite') {
        expect(replaceInput).not.toHaveBeenCalled()
        expect(openSaveFavoriteDialog.mock.calls[0][0].prefill).toMatchObject({ functionMode: 'image', imageSubMode: 'text2image' })
      } else {
        expect(replaceInput).toHaveBeenCalledWith('Draw fixed article', [])
        expect(currentRoute.value.path).toBe('/arena')
        expect(currentRoute.value.query.importCode).toBeUndefined()
        expect(error).not.toHaveBeenCalled()
      }
      expect(basicUserSession.prompt).toBe('Keep existing workspace')
      await waitForCondition(() => !isLoadingExternalData.value)
    } finally {
      scope.stop(); consoleError.mockRestore(); vi.unstubAllGlobals()
    }
  })
})

describe('useAppPromptGardenImport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('imports once when hasRestoredInitialState flips to true', async () => {
    const { pinia } = createTestPinia()

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    // Seed non-empty state so we can verify it gets cleared.
    basicSystemSession.updatePrompt('old')
    basicSystemSession.updateOptimizedResult({
      optimizedPrompt: 'old-opt',
      reasoning: 'old-r',
      chainId: 'old-chain',
      versionId: 'old-version',
    })
    basicSystemSession.updateTestContent('old-test')
    basicSystemSession.testVariantResults = {
      ...basicSystemSession.testVariantResults,
      a: { result: 'old-orig', reasoning: 'old-orig-r' },
      b: { result: 'old-opt', reasoning: 'old-opt-r' },
    }

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])

    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-001',
      subModeKey: 'basic-system',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/user', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'basic-system' },
          prompt: { format: 'text', text: 'IMPORTED' },
          variables: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      // Still restoring: should not fetch yet.
      expect(fetchMock).not.toHaveBeenCalled()

      // Restore completes without route changes: import should still happen.
      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://garden.local/api/public/prompt-source/NB-001')

      // Navigated to target workspace.
      expect(currentRoute.value.path).toBe('/basic/system')

      // Session updated + cleared.
      expect(basicSystemSession.prompt).toBe('IMPORTED')
      expect(basicSystemSession.optimizedPrompt).toBe('')
      expect(basicSystemSession.reasoning).toBe('')
      expect(basicSystemSession.chainId).toBe('')
      expect(basicSystemSession.versionId).toBe('')
      expect(basicSystemSession.testContent).toBe('')
      expect(basicSystemSession.testVariantResults.a).toEqual({ result: '', reasoning: '' })
      expect(basicSystemSession.testVariantResults.b).toEqual({ result: '', reasoning: '' })
      expect(optimizerCurrentVersions.value).toEqual([])

      // Import params removed from the URL.
      expect(currentRoute.value.query.importCode).toBeUndefined()
      expect(currentRoute.value.query.subModeKey).toBeUndefined()

      // External loading flag reset.
      expect(isLoadingExternalData.value).toBe(false)
    } finally {
      scope.stop()
    }
  })

  it('imports v1 schema messages + variables into pro-multi', async () => {
    const { pinia } = createTestPinia()

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    // Seed some state to ensure import resets pro-multi-specific fields.
    proMultiMessageSession.setMessageChainMap({ old: 'chain' })
    proMultiMessageSession.updateOptimizedResult({
      optimizedPrompt: 'old-opt',
      reasoning: 'old-r',
      chainId: 'old-chain',
      versionId: 'old-version',
    })
    proMultiMessageSession.testVariantResults = {
      ...proMultiMessageSession.testVariantResults,
      a: { result: 'old-orig', reasoning: 'old-orig-r' },
      b: { result: 'old-opt', reasoning: 'old-opt-r' },
    }
    proMultiMessageSession.setTemporaryVariable('topic', 'pizza')
    proMultiMessageSession.setTemporaryVariable('obsolete', 'should-delete')

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])

    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-PRO-001',
      // subModeKey intentionally omitted to exercise v1 optimizerTarget.subModeKey.
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const v1Payload = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'pro-multi' },
      prompt: {
        format: 'messages',
        messages: [
          {
            id: 'm1',
            role: 'system',
            content: 'You are a {{topic}} expert',
            originalContent: 'You are a {{topic}} expert',
          },
          {
            id: 'm2',
            role: 'assistant',
            content: 'OK',
            originalContent: 'OK',
          },
          {
            id: 'm3',
            role: 'user',
            content: 'Write it in {{format}} with a {{tone}} vibe',
            originalContent: 'Write it in {{format}} with a {{tone}} vibe',
          },
        ],
      },
      variables: [
        { name: 'topic', defaultValue: 'ice cream' },
        { name: 'format', defaultValue: 'markdown' },
        { name: 'tone' },
      ],
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(JSON.stringify(v1Payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      expect(fetchMock).not.toHaveBeenCalled()

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://garden.local/api/public/prompt-source/NB-PRO-001')

      // Navigated to target workspace.
      expect(currentRoute.value.path).toBe('/pro/multi')

      const expectedMessages: ConversationMessage[] = [
        {
          id: 'm1',
          role: 'system',
          content: 'You are a {{topic}} expert',
          originalContent: 'You are a {{topic}} expert',
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'OK',
          originalContent: 'OK',
        },
        {
          id: 'm3',
          role: 'user',
          content: 'Write it in {{format}} with a {{tone}} vibe',
          originalContent: 'Write it in {{format}} with a {{tone}} vibe',
        },
      ]

      // Session updated + persisted snapshot updated.
      expect(proMultiMessageSession.conversationMessagesSnapshot).toEqual(expectedMessages)

      // Auto-select latest system/user message.
      expect(proMultiMessageSession.selectedMessageId).toBe('m3')

      // Pro-multi state reset.
      expect(proMultiMessageSession.messageChainMap).toEqual({})
      expect(proMultiMessageSession.testVariantResults.a).toEqual({ result: '', reasoning: '' })
      expect(proMultiMessageSession.testVariantResults.b).toEqual({ result: '', reasoning: '' })
      expect(proMultiMessageSession.optimizedPrompt).toBe('')
      expect(proMultiMessageSession.reasoning).toBe('')
      expect(proMultiMessageSession.chainId).toBe('')
      expect(proMultiMessageSession.versionId).toBe('')

      // Variables are re-seeded from the import payload after clear-content runs.
      expect(proMultiMessageSession.getTemporaryVariable('topic')).toBe('ice cream')
      expect(proMultiMessageSession.getTemporaryVariable('format')).toBe('markdown')
      expect(proMultiMessageSession.getTemporaryVariable('tone')).toBe('')
      expect(proMultiMessageSession.getTemporaryVariable('obsolete')).toBeUndefined()

      // Import params removed from the URL.
      expect(currentRoute.value.query.importCode).toBeUndefined()
      expect(currentRoute.value.query.subModeKey).toBeUndefined()

      expect(isLoadingExternalData.value).toBe(false)
    } finally {
      scope.stop()
    }
  })

  it('imports v1 schema text + variables into pro-variable', async () => {
    const { pinia } = createTestPinia()

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    // Seed non-empty state so we can verify it gets cleared.
    proVariableSession.updatePrompt('old')
    proVariableSession.updateOptimizedResult({
      optimizedPrompt: 'old-opt',
      reasoning: 'old-r',
      chainId: 'old-chain',
      versionId: 'old-version',
    })
    proVariableSession.updateTestContent('old-test')
    proVariableSession.testVariantResults = {
      ...proVariableSession.testVariantResults,
      a: { result: 'old-orig', reasoning: 'old-orig-r' },
      b: { result: 'old-opt', reasoning: 'old-opt-r' },
    }

    // Existing values should be preserved.
    proVariableSession.setTemporaryVariable('name', 'Bob')
    proVariableSession.setTemporaryVariable('obsolete', 'should-delete')

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-PVAR-001',
      // subModeKey intentionally omitted to exercise v1 optimizerTarget.subModeKey.
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const v1Payload = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'pro-variable' },
      prompt: {
        format: 'text',
        text: 'Hello {{name}}',
      },
      variables: [
        { name: 'name', defaultValue: 'Alice' },
        { name: 'tone' },
      ],
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(JSON.stringify(v1Payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      expect(fetchMock).not.toHaveBeenCalled()

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://garden.local/api/public/prompt-source/NB-PVAR-001')

      expect(currentRoute.value.path).toBe('/pro/variable')

      // Prompt imported into pro-variable session.
      expect(proVariableSession.prompt).toBe('Hello {{name}}')

      // Session cleared.
      expect(proVariableSession.optimizedPrompt).toBe('')
      expect(proVariableSession.reasoning).toBe('')
      expect(proVariableSession.chainId).toBe('')
      expect(proVariableSession.versionId).toBe('')
      expect(proVariableSession.testContent).toBe('')
      expect(proVariableSession.testVariantResults.a).toEqual({ result: '', reasoning: '' })
      expect(proVariableSession.testVariantResults.b).toEqual({ result: '', reasoning: '' })

      // Variables are re-seeded from the import payload after clear-content runs.
      expect(proVariableSession.getTemporaryVariable('name')).toBe('Alice')
      expect(proVariableSession.getTemporaryVariable('tone')).toBe('')
      expect(proVariableSession.getTemporaryVariable('obsolete')).toBeUndefined()

      // Pro-variable import should not mutate pro-multi session messages.
      expect(proMultiMessageSession.conversationMessagesSnapshot).toEqual([])

      // Import params removed from the URL.
      expect(currentRoute.value.query.importCode).toBeUndefined()
      expect(currentRoute.value.query.subModeKey).toBeUndefined()
      expect(isLoadingExternalData.value).toBe(false)
    } finally {
      scope.stop()
    }
  })

  it('imports v1 schema text + variables into multiimage workspace', async () => {
    const { pinia } = createTestPinia({
      imageStorageService: {
        getMetadata: async () => null,
        saveImage: async () => {},
        listAllMetadata: async () => [],
        deleteImages: async () => {},
      } as unknown as never,
    })

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)
    const imageMultiImageSession = useImageMultiImageSession(pinia)

    imageMultiImageSession.updatePrompt('旧多图提示词')
    imageMultiImageSession.updateOptimizedResult({
      optimizedPrompt: '旧优化结果',
      reasoning: '旧推理',
      chainId: 'old-chain',
      versionId: 'old-version',
    })
    imageMultiImageSession.setTemporaryVariable('scene', 'obsolete')
    imageMultiImageSession.replaceInputImages([
      { b64: 'AAAA', mimeType: 'image/png' },
      { b64: 'BBBB', mimeType: 'image/jpeg' },
    ])

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-MULTI-001',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'image-multiimage' },
          prompt: { format: 'text', text: '请用图1和图2融合出一张新海报' },
          variables: [
            { name: 'subject', defaultValue: '图1中的人物' },
            { name: 'style', defaultValue: '图2的色调' },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          imageMultiImageSession,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(currentRoute.value.path).toBe('/image/multiimage')
      expect(imageMultiImageSession.originalPrompt).toBe('请用图1和图2融合出一张新海报')
      expect(imageMultiImageSession.optimizedPrompt).toBe('')
      expect(imageMultiImageSession.reasoning).toBe('')
      expect(imageMultiImageSession.chainId).toBe('')
      expect(imageMultiImageSession.versionId).toBe('')
      expect(imageMultiImageSession.inputImages).toEqual([])
      expect(imageMultiImageSession.temporaryVariables.subject).toBe('图1中的人物')
      expect(imageMultiImageSession.temporaryVariables.style).toBe('图2的色调')
      expect(imageMultiImageSession.temporaryVariables.scene).toBeUndefined()
    } finally {
      scope.stop()
    }
  })

  it('loads multiimage example input images when present', async () => {
    const { pinia } = createTestPinia({
      imageStorageService: {
        getMetadata: async () => null,
        saveImage: async () => {},
        listAllMetadata: async () => [],
        deleteImages: async () => {},
      } as unknown as never,
    })

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)
    const imageMultiImageSession = useImageMultiImageSession(pinia)

    imageMultiImageSession.replaceInputImages([
      { b64: 'OLD', mimeType: 'image/png' },
    ])

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-MULTI-EXAMPLE-001',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const firstImagePath = '/prompt-assets/NB-MULTI-EXAMPLE-001/examples/ex-001/01.png'
    const secondImagePath = '/prompt-assets/NB-MULTI-EXAMPLE-001/examples/ex-001/02.jpg'
    const firstImageUrl = `http://garden.local${firstImagePath}`
    const secondImageUrl = `http://garden.local${secondImagePath}`

    const v1Payload = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'image-multiimage' },
      prompt: { format: 'text', text: '请用图1和图2完成一张融合海报' },
      variables: [],
      assets: {
        examples: [
          {
            id: 'ex-001',
            inputImages: [firstImagePath, secondImagePath],
          },
        ],
      },
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = String(input)
      if (url === 'http://garden.local/api/public/prompt-source/NB-MULTI-EXAMPLE-001') {
        return new Response(JSON.stringify(v1Payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url === firstImageUrl) {
        return new Response(new Uint8Array([0, 1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      }
      if (url === secondImageUrl) {
        return new Response(new Uint8Array([4, 5, 6, 7]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          imageMultiImageSession,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(currentRoute.value.path).toBe('/image/multiimage')
      expect(imageMultiImageSession.inputImages).toHaveLength(2)
      expect(imageMultiImageSession.inputImages[0]).toMatchObject({
        b64: 'AAECAw==',
        mimeType: 'image/png',
      })
      expect(imageMultiImageSession.inputImages[1]).toMatchObject({
        b64: 'BAUGBw==',
        mimeType: 'image/jpeg',
      })
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      scope.stop()
    }
  })

  it('applies default example parameters into pro-variable temporary variables', async () => {
    const { pinia } = createTestPinia()

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    // Seed existing values; example parameters should override them.
    proVariableSession.setTemporaryVariable('name', 'Bob')

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-PVAR-EX-001',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const v1Payload = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'pro-variable' },
      prompt: {
        format: 'text',
        text: 'Hello {{name}}',
      },
      variables: [{ name: 'name' }, { name: 'tone' }],
      assets: {
        examples: [
          {
            id: 'ex-001',
            parameters: {
              name: 'Alice',
              tone: 'friendly',
            },
          },
        ],
      },
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(JSON.stringify(v1Payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(currentRoute.value.path).toBe('/pro/variable')
      expect(proVariableSession.prompt).toBe('Hello {{name}}')

      // Example parameters override existing values.
      expect(proVariableSession.getTemporaryVariable('name')).toBe('Alice')
      expect(proVariableSession.getTemporaryVariable('tone')).toBe('friendly')
    } finally {
      scope.stop()
    }
  })

  it('applies selected inline example suffix parameters when provided', async () => {
    const { pinia } = createTestPinia()

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-PVAR-EX-002@ex-b',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const v1Payload = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'pro-variable' },
      prompt: {
        format: 'text',
        text: 'Hello {{name}}',
      },
      variables: [{ name: 'name' }],
      assets: {
        examples: [
          { id: 'ex-a', parameters: { name: 'Alice' } },
          { id: 'ex-b', parameters: { name: 'Charlie' } },
        ],
      },
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(JSON.stringify(v1Payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(currentRoute.value.path).toBe('/pro/variable')
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://garden.local/api/public/prompt-source/NB-PVAR-EX-002')
      expect(proVariableSession.getTemporaryVariable('name')).toBe('Charlie')

      // Import params removed from the URL.
      expect(currentRoute.value.query.importCode).toBeUndefined()
      expect(currentRoute.value.query.exampleId).toBeUndefined()
    } finally {
      scope.stop()
    }
  })

  it('injects {{var}} placeholders into image temporary variables', async () => {
    const { pinia } = createTestPinia({
      // Image sessions require ImageStorageService to persist.
      // Provide a minimal stub to avoid console warnings during tests.
      imageStorageService: {
        listAllMetadata: async () => [],
        deleteImages: async () => {},
      } as unknown as never,
    })

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    imageText2ImageSession.updateOptimizedResult({
      optimizedPrompt: 'old-opt',
      reasoning: 'old-r',
      chainId: 'old-chain',
      versionId: 'old-version',
    })
    imageText2ImageSession.testVariantResults = {
      ...imageText2ImageSession.testVariantResults,
      a: { result: 'old-a', reasoning: 'old-a-r' },
      b: { result: 'old-b', reasoning: 'old-b-r' },
    }

    // Existing values should be preserved.
    imageText2ImageSession.setTemporaryVariable('season', 'winter')
    imageText2ImageSession.setTemporaryVariable('obsolete', 'should-delete')

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])

    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-IMG-001',
      subModeKey: 'image-text2image',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'image-text2image' },
          prompt: { format: 'text', text: 'Draw a {{season}} {{style}} landscape' },
          variables: [{ name: 'season' }, { name: 'style' }],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      expect(fetchMock).not.toHaveBeenCalled()

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(currentRoute.value.path).toBe('/image/text2image')

      // Prompt imported into image session.
      expect(imageText2ImageSession.originalPrompt).toBe('Draw a {{season}} {{style}} landscape')
      expect(imageText2ImageSession.optimizedPrompt).toBe('')
      expect(imageText2ImageSession.reasoning).toBe('')
      expect(imageText2ImageSession.chainId).toBe('')
      expect(imageText2ImageSession.versionId).toBe('')
      expect(imageText2ImageSession.testVariantResults.a).toBeNull()
      expect(imageText2ImageSession.testVariantResults.b).toBeNull()

      // Variables are re-seeded from the import payload after clear-content runs.
      expect(imageText2ImageSession.getTemporaryVariable('season')).toBe('')

      // Missing variable names are injected as empty strings.
      expect(imageText2ImageSession.getTemporaryVariable('style')).toBe('')

      // Variables not present in the import payload are removed.
      expect(imageText2ImageSession.getTemporaryVariable('obsolete')).toBeUndefined()
    } finally {
      scope.stop()
    }
  })

  it('loads image2image example input image when present', async () => {
    const { pinia } = createTestPinia({
      imageStorageService: {
        getMetadata: async () => null,
        saveImage: async () => {},
        listAllMetadata: async () => [],
        deleteImages: async () => {},
      } as unknown as never,
    })

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    imageImage2ImageSession.updatePrompt('old prompt')
    imageImage2ImageSession.updateOptimizedResult({
      optimizedPrompt: 'old-opt',
      reasoning: 'old-r',
      chainId: 'old-chain',
      versionId: 'old-version',
    })
    imageImage2ImageSession.updateInputImage({
      imageB64: 'old-b64',
      imageId: null,
      mimeType: 'image/png',
    })
    imageImage2ImageSession.testVariantResults = {
      ...imageImage2ImageSession.testVariantResults,
      a: { result: 'old-a', reasoning: 'old-a-r' },
      b: { result: 'old-b', reasoning: 'old-b-r' },
    }
    imageImage2ImageSession.setTemporaryVariable('obsolete', 'should-delete')

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-I2I-001',
      subModeKey: 'image-image2image',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const inputAssetPath = '/prompt-assets/NB-I2I-001/examples/ex-001/01.png'
    const inputAssetUrl = `http://garden.local${inputAssetPath}`

    const v1Payload = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'image-image2image' },
      prompt: { format: 'text', text: 'Transform the image' },
      variables: [],
      assets: {
        examples: [
          {
            id: 'ex-001',
            inputImages: [inputAssetPath],
          },
        ],
      },
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = String(input)
      if (url === 'http://garden.local/api/public/prompt-source/NB-I2I-001') {
        return new Response(JSON.stringify(v1Payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url === inputAssetUrl) {
        return new Response(new Uint8Array([0, 1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(currentRoute.value.path).toBe('/image/image2image')
      expect(imageImage2ImageSession.originalPrompt).toBe('Transform the image')
      expect(imageImage2ImageSession.optimizedPrompt).toBe('')
      expect(imageImage2ImageSession.reasoning).toBe('')
      expect(imageImage2ImageSession.chainId).toBe('')
      expect(imageImage2ImageSession.versionId).toBe('')
      expect(imageImage2ImageSession.testVariantResults.a).toBeNull()
      expect(imageImage2ImageSession.testVariantResults.b).toBeNull()
      expect(imageImage2ImageSession.getTemporaryVariable('obsolete')).toBeUndefined()

      // [0,1,2,3] -> AAECAw==
      expect(imageImage2ImageSession.inputImageB64).toBe('AAECAw==')
      expect(imageImage2ImageSession.inputImageMime).toBe('image/png')

      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      scope.stop()
    }
  })

  it('clears temporary variables when importing an empty variable list into pro-variable', async () => {
    const { pinia } = createTestPinia()

    // Avoid console.warn from useToast (tests fail on console.warn).
    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    // Seed non-empty variables; they should be cleared because the import has no variables.
    proVariableSession.setTemporaryVariable('keep', '1')
    proVariableSession.setTemporaryVariable('alsoRemove', '2')

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([makeDummyRecord()])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-PVAR-EMPTY-001',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const v1Payload = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'pro-variable' },
      prompt: {
        format: 'text',
        text: 'Hello',
      },
      variables: [],
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(JSON.stringify(v1Payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          optimizerCurrentVersions,
        })
      })

      expect(fetchMock).not.toHaveBeenCalled()

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(currentRoute.value.path).toBe('/pro/variable')
      expect(proVariableSession.prompt).toBe('Hello')

      expect(proVariableSession.getTemporaryVariable('keep')).toBeUndefined()
      expect(proVariableSession.getTemporaryVariable('alsoRemove')).toBeUndefined()
    } finally {
      scope.stop()
    }
  })

  it('auto-saves imported prompt into favorites when saveToFavorites=1', async () => {
    const { pinia } = createTestPinia()

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-SAVE-001',
      saveToFavorites: '1',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const favoriteManager = {
      getFavorites: vi.fn(async (): Promise<FavoritePrompt[]> => []),
      getCategories: vi.fn(async () => []),
      addCategory: vi.fn(async ({ name }: { name: string }) => `cat-${name}`),
      addFavorite: vi.fn(async (
        _favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>
      ) => 'fav-new'),
      updateFavorite: vi.fn(async (_id: string, _updates: Partial<FavoritePrompt>) => {}),
    }

    const imageStorageService = {
      getMetadata: vi.fn(async () => null),
      saveImage: vi.fn(async () => 'saved-image-id'),
    } as any

    const v1Payload = {
      id: 'prompt-001',
      importCode: 'NB-SAVE-001',
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      optimizerTarget: { subModeKey: 'basic-system' },
      prompt: { format: 'text', text: 'IMPORTED PROMPT' },
      variables: [
        {
          name: 'topic',
          description: 'topic desc',
          type: 'string',
          required: true,
          defaultValue: 'travel',
          source: 'frontmatter',
        },
      ],
      assets: {
        cover: {
          url: '/prompt-assets/cover.png',
        },
        showcases: [
          {
            id: 'show-1',
            images: ['/prompt-assets/show-1.png'],
          },
        ],
        examples: [
          {
            id: 'ex-1',
            inputImages: ['/prompt-assets/in-1.png'],
            parameters: {
              topic: 'city',
            },
          },
        ],
      },
      meta: {
        title: 'Garden Prompt Title',
        description: 'Garden Prompt Description',
        tags: ['travel', 'city'],
        categoryPath: ['图像创作', '海报'],
      },
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(JSON.stringify(v1Payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          getFavoriteManager: () => favoriteManager,
          getFavoriteImageStorageService: () => imageStorageService,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(favoriteManager.getFavorites).toHaveBeenCalledTimes(1)
      expect(favoriteManager.updateFavorite).not.toHaveBeenCalled()
      expect(favoriteManager.addFavorite).toHaveBeenCalledTimes(1)

      const savedArg = favoriteManager.addFavorite.mock.calls[0]![0] as Record<string, unknown>
      expect(savedArg.content).toBe('IMPORTED PROMPT')
      expect(savedArg.functionMode).toBe('basic')
      expect(savedArg.optimizationMode).toBe('system')
      expect(savedArg.category).toBe('cat-海报')
      expect(savedArg.tags).toEqual(['travel', 'city'])
      expect(favoriteManager.addCategory).toHaveBeenCalledTimes(2)
      expect(favoriteManager.addCategory).toHaveBeenNthCalledWith(1, expect.objectContaining({
        name: '图像创作',
        parentId: undefined,
      }))
      expect(favoriteManager.addCategory).toHaveBeenNthCalledWith(2, expect.objectContaining({
        name: '海报',
        parentId: 'cat-图像创作',
      }))

      const metadata = savedArg.metadata as Record<string, unknown>
      const snapshot = metadata.gardenSnapshot as Record<string, unknown>
      expect(snapshot.importCode).toBe('NB-SAVE-001')
      expect(snapshot.gardenBaseUrl).toBe('http://garden.local')

      const media = metadata.media as Record<string, unknown>
      expect(String(media.coverAssetId || '')).toMatch(/^img_/)
      const mediaAssetIds = media.assetIds as unknown[]
      expect(Array.isArray(mediaAssetIds)).toBe(true)
      expect(mediaAssetIds.length).toBeGreaterThan(0)

      const snapshotAssets = snapshot.assets as Record<string, unknown>
      const cover = snapshotAssets.cover as Record<string, unknown>
      expect(String(cover.assetId || '')).toMatch(/^img_/)
      expect(cover.url).toBeUndefined()

      const showcases = snapshotAssets.showcases as Array<Record<string, unknown>>
      const showcaseImageAssetIds = showcases[0]?.imageAssetIds as unknown[]
      expect(showcaseImageAssetIds).toHaveLength(1)
      expect(String(showcaseImageAssetIds[0] || '')).toMatch(/^img_/)

      const examples = snapshotAssets.examples as Array<Record<string, unknown>>
      const inputImageAssetIds = examples[0]?.inputImageAssetIds as unknown[]
      expect(inputImageAssetIds).toHaveLength(1)
      expect(String(inputImageAssetIds[0] || '')).toMatch(/^img_/)
      expect(imageStorageService.saveImage).toHaveBeenCalled()

      // saveToFavorites 查询参数会和 import 参数一起清理。
      expect(currentRoute.value.query.importCode).toBeUndefined()
      expect(currentRoute.value.query.saveToFavorites).toBeUndefined()
    } finally {
      scope.stop()
    }
  })

  it('opens save-favorite dialog when saveToFavorites=confirm', async () => {
    const { pinia } = createTestPinia()

    const loadingDestroy = vi.fn()
    const createReactive = (destroy = vi.fn()): MessageReactive => ({
      destroy,
    } as unknown as MessageReactive)
    const messageApi = {
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive(loadingDestroy)),
    }
    setGlobalMessageApi(messageApi)

    const basicSystemSession = useBasicSystemSession(pinia)
    basicSystemSession.updatePrompt('KEEP WORKSPACE')
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-CONFIRM-001',
      saveToFavorites: 'confirm',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const favoriteManager = {
      getFavorites: vi.fn(async (): Promise<FavoritePrompt[]> => []),
      getCategories: vi.fn(async () => [
        {
          id: 'cat-text-root',
          name: '文本生成',
          parentId: undefined,
          createdAt: Date.now(),
          sortOrder: 0,
        },
        {
          id: 'cat-marketing-leaf',
          name: '营销文案',
          parentId: 'cat-text-root',
          createdAt: Date.now(),
          sortOrder: 0,
        },
      ]),
      addCategory: vi.fn(async ({ name }: { name: string }) => `cat-${name}`),
      addFavorite: vi.fn(async (
        _favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>
      ) => 'fav-new'),
      updateFavorite: vi.fn(async (_id: string, _updates: Partial<FavoritePrompt>) => {}),
    }

    const openSaveFavoriteDialog = vi.fn()

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          id: 'prompt-confirm-1',
          importCode: 'NB-CONFIRM-001',
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'basic-system' },
          prompt: { format: 'text', text: 'CONFIRM CONTENT' },
          variables: [],
          meta: {
            title: 'Confirm Prompt Title',
            description: 'Confirm Prompt Description',
            tags: ['confirm', 'garden'],
            categoryPath: ['文本生成', '营销文案'],
            categoryKey: '文本生成',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          getFavoriteManager: () => favoriteManager,
          openSaveFavoriteDialog,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(openSaveFavoriteDialog).toHaveBeenCalledTimes(1)
      expect(messageApi.info).toHaveBeenCalledWith(
        String(i18n.global.t('common.promptGarden.importingStatus')),
        expect.objectContaining({
          duration: 0,
          closable: false,
        })
      )
      expect(loadingDestroy).toHaveBeenCalledTimes(1)
      expect(basicSystemSession.prompt).toBe('KEEP WORKSPACE')
      const savedArg = openSaveFavoriteDialog.mock.calls[0]?.[0] as {
        content: string
        prefill?: {
          title?: string
          description?: string
          tags?: string[]
          category?: string
          functionMode?: string
          metadata?: Record<string, unknown>
        }
      }

      expect(savedArg.content).toBe('CONFIRM CONTENT')
      expect(savedArg.prefill?.title).toBe('Confirm Prompt Title')
      expect(savedArg.prefill?.description).toBe('Confirm Prompt Description')
      expect(savedArg.prefill?.tags).toEqual(['confirm', 'garden'])
      expect(savedArg.prefill?.category).toBe('cat-marketing-leaf')
      expect(savedArg.prefill?.functionMode).toBe('basic')
      expect(savedArg.prefill?.metadata?.gardenSnapshot).toBeTruthy()

      expect(favoriteManager.getFavorites).not.toHaveBeenCalled()
      expect(favoriteManager.getCategories).toHaveBeenCalledTimes(1)
      expect(favoriteManager.addFavorite).not.toHaveBeenCalled()
      expect(favoriteManager.updateFavorite).not.toHaveBeenCalled()

      expect(currentRoute.value.query.importCode).toBeUndefined()
      expect(currentRoute.value.query.saveToFavorites).toBeUndefined()
    } finally {
      scope.stop()
    }
  })

  it('auto-saves to favorites with URL media fallback when snapshot image persistence fails', async () => {
    const { pinia } = createTestPinia()

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    basicSystemSession.updatePrompt('KEEP WORKSPACE')
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-SAVE-FAIL-001',
      saveToFavorites: '1',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const favoriteManager = {
      getFavorites: vi.fn(async (): Promise<FavoritePrompt[]> => []),
      getCategories: vi.fn(async () => []),
      addCategory: vi.fn(async ({ name }: { name: string }) => `cat-${name}`),
      addFavorite: vi.fn(async (
        _favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>
      ) => 'fav-new'),
      updateFavorite: vi.fn(async (_id: string, _updates: Partial<FavoritePrompt>) => {}),
    }

    const imageStorageService = {
      getMetadata: vi.fn(async () => null),
      saveImage: vi.fn(async () => {
        throw new Error('boom')
      }),
    } as any

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          id: 'prompt-asset-fail-1',
          importCode: 'NB-SAVE-FAIL-001',
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'basic-system' },
          prompt: { format: 'text', text: 'PROMPT WITH ASSET FAILURE' },
          variables: [],
          assets: {
            cover: {
              url: '/prompt-assets/cover.png',
            },
            showcases: [
              {
                id: 'show-1',
                images: ['/prompt-assets/show-1.png'],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          getFavoriteManager: () => favoriteManager,
          getFavoriteImageStorageService: () => imageStorageService,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(favoriteManager.getFavorites).toHaveBeenCalledTimes(1)
      expect(basicSystemSession.prompt).toBe('KEEP WORKSPACE')
      expect(favoriteManager.addFavorite).toHaveBeenCalledTimes(1)
      expect(favoriteManager.updateFavorite).not.toHaveBeenCalled()
      const favoriteArg = favoriteManager.addFavorite.mock.calls[0]?.[0]
      expect(favoriteArg?.metadata?.media).toEqual({
        coverAssetId: undefined,
        coverUrl: 'http://garden.local/prompt-assets/cover.png',
        assetIds: [],
        urls: ['http://garden.local/prompt-assets/show-1.png'],
      })
    } finally {
      scope.stop()
    }
  })

  it('opens save-favorite dialog with URL media fallback when snapshot image persistence fails', async () => {
    const { pinia } = createTestPinia()

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-CONFIRM-FAIL-001',
      saveToFavorites: 'confirm',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const openSaveFavoriteDialog = vi.fn()
    const imageStorageService = {
      getMetadata: vi.fn(async () => null),
      saveImage: vi.fn(async () => {
        throw new Error('boom')
      }),
    } as any

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          id: 'prompt-confirm-fail-1',
          importCode: 'NB-CONFIRM-FAIL-001',
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'basic-system' },
          prompt: { format: 'text', text: 'CONFIRM CONTENT WITH IMAGE' },
          variables: [],
          assets: {
            cover: {
              url: '/prompt-assets/cover.png',
            },
            showcases: [
              {
                id: 'show-1',
                images: ['/prompt-assets/show-1.png'],
              },
            ],
          },
          meta: {
            title: 'Confirm Prompt Title',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          getFavoriteImageStorageService: () => imageStorageService,
          openSaveFavoriteDialog,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(openSaveFavoriteDialog).toHaveBeenCalledTimes(1)
      const savedArg = openSaveFavoriteDialog.mock.calls[0]?.[0] as {
        prefill?: {
          metadata?: Record<string, unknown>
        }
      }

      expect(savedArg.prefill?.metadata?.media).toEqual({
        coverAssetId: undefined,
        coverUrl: 'http://garden.local/prompt-assets/cover.png',
        assetIds: [],
        urls: ['http://garden.local/prompt-assets/show-1.png'],
      })
    } finally {
      scope.stop()
    }
  })

  it('does not auto-save when saveToFavorites flag is absent', async () => {
    const { pinia } = createTestPinia()

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-NO-SAVE-001',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const favoriteManager = {
      getFavorites: vi.fn(async (): Promise<FavoritePrompt[]> => []),
      getCategories: vi.fn(async () => []),
      addCategory: vi.fn(async ({ name }: { name: string }) => `cat-${name}`),
      addFavorite: vi.fn(async (
        _favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>
      ) => 'fav-new'),
      updateFavorite: vi.fn(async (_id: string, _updates: Partial<FavoritePrompt>) => {}),
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'basic-system' },
          prompt: { format: 'text', text: 'NO SAVE PROMPT' },
          variables: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          getFavoriteManager: () => favoriteManager,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(favoriteManager.getFavorites).not.toHaveBeenCalled()
      expect(favoriteManager.addFavorite).not.toHaveBeenCalled()
      expect(favoriteManager.updateFavorite).not.toHaveBeenCalled()
    } finally {
      scope.stop()
    }
  })

  it('upserts existing favorite by gardenSnapshot importCode + gardenBaseUrl', async () => {
    const { pinia } = createTestPinia()

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    setGlobalMessageApi({
      success: vi.fn(() => createReactive()),
      error: vi.fn(() => createReactive()),
      warning: vi.fn(() => createReactive()),
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-SAVE-UPSERT-001',
      saveToFavorites: 'true',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/pro/multi', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const existingFavorite: FavoritePrompt = {
      id: 'fav-existing',
      title: 'old',
      content: 'old',
      createdAt: 1,
      updatedAt: 1,
      tags: [],
      useCount: 0,
      functionMode: 'basic',
      optimizationMode: 'system',
      metadata: {
        gardenSnapshot: {
          importCode: 'NB-SAVE-UPSERT-001',
          gardenBaseUrl: 'http://garden.local',
        },
      },
    }

    const favoriteManager = {
      getFavorites: vi.fn(async (): Promise<FavoritePrompt[]> => [
        existingFavorite,
      ]),
      getCategories: vi.fn(async () => []),
      addCategory: vi.fn(async ({ name }: { name: string }) => `cat-${name}`),
      addFavorite: vi.fn(async (
        _favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>
      ) => 'fav-new'),
      updateFavorite: vi.fn(async (_id: string, _updates: Partial<FavoritePrompt>) => {}),
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'pro-multi' },
          prompt: {
            format: 'messages',
            messages: [
              {
                id: 'm1',
                role: 'system',
                content: 'System content',
              },
              {
                id: 'm2',
                role: 'user',
                content: 'User content',
              },
            ],
          },
          variables: [],
          meta: {
            title: 'new title',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          getFavoriteManager: () => favoriteManager,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(favoriteManager.getFavorites).toHaveBeenCalledTimes(1)
      expect(favoriteManager.addFavorite).not.toHaveBeenCalled()
      expect(favoriteManager.updateFavorite).toHaveBeenCalledTimes(1)
      expect(favoriteManager.updateFavorite).toHaveBeenCalledWith(
        'fav-existing',
        expect.objectContaining({
          content: '[system] System content\n\n[user] User content',
          functionMode: 'context',
          optimizationMode: 'system',
          metadata: expect.objectContaining({
            gardenSnapshot: expect.objectContaining({
              importCode: 'NB-SAVE-UPSERT-001',
              gardenBaseUrl: 'http://garden.local',
            }),
          }),
        })
      )
    } finally {
      scope.stop()
    }
  })

  it('shows a warning when Prompt Garden auto-save to favorites fails', async () => {
    const { pinia } = createTestPinia()

    const createReactive = (): MessageReactive => ({
      destroy: () => {},
    } as unknown as MessageReactive)
    const successMock = vi.fn(() => createReactive())
    const errorMock = vi.fn(() => createReactive())
    const warningMock = vi.fn(() => createReactive())
    setGlobalMessageApi({
      success: successMock,
      error: errorMock,
      warning: warningMock,
      info: vi.fn(() => createReactive()),
    })

    const basicSystemSession = useBasicSystemSession(pinia)
    const basicUserSession = useBasicUserSession(pinia)
    const proMultiMessageSession = useProMultiMessageSession(pinia)
    const proVariableSession = useProVariableSession(pinia)
    const imageText2ImageSession = useImageText2ImageSession(pinia)
    const imageImage2ImageSession = useImageImage2ImageSession(pinia)

    const optimizerCurrentVersions = ref<PromptRecordChain['versions']>([])
    const hasRestoredInitialState = ref(false)
    const isLoadingExternalData = ref(false)

    const query: LocationQuery = {
      importCode: 'NB-AUTO-SAVE-FAIL-001',
      saveToFavorites: 'true',
    }

    const currentRoute = ref<RouteLocationNormalizedLoaded>(makeRoute('/basic/system', query))

    let replaceResolve: (() => void) | undefined
    const replaceDone = new Promise<void>((resolve) => {
      replaceResolve = resolve
    })

    const push: Router['push'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      return undefined
    })

    const replace: Router['replace'] = vi.fn(async (to) => {
      applyNavigation(currentRoute, to)
      replaceResolve?.()
      return undefined
    })

    const router: Pick<Router, 'currentRoute' | 'push' | 'replace'> = {
      currentRoute,
      push,
      replace,
    }

    const favoriteManager = {
      getFavorites: vi.fn(async (): Promise<FavoritePrompt[]> => []),
      getCategories: vi.fn(async () => []),
      addCategory: vi.fn(async ({ name }: { name: string }) => `cat-${name}`),
      addFavorite: vi.fn(async () => {
        throw new Error('favorites payload exceeds hard limit')
      }),
      updateFavorite: vi.fn(async (_id: string, _updates: Partial<FavoritePrompt>) => {}),
    }

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => {
      return new Response(
        JSON.stringify({
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          optimizerTarget: { subModeKey: 'basic-system' },
          prompt: { format: 'text', text: 'AUTO SAVE FAIL PROMPT' },
          variables: [],
          meta: {
            title: 'Auto Save Fail Prompt',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = effectScope()
    try {
      scope.run(() => {
        useAppPromptGardenImport({
          router,
          hasRestoredInitialState,
          isLoadingExternalData,
          gardenBaseUrl: 'http://garden.local',
          basicSystemSession,
          basicUserSession,
          proMultiMessageSession,
          proVariableSession,
          imageText2ImageSession,
          imageImage2ImageSession,
          getFavoriteManager: () => favoriteManager,
          optimizerCurrentVersions,
        })
      })

      hasRestoredInitialState.value = true

      await replaceDone
      await waitForCondition(() => isLoadingExternalData.value === false)

      expect(favoriteManager.getFavorites).toHaveBeenCalledTimes(1)
      expect(favoriteManager.addFavorite).toHaveBeenCalledTimes(1)
      expect(warningMock).toHaveBeenCalledTimes(1)
      expect(warningMock.mock.calls[0]?.[0]).toBe(
        String(i18n.global.t('toast.warning.promptGardenFavoriteSaveFailed')),
      )
      expect(errorMock).not.toHaveBeenCalled()
      expect(successMock).toHaveBeenCalled()
    } finally {
      scope.stop()
    }
  })
})
