import { describe, expect, it, vi } from 'vitest'
import type { FullImageData } from '@prompt-optimizer/core'

import {
  REMOTE_SNAPSHOT_SCHEMA_VERSION,
  analyzeRemoteSnapshotAssetCleanup,
  cleanupRemoteSnapshotAssets,
  createRemoteSnapshotBackup,
  listRemoteSnapshotBackups,
  restoreRemoteSnapshotBackup,
  type RemoteSnapshotManifest,
} from '../../../src/utils/remote-snapshot-backup'
import type { RemoteObjectStore } from '../../../src/utils/remote-backup'

const encode = (value: string): string => globalThis.btoa(value)

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const imageAssetPath = async (
  store: 'imageCache' | 'favoriteImages',
  id: string,
  data: string,
): Promise<string> =>
  `v1/assets/${store}/${encodeURIComponent(id)}.${await sha256Hex(data)}.png`

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

const blobToArrayBuffer = async (body: Blob | ArrayBuffer | Uint8Array | string): Promise<ArrayBuffer> => {
  if (body instanceof Blob) return body.arrayBuffer()
  if (body instanceof ArrayBuffer) return body
  if (body instanceof Uint8Array) {
    const copy = new Uint8Array(body.byteLength)
    copy.set(body)
    return copy.buffer
  }
  return new TextEncoder().encode(body).buffer
}

const createObjectStore = (initial?: Record<string, string | Uint8Array>): RemoteObjectStore & {
  objects: Map<string, { bytes: Uint8Array; contentType?: string; updatedAt: string }>
  putCalls: string[]
  deleteCalls: string[]
} => {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string; updatedAt: string }>()
  Object.entries(initial || {}).forEach(([path, value]) => {
    objects.set(path, {
      bytes: typeof value === 'string' ? new TextEncoder().encode(value) : value,
      contentType: typeof value === 'string' ? 'application/json' : 'image/png',
      updatedAt: new Date(0).toISOString(),
    })
  })
  const putCalls: string[] = []
  const deleteCalls: string[] = []
  return {
    provider: 'google-drive',
    objects,
    putCalls,
    deleteCalls,
    head: vi.fn(async (path: string) => {
      const object = objects.get(path)
      return object
        ? {
            path,
            sizeBytes: object.bytes.byteLength,
            updatedAt: object.updatedAt,
            contentType: object.contentType,
          }
        : null
    }),
    exists: vi.fn(async (path: string) => objects.has(path)),
    put: vi.fn(async (path, body, options) => {
      putCalls.push(path)
      const bytes = new Uint8Array(await blobToArrayBuffer(body))
      objects.set(path, {
        bytes,
        contentType: options?.contentType,
        updatedAt: new Date().toISOString(),
      })
      return {
        path,
        sizeBytes: bytes.byteLength,
        updatedAt: objects.get(path)?.updatedAt,
        contentType: options?.contentType,
      }
    }),
    get: vi.fn(async (path: string) => {
      const object = objects.get(path)
      if (!object) throw new Error(`object not found: ${path}`)
      const copy = new Uint8Array(object.bytes.byteLength)
      copy.set(object.bytes)
      return copy.buffer
    }),
    getText: vi.fn(async (path: string) => {
      const object = objects.get(path)
      if (!object) throw new Error(`object not found: ${path}`)
      return new TextDecoder().decode(object.bytes)
    }),
    list: vi.fn(async (prefix: string) =>
      Array.from(objects.entries())
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, object]) => ({
          path,
          sizeBytes: object.bytes.byteLength,
          updatedAt: object.updatedAt,
          contentType: object.contentType,
        })),
    ),
    delete: vi.fn(async (path: string) => {
      deleteCalls.push(path)
      objects.delete(path)
    }),
  }
}

describe('remote snapshot backup', () => {
  it('creates a manifest snapshot and skips image assets that already exist remotely', async () => {
    const existingPath = await imageAssetPath('imageCache', 'session-1', 'session-image')
    const objectStore = createObjectStore({
      [existingPath]: new TextEncoder().encode('session-image'),
    })
    const progressPhases: string[] = []

    const result = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { models: [] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
      onProgress: (event) => {
        progressPhases.push(event.phase)
      },
    })

    expect(result.uploadedAssets).toBe(0)
    expect(result.skippedAssets).toBe(1)
    expect(result.manifest.schemaVersion).toBe(REMOTE_SNAPSHOT_SCHEMA_VERSION)
    expect(result.manifest.assets[0]).toMatchObject({
      store: 'imageCache',
      id: 'session-1',
      path: existingPath,
      mimeType: 'image/png',
    })
    expect(objectStore.putCalls).toEqual([
      result.manifest.appDataPath,
      result.manifest.favoritesPath,
      result.entry.manifestPath,
    ])
    expect(progressPhases).toContain('prepare')
    expect(progressPhases).toContain('scan')
    expect(progressPhases).toContain('asset-check')
    expect(progressPhases).toContain('metadata-upload')
    expect(progressPhases).toContain('manifest-upload')
    expect(progressPhases.at(-1)).toBe('done')
  })

  it('uses content-addressed image asset paths so same-size stale objects are not reused', async () => {
    const staleLegacyPath = 'v1/assets/imageCache/session-1.png'
    const objectStore = createObjectStore({
      [staleLegacyPath]: new TextEncoder().encode('different-one'),
    })

    const result = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { models: [] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
    })

    const expectedPath = await imageAssetPath('imageCache', 'session-1', 'session-image')
    expect(result.uploadedAssets).toBe(1)
    expect(result.skippedAssets).toBe(0)
    expect(result.manifest.assets[0].path).toBe(expectedPath)
    expect(result.manifest.assets[0].path).not.toBe(staleLegacyPath)
    expect(objectStore.putCalls).toContain(expectedPath)
    expect(Array.from(objectStore.objects.get(expectedPath)?.bytes ?? [])).toEqual(
      Array.from(new TextEncoder().encode('session-image')),
    )
  })

  it('reuploads existing image assets when remote size does not match', async () => {
    const existingPath = await imageAssetPath('imageCache', 'session-1', 'session-image')
    const objectStore = createObjectStore({
      [existingPath]: new Uint8Array([1, 2, 3]),
    })

    const result = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { models: [] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
    })

    expect(result.uploadedAssets).toBe(1)
    expect(result.skippedAssets).toBe(0)
    expect(objectStore.putCalls).toContain(existingPath)
    expect(Array.from(objectStore.objects.get(existingPath)?.bytes ?? [])).toEqual(
      Array.from(new TextEncoder().encode('session-image')),
    )
  })

  it('reuploads content-addressed image assets when remote size metadata is unavailable', async () => {
    const existingPath = await imageAssetPath('imageCache', 'session-1', 'session-image')
    const objectStore = createObjectStore({
      [existingPath]: new TextEncoder().encode('session-image'),
    })
    objectStore.head = vi.fn(async (path: string) =>
      objectStore.objects.has(path) ? { path } : null,
    )

    const result = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { models: [] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
    })

    expect(result.uploadedAssets).toBe(1)
    expect(result.skippedAssets).toBe(0)
    expect(objectStore.putCalls).toContain(existingPath)
  })

  it('lists committed snapshots by manifest and restores only after resources validate', async () => {
    const objectStore = createObjectStore()
    const exported = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { history: [] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([createImage('favorite-1', 'favorite-image')]),
    })

    const snapshots = await listRemoteSnapshotBackups(objectStore)
    expect(snapshots.map((snapshot) => snapshot.id)).toEqual([exported.entry.id])

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

    const result = await restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: exported.entry.id,
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

    expect(result.restored).toBe(2)
    expect(order).toEqual([
      'save:session:session-1',
      'save:favorite:favorite-1',
      'import:favorites',
      'import:app',
    ])
  })

  it('restores remote image assets when local metadata exists but image bytes are missing', async () => {
    const objectStore = createObjectStore()
    const exported = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: {} })),
      },
      favoriteManager: null,
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
      sections: {
        appData: false,
        favorites: false,
        imageCache: true,
        favoriteImages: false,
      },
    })
    const target = createStorage([])
    target.getMetadata.mockResolvedValue(createImage('session-1', 'metadata-only').metadata)

    const result = await restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: exported.entry.id,
      dataManager: {
        importAllData: vi.fn(async () => {}),
      },
      favoriteManager: null,
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
    })

    expect(result.restored).toBe(1)
    expect(target.saveImage).toHaveBeenCalledTimes(1)
    expect(target.store.has('session-1')).toBe(true)
  })

  it('does not restore sections that were not included in the remote snapshot', async () => {
    const objectStore = createObjectStore()
    const exportAllData = vi.fn(async () => JSON.stringify({ version: 1, data: { history: ['local'] } }))
    const exported = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData,
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: createStorage([]),
      favoriteImageStorageService: createStorage([]),
      sections: {
        appData: false,
        imageCache: false,
        favorites: true,
        favoriteImages: false,
      },
    })
    const importAllData = vi.fn(async () => {})
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))

    const result = await restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: exported.entry.id,
      dataManager: {
        importAllData,
      },
      favoriteManager: {
        importFavorites,
      },
      imageStorageService: createStorage([]),
      favoriteImageStorageService: createStorage([]),
    })

    expect(exportAllData).not.toHaveBeenCalled()
    expect(importAllData).not.toHaveBeenCalled()
    expect(importFavorites).toHaveBeenCalledTimes(1)
    expect(result.imported).toEqual({
      appData: false,
      favorites: true,
    })
  })

  it.each(['skip', 'overwrite', 'merge'] as const)(
    'forwards duplicate favorite strategy "%s" during remote restore',
    async (favoriteMergeStrategy) => {
      const objectStore = createObjectStore()
      const favoritesJson = JSON.stringify({
        version: '1.0',
        favorites: [
          { id: 'duplicate-favorite', title: 'A' },
          { id: 'new-favorite', title: 'B' },
        ],
      })
      const exported = await createRemoteSnapshotBackup({
        objectStore,
        dataManager: {
          exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: {} })),
        },
        favoriteManager: {
          exportFavorites: vi.fn(async () => favoritesJson),
        },
        imageStorageService: createStorage([]),
        favoriteImageStorageService: createStorage([]),
        sections: {
          appData: false,
          favorites: true,
          imageCache: false,
          favoriteImages: false,
        },
      })
      const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 1, errors: [] }))

      await restoreRemoteSnapshotBackup({
        objectStore,
        snapshotId: exported.entry.id,
        dataManager: {
          importAllData: vi.fn(async () => {}),
        },
        favoriteManager: {
          importFavorites,
        },
        imageStorageService: createStorage([]),
        favoriteImageStorageService: createStorage([]),
        favoriteMergeStrategy,
      })

      expect(importFavorites).toHaveBeenCalledWith(favoritesJson, {
        mergeStrategy: favoriteMergeStrategy,
      })
    },
  )

  it('runs app data last, after resource validation and favorites import', async () => {
    const objectStore = createObjectStore()
    const exported = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { models: ['remote'] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
    })
    const target = createStorage([])
    const importAllData = vi.fn(async () => {
      throw new Error('app import failed')
    })
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))

    await expect(restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: exported.entry.id,
      dataManager: { importAllData },
      favoriteManager: { importFavorites },
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
    })).rejects.toThrow('app import failed')

    expect(target.saveImage).toHaveBeenCalledTimes(1)
    expect(target.store.has('session-1')).toBe(true)
    expect(importFavorites).toHaveBeenCalledTimes(1)
  })

  it('does not write local data when strict restore validation fails', async () => {
    const manifest: RemoteSnapshotManifest = {
      schemaVersion: REMOTE_SNAPSHOT_SCHEMA_VERSION,
      snapshotId: '2026-05-06T10-30-00-000Z',
      createdAt: new Date(0).toISOString(),
      appDataPath: 'v1/snapshots/2026-05-06T10-30-00-000Z/app-data.json',
      favoritesPath: 'v1/snapshots/2026-05-06T10-30-00-000Z/favorites.json',
      assets: [{
        kind: 'image',
        store: 'imageCache',
        id: 'missing-image',
        path: 'v1/assets/imageCache/missing-image.png',
        mimeType: 'image/png',
        sizeBytes: 100,
        createdAt: 1,
        source: 'uploaded',
      }],
      missingAssets: [],
      assetCounts: { imageCache: 1, favoriteImages: 0 },
      includedSections: ['appData', 'imageCache'],
    }
    const objectStore = createObjectStore({
      [manifest.appDataPath]: JSON.stringify({ version: 1, data: {} }),
      [manifest.favoritesPath]: JSON.stringify({ version: '1.0', favorites: [] }),
      'v1/snapshots/2026-05-06T10-30-00-000Z/manifest.json': JSON.stringify(manifest),
    })
    const importAllData = vi.fn(async () => {})
    const target = createStorage([])

    await expect(restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: manifest.snapshotId,
      dataManager: { importAllData },
      favoriteManager: null,
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
    })).rejects.toThrow('validation failed')

    expect(importAllData).not.toHaveBeenCalled()
    expect(target.saveImage).not.toHaveBeenCalled()
  })

  it('does not write local data when the remote snapshot was created with missing selected assets', async () => {
    const manifest: RemoteSnapshotManifest = {
      schemaVersion: REMOTE_SNAPSHOT_SCHEMA_VERSION,
      snapshotId: '2026-05-06T10-45-00-000Z',
      createdAt: new Date(0).toISOString(),
      appDataPath: 'v1/snapshots/2026-05-06T10-45-00-000Z/app-data.json',
      favoritesPath: 'v1/snapshots/2026-05-06T10-45-00-000Z/favorites.json',
      assets: [],
      missingAssets: [{ store: 'imageCache', id: 'already-missing' }],
      assetCounts: { imageCache: 0, favoriteImages: 0 },
      includedSections: ['appData', 'imageCache'],
    }
    const objectStore = createObjectStore({
      [manifest.appDataPath]: JSON.stringify({ version: 1, data: {} }),
      [manifest.favoritesPath]: JSON.stringify({ version: '1.0', favorites: [] }),
      'v1/snapshots/2026-05-06T10-45-00-000Z/manifest.json': JSON.stringify(manifest),
    })
    const importAllData = vi.fn(async () => {})

    await expect(restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: manifest.snapshotId,
      dataManager: { importAllData },
      favoriteManager: null,
      imageStorageService: createStorage([]),
      favoriteImageStorageService: createStorage([]),
    })).rejects.toThrow('validation failed: missing=1')

    expect(importAllData).not.toHaveBeenCalled()
  })

  it('cleans only remote image assets not referenced by committed snapshots', async () => {
    const manifest: RemoteSnapshotManifest = {
      schemaVersion: REMOTE_SNAPSHOT_SCHEMA_VERSION,
      snapshotId: '2026-05-06T10-30-00-000Z',
      createdAt: new Date(0).toISOString(),
      appDataPath: 'v1/snapshots/2026-05-06T10-30-00-000Z/app-data.json',
      favoritesPath: 'v1/snapshots/2026-05-06T10-30-00-000Z/favorites.json',
      assets: [{
        kind: 'image',
        store: 'imageCache',
        id: 'kept',
        path: 'v1/assets/imageCache/kept.png',
        mimeType: 'image/png',
        sizeBytes: 3,
        createdAt: 1,
        source: 'uploaded',
      }],
      missingAssets: [],
      assetCounts: { imageCache: 1, favoriteImages: 0 },
      includedSections: ['appData', 'imageCache'],
    }
    const objectStore = createObjectStore({
      'v1/snapshots/2026-05-06T10-30-00-000Z/manifest.json': JSON.stringify(manifest),
      'v1/assets/imageCache/kept.png': new Uint8Array([1, 2, 3]),
      'v1/assets/imageCache/orphan.png': new Uint8Array([4, 5]),
    })

    const analysis = await analyzeRemoteSnapshotAssetCleanup(objectStore)
    expect(analysis.candidates.map((candidate) => candidate.path)).toEqual([
      'v1/assets/imageCache/orphan.png',
    ])

    const result = await cleanupRemoteSnapshotAssets(objectStore)
    expect(result.deleted).toBe(1)
    expect(objectStore.objects.has('v1/assets/imageCache/kept.png')).toBe(true)
    expect(objectStore.objects.has('v1/assets/imageCache/orphan.png')).toBe(false)
  })

  it('does not clean fresh orphaned assets that may belong to an unfinished snapshot', async () => {
    const objectStore = createObjectStore({
      'v1/assets/imageCache/fresh-orphan.png': new Uint8Array([4, 5]),
    })
    const object = objectStore.objects.get('v1/assets/imageCache/fresh-orphan.png')
    if (object) {
      object.updatedAt = new Date('2026-05-09T00:00:00.000Z').toISOString()
    }

    const analysis = await analyzeRemoteSnapshotAssetCleanup(objectStore, undefined, {
      now: new Date('2026-05-09T00:30:00.000Z'),
    })

    expect(analysis.candidates).toEqual([])
    const result = await cleanupRemoteSnapshotAssets(objectStore, undefined, {
      now: new Date('2026-05-09T00:30:00.000Z'),
    })
    expect(result.deleted).toBe(0)
    expect(objectStore.objects.has('v1/assets/imageCache/fresh-orphan.png')).toBe(true)
  })

  it('does not clean remote image assets when any snapshot manifest cannot be read', async () => {
    const objectStore = createObjectStore({
      'v1/snapshots/2026-05-06T10-30-00-000Z/manifest.json': '{not-json',
      'v1/assets/imageCache/orphan.png': new Uint8Array([4, 5]),
    })

    await expect(cleanupRemoteSnapshotAssets(objectStore)).rejects.toThrow(
      'Unable to safely analyze remote snapshot assets',
    )

    expect(objectStore.deleteCalls).toEqual([])
    expect(objectStore.objects.has('v1/assets/imageCache/orphan.png')).toBe(true)
  })
})
