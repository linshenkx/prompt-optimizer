import { describe, expect, it, vi } from 'vitest'
import type { FullImageData } from '@prompt-optimizer/core'
import { DataManager } from '../../../../core/src/services/data/manager'
import { PreferenceService } from '../../../../core/src/services/preference/service'
import { MemoryStorageProvider } from '../../../../core/src/services/storage/memoryStorageProvider'
import {
  createDataManagerResourcePackage,
  importDataManagerResourcePackage,
} from '../../../src/utils/data-manager-resource-package'
import {
  createRemoteSnapshotBackup,
  restoreRemoteSnapshotBackup,
} from '../../../src/utils/remote-snapshot-backup'
import type { RemoteObjectStore } from '../../../src/utils/remote-backup'
import { allowConsole } from '../../utils/error-detection'

const createManager = (preferences: PreferenceService) => {
  const collection = () => ({ exportData: vi.fn(async () => []), importData: vi.fn(async () => {}) })
  const models = collection()
  const manager = new DataManager(
    models as unknown as ConstructorParameters<typeof DataManager>[0],
    collection() as unknown as ConstructorParameters<typeof DataManager>[1],
    collection() as unknown as ConstructorParameters<typeof DataManager>[2],
    preferences,
    { exportData: async () => ({}), importData: async () => {} } as unknown as ConstructorParameters<typeof DataManager>[4],
  )
  return { manager, models }
}

const imageFor = (id: string): FullImageData => ({
  metadata: { id, mimeType: 'image/png', sizeBytes: id.length, source: 'generated', createdAt: 1, accessedAt: 1 },
  data: btoa(id),
})

const createImages = (images: FullImageData[]) => {
  const values = new Map(images.map(image => [image.metadata.id, image]))
  return {
    values,
    listAllMetadata: async () => [...values.values()].map(image => image.metadata),
    getImage: async (id: string) => values.get(id) ?? null,
    getMetadata: async (id: string) => values.get(id)?.metadata ?? null,
    saveImage: async (image: FullImageData) => { values.set(image.metadata.id, image); return image.metadata.id },
  }
}

const createObjectStore = (): RemoteObjectStore => {
  const objects = new Map<string, ArrayBuffer>()
  const get = async (path: string) => {
    const bytes = objects.get(path)
    if (!bytes) throw new Error(`Missing ${path}`)
    return bytes.slice(0)
  }
  return {
    provider: 'google-drive',
    detect: async () => ({ ok: true, provider: 'google-drive', steps: [] }),
    exists: async path => objects.has(path),
    put: async (path, body) => {
      const bytes = typeof body === 'string' ? new TextEncoder().encode(body).buffer
        : body instanceof Blob ? await body.arrayBuffer()
          : body instanceof Uint8Array ? new Uint8Array(body).buffer : body
      objects.set(path, bytes)
      return { path, sizeBytes: bytes.byteLength }
    },
    get,
    getText: async path => new TextDecoder().decode(await get(path)),
    list: async prefix => [...objects].filter(([path]) => path.startsWith(prefix))
      .map(([path, bytes]) => ({ path, sizeBytes: bytes.byteLength })),
  }
}

const snapshotFor = (id: string) => ({
  originalPrompt: `${id} prompt`, optimizedPrompt: `${id} draft`,
  originalImageResult: { images: [{ _type: 'image-ref', id, mimeType: 'image/png' }] },
})

describe.each(['zip', 'remote'] as const)('%s workspace final commit', format => {
  it.each(['favorites rejection', 'favorites reported error', 'model import failure'] as const)(
    'preserves the previous workspace after %s and restores it only on successful retry', async failure => {
      if (failure === 'model import failure') allowConsole(/Failed to import models/)
      const sourcePreferences = new PreferenceService(new MemoryStorageProvider())
      const source = createManager(sourcePreferences)
      const sourceImages = createImages([imageFor('incoming-image')])
      const sourceSnapshot = snapshotFor('incoming-image')
      await sourcePreferences.set('session/v1/image-text2image', sourceSnapshot)
      const sourceOptions = {
        dataManager: source.manager,
        favoriteManager: { exportFavorites: async () => JSON.stringify({ version: '1.0', favorites: [] }) },
        imageStorageService: sourceImages,
        favoriteImageStorageService: createImages([]),
      }

      const targetPreferences = new PreferenceService(new MemoryStorageProvider())
      const target = createManager(targetPreferences)
      const oldSnapshot = snapshotFor('local-image')
      await targetPreferences.set('session/v1/image-text2image', oldSnapshot)
      const targetImages = createImages([imageFor('local-image')])
      const importFavorites = vi.fn(async () => ({ imported: 0, skipped: 0, errors: [] as string[] }))
      if (failure === 'favorites rejection') importFavorites.mockRejectedValueOnce(new Error('Favorite storage unavailable'))
      if (failure === 'favorites reported error') {
        importFavorites.mockResolvedValueOnce({ imported: 0, skipped: 0, errors: ['Favorite write failed'] })
      }
      if (failure === 'model import failure') target.models.importData.mockRejectedValueOnce(new Error('Model storage unavailable'))
      const targetOptions = {
        dataManager: target.manager,
        favoriteManager: { importFavorites },
        imageStorageService: targetImages,
        favoriteImageStorageService: createImages([]),
      }
      let restore: () => Promise<unknown>
      if (format === 'zip') {
        const exported = await createDataManagerResourcePackage(sourceOptions)
        const bytes = await exported.blob.arrayBuffer()
        restore = () => importDataManagerResourcePackage(bytes, targetOptions)
      } else {
        const objectStore = createObjectStore()
        const exported = await createRemoteSnapshotBackup({ objectStore, ...sourceOptions })
        restore = () => restoreRemoteSnapshotBackup({ objectStore, snapshotId: exported.entry.id, ...targetOptions })
      }

      // Exercise the actual package/snapshot importer and core coordinator, not
      // a rejected mock of importAllData. Images have already been restored.
      await expect(restore()).rejects.toThrow()
      expect(targetImages.values.has('incoming-image')).toBe(true)
      expect(targetImages.values.has('local-image')).toBe(true)
      expect(await targetPreferences.get('session/v1/image-text2image', null)).toEqual(oldSnapshot)

      await restore()
      expect(await targetPreferences.get('session/v1/image-text2image', null)).toEqual(sourceSnapshot)
      expect(targetImages.values.get('incoming-image')?.data).toBe(sourceImages.values.get('incoming-image')?.data)
    },
  )
})
