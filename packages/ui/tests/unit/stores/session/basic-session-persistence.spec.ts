import { describe, it, expect, vi } from 'vitest'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../../src/stores/session/useBasicUserSession'
import { createPreferenceServiceStub, createTestPinia } from '../../../utils/pinia-test-helpers'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'

describe('Session stores (basic) persistence', () => {
  it('basic-system clearContent removes derived content and test image while preserving workspace selections', async () => {
    const { pinia } = createTestPinia()
    const store = useBasicSystemSession(pinia)

    store.updatePrompt('prompt')
    store.updateOptimizedResult({ optimizedPrompt: 'optimized', reasoning: 'reasoning', chainId: 'chain', versionId: 'version' })
    store.updateTestContent('test input')
    store.updateTestImage('raw-image', 'image/png', 'asset-image')
    store.updateOptimizeModel('opt-model')
    store.updateTestModel('test-model')
    store.updateTemplate('template')
    store.updateIterateTemplate('iterate-template')
    store.setMainSplitLeftPct(42)
    store.setTestColumnCount(4)
    store.updateTestVariant('a', { modelKey: 'variant-model' })

    store.clearContent()

    expect(store.prompt).toBe('')
    expect(store.optimizedPrompt).toBe('')
    expect(store.reasoning).toBe('')
    expect(store.chainId).toBe('')
    expect(store.versionId).toBe('')
    expect(store.testContent).toBe('')
    expect(store.testImageB64).toBeNull()
    expect(store.testImageMimeType).toBe('')
    expect(store.testImageAssetId).toBeNull()
    expect(store.testVariantResults.a).toEqual({ result: '', reasoning: '' })
    expect(store.selectedOptimizeModelKey).toBe('opt-model')
    expect(store.selectedTestModelKey).toBe('test-model')
    expect(store.selectedTemplateId).toBe('template')
    expect(store.selectedIterateTemplateId).toBe('iterate-template')
    expect(store.layout).toEqual({ mainSplitLeftPct: 42, testColumnCount: 4 })
    expect(store.testVariants.find((variant) => variant.id === 'a')?.modelKey).toBe('variant-model')

    // Drain best-effort saves queued by synchronous update actions.
    await store.saveSession()

    store.updateTestImage('reset-image', 'image/jpeg', 'asset-reset')
    store.reset()
    expect(store.testImageB64).toBeNull()
    expect(store.testImageMimeType).toBe('')
    expect(store.testImageAssetId).toBeNull()
    await store.saveSession()
  })

  it('basic-system saveSession writes snapshot to preferenceService', async () => {
    const set = vi.fn(async () => {})

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(_key: string, defaultValue: T) => defaultValue,
        set,
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
        getAll: async () => ({}),
        exportData: async () => ({}),
        importData: async () => {},
        getDataType: async () => 'preference',
        validateData: async () => true,
      } as any
    })

    const store = useBasicSystemSession(pinia)
    store.updatePrompt('p')
    store.updateOptimizedResult({ optimizedPrompt: 'o', reasoning: 'r', chainId: 'c', versionId: 'v' })
    store.updateTestContent('t')
    store.updateTemplate('tpl')
    store.updateIterateTemplate('tpl-iter')

    await store.saveSession()

    expect(set).toHaveBeenCalled()
    const lastCall = set.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('session/v1/basic-system')

    const raw = lastCall?.[1]
    const saved =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, unknown> | undefined) || {}
    expect(saved).toMatchObject({
      prompt: 'p',
      optimizedPrompt: 'o',
      reasoning: 'r',
      chainId: 'c',
      versionId: 'v',
      testContent: 't',
      selectedTemplateId: 'tpl',
      selectedIterateTemplateId: 'tpl-iter',
    })
    expect(saved).not.toHaveProperty('testImageB64')
  })

  it('basic-system clearAssetBinding persists removal even when optimized fields are unchanged', async () => {
    const set = vi.fn(async () => {})

    const { pinia } = createTestPinia({
      preferenceService: createPreferenceServiceStub({ set }),
    })

    const store = useBasicSystemSession(pinia)
    store.updateAssetBinding(
      { assetId: 'asset-basic', versionId: 'v1', status: 'linked' },
      { kind: 'favorite', id: 'favorite-basic' },
    )
    set.mockClear()

    store.clearAssetBinding()
    await store.saveSession()

    expect(store.assetBinding).toBeUndefined()
    expect(store.origin).toBeUndefined()
    expect(set).toHaveBeenCalled()

    const lastCall = set.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('session/v1/basic-system')

    const raw = lastCall?.[1]
    const saved =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, unknown> | undefined) || {}
    expect(saved).not.toHaveProperty('assetBinding')
    expect(saved).not.toHaveProperty('origin')
  })

  it('basic-system persists an attached image as an asset and restores runtime payload without storing base64', async () => {
    const preferenceValues = new Map<string, unknown>()
    const storedImages = new Map<string, any>()
    const set = vi.fn(async (key: string, value: unknown) => {
      preferenceValues.set(key, value)
    })
    const get = vi.fn(async <T,>(key: string, defaultValue: T) =>
      (preferenceValues.has(key) ? preferenceValues.get(key) : defaultValue) as T)
    const imageStorageService = {
      getMetadata: vi.fn(async (id: string) => storedImages.get(id)?.metadata ?? null),
      saveImage: vi.fn(async (image: any) => {
        storedImages.set(image.metadata.id, image)
      }),
      getImage: vi.fn(async (id: string) => storedImages.get(id) ?? null),
      listAllMetadata: vi.fn(async () =>
        Array.from(storedImages.values(), (image) => image.metadata)),
      deleteImages: vi.fn(async (ids: string[]) => {
        for (const id of ids) storedImages.delete(id)
      }),
    }
    const preferenceService = createPreferenceServiceStub({ get, set })

    const { pinia } = createTestPinia({
      preferenceService,
      imageStorageService: imageStorageService as any,
    })
    const store = useBasicSystemSession(pinia)

    store.updateTestImage('RAW_IMAGE_B64', 'image/jpeg')

    expect(store.testImageB64).toBe('RAW_IMAGE_B64')
    expect(store.testImageMimeType).toBe('image/jpeg')
    expect(store.testImageAssetId).toBeNull()

    await store.saveSession()

    const persistedAssetId = store.testImageAssetId
    expect(persistedAssetId).toMatch(/^img_/)
    expect(store.testImageB64).toBe('RAW_IMAGE_B64')
    expect(imageStorageService.saveImage).toHaveBeenCalledTimes(1)

    const saved = preferenceValues.get('session/v1/basic-system') as Record<string, unknown>
    expect(saved).toMatchObject({
      testImageAssetId: persistedAssetId,
      testImageMimeType: 'image/jpeg',
    })
    expect(saved).not.toHaveProperty('testImageB64')
    expect(JSON.stringify(saved)).not.toContain('RAW_IMAGE_B64')
    expect(JSON.stringify(saved)).not.toContain('data:image/')

    const restoredPinia = createTestPinia({
      preferenceService,
      imageStorageService: imageStorageService as any,
    }).pinia
    const restored = useBasicSystemSession(restoredPinia)
    await restored.restoreSession()

    expect(restored.testImageAssetId).toBe(persistedAssetId)
    expect(restored.testImageB64).toBe('RAW_IMAGE_B64')
    expect(restored.testImageMimeType).toBe('image/jpeg')
  })

  it('basic-system restores text when image storage access fails transiently', async () => {
    const savedSession = {
      prompt: 'persisted prompt',
      optimizedPrompt: 'persisted optimized prompt',
      reasoning: 'persisted reasoning',
      chainId: 'persisted-chain',
      versionId: 'persisted-version',
      testContent: 'persisted test input',
      testImageAssetId: 'temporarily-unavailable-image',
      testImageMimeType: 'image/png',
      layout: { mainSplitLeftPct: 40, testColumnCount: 2 },
      testVariants: [],
      testVariantResults: {},
      testVariantLastRunFingerprint: {},
      evaluationResults: {},
      compareSnapshotRoles: {},
      compareSnapshotRoleSignatures: {},
      selectedOptimizeModelKey: 'opt-model',
      selectedTestModelKey: 'test-model',
      selectedTemplateId: 'opt-template',
      selectedIterateTemplateId: 'iterate-template',
      isCompareMode: false,
      lastActiveAt: 1,
    }
    const set = vi.fn(async () => {})
    const preferenceService = createPreferenceServiceStub({
      get: vi.fn(async <T,>(key: string, defaultValue: T) =>
        (key === 'session/v1/basic-system' ? savedSession : defaultValue) as T),
      set,
    })
    const getImage = vi.fn().mockRejectedValue(new Error('IndexedDB temporarily unavailable'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { pinia } = createTestPinia({
      preferenceService,
      imageStorageService: { getImage } as any,
    })

    const restored = useBasicSystemSession(pinia)
    await restored.restoreSession()

    expect(restored.prompt).toBe('persisted prompt')
    expect(restored.optimizedPrompt).toBe('persisted optimized prompt')
    expect(restored.reasoning).toBe('persisted reasoning')
    expect(restored.testContent).toBe('persisted test input')
    expect(restored.testImageB64).toBeNull()
    expect(restored.testImageMimeType).toBe('')
    expect(restored.testImageAssetId).toBeNull()
    expect(set).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      '[BasicSystemSession] Failed to restore test image; restoring text session without it:',
      expect.any(Error),
    )
    warn.mockRestore()
  })

  it('basic-system replacement clears the old asset id immediately and deletion clears all image state', async () => {
    const preferenceValues = new Map<string, unknown>()
    const storedImages = new Map<string, any>()
    const imageStorageService = {
      getMetadata: vi.fn(async (id: string) => storedImages.get(id)?.metadata ?? null),
      saveImage: vi.fn(async (image: any) => {
        storedImages.set(image.metadata.id, image)
      }),
      listAllMetadata: vi.fn(async () =>
        Array.from(storedImages.values(), (image) => image.metadata)),
      deleteImages: vi.fn(async (ids: string[]) => {
        for (const id of ids) storedImages.delete(id)
      }),
    }
    const preferenceService = createPreferenceServiceStub({
      get: vi.fn(async <T,>(key: string, defaultValue: T) =>
        (preferenceValues.has(key) ? preferenceValues.get(key) : defaultValue) as T),
      set: vi.fn(async (key: string, value: unknown) => {
        preferenceValues.set(key, value)
      }),
    })
    const { pinia } = createTestPinia({
      preferenceService,
      imageStorageService: imageStorageService as any,
    })
    const store = useBasicSystemSession(pinia)

    store.updateTestImage('FIRST_IMAGE', 'image/png', 'asset-first')
    expect(store.testImageAssetId).toBe('asset-first')

    store.updateTestImage('SECOND_IMAGE', 'image/jpeg')
    expect(store.testImageB64).toBe('SECOND_IMAGE')
    expect(store.testImageMimeType).toBe('image/jpeg')
    expect(store.testImageAssetId).toBeNull()

    store.updateTestImage(null)
    expect(store.testImageB64).toBeNull()
    expect(store.testImageMimeType).toBe('')
    expect(store.testImageAssetId).toBeNull()

    await store.saveSession()

    expect(store.testImageB64).toBeNull()
    expect(store.testImageMimeType).toBe('')
    expect(store.testImageAssetId).toBeNull()
    const saved = preferenceValues.get('session/v1/basic-system') as Record<string, unknown>
    expect(saved).toMatchObject({ testImageAssetId: null, testImageMimeType: '' })
    expect(saved).not.toHaveProperty('testImageB64')
  })

  it('basic-user restoreSession migrates legacy template selection when missing', async () => {
    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key === 'session/v1/basic-user') return null
      if (key === TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE) return 'legacy-template'
      return defaultValue
    })

    const { pinia } = createTestPinia({
      preferenceService: {
        get,
        set: async () => {},
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
        getAll: async () => ({}),
        exportData: async () => ({}),
        importData: async () => {},
        getDataType: async () => 'preference',
        validateData: async () => true,
      } as any
    })

    const store = useBasicUserSession(pinia)
    await store.restoreSession()

    expect(store.selectedTemplateId).toBe('legacy-template')
    expect(get).toHaveBeenCalledWith('session/v1/basic-user', null)
  })

  it('basic-system restoreSession migrates legacy latest test variants to workspace', async () => {
    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key !== 'session/v1/basic-system') return defaultValue
      return {
        prompt: 'p',
        optimizedPrompt: 'draft',
        reasoning: '',
        chainId: '',
        versionId: '',
        testContent: 'input',
        layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
        testVariants: [
          { id: 'a', version: 0, modelKey: 'm1' },
          { id: 'b', version: 'latest', modelKey: 'm2' },
          { id: 'c', version: 'latest', modelKey: 'm3' },
          { id: 'd', version: 'latest', modelKey: 'm4' },
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
        selectedOptimizeModelKey: '',
        selectedTestModelKey: '',
        selectedTemplateId: null,
        selectedIterateTemplateId: null,
        isCompareMode: true,
        lastActiveAt: Date.now(),
      }
    })

    const { pinia } = createTestPinia({
      preferenceService: {
        get,
        set: async () => {},
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
        getAll: async () => ({}),
        exportData: async () => ({}),
        importData: async () => {},
        getDataType: async () => 'preference',
        validateData: async () => true,
      } as any
    })

    const store = useBasicSystemSession(pinia)
    await store.restoreSession()

    expect(store.testVariants.map((item) => item.version)).toEqual([0, 'workspace', 'workspace', 'workspace'])
  })

  it('uses English warnings when preferenceService is unavailable', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { pinia } = createTestPinia({
      preferenceService: undefined as any,
    })

    const basicSystemStore = useBasicSystemSession(pinia)
    await basicSystemStore.saveSession()
    await basicSystemStore.restoreSession()

    const basicUserStore = useBasicUserSession(pinia)
    await basicUserStore.saveSession()
    await basicUserStore.restoreSession()

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[BasicSystemSession] PreferenceService is unavailable; cannot save session',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[BasicSystemSession] PreferenceService is unavailable; cannot restore session',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[BasicUserSession] PreferenceService is unavailable; cannot save session',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[BasicUserSession] PreferenceService is unavailable; cannot restore session',
    )

    consoleWarnSpy.mockRestore()
  })

  it('uses English error logs when basic session persistence throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('boom')
    const { pinia } = createTestPinia({
      preferenceService: {
        get: vi.fn(async () => {
          throw error
        }),
        set: vi.fn(async () => {
          throw error
        }),
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
        getAll: async () => ({}),
        exportData: async () => ({}),
        importData: async () => {},
        getDataType: async () => 'preference',
        validateData: async () => true,
      } as any,
    })

    const basicSystemStore = useBasicSystemSession(pinia)
    await basicSystemStore.saveSession()
    await basicSystemStore.restoreSession()

    const basicUserStore = useBasicUserSession(pinia)
    await basicUserStore.saveSession()
    await basicUserStore.restoreSession()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BasicSystemSession] Failed to save session:',
      error,
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BasicSystemSession] Failed to restore session:',
      error,
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BasicUserSession] Failed to save session:',
      error,
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BasicUserSession] Failed to restore session:',
      error,
    )

    consoleErrorSpy.mockRestore()
  })
})
