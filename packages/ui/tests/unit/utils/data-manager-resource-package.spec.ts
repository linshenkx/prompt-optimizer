import { afterEach, describe, expect, it, vi } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import type { FullImageData } from '@prompt-optimizer/core'
import { DataManager } from '../../../../core/src/services/data/manager'
import { PreferenceService } from '../../../../core/src/services/preference/service'
import { MemoryStorageProvider } from '../../../../core/src/services/storage/memoryStorageProvider'

import {
  DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION,
  createDataManagerResourcePackage,
  importDataManagerResourcePackage,
  readDataManagerResourcePackage,
} from '../../../src/utils/data-manager-resource-package'

const encode = (value: string): string => globalThis.btoa(value)

const encodeBytes = (bytes: number[]): string =>
  globalThis.btoa(String.fromCharCode(...bytes))

const toZipBytes = (bytes: Uint8Array): Uint8Array => {
  const out = new globalThis.Uint8Array(bytes.byteLength)
  out.set(bytes)
  return out
}

const stubSha256Digest = () => {
  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn(async () => new Uint8Array([0x01, 0x02, 0x03]).buffer),
    },
  })
}

const createImage = (id: string, data: string): FullImageData => ({
  metadata: {
    id,
    mimeType: 'image/png',
    sizeBytes: data.length,
    createdAt: 1700000000000,
    accessedAt: 1700000000001,
    source: 'uploaded',
  },
  data: encode(data),
})

const createStorage = (images: FullImageData[]) => {
  const store = new Map(images.map((image) => [image.metadata.id, image]))
  return {
    store,
    listAllMetadata: vi.fn(async () => Array.from(store.values()).map((image) => image.metadata)),
    getImage: vi.fn(async (id: string) => store.get(id) ?? null),
    getMetadata: vi.fn(async (id: string) => store.get(id)?.metadata ?? null),
    saveImage: vi.fn(async (image: FullImageData) => {
      store.set(image.metadata.id, image)
      return image.metadata.id
    }),
  }
}

describe('dataManagerResourcePackage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports app data, favorites, session images, and favorite images into one zip package', async () => {
    const sessionStorage = createStorage([createImage('session-1', 'session-image')])
    const favoriteStorage = createStorage([createImage('favorite-1', 'favorite-image')])

    const result = await createDataManagerResourcePackage({
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { models: [] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: sessionStorage,
      favoriteImageStorageService: favoriteStorage,
    })

    const packageContent = readDataManagerResourcePackage(await result.blob.arrayBuffer())

    expect(packageContent.manifest.schemaVersion).toBe(DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION)
    expect(packageContent.appDataJson).toContain('"models"')
    expect(packageContent.favoritesJson).toContain('"favorites"')
    expect(packageContent.manifest.resources.map((resource) => `${resource.store}:${resource.id}`)).toEqual([
      'imageCache:session-1',
      'favoriteImages:favorite-1',
    ])
    expect(packageContent.files['resources/image-cache/session-1.png']).toBeTruthy()
    expect(packageContent.files['resources/favorite-images/favorite-1.png']).toBeTruthy()
  })

  it('restores resources before importing app data and favorites', async () => {
    const exported = await createDataManagerResourcePackage({
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { history: [] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([createImage('favorite-1', 'favorite-image')]),
    })

    const order: string[] = []
    const sessionTarget = createStorage([])
    const favoriteTarget = createStorage([])
    sessionTarget.saveImage.mockImplementation(async (image: FullImageData) => {
      order.push(`save:session:${image.metadata.id}`)
      sessionTarget.store.set(image.metadata.id, image)
      return image.metadata.id
    })
    favoriteTarget.saveImage.mockImplementation(async (image: FullImageData) => {
      order.push(`save:favorite:${image.metadata.id}`)
      favoriteTarget.store.set(image.metadata.id, image)
      return image.metadata.id
    })

    const result = await importDataManagerResourcePackage(await exported.blob.arrayBuffer(), {
      dataManager: {
        importAllData: vi.fn(async () => {
          order.push('import:app')
        }),
      },
      favoriteManager: {
        importFavorites: vi.fn(async () => {
          order.push('import:favorites')
          return { imported: 1, skipped: 0, errors: [] }
        }),
      },
      imageStorageService: sessionTarget,
      favoriteImageStorageService: favoriteTarget,
    })

    expect(result.resources.restored).toBe(2)
    expect(order).toEqual([
      'save:session:session-1',
      'save:favorite:favorite-1',
      'import:favorites',
      'import:app',
    ])
    expect(sessionTarget.store.has('session-1')).toBe(true)
    expect(favoriteTarget.store.has('favorite-1')).toBe(true)
  })

  it('round-trips workspace input and A/B output images through the unified app-data backup without favorites', async () => {
    const createManager = (preferences: PreferenceService) => {
      const collection = { exportData: async () => [], importData: async () => {} }
      return new DataManager(
        collection as ConstructorParameters<typeof DataManager>[0],
        collection as ConstructorParameters<typeof DataManager>[1],
        collection as ConstructorParameters<typeof DataManager>[2],
        preferences,
        { exportData: async () => ({}), importData: async () => {} } as ConstructorParameters<typeof DataManager>[4],
      )
    }
    const sourcePreferences = new PreferenceService(new MemoryStorageProvider())
    const result = (id: string) => ({ images: [{ _type: 'image-ref', id, mimeType: 'image/png' }] })
    const sessions = {
      'basic-system': { prompt: '识别图片', optimizedPrompt: '描述图片中的内容', testImageAssetId: 'vision-input' },
      'image-image2image': { originalPrompt: '改为水彩', optimizedPrompt: '保留构图，改为水彩画', inputImageId: 'edit-input' },
      'image-multiimage': {
        originalPrompt: '融合两张图', optimizedPrompt: '保留人物并替换背景',
        inputImages: [{ id: 'runtime-1', assetId: 'multi-input' }],
        originalImageResult: result('generated-a'), optimizedImageResult: result('generated-b'),
        testVariantResults: { a: result('generated-a'), b: result('generated-b') },
      },
    }
    for (const [mode, snapshot] of Object.entries(sessions)) {
      await sourcePreferences.set(`session/v1/${mode}`, snapshot)
    }
    const imageIds = ['vision-input', 'edit-input', 'multi-input', 'generated-a', 'generated-b']
    const sourceImages = createStorage(imageIds.map(id => createImage(id, `image bytes for ${id}`)))
    const backup = await createDataManagerResourcePackage({
      dataManager: createManager(sourcePreferences), favoriteManager: null,
      imageStorageService: sourceImages, favoriteImageStorageService: null,
    })
    expect(backup.missingResources).toEqual([])
    const packageContent = readDataManagerResourcePackage(await backup.blob.arrayBuffer())
    expect(packageContent.manifest.resources.map(resource => resource.id)).toEqual(imageIds)

    const destinationPreferences = new PreferenceService(new MemoryStorageProvider())
    const destinationImages = createStorage([])
    const destinationManager = createManager(destinationPreferences)
    const importAllData = vi.fn(async (data: string) => {
      // References must be resolvable when the session snapshots are restored.
      for (const id of imageIds) {
        expect(destinationImages.store.get(id)?.data).toEqual(sourceImages.store.get(id)?.data)
        expect(destinationImages.store.get(id)?.metadata).toMatchObject({ id, mimeType: 'image/png', source: 'uploaded' })
      }
      await destinationManager.importAllData(data)
    })
    await importDataManagerResourcePackage(await backup.blob.arrayBuffer(), {
      dataManager: { importAllData }, favoriteManager: null,
      imageStorageService: destinationImages, favoriteImageStorageService: null,
    })
    expect(importAllData).toHaveBeenCalledOnce()
    for (const [mode, snapshot] of Object.entries(sessions)) {
      expect(await destinationPreferences.get(`session/v1/${mode}`, null)).toEqual(snapshot)
    }
  })

  it('restores package resources when local metadata exists but image bytes are missing', async () => {
    const exported = await createDataManagerResourcePackage({
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: {} })),
      },
      favoriteManager: null,
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
    })
    const target = createStorage([])
    target.getMetadata.mockResolvedValue(createImage('session-1', 'metadata-only').metadata)

    const result = await importDataManagerResourcePackage(await exported.blob.arrayBuffer(), {
      dataManager: { importAllData: vi.fn(async () => {}) },
      favoriteManager: null,
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
      sections: {
        appData: false,
        favorites: false,
        imageCache: true,
        favoriteImages: false,
      },
    })

    expect(result.resources.restored).toBe(1)
    expect(target.saveImage).toHaveBeenCalledTimes(1)
    expect(target.store.has('session-1')).toBe(true)
  })

  it('exports resource metadata from actual bytes instead of stale image metadata', async () => {
    const jpegBytes = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]
    const image: FullImageData = {
      metadata: {
        id: 'jpeg-asset',
        mimeType: 'image/png',
        sizeBytes: 999,
        createdAt: 1700000000000,
        source: 'uploaded',
      },
      data: encodeBytes(jpegBytes),
    }

    const result = await createDataManagerResourcePackage({
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: {} })),
      },
      favoriteManager: null,
      imageStorageService: createStorage([image]),
      favoriteImageStorageService: createStorage([]),
    })

    const packageContent = readDataManagerResourcePackage(await result.blob.arrayBuffer())
    const resource = packageContent.manifest.resources.find((entry) => entry.id === 'jpeg-asset')

    expect(resource?.mimeType).toBe('image/jpeg')
    expect(resource?.sizeBytes).toBe(jpegBytes.length)
    expect(resource?.path).toBe('resources/image-cache/jpeg-asset.jpg')
  })

  it('exports only selected package sections', async () => {
    const sessionStorage = createStorage([createImage('session-1', 'session-image')])
    const favoriteStorage = createStorage([createImage('favorite-1', 'favorite-image')])

    const result = await createDataManagerResourcePackage({
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { history: ['h'] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: sessionStorage,
      favoriteImageStorageService: favoriteStorage,
      sections: {
        appData: false,
        favorites: true,
        imageCache: false,
        favoriteImages: true,
      },
    })

    const packageContent = readDataManagerResourcePackage(await result.blob.arrayBuffer())
    expect(packageContent.manifest.includedSections).toEqual(['favorites', 'favoriteImages'])
    expect(JSON.parse(packageContent.appDataJson)).toEqual({ version: 1, data: {} })
    expect(packageContent.favoritesJson).toContain('fav-1')
    expect(packageContent.manifest.resources.map((resource) => `${resource.store}:${resource.id}`)).toEqual([
      'favoriteImages:favorite-1',
    ])
  })

  it('imports legacy packages with estimated size drift when sha256 still matches', async () => {
    stubSha256Digest()

    const exported = await createDataManagerResourcePackage({
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { history: [] } })),
      },
      favoriteManager: null,
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
    })
    const files = unzipSync(new Uint8Array(await exported.blob.arrayBuffer()))
    const manifest = JSON.parse(String.fromCharCode(...files['manifest.json']))
    manifest.resources[0].sizeBytes += 2

    const packageBytes = zipSync({
      ...files,
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
    })
    const target = createStorage([])

    const result = await importDataManagerResourcePackage(packageBytes, {
      dataManager: {
        importAllData: vi.fn(async () => {}),
      },
      favoriteManager: null,
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
    })

    expect(result.resources.corrupt).toEqual([])
    expect(result.resources.restored).toBe(1)
    expect(target.store.get('session-1')?.metadata.sizeBytes).toBe('session-image'.length)
  })

  it('normalizes legacy imported image mime types from bytes', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9])
    const manifest = {
      schemaVersion: DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION,
      createdAt: new Date(0).toISOString(),
      appDataPath: 'app-data.json',
      favoritesPath: 'favorites.json',
      missingResources: [],
      resourceCounts: { imageCache: 1, favoriteImages: 0 },
      resources: [
        {
          kind: 'image',
          store: 'imageCache',
          id: 'legacy-jpeg',
          path: 'resources/image-cache/legacy-jpeg.png',
          mimeType: 'image/png',
          sizeBytes: jpegBytes.byteLength,
          createdAt: 1700000000000,
          source: 'uploaded',
        },
      ],
    }
    const target = createStorage([])

    const result = await importDataManagerResourcePackage(zipSync({
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
      'app-data.json': toZipBytes(strToU8(JSON.stringify({ version: 1, data: {} }))),
      'favorites.json': toZipBytes(strToU8(JSON.stringify({ version: '1.0', favorites: [] }))),
      'resources/image-cache/legacy-jpeg.png': toZipBytes(jpegBytes),
    }), {
      dataManager: {
        importAllData: vi.fn(async () => {}),
      },
      favoriteManager: null,
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
    })

    expect(result.resources.corrupt).toEqual([])
    expect(target.store.get('legacy-jpeg')?.metadata.mimeType).toBe('image/jpeg')
  })

  it('does not import app data when selected package resources are missing', async () => {
    const manifest = {
      schemaVersion: DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION,
      createdAt: new Date(0).toISOString(),
      appDataPath: 'app-data.json',
      favoritesPath: 'favorites.json',
      missingResources: [],
      resourceCounts: { imageCache: 1, favoriteImages: 0 },
      includedSections: ['appData', 'imageCache'],
      resources: [
        {
          kind: 'image',
          store: 'imageCache',
          id: 'missing-image',
          path: 'resources/image-cache/missing-image.png',
          mimeType: 'image/png',
          sizeBytes: 10,
          createdAt: 1700000000000,
          source: 'uploaded',
        },
      ],
    }
    const importAllData = vi.fn(async () => {})
    const target = createStorage([])

    await expect(importDataManagerResourcePackage(zipSync({
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
      'app-data.json': toZipBytes(strToU8(JSON.stringify({ version: 1, data: { models: ['new'] } }))),
      'favorites.json': toZipBytes(strToU8(JSON.stringify({ version: '1.0', favorites: [] }))),
    }), {
      dataManager: { importAllData },
      favoriteManager: null,
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
    })).rejects.toThrow('resource validation failed: missing=1')

    expect(importAllData).not.toHaveBeenCalled()
    expect(target.saveImage).not.toHaveBeenCalled()
  })

  it('ignores missing resources from package sections that are not selected', async () => {
    const manifest = {
      schemaVersion: DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION,
      createdAt: new Date(0).toISOString(),
      appDataPath: 'app-data.json',
      favoritesPath: 'favorites.json',
      missingResources: [{ store: 'imageCache', id: 'missing-image' }],
      resourceCounts: { imageCache: 0, favoriteImages: 0 },
      includedSections: ['appData', 'imageCache'],
      resources: [],
    }
    const importAllData = vi.fn(async () => {})

    const result = await importDataManagerResourcePackage(zipSync({
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
      'app-data.json': toZipBytes(strToU8(JSON.stringify({ version: 1, data: { models: ['new'] } }))),
      'favorites.json': toZipBytes(strToU8(JSON.stringify({ version: '1.0', favorites: [] }))),
    }), {
      dataManager: { importAllData },
      favoriteManager: null,
      imageStorageService: createStorage([]),
      favoriteImageStorageService: createStorage([]),
      sections: {
        appData: true,
        favorites: false,
        imageCache: false,
        favoriteImages: false,
      },
    })

    expect(result.resources.missing).toEqual([])
    expect(importAllData).toHaveBeenCalledTimes(1)
  })

  it('imports only selected package sections and passes the favorites merge strategy', async () => {
    const exported = await createDataManagerResourcePackage({
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { history: ['h'] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([createImage('favorite-1', 'favorite-image')]),
    })

    const targetSession = createStorage([])
    const targetFavorite = createStorage([])
    const importAllData = vi.fn(async () => {})
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))

    const result = await importDataManagerResourcePackage(await exported.blob.arrayBuffer(), {
      dataManager: { importAllData },
      favoriteManager: { importFavorites },
      imageStorageService: targetSession,
      favoriteImageStorageService: targetFavorite,
      sections: {
        appData: false,
        favorites: true,
        imageCache: false,
        favoriteImages: true,
      },
      favoriteMergeStrategy: 'merge',
    })

    expect(importAllData).not.toHaveBeenCalled()
    expect(importFavorites).toHaveBeenCalledWith(expect.stringContaining('fav-1'), {
      mergeStrategy: 'merge',
    })
    expect(result.resources.restored).toBe(1)
    expect(result.resources.skipped).toBe(1)
    expect(targetSession.store.has('session-1')).toBe(false)
    expect(targetFavorite.store.has('favorite-1')).toBe(true)
  })
})
