import { describe, it, expect, vi } from 'vitest'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { useImageMultiImageSession } from '../../../../src/stores/session/useImageMultiImageSession'
import { IMAGE_MULTIIMAGE_SESSION_KEY } from '../../../../src/stores/session/imageStorageMaintenance'

describe('Session store (image-multiimage) persistence', () => {
  it('clearContent removes prompt, inputs, results, and variables while preserving workspace selections', () => {
    const { pinia } = createTestPinia()
    const store = useImageMultiImageSession(pinia)

    store.updatePrompt('prompt')
    store.updateOptimizedResult({ optimizedPrompt: 'optimized', reasoning: 'reasoning', chainId: 'chain', versionId: 'version' })
    store.setTemporaryVariable('topic', 'pizza')
    store.replaceInputImages([{ b64: 'AAAA', mimeType: 'image/png' }])
    store.updateOriginalImageResult({ images: [{ b64: 'BBBB', mimeType: 'image/png' }], metadata: {} } as any)
    store.updateOptimizedImageResult({ images: [{ b64: 'CCCC', mimeType: 'image/png' }], metadata: {} } as any)
    store.updateTextModel('text-model')
    store.updateImageModel('image-model')
    store.updateTemplate('template')
    store.updateIterateTemplate('iterate-template')
    store.setTestColumnCount(4)
    store.updateTestVariant('a', { modelKey: 'variant-model' })

    store.clearContent({ persist: false })

    expect(store.originalPrompt).toBe('')
    expect(store.optimizedPrompt).toBe('')
    expect(store.reasoning).toBe('')
    expect(store.chainId).toBe('')
    expect(store.versionId).toBe('')
    expect(store.temporaryVariables).toEqual({})
    expect(store.inputImages).toEqual([])
    expect(store.originalImageResult).toBeNull()
    expect(store.optimizedImageResult).toBeNull()
    expect(store.selectedTextModelKey).toBe('text-model')
    expect(store.selectedImageModelKey).toBe('image-model')
    expect(store.selectedTemplateId).toBe('template')
    expect(store.selectedIterateTemplateId).toBe('iterate-template')
    expect(store.layout.testColumnCount).toBe(4)
    expect(store.testVariants.find((variant) => variant.id === 'a')?.modelKey).toBe('variant-model')
  })

  it('persists the ordered multi-image list and restores it with the same order', async () => {
    const savedSnapshots = new Map<string, unknown>()
    const imageMap = new Map<string, { data: string; metadata: { mimeType: string } }>()

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(key: string, defaultValue: T) =>
          (savedSnapshots.has(key) ? savedSnapshots.get(key) : defaultValue) as T,
        set: async (key: string, value: unknown) => {
          savedSnapshots.set(key, value)
        },
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
        saveImage: vi.fn(async (data: any) => {
          imageMap.set(data.metadata.id, {
            data: data.data,
            metadata: { mimeType: data.metadata.mimeType },
          })
          return data.metadata.id
        }),
        getImage: vi.fn(async (id: string) => imageMap.get(id) ?? null),
        getMetadata: vi.fn(async (id: string) =>
          imageMap.has(id)
            ? {
                id,
                mimeType: imageMap.get(id)?.metadata.mimeType || 'image/png',
                sizeBytes: 4,
                createdAt: Date.now(),
                accessedAt: Date.now(),
                source: 'uploaded',
              }
            : null,
        ),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const store = useImageMultiImageSession(pinia)
    store.updatePrompt('将图1和图2融合成新画面')
    await store.addInputImage({ b64: 'AAAA', mimeType: 'image/png' })
    await store.addInputImage({ b64: 'BBBB', mimeType: 'image/jpeg' })
    store.reorderInputImages(1, 0)

    await store.saveSession()

    // A second, idle save must not masquerade as an edit and block app updates.
    const cachedInputList = store.inputImages
    await store.saveSession()
    expect(store.inputImages).toBe(cachedInputList)

    const restored = useImageMultiImageSession(pinia)
    restored.reset()
    await restored.restoreSession()

    expect(restored.originalPrompt).toBe('将图1和图2融合成新画面')
    expect(restored.inputImages).toHaveLength(2)
    expect(restored.inputImages[0]).toMatchObject({ b64: 'BBBB', mimeType: 'image/jpeg' })
    expect(restored.inputImages[1]).toMatchObject({ b64: 'AAAA', mimeType: 'image/png' })
  })

  it('restores test panel layout and variant state together with the workspace session', async () => {
    const savedSnapshots = new Map<string, unknown>()
    const imageMap = new Map<string, { data: string; metadata: { mimeType: string } }>()

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(key: string, defaultValue: T) =>
          (savedSnapshots.has(key) ? savedSnapshots.get(key) : defaultValue) as T,
        set: async (key: string, value: unknown) => {
          savedSnapshots.set(key, value)
        },
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
        saveImage: vi.fn(async (data: any) => {
          imageMap.set(data.metadata.id, {
            data: data.data,
            metadata: { mimeType: data.metadata.mimeType },
          })
          return data.metadata.id
        }),
        getImage: vi.fn(async (id: string) => imageMap.get(id) ?? null),
        getMetadata: vi.fn(async (id: string) =>
          imageMap.has(id)
            ? {
                id,
                mimeType: imageMap.get(id)?.metadata.mimeType || 'image/png',
                sizeBytes: 4,
                createdAt: Date.now(),
                accessedAt: Date.now(),
                source: 'uploaded',
              }
            : null,
        ),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const store = useImageMultiImageSession(pinia)
    store.updatePrompt('用图1和图2做多图测试')
    await store.addInputImage({ b64: 'AAAA', mimeType: 'image/png' })
    await store.addInputImage({ b64: 'BBBB', mimeType: 'image/jpeg' })
    store.setTestColumnCount(4)
    store.setMainSplitLeftPct(42)
    store.updateTestVariant('a', { version: 'workspace', modelKey: 'image-model-a' })
    store.updateTestVariant('b', { version: 'previous', modelKey: 'image-model-b' })
    store.updateTestVariantResult('a', {
      images: [{ b64: 'CCCC', mimeType: 'image/png' }],
      metadata: { providerId: 'provider', modelId: 'model-a', configId: 'image-model-a' },
    })
    store.setTestVariantLastRunFingerprint('a', 'fingerprint-a')
    store.toggleCompareMode(false)

    await store.saveSession()

    const restored = useImageMultiImageSession(pinia)
    restored.reset()
    await restored.restoreSession()

    expect(restored.layout).toEqual({
      mainSplitLeftPct: 42,
      testColumnCount: 4,
    })
    expect(restored.testVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a', version: 'workspace', modelKey: 'image-model-a' }),
        expect.objectContaining({ id: 'b', version: 'previous', modelKey: 'image-model-b' }),
      ]),
    )
    expect(restored.testVariantResults.a).toMatchObject({
      images: [{ b64: 'CCCC', mimeType: 'image/png' }],
    })
    expect(restored.testVariantLastRunFingerprint.a).toBe('fingerprint-a')
    expect(restored.isCompareMode).toBe(false)
  })

  it('stores generated multi-image results as image refs and restores their payloads from image storage', async () => {
    const savedSnapshots = new Map<string, unknown>()
    const imageMap = new Map<string, { data: string; metadata: { mimeType: string } }>()

    const imageStorageService = {
      saveImage: vi.fn(async (data: any) => {
        imageMap.set(data.metadata.id, {
          data: data.data,
          metadata: { mimeType: data.metadata.mimeType },
        })
        return data.metadata.id
      }),
      getImage: vi.fn(async (id: string) => imageMap.get(id) ?? null),
      getMetadata: vi.fn(async (id: string) =>
        imageMap.has(id)
          ? {
              id,
              mimeType: imageMap.get(id)?.metadata.mimeType || 'image/png',
              sizeBytes: 4,
              createdAt: Date.now(),
              accessedAt: Date.now(),
              source: 'generated',
            }
          : null,
      ),
      listAllMetadata: vi.fn(async () => []),
      deleteImages: vi.fn(async () => {}),
    }

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(key: string, defaultValue: T) =>
          (savedSnapshots.has(key) ? savedSnapshots.get(key) : defaultValue) as T,
        set: async (key: string, value: unknown) => {
          savedSnapshots.set(key, value)
        },
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
        getAll: async () => ({}),
        exportData: async () => ({}),
        importData: async () => {},
        getDataType: async () => 'preference',
        validateData: async () => true,
      } as any,
      imageStorageService: imageStorageService as any,
    })

    const store = useImageMultiImageSession(pinia)
    store.updateOriginalImageResult({
      images: [{ b64: 'ORIGINAL', mimeType: 'image/png' }],
      metadata: { providerId: 'provider', modelId: 'model-original', configId: 'image-model-original' },
    })
    store.updateOptimizedImageResult({
      images: [{ b64: 'OPTIMIZED', mimeType: 'image/jpeg' }],
      metadata: { providerId: 'provider', modelId: 'model-optimized', configId: 'image-model-optimized' },
    })
    store.updateTestVariantResult('c', {
      images: [{ b64: 'VARIANTC', mimeType: 'image/png' }],
      metadata: { providerId: 'provider', modelId: 'model-c', configId: 'image-model-c' },
    })

    await store.saveSession()

    const snapshot = savedSnapshots.get(IMAGE_MULTIIMAGE_SESSION_KEY) as Record<string, any>

    expect(snapshot.originalImageResult.images[0]).toMatchObject({ _type: 'image-ref', id: expect.any(String) })
    expect(snapshot.optimizedImageResult.images[0]).toMatchObject({ _type: 'image-ref', id: expect.any(String) })
    expect(snapshot.testVariantResults.a.images[0]).toMatchObject({ _type: 'image-ref', id: expect.any(String) })
    expect(snapshot.testVariantResults.b.images[0]).toMatchObject({ _type: 'image-ref', id: expect.any(String) })
    expect(snapshot.testVariantResults.c.images[0]).toMatchObject({ _type: 'image-ref', id: expect.any(String) })
    expect(JSON.stringify(snapshot)).not.toContain('ORIGINAL')
    expect(JSON.stringify(snapshot)).not.toContain('OPTIMIZED')
    expect(JSON.stringify(snapshot)).not.toContain('VARIANTC')

    const restored = useImageMultiImageSession(pinia)
    restored.reset()
    await restored.restoreSession()

    expect(restored.originalImageResult).toMatchObject({
      images: [{ b64: 'ORIGINAL', mimeType: 'image/png' }],
    })
    expect(restored.optimizedImageResult).toMatchObject({
      images: [{ b64: 'OPTIMIZED', mimeType: 'image/jpeg' }],
    })
    expect(restored.testVariantResults.c).toMatchObject({
      images: [{ b64: 'VARIANTC', mimeType: 'image/png' }],
    })
    expect(imageStorageService.saveImage).toHaveBeenCalledTimes(3)
    expect(imageStorageService.getImage).toHaveBeenCalled()
  })

  it('fails restore when a persisted input image asset is missing', async () => {
    const savedSnapshots = new Map<string, unknown>()

    savedSnapshots.set(IMAGE_MULTIIMAGE_SESSION_KEY, {
      originalPrompt: '使用两张参考图',
      inputImages: [
        {
          id: 'input-1',
          assetId: 'missing-asset',
          mimeType: 'image/png',
        },
        {
          id: 'input-2',
          assetId: 'existing-asset',
          mimeType: 'image/jpeg',
        },
      ],
    })

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(key: string, defaultValue: T) =>
          (savedSnapshots.has(key) ? savedSnapshots.get(key) : defaultValue) as T,
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
        getImage: vi.fn(async (id: string) =>
          id === 'existing-asset'
            ? {
                data: 'BBBB',
                metadata: { mimeType: 'image/jpeg' },
              }
            : null,
        ),
      } as any,
    })

    const restored = useImageMultiImageSession(pinia)

    await expect(restored.restoreSession()).rejects.toThrow(/missing input image asset/i)
  })

  it('uses English fallback errors when required services are unavailable', async () => {
    const { pinia: missingPreferencePinia } = createTestPinia({
      preferenceService: undefined as any,
      imageStorageService: {
        getImage: vi.fn(async () => null),
        getMetadata: vi.fn(async () => null),
        saveImage: vi.fn(async () => ''),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const missingPreferenceStore = useImageMultiImageSession(missingPreferencePinia)
    await expect(missingPreferenceStore.saveSession()).rejects.toThrow(
      '[ImageMultiImageSession] PreferenceService is unavailable; cannot save session',
    )
    await expect(missingPreferenceStore.restoreSession()).rejects.toThrow(
      '[ImageMultiImageSession] PreferenceService is unavailable; cannot restore session',
    )

    const { pinia: missingImageStoragePinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(_key: string, defaultValue: T) => defaultValue,
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
      imageStorageService: undefined as any,
    })

    const missingImageStorageStore = useImageMultiImageSession(missingImageStoragePinia)
    await expect(missingImageStorageStore.saveSession()).rejects.toThrow(
      '[ImageMultiImageSession] ImageStorageService is unavailable; cannot save session',
    )
    await expect(missingImageStorageStore.restoreSession()).rejects.toThrow(
      '[ImageMultiImageSession] ImageStorageService is unavailable; cannot restore session',
    )
  })
})
