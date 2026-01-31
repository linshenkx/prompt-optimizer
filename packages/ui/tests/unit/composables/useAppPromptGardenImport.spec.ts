import { describe, it, expect, afterEach, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type {
  LocationQuery,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  Router,
} from 'vue-router'
import type { ConversationMessage, PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import type { MessageReactive } from 'naive-ui'

import { createTestPinia } from '../../utils/pinia-test-helpers'
import { useBasicSystemSession } from '../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../src/stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../src/stores/session/useProVariableSession'
import { useImageText2ImageSession } from '../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../src/stores/session/useImageImage2ImageSession'
import { useAppPromptGardenImport } from '../../../src/composables/app/useAppPromptGardenImport'
import { setGlobalMessageApi } from '../../../src/composables/ui/useToast'

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
    basicSystemSession.updateTestResults({
      originalResult: 'old-orig',
      originalReasoning: 'old-orig-r',
      optimizedResult: 'old-opt',
      optimizedReasoning: 'old-opt-r',
    })

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
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://garden.local/api/prompt-source/NB-001')

      // Navigated to target workspace.
      expect(currentRoute.value.path).toBe('/basic/system')

      // Session updated + cleared.
      expect(basicSystemSession.prompt).toBe('IMPORTED')
      expect(basicSystemSession.optimizedPrompt).toBe('')
      expect(basicSystemSession.reasoning).toBe('')
      expect(basicSystemSession.chainId).toBe('')
      expect(basicSystemSession.versionId).toBe('')
      expect(basicSystemSession.testContent).toBe('')
      expect(basicSystemSession.testResults).toBe(null)
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
    proMultiMessageSession.updateTestResults({
      originalResult: 'old-orig',
      originalReasoning: 'old-orig-r',
      optimizedResult: 'old-opt',
      optimizedReasoning: 'old-opt-r',
    })
    proMultiMessageSession.setTemporaryVariable('topic', 'pizza')

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
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://garden.local/api/prompt-source/NB-PRO-001')

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
      expect(proMultiMessageSession.testResults).toBe(null)
      expect(proMultiMessageSession.optimizedPrompt).toBe('')
      expect(proMultiMessageSession.reasoning).toBe('')
      expect(proMultiMessageSession.chainId).toBe('')
      expect(proMultiMessageSession.versionId).toBe('')

      // Variables injected from schema; existing values preserved.
      expect(proMultiMessageSession.getTemporaryVariable('topic')).toBe('pizza')
      expect(proMultiMessageSession.getTemporaryVariable('format')).toBe('markdown')
      expect(proMultiMessageSession.getTemporaryVariable('tone')).toBe('')

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
    proVariableSession.updateTestResults({
      originalResult: 'old-orig',
      originalReasoning: 'old-orig-r',
      optimizedResult: 'old-opt',
      optimizedReasoning: 'old-opt-r',
    })

    // Existing values should be preserved.
    proVariableSession.setTemporaryVariable('name', 'Bob')

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
      expect(fetchMock.mock.calls[0]?.[0]).toBe('http://garden.local/api/prompt-source/NB-PVAR-001')

      expect(currentRoute.value.path).toBe('/pro/variable')

      // Prompt imported into pro-variable session.
      expect(proVariableSession.prompt).toBe('Hello {{name}}')

      // Session cleared.
      expect(proVariableSession.optimizedPrompt).toBe('')
      expect(proVariableSession.reasoning).toBe('')
      expect(proVariableSession.chainId).toBe('')
      expect(proVariableSession.versionId).toBe('')
      expect(proVariableSession.testContent).toBe('')
      expect(proVariableSession.testResults).toBe(null)

      // Variables injected from schema; existing values preserved.
      expect(proVariableSession.getTemporaryVariable('name')).toBe('Bob')
      expect(proVariableSession.getTemporaryVariable('tone')).toBe('')

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

    // Existing values should be preserved.
    imageText2ImageSession.setTemporaryVariable('season', 'winter')

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

      // The variable key exists; existing value preserved.
      expect(imageText2ImageSession.getTemporaryVariable('season')).toBe('winter')

      // Missing variable names are injected as empty strings.
      expect(imageText2ImageSession.getTemporaryVariable('style')).toBe('')
    } finally {
      scope.stop()
    }
  })
})
