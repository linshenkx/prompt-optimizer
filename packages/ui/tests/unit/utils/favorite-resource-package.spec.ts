import { afterEach, describe, expect, it, vi } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import type { FavoritePrompt, FullImageData } from '@prompt-optimizer/core'

import {
  FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION,
  createFavoriteResourcePackage,
  importFavoriteResourcePackage,
  readFavoriteResourcePackage,
} from '../../../src/utils/favorite-resource-package'

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

const createImage = (
  id: string,
  data: string,
  mimeType = 'image/png',
): FullImageData => ({
  metadata: {
    id,
    mimeType,
    sizeBytes: data.length,
    createdAt: 1700000000000,
    accessedAt: 1700000000001,
    source: 'uploaded',
    metadata: {
      prompt: `prompt-${id}`,
    },
  },
  data: encode(data),
})

const createFavorite = (): FavoritePrompt => ({
  id: 'fav-1',
  title: 'Image favorite',
  content: 'Generate image',
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  tags: ['image'],
  useCount: 0,
  functionMode: 'image',
  imageSubMode: 'image2image',
  metadata: {
    media: {
      coverAssetId: 'cover-asset',
      assetIds: ['media-asset'],
    },
    promptAsset: {
      schemaVersion: 'prompt-model/v1',
      id: 'asset-1',
      title: 'Image favorite',
      tags: [],
      contract: {
        family: 'image',
        subMode: 'image2image',
        modeKey: 'image-image2image',
        variables: [],
      },
      currentVersionId: 'version-2',
      content: {
        kind: 'image-prompt',
        text: 'current root content',
        images: [{ kind: 'asset', assetId: 'root-content-asset' }],
      },
      versions: [
        {
          id: 'version-1',
          version: 1,
          content: {
            kind: 'image-prompt',
            text: 'first',
            images: [{ kind: 'asset', assetId: 'version-asset-1' }],
          },
          createdAt: 1700000000000,
        },
        {
          id: 'version-2',
          version: 2,
          content: {
            kind: 'image-prompt',
            text: 'second',
            images: [{ kind: 'asset', assetId: 'version-asset-2' }],
          },
          createdAt: 1700000001000,
        },
      ],
      examples: [
        {
          id: 'example-1',
          basedOnVersionId: 'version-2',
          input: {
            images: [{ kind: 'asset', assetId: 'example-input-asset' }],
          },
          output: {
            images: [{ kind: 'asset', assetId: 'example-output-asset' }],
          },
        },
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
    },
    reproducibility: {
      examples: [
        {
          imageAssetIds: ['repro-output-asset'],
          inputImageAssetIds: ['repro-input-asset'],
        },
      ],
    },
    examples: [
      {
        imageAssetIds: ['legacy-output-asset'],
        inputImageAssetIds: ['legacy-input-asset'],
      },
    ],
  },
})

const createMediaOnlyFavorite = (assetIds = ['media-asset']): FavoritePrompt => ({
  ...createFavorite(),
  metadata: {
    media: {
      coverAssetId: 'cover-asset',
      assetIds,
    },
  },
})

const createStorage = (images: FullImageData[]) => {
  const store = new Map(images.map((image) => [image.metadata.id, image]))
  return {
    store,
    getImage: vi.fn(async (id: string) => store.get(id) ?? null),
    getMetadata: vi.fn(async (id: string) => store.get(id)?.metadata ?? null),
    saveImage: vi.fn(async (image: FullImageData) => {
      store.set(image.metadata.id, image)
      return image.metadata.id
    }),
  }
}

describe('favoriteResourcePackage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports manifest, favorites JSON, and every referenced image resource', async () => {
    const favorite = createFavorite()
    const referencedIds = [
      'cover-asset',
      'media-asset',
      'root-content-asset',
      'version-asset-1',
      'version-asset-2',
      'example-input-asset',
      'example-output-asset',
      'repro-output-asset',
      'repro-input-asset',
      'legacy-output-asset',
      'legacy-input-asset',
    ]
    const storage = createStorage(referencedIds.map((id) => createImage(id, `data-${id}`)))
    const favoriteManager = {
      exportFavorites: vi.fn(async () => JSON.stringify({
        version: '1.0',
        favorites: [favorite],
        categories: [],
        tags: [],
      })),
    }

    const result = await createFavoriteResourcePackage({
      favoriteManager,
      imageStorageService: storage,
    })
    const bytes = new Uint8Array(await result.blob.arrayBuffer())
    const files = unzipSync(bytes)
    const packageContent = readFavoriteResourcePackage(bytes)

    expect(files['manifest.json']).toBeTruthy()
    expect(files['favorites.json']).toBeTruthy()
    expect(packageContent.manifest.schemaVersion).toBe(FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION)
    expect(packageContent.manifest.resources.map((entry) => entry.id)).toEqual(expect.arrayContaining(referencedIds))
    expect(packageContent.manifest.resources).toHaveLength(referencedIds.length)
    expect(packageContent.manifest.missingResourceIds).toEqual([])
    expect(packageContent.manifest.resources.every((entry) => files[entry.path])).toBe(true)

    const exportedJson = JSON.parse(packageContent.favoritesJson)
    expect(exportedJson.favorites[0].metadata.promptAsset.versions).toHaveLength(2)
  })

  it('reports missing export resources without dropping the favorites JSON', async () => {
    const favorite = createFavorite()
    const storage = createStorage([
      createImage('cover-asset', 'cover'),
    ])
    const favoriteManager = {
      exportFavorites: vi.fn(async () => JSON.stringify({
        version: '1.0',
        favorites: [favorite],
      })),
    }

    const result = await createFavoriteResourcePackage({
      favoriteManager,
      imageStorageService: storage,
    })
    const packageContent = readFavoriteResourcePackage(new Uint8Array(await result.blob.arrayBuffer()))

    expect(result.missingResourceIds).toEqual(expect.arrayContaining(['version-asset-1', 'example-output-asset']))
    expect(packageContent.favoritesJson).toContain('"favorites"')
    expect(packageContent.manifest.resources.map((entry) => entry.id)).toEqual(['cover-asset'])
  })

  it('exports resources from fallback image stores when the preferred store misses them', async () => {
    const favorite = createFavorite()
    const preferredStorage = createStorage([
      createImage('cover-asset', 'cover'),
    ])
    const fallbackStorage = createStorage([
      createImage('media-asset', 'media-from-legacy-store'),
    ])
    const favoriteManager = {
      exportFavorites: vi.fn(async () => JSON.stringify({
        version: '1.0',
        favorites: [favorite],
      })),
    }

    const result = await createFavoriteResourcePackage({
      favoriteManager,
      imageStorageServices: [preferredStorage, fallbackStorage],
    })
    const packageContent = readFavoriteResourcePackage(new Uint8Array(await result.blob.arrayBuffer()))

    expect(packageContent.manifest.resources.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'cover-asset',
      'media-asset',
    ]))
    expect(result.missingResourceIds).not.toContain('media-asset')
  })

  it('exports resource metadata from actual bytes instead of stale image metadata', async () => {
    const jpegBytes = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]
    const favorite = createFavorite()
    const storage = createStorage([
      {
        metadata: {
          id: 'cover-asset',
          mimeType: 'image/png',
          sizeBytes: 999,
          createdAt: 1700000000000,
          source: 'uploaded',
        },
        data: encodeBytes(jpegBytes),
      },
    ])
    const favoriteManager = {
      exportFavorites: vi.fn(async () => JSON.stringify({
        version: '1.0',
        favorites: [favorite],
      })),
    }

    const result = await createFavoriteResourcePackage({
      favoriteManager,
      imageStorageService: storage,
    })
    const packageContent = readFavoriteResourcePackage(new Uint8Array(await result.blob.arrayBuffer()))
    const resource = packageContent.manifest.resources.find((entry) => entry.id === 'cover-asset')

    expect(resource?.mimeType).toBe('image/jpeg')
    expect(resource?.sizeBytes).toBe(jpegBytes.length)
    expect(resource?.path).toBe('resources/images/cover-asset.jpg')
  })

  it('restores package resources before importing favorites and skips existing resources', async () => {
    const favorite = createMediaOnlyFavorite()
    const sourceStorage = createStorage([
      createImage('cover-asset', 'cover'),
      createImage('media-asset', 'media'),
    ])
    const exportManager = {
      exportFavorites: vi.fn(async () => JSON.stringify({
        version: '1.0',
        favorites: [favorite],
      })),
    }
    const exported = await createFavoriteResourcePackage({
      favoriteManager: exportManager,
      imageStorageService: sourceStorage,
    })
    const packageBytes = await exported.blob.arrayBuffer()

    const order: string[] = []
    const targetStorage = createStorage([
      createImage('cover-asset', 'cover'),
    ])
    targetStorage.saveImage.mockImplementation(async (image: FullImageData) => {
      order.push(`save:${image.metadata.id}`)
      targetStorage.store.set(image.metadata.id, image)
      return image.metadata.id
    })
    const importManager = {
      importFavorites: vi.fn(async () => {
        order.push('import:favorites')
        return { imported: 1, skipped: 0, errors: [] }
      }),
    }

    const result = await importFavoriteResourcePackage(packageBytes, {
      favoriteManager: importManager,
      imageStorageService: targetStorage,
      mergeStrategy: 'skip',
    })

    expect(result.resources.restored).toBe(1)
    expect(result.resources.skipped).toBe(1)
    expect(targetStorage.store.has('media-asset')).toBe(true)
    expect(importManager.importFavorites).toHaveBeenCalledWith(expect.stringContaining('"favorites"'), {
      mergeStrategy: 'skip',
    })
    expect(order).toEqual(['save:media-asset', 'import:favorites'])
  })

  it('restores package resources when local metadata exists but image bytes are missing', async () => {
    const favorite = createMediaOnlyFavorite([])
    const exported = await createFavoriteResourcePackage({
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({
          version: '1.0',
          favorites: [favorite],
        })),
      },
      imageStorageService: createStorage([createImage('cover-asset', 'cover')]),
    })
    const target = createStorage([])
    target.getMetadata.mockResolvedValue(createImage('cover-asset', 'metadata-only').metadata)

    const result = await importFavoriteResourcePackage(await exported.blob.arrayBuffer(), {
      favoriteManager: {
        importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
      },
      imageStorageService: target,
    })

    expect(result.resources.restored).toBe(1)
    expect(target.saveImage).toHaveBeenCalledTimes(1)
    expect(target.store.has('cover-asset')).toBe(true)
  })

  it('blocks favorites JSON import when package resources are corrupt', async () => {
    stubSha256Digest()

    const manifest = {
      schemaVersion: FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION,
      createdAt: new Date(0).toISOString(),
      favoriteCount: 1,
      resourceCount: 1,
      missingResourceIds: [],
      resources: [
        {
          kind: 'image' as const,
          id: 'bad-asset',
          path: 'resources/images/bad-asset.png',
          mimeType: 'image/png',
          sizeBytes: 99,
          createdAt: 1700000000000,
          source: 'uploaded' as const,
          sha256: 'not-the-real-hash',
        },
      ],
    }
    const packageBytes = zipSync({
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
      'favorites.json': toZipBytes(strToU8(JSON.stringify({ version: '1.0', favorites: [{ ...createFavorite(), metadata: { media: { assetIds: ['bad-asset'] } } }] }))),
      'resources/images/bad-asset.png': toZipBytes(strToU8('bad')),
    })
    const importManager = {
      importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
    }

    await expect(importFavoriteResourcePackage(packageBytes, {
      favoriteManager: importManager,
      imageStorageService: createStorage([]),
    })).rejects.toThrow('Favorite package resource validation failed: corrupt=1')

    expect(importManager.importFavorites).not.toHaveBeenCalled()
  })

  it('blocks favorites JSON import when package manifest has missing resources', async () => {
    const manifest = {
      schemaVersion: FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION,
      createdAt: new Date(0).toISOString(),
      favoriteCount: 1,
      resourceCount: 0,
      missingResourceIds: ['missing-cover'],
      resources: [],
    }
    const importManager = {
      importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
    }

    await expect(importFavoriteResourcePackage(zipSync({
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
      'favorites.json': toZipBytes(strToU8(JSON.stringify({ version: '1.0', favorites: [{ ...createFavorite(), metadata: { media: { assetIds: ['missing-cover'] } } }] }))),
    }), {
      favoriteManager: importManager,
      imageStorageService: createStorage([]),
    })).rejects.toThrow('Favorite package resource validation failed: missing=1')

    expect(importManager.importFavorites).not.toHaveBeenCalled()
  })

  it('imports legacy packages with estimated size drift when sha256 still matches', async () => {
    stubSha256Digest()

    const favorite = createMediaOnlyFavorite([])
    const exportManager = {
      exportFavorites: vi.fn(async () => JSON.stringify({
        version: '1.0',
        favorites: [favorite],
      })),
    }
    const exported = await createFavoriteResourcePackage({
      favoriteManager: exportManager,
      imageStorageService: createStorage([
        createImage('cover-asset', 'cover'),
      ]),
    })
    const files = unzipSync(new Uint8Array(await exported.blob.arrayBuffer()))
    const manifest = JSON.parse(String.fromCharCode(...files['manifest.json']))
    manifest.resources[0].sizeBytes += 2
    const packageBytes = zipSync({
      ...files,
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
    })
    const target = createStorage([])
    const importManager = {
      importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
    }

    const result = await importFavoriteResourcePackage(packageBytes, {
      favoriteManager: importManager,
      imageStorageService: target,
    })

    expect(result.resources.corrupt).toEqual([])
    expect(result.resources.restored).toBe(1)
    expect(target.store.get('cover-asset')?.metadata.sizeBytes).toBe('cover'.length)
  })

  it('normalizes legacy imported image mime types from bytes', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9])
    const manifest = {
      schemaVersion: FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION,
      createdAt: new Date(0).toISOString(),
      favoriteCount: 1,
      resourceCount: 1,
      missingResourceIds: [],
      resources: [
        {
          kind: 'image' as const,
          id: 'legacy-jpeg',
          path: 'resources/images/legacy-jpeg.png',
          mimeType: 'image/png',
          sizeBytes: jpegBytes.byteLength,
          createdAt: 1700000000000,
          source: 'uploaded' as const,
        },
      ],
    }
    const target = createStorage([])
    const importManager = {
      importFavorites: vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] })),
    }

    const result = await importFavoriteResourcePackage(zipSync({
      'manifest.json': toZipBytes(strToU8(JSON.stringify(manifest))),
      'favorites.json': toZipBytes(strToU8(JSON.stringify({ version: '1.0', favorites: [{ ...createFavorite(), metadata: { media: { assetIds: ['legacy-jpeg'] } } }] }))),
      'resources/images/legacy-jpeg.png': toZipBytes(jpegBytes),
    }), {
      favoriteManager: importManager,
      imageStorageService: target,
    })

    expect(result.resources.corrupt).toEqual([])
    expect(target.store.get('legacy-jpeg')?.metadata.mimeType).toBe('image/jpeg')
  })

  it('rejects an existing image ID with different content before importing favorites', async () => {
    const exported = await createFavoriteResourcePackage({
      favoriteManager: { exportFavorites: async () => JSON.stringify({ favorites: [createMediaOnlyFavorite([])] }) },
      imageStorageService: createStorage([createImage('cover-asset', 'backup')]),
    })
    const target = createStorage([createImage('cover-asset', 'target')])
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))
    await expect(importFavoriteResourcePackage(await exported.blob.arrayBuffer(), {
      favoriteManager: { importFavorites }, imageStorageService: target,
    })).rejects.toThrow('errors=1')
    expect(target.saveImage).not.toHaveBeenCalled()
    expect(importFavorites).not.toHaveBeenCalled()
  })

  it('preflights favorite business data before saving images', async () => {
    const exported = await createFavoriteResourcePackage({
      favoriteManager: { exportFavorites: async () => JSON.stringify({ favorites: [createMediaOnlyFavorite([])] }) },
      imageStorageService: createStorage([createImage('cover-asset', 'cover')]),
    })
    const target = createStorage([])
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))
    await expect(importFavoriteResourcePackage(await exported.blob.arrayBuffer(), {
      favoriteManager: { importFavorites, validateImportData: async () => { throw new Error('Invalid favorite') } },
      imageStorageService: target,
    })).rejects.toThrow('Invalid favorite')
    expect(target.saveImage).not.toHaveBeenCalled()
    expect(importFavorites).not.toHaveBeenCalled()
  })

  it('detects a referenced asset omitted from the manifest even if the missing list is empty', async () => {
    const exported = await createFavoriteResourcePackage({
      favoriteManager: { exportFavorites: async () => JSON.stringify({ favorites: [createMediaOnlyFavorite([])] }) },
      imageStorageService: createStorage([createImage('cover-asset', 'cover')]),
    })
    const files = unzipSync(new Uint8Array(await exported.blob.arrayBuffer()))
    const manifest = { ...exported.manifest, resources: [], resourceCount: 0, missingResourceIds: [] }
    files['manifest.json'] = toZipBytes(strToU8(JSON.stringify(manifest)))
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))
    await expect(importFavoriteResourcePackage(zipSync(files), {
      favoriteManager: { importFavorites }, imageStorageService: createStorage([]),
    })).rejects.toThrow('missing=1')
    expect(importFavorites).not.toHaveBeenCalled()
  })
})
