import { describe, it, expect, vi } from 'vitest'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { useImageText2ImageSession } from '../../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../../src/stores/session/useImageImage2ImageSession'

describe('Session stores (image) persistence', () => {
  it('image-text2image saveSession stores ImageRef in snapshot without mutating runtime base64', async () => {
    const set = vi.fn(async () => {})
    const saveImage = vi.fn(async () => 'img-1')

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
    expect(saved.originalImageResult.images[0]).toEqual({ id: 'img-1', _type: 'image-ref' })

    const runtimeAfter = store.originalImageResult?.images?.[0] as any
    expect(runtimeAfter?.b64).toBe('AAAA')
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
})
