import { describe, it, expect, vi } from 'vitest'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { useImageText2ImageSession } from '../../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../../src/stores/session/useImageImage2ImageSession'

describe('Session stores (image) persistence', () => {
  it('image-text2image clearContent removes image content while preserving workspace selections', async () => {
    const { pinia } = createTestPinia({
      imageStorageService: {
        saveImage: vi.fn(),
        getMetadata: vi.fn(async () => null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
        getImage: vi.fn(async () => null),
      } as any,
    })
    const store = useImageText2ImageSession(pinia)

    store.updatePrompt('prompt')
    store.updateOptimizedResult({ optimizedPrompt: 'optimized', reasoning: 'reasoning', chainId: 'chain', versionId: 'version' })
    store.setTemporaryVariable('topic', 'pizza')
    store.updateOriginalImageResult({ images: [{ b64: 'AAAA', mimeType: 'image/png' }], metadata: {} } as any)
    store.updateOptimizedImageResult({ images: [{ b64: 'BBBB', mimeType: 'image/png' }], metadata: {} } as any)
    store.updateTextModel('text-model')
    store.updateImageModel('image-model')
    store.updateTemplate('template')
    store.updateIterateTemplate('iterate-template')
    store.setTestColumnCount(3)
    store.updateTestVariant('d', { modelKey: 'variant-model' })

    store.clearContent({ persist: false })

    expect(store.originalPrompt).toBe('')
    expect(store.optimizedPrompt).toBe('')
    expect(store.reasoning).toBe('')
    expect(store.chainId).toBe('')
    expect(store.versionId).toBe('')
    expect(store.temporaryVariables).toEqual({})
    expect(store.originalImageResult).toBeNull()
    expect(store.optimizedImageResult).toBeNull()
    expect(store.selectedTextModelKey).toBe('text-model')
    expect(store.selectedImageModelKey).toBe('image-model')
    expect(store.selectedTemplateId).toBe('template')
    expect(store.selectedIterateTemplateId).toBe('iterate-template')
    expect(store.layout.testColumnCount).toBe(3)
    expect(store.testVariants.find((variant) => variant.id === 'd')?.modelKey).toBe('variant-model')
    // Drain the selection setters' pending writes before the fixture clears its services.
    await store.saveSession()
  })

  it('image-text2image clearTemporaryVariables persists the cleared snapshot', async () => {
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
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getMetadata: vi.fn(async () => null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
        getImage: vi.fn(async () => null),
      } as any,
    })

    const store = useImageText2ImageSession(pinia)
    store.setTemporaryVariable('主体', '小猫')
    await store.saveSession()
    set.mockClear()

    store.clearTemporaryVariables()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.temporaryVariables).toEqual({})
    expect(set).toHaveBeenCalled()

    const lastCall = set.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('session/v1/image-text2image')

    const raw = lastCall?.[1]
    const saved =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, unknown> | undefined) || {}
    expect(saved.temporaryVariables).toEqual({})
  })

  it('image-text2image saveSession stores ImageRef in snapshot without mutating runtime base64', async () => {
    const set = vi.fn(async (_key: string, _value: any) => {})
    const saveImage = vi.fn(async (data: any) => data?.metadata?.id || 'img-test')
    const getMetadata = vi.fn(async () => null)
    const listAllMetadata = vi.fn(async () => [])
    const deleteImages = vi.fn(async () => {})

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
      } as any,
      imageStorageService: {
        saveImage,
        getMetadata,
        listAllMetadata,
        deleteImages,
        getImage: vi.fn()
      } as any
    })

    const store = useImageText2ImageSession(pinia)
    store.updatePrompt('p')
    store.updateOriginalImageResult({
      images: [{ b64: 'AAAA', mimeType: 'image/png' }],
      metadata: { prompt: 'p', configId: 'cfg', modelId: 'm' }
    } as any)

    const runtimeBefore = store.originalImageResult?.images?.[0] as any
    expect(runtimeBefore?.b64).toBe('AAAA')

    await store.saveSession()

    expect(saveImage).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith('session/v1/image-text2image', expect.any(Object))

    const raw = set.mock.calls[0]?.[1]
    const saved =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, any> | undefined) || {}
    expect(saved.originalImageResult.images[0]).toMatchObject({ id: expect.any(String), _type: 'image-ref' })

    const runtimeAfter = store.originalImageResult?.images?.[0] as any
    expect(runtimeAfter?.b64).toBe('AAAA')
  })

  it('image-text2image saveSession converts legacy url results into ImageRef snapshots', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: {
        get: vi.fn((name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)),
      },
      arrayBuffer: async () => Uint8Array.from([104, 101, 108, 108, 111]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const set = vi.fn(async (_key: string, _value: any) => {})
    const saveImage = vi.fn(async (data: any) => data?.metadata?.id || 'img-test')
    const getMetadata = vi.fn(async () => null)
    const listAllMetadata = vi.fn(async () => [])
    const deleteImages = vi.fn(async () => {})

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
      } as any,
      imageStorageService: {
        saveImage,
        getMetadata,
        listAllMetadata,
        deleteImages,
        getImage: vi.fn(),
      } as any,
    })

    const store = useImageText2ImageSession(pinia)
    store.updatePrompt('p')
    store.updateOriginalImageResult({
      images: [{ url: 'https://example.com/runtime-only.png' }],
      metadata: { prompt: 'p', configId: 'cfg', modelId: 'm' },
    } as any)

    try {
      await store.saveSession()

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/runtime-only.png', { method: 'GET' })
      expect(saveImage).toHaveBeenCalledTimes(1)

      const raw = set.mock.calls[0]?.[1]
      const saved =
        typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, any> | undefined) || {}

      expect(saved.originalImageResult.images[0]).toMatchObject({
        id: expect.any(String),
        _type: 'image-ref',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('image-text2image saveSession throws when ImageStorageService is missing', async () => {
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
      } as any,
    })

    const store = useImageText2ImageSession(pinia)
    store.updateOriginalImageResult({
      images: [{ b64: 'AAAA', mimeType: 'image/png' }],
      metadata: { prompt: 'p', configId: 'cfg', modelId: 'm' }
    } as any)

    await expect(store.saveSession()).rejects.toThrow(/ImageStorageService/)
    expect(set).not.toHaveBeenCalled()
  })

  it('image-text2image saveSession throws when saveImage fails (no base64 downgrade)', async () => {
    const set = vi.fn(async () => {})
    const saveImage = vi.fn(async () => {
      throw new Error('boom')
    })
    const getMetadata = vi.fn(async () => null)
    const listAllMetadata = vi.fn(async () => [])
    const deleteImages = vi.fn(async () => {})

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
      } as any,
      imageStorageService: {
        saveImage,
        getMetadata,
        listAllMetadata,
        deleteImages,
        getImage: vi.fn()
      } as any
    })

    const store = useImageText2ImageSession(pinia)
    store.updateOriginalImageResult({
      images: [{ b64: 'AAAA', mimeType: 'image/png' }],
      metadata: { prompt: 'p', configId: 'cfg', modelId: 'm' }
    } as any)

    await expect(store.saveSession()).rejects.toThrow('boom')
    expect(set).not.toHaveBeenCalled()
  })

  it('image-image2image restoreSession loads input image + result images from ImageStorageService', async () => {
    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key !== 'session/v1/image-image2image') return defaultValue
      return JSON.stringify({
        originalPrompt: 'p',
        inputImageId: 'in-1',
        inputImageB64: null,
        inputImageMime: 'image/png',
        originalImageResult: { images: [{ id: 'img-2', _type: 'image-ref' }] },
        optimizedImageResult: null,
        isCompareMode: true,
        selectedTextModelKey: '',
        selectedImageModelKey: '',
        selectedTemplateId: null,
        selectedIterateTemplateId: null,
        lastActiveAt: Date.now(),
      })
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
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getImage: vi.fn(async (id: string) => {
          if (id === 'in-1') {
            return { data: 'INPUT_B64', metadata: { mimeType: 'image/png' } }
          }
          if (id === 'img-2') {
            return { data: 'RESULT_B64', metadata: { mimeType: 'image/png' } }
          }
          return null
        })
      } as any
    })

    const store = useImageImage2ImageSession(pinia)
    await store.restoreSession()

    expect(store.inputImageB64).toBe('INPUT_B64')
    expect(store.originalImageResult?.images?.[0]).toMatchObject({ b64: 'RESULT_B64', mimeType: 'image/png' })
    expect(get).toHaveBeenCalledWith('session/v1/image-image2image', null)
  })

  it('image-text2image restoreSession normalizes legacy url results into runtime base64', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: {
        get: vi.fn((name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)),
      },
      arrayBuffer: async () => Uint8Array.from([104, 101, 108, 108, 111]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key !== 'session/v1/image-text2image') return defaultValue
      return JSON.stringify({
        originalPrompt: 'p',
        originalImageResult: { images: [{ url: 'https://example.com/legacy.png' }] },
        optimizedImageResult: null,
        isCompareMode: true,
        selectedTextModelKey: '',
        selectedImageModelKey: '',
        selectedTemplateId: null,
        selectedIterateTemplateId: null,
        lastActiveAt: Date.now(),
      })
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
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getImage: vi.fn(async () => null),
        getMetadata: vi.fn(async () => null),
      } as any,
    })

    const store = useImageText2ImageSession(pinia)

    try {
      await store.restoreSession()

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/legacy.png', { method: 'GET' })
      expect(store.originalImageResult?.images?.[0]).toMatchObject({
        b64: 'aGVsbG8=',
        mimeType: 'image/png',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('image-image2image saveSession converts legacy url results into ImageRef snapshots', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: {
        get: vi.fn((name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)),
      },
      arrayBuffer: async () => Uint8Array.from([104, 101, 108, 108, 111]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const set = vi.fn(async (_key: string, _value: any) => {})
    const saveImage = vi.fn(async (data: any) => data?.metadata?.id || 'img-test')
    const getMetadata = vi.fn(async () => null)
    const listAllMetadata = vi.fn(async () => [])
    const deleteImages = vi.fn(async () => {})

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
      } as any,
      imageStorageService: {
        saveImage,
        getMetadata,
        listAllMetadata,
        deleteImages,
        getImage: vi.fn(),
      } as any,
    })

    const store = useImageImage2ImageSession(pinia)
    store.updatePrompt('p')
    store.updateOriginalImageResult({
      images: [{ url: 'https://example.com/runtime-only.png' }],
      metadata: { prompt: 'p', configId: 'cfg', modelId: 'm' },
    } as any)

    try {
      await store.saveSession()

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/runtime-only.png', { method: 'GET' })
      expect(saveImage).toHaveBeenCalledTimes(1)

      const raw = set.mock.calls[0]?.[1]
      const saved =
        typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, any> | undefined) || {}

      expect(saved.originalImageResult.images[0]).toMatchObject({
        id: expect.any(String),
        _type: 'image-ref',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('image-image2image restoreSession normalizes legacy url results into runtime base64', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: {
        get: vi.fn((name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)),
      },
      arrayBuffer: async () => Uint8Array.from([104, 101, 108, 108, 111]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key !== 'session/v1/image-image2image') return defaultValue
      return JSON.stringify({
        originalPrompt: 'p',
        originalImageResult: { images: [{ url: 'https://example.com/legacy.png' }] },
        optimizedImageResult: null,
        isCompareMode: true,
        selectedTextModelKey: '',
        selectedImageModelKey: '',
        selectedTemplateId: null,
        selectedIterateTemplateId: null,
        lastActiveAt: Date.now(),
      })
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
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getImage: vi.fn(async () => null),
        getMetadata: vi.fn(async () => null),
      } as any,
    })

    const store = useImageImage2ImageSession(pinia)

    try {
      await store.restoreSession()

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/legacy.png', { method: 'GET' })
      expect(store.originalImageResult?.images?.[0]).toMatchObject({
        b64: 'aGVsbG8=',
        mimeType: 'image/png',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('image-image2image saveSession throws when ImageStorageService is missing', async () => {
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
      } as any,
    })

    const store = useImageImage2ImageSession(pinia)
    store.updateInputImage('INPUT_B64', 'image/png')

    await expect(store.saveSession()).rejects.toThrow(/ImageStorageService/)
    expect(set).not.toHaveBeenCalled()
  })

  it('image-image2image saveSession throws when saving input image fails (no base64 downgrade)', async () => {
    const set = vi.fn(async () => {})
    const saveImage = vi.fn(async () => {
      throw new Error('boom')
    })
    const getMetadata = vi.fn(async () => null)
    const listAllMetadata = vi.fn(async () => [])
    const deleteImages = vi.fn(async () => {})

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
      } as any,
      imageStorageService: {
        saveImage,
        getMetadata,
        listAllMetadata,
        deleteImages,
        getImage: vi.fn()
      } as any
    })

    const store = useImageImage2ImageSession(pinia)
    store.updateInputImage('INPUT_B64', 'image/png')

    await expect(store.saveSession()).rejects.toThrow('boom')
    expect(set).not.toHaveBeenCalled()
    expect(store.inputImageB64).toBe('INPUT_B64')
  })

  it('image-text2image restoreSession migrates legacy latest test variants to workspace', async () => {
    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key !== 'session/v1/image-text2image') return defaultValue
      return {
        originalPrompt: 'p',
        optimizedPrompt: 'draft',
        reasoning: '',
        chainId: '',
        versionId: '',
        temporaryVariables: {},
        selectedTextModelKey: '',
        selectedImageModelKey: '',
        selectedTemplateId: null,
        selectedIterateTemplateId: null,
        testVariants: [
          { id: 'a', version: 0, modelKey: 'm1' },
          { id: 'b', version: 'latest', modelKey: 'm2' },
          { id: 'c', version: 'latest', modelKey: 'm3' },
          { id: 'd', version: 'latest', modelKey: 'm4' },
        ],
        testVariantResults: { a: null, b: null, c: null, d: null },
        testVariantLastRunFingerprint: { a: '', b: '', c: '', d: '' },
        layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
        evaluationResults: {},
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
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getMetadata: vi.fn(async () => null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
        getImage: vi.fn(async () => null),
      } as any
    })

    const store = useImageText2ImageSession(pinia)
    await store.restoreSession()

    expect(store.testVariants.map((item) => item.version)).toEqual([0, 'workspace', 'workspace', 'workspace'])
  })
})
