import type { FavoritePrompt } from '@prompt-optimizer/core'
import { collectFavoriteAssetIds } from './favorite-asset-refs'

export type BackupImageStore = 'imageCache' | 'favoriteImages'
export type BackupImageReferences = Record<BackupImageStore, Set<string>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const parsePayload = (value: unknown): unknown => typeof value === 'string' ? JSON.parse(value) : value
const addId = (value: unknown, ids: Set<string>) => {
  if (typeof value === 'string' && value.trim()) ids.add(value.trim())
}

const collectMarkedImageRefs = (value: unknown, ids: Set<string>) => {
  if (Array.isArray(value)) {
    value.forEach(item => collectMarkedImageRefs(item, ids))
  } else if (isRecord(value)) {
    if (value._type === 'image-ref') addId(value.id, ids)
    Object.values(value).forEach(item => collectMarkedImageRefs(item, ids))
  }
}

/** Read persisted business references, including IDs absent from the image metadata table. */
export const collectBackupImageReferences = (
  appData: unknown,
  favorites: unknown,
): BackupImageReferences => {
  const references: BackupImageReferences = { imageCache: new Set(), favoriteImages: new Set() }
  const appPayload = parsePayload(appData)
  const data = isRecord(appPayload) && isRecord(appPayload.data) ? appPayload.data : appPayload
  const workspace = isRecord(data) ? data.workspaceSessions : null
  if (isRecord(workspace) && isRecord(workspace.sessions)) {
    for (const rawSnapshot of Object.values(workspace.sessions)) {
      const snapshot = parsePayload(rawSnapshot)
      if (!isRecord(snapshot)) continue
      collectMarkedImageRefs(snapshot, references.imageCache)
      addId(snapshot.testImageAssetId, references.imageCache)
      addId(snapshot.inputImageId, references.imageCache)
      if (Array.isArray(snapshot.inputImages)) {
        snapshot.inputImages.forEach(image => {
          if (isRecord(image)) addId(image.assetId, references.imageCache)
        })
      }
    }
  }

  const favoritePayload = parsePayload(favorites)
  if (isRecord(favoritePayload) && Array.isArray(favoritePayload.favorites)) {
    favoritePayload.favorites.forEach(favorite => {
      if (!isRecord(favorite)) return
      collectFavoriteAssetIds(favorite as unknown as FavoritePrompt)
        .forEach(id => references.favoriteImages.add(id))
    })
  }
  return references
}

export const findMissingBackupImageReferences = (
  references: BackupImageReferences,
  resources: Array<{ store: BackupImageStore; id: string }>,
): Array<{ store: BackupImageStore; id: string }> => {
  const available: BackupImageReferences = { imageCache: new Set(), favoriteImages: new Set() }
  resources.forEach(resource => available[resource.store].add(resource.id))
  const missing: Array<{ store: BackupImageStore; id: string }> = []
  for (const store of ['imageCache', 'favoriteImages'] as const) {
    references[store].forEach(id => {
      if (!available[store].has(id)) missing.push({ store, id })
    })
  }
  return missing
}
