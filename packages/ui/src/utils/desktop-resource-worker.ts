import type { AppServices } from '../types/services'
import { createDataManagerResourcePackage, importDataManagerResourcePackage } from './data-manager-resource-package'
import { base64ToBytes, bytesToArrayBuffer, sha256Hex, validateImageResourceBytes } from './image-resource-backup'
import { collectBackupImageReferences } from './image-resource-references'
import { completeSessionRestore, withSessionMaintenance, type SessionRestoreRelease } from '../stores/session/sessionConcurrency'
import { queueImageStorageMaintenance } from '../stores/session/imageStorageMaintenance'

class ResourceRefusal extends Error {
  constructor(readonly code: string) { super(code) }
}

const encode = (bytes: Uint8Array): string => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}
const digestOf = async (bytes: Uint8Array): Promise<string> => {
  const digest = await sha256Hex(bytes)
  if (!digest) throw new Error('Image digest unavailable')
  return digest
}

export function startDesktopResourceWorker(options: {
  services: AppServices
  flush(): Promise<boolean>
  prepareRestore(): Promise<(() => void) | null>
}): () => void {
  const api = window.electronAPI?.desktopResources
  if (!api) return () => {}
  let work = Promise.resolve()
  let reloading = false
  const stop = api.onRequest(packet => {
    work = work.catch(() => {}).then(async () => {
      if (reloading) { await api.complete({ id: packet.id, ok: false }); return }
      let reload = false
      try {
        const result = await withSessionMaintenance(async () => {
          const args = packet.arguments
          const services = options.services
          const stores = { imageCache: services.imageStorageService, favoriteImages: services.favoriteImageStorageService }
          if (packet.operation.startsWith('images.')) {
            if (packet.operation === 'images.delete' && !await options.flush()) throw new ResourceRefusal('WORKSPACE_BUSY')
            return queueImageStorageMaintenance(async () => {
              if (args.store !== 'imageCache' && args.store !== 'favoriteImages') throw new Error('Invalid image store')
              const store = stores[args.store]
              if (!store) throw new Error('Image store unavailable')
              if (packet.operation === 'images.list') return { metadata: await store.listAllMetadata(), statistics: await store.getStorageStats() }
              if (typeof args.id !== 'string' || !args.id || args.id.length > 256) throw new Error('Invalid image ID')
              if (packet.operation === 'images.save') {
                if (typeof args.data !== 'string' || typeof args.mimeType !== 'string') throw new Error('Invalid image')
                const bytes = base64ToBytes(args.data)
                const signatures: Record<string, boolean> = {
                  'image/png': bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71,
                  'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
                  'image/gif': String.fromCharCode(...bytes.subarray(0, 3)) === 'GIF',
                  'image/webp': String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP',
                }
                if (!signatures[args.mimeType] || await validateImageResourceBytes({ kind: 'image', id: args.id, path: '', sizeBytes: bytes.length }, bytes) !== 'ok') {
                  throw new Error('Invalid image bytes')
                }
                const existing = await store.getImage(args.id)
                if (existing && existing.data !== args.data) throw new Error('Existing image conflict')
                if (!existing) await store.saveImage({ data: args.data, metadata: { id: args.id, mimeType: args.mimeType,
                  sizeBytes: bytes.length, createdAt: Date.now(), accessedAt: Date.now(), source: 'uploaded' } }, { preventEviction: true })
                return { id: args.id, digest: await digestOf(bytes) }
              }
              const image = await store.getImage(args.id)
              if (!image) {
                if (packet.operation === 'images.delete' && typeof args.expectedDigest === 'string' && /^[a-f0-9]{64}$/.test(args.expectedDigest)) return { deleted: true, alreadyAbsent: true }
                throw new ResourceRefusal('IMAGE_NOT_FOUND')
              }
              const digest = await digestOf(base64ToBytes(image.data))
              if (packet.operation === 'images.get') return { data: image.data, metadata: image.metadata, digest }
              if (packet.operation === 'images.delete') {
                if (args.expectedDigest !== digest) throw new ResourceRefusal('IMAGE_REVISION_CONFLICT')
                const references = collectBackupImageReferences(await services.dataManager.exportAllData(), await services.favoriteManager.exportFavorites())
                if (references[args.store].has(args.id)) throw new ResourceRefusal('IMAGE_REFERENCED')
                await store.deleteImage(args.id)
                return { deleted: true }
              }
              throw new Error('Unknown operation')
            })
          }
          const shared = { dataManager: services.dataManager, favoriteManager: services.favoriteManager,
            imageStorageService: services.imageStorageService, favoriteImageStorageService: services.favoriteImageStorageService }
          if (packet.operation === 'package.export') {
            if (!await options.flush()) throw new Error('Workspace busy')
            const exported = await createDataManagerResourcePackage(shared)
            return { data: encode(new Uint8Array(await exported.blob.arrayBuffer())), manifest: exported.manifest, missingResources: exported.missingResources }
          }
          if (packet.operation === 'package.import') {
            if (typeof args.data !== 'string') throw new Error('Invalid package')
            const lease = await options.prepareRestore() as SessionRestoreRelease | null
            if (!lease) throw new Error('Workspace busy')
            try {
              const imported = await importDataManagerResourcePackage(bytesToArrayBuffer(base64ToBytes(args.data)), shared)
              completeSessionRestore(lease)
              reload = true
              return imported
            } finally { lease() }
          }
          throw new Error('Unknown operation')
        })
        const acknowledged = await api.complete({ id: packet.id, ok: true, result })
        if (reload && acknowledged) { reloading = true; window.location.reload() }
      } catch (error) { await api.complete({ id: packet.id, ok: false, code: error instanceof ResourceRefusal ? error.code : undefined }) }
    })
    void work.catch(() => {})
  })
  void api.register().catch(() => {})
  return stop
}
