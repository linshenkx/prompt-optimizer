import type { IImageStorageService, IPreferenceService } from '@prompt-optimizer/core'
import { hasSessionLocks, withSessionMaintenance } from './sessionConcurrency'

// Session snapshot keys (single source of truth)
export const BASIC_SYSTEM_SESSION_KEY = 'session/v1/basic-system'
export const IMAGE_TEXT2IMAGE_SESSION_KEY = 'session/v1/image-text2image'
export const IMAGE_IMAGE2IMAGE_SESSION_KEY = 'session/v1/image-image2image'
export const IMAGE_MULTIIMAGE_SESSION_KEY = 'session/v1/image-multiimage'
export const FAVORITES_STORAGE_KEY = 'favorites'

type FavoritesPayloadProvider = () => Promise<unknown> | unknown

// === Global maintenance queue ===
// Serialize image storage writes + GC to avoid race conditions where GC deletes
// images that were saved but not yet referenced by the snapshot.
let maintenanceChain: Promise<void> = Promise.resolve()

export function queueImageStorageMaintenance<T>(job: () => Promise<T>): Promise<T> {
  const next = maintenanceChain.then(job)
  maintenanceChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

// === Stable content IDs ===

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

// Small deterministic fallback hash (NOT cryptographically secure).
// Only used if WebCrypto isn't available.
const djb2Hex = (input: string) => {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(input)
    const digest = await subtle.digest('SHA-256', bytes)
    return toHex(digest)
  }

  return djb2Hex(input)
}

export async function computeStableImageId(b64: string, mimeType: string): Promise<string> {
  const normalizedMime = mimeType || 'image/png'
  const hash = await sha256Hex(`${normalizedMime}\n${b64}`)
  // Keep IDs short while still extremely collision-resistant (sha256 fallback)
  return `img_${hash.slice(0, 32)}`
}

// === GC (keep only images referenced by session snapshots + favorites) ===

function parseStoredValue(raw: unknown): unknown {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }
  return raw
}

function parseSnapshot(raw: unknown): Record<string, unknown> | null {
  const parsed = parseStoredValue(raw)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  return null
}

function collectImageRefIds(value: unknown, out: Set<string>) {
  if (!value) return

  if (Array.isArray(value)) {
    for (const item of value) collectImageRefIds(item, out)
    return
  }

  if (typeof value !== 'object') return

  const obj = value as Record<string, unknown>
  if (obj['_type'] === 'image-ref' && typeof obj['id'] === 'string') {
    out.add(obj['id'] as string)
    return
  }

  for (const key of Object.keys(obj)) {
    collectImageRefIds(obj[key], out)
  }
}

function collectFavoriteAssetIds(value: unknown, out: Set<string>) {
  if (!value) return

  if (Array.isArray(value)) {
    for (const item of value) collectFavoriteAssetIds(item, out)
    return
  }

  if (typeof value !== 'object') return

  const obj = value as Record<string, unknown>
  const assetId = obj['assetId']
  if (typeof assetId === 'string' && assetId.trim()) {
    out.add(assetId.trim())
  }

  const imageAssetIds = obj['imageAssetIds']
  if (Array.isArray(imageAssetIds)) {
    for (const id of imageAssetIds) {
      if (typeof id === 'string' && id.trim()) {
        out.add(id.trim())
      }
    }
  }

  const inputImageAssetIds = obj['inputImageAssetIds']
  if (Array.isArray(inputImageAssetIds)) {
    for (const id of inputImageAssetIds) {
      if (typeof id === 'string' && id.trim()) {
        out.add(id.trim())
      }
    }
  }

  for (const key of Object.keys(obj)) {
    collectFavoriteAssetIds(obj[key], out)
  }
}

function collectMultiImageInputAssetIds(value: unknown, out: Set<string>) {
  if (!value || typeof value !== 'object') return

  const obj = value as Record<string, unknown>
  const inputImages = obj['inputImages']
  if (!Array.isArray(inputImages)) return

  for (const item of inputImages) {
    if (!item || typeof item !== 'object') continue
    const assetId = (item as Record<string, unknown>)['assetId']
    if (typeof assetId === 'string' && assetId.trim()) {
      out.add(assetId.trim())
    }
  }
}

function collectBasicSystemTestImageAssetId(value: unknown, out: Set<string>) {
  if (!value || typeof value !== 'object') return

  const assetId = (value as Record<string, unknown>)['testImageAssetId']
  if (typeof assetId === 'string' && assetId.trim()) {
    out.add(assetId.trim())
  }
}

async function collectReferencedImageIds(
  preferenceService: IPreferenceService,
  getFavoritesPayload?: FavoritesPayloadProvider | null,
): Promise<Set<string>> {
  const referenced = new Set<string>()

  const [rawBasicSystem, rawText2Image, rawImage2Image, rawMultiImage, rawFavorites] = await Promise.all([
    preferenceService.get<unknown>(BASIC_SYSTEM_SESSION_KEY, null),
    preferenceService.get<unknown>(IMAGE_TEXT2IMAGE_SESSION_KEY, null),
    preferenceService.get<unknown>(IMAGE_IMAGE2IMAGE_SESSION_KEY, null),
    preferenceService.get<unknown>(IMAGE_MULTIIMAGE_SESSION_KEY, null),
    preferenceService.get<unknown>(FAVORITES_STORAGE_KEY, null),
  ])

  const basicSystem = parseSnapshot(rawBasicSystem)
  const text2Image = parseSnapshot(rawText2Image)
  const image2Image = parseSnapshot(rawImage2Image)
  const multiImage = parseSnapshot(rawMultiImage)
  const favorites = parseStoredValue(rawFavorites)

  if (basicSystem) {
    collectBasicSystemTestImageAssetId(basicSystem, referenced)
  }

  if (text2Image) {
    collectImageRefIds(text2Image, referenced)
  }

  if (image2Image) {
    collectImageRefIds(image2Image, referenced)
    const inputImageId = image2Image['inputImageId']
    if (typeof inputImageId === 'string' && inputImageId) {
      referenced.add(inputImageId)
    }
  }

  if (multiImage) {
    collectImageRefIds(multiImage, referenced)
    collectMultiImageInputAssetIds(multiImage, referenced)
  }

  // Backward compatibility: some builds stored favorites inside preference payload.
  if (favorites) {
    collectFavoriteAssetIds(favorites, referenced)
  }

  // Runtime source of truth: read favorites via dedicated provider to avoid relying
  // on preference key naming/serialization details.
  if (getFavoritesPayload) {
    try {
      const externalFavorites = parseStoredValue(await getFavoritesPayload())
      if (externalFavorites) {
        collectFavoriteAssetIds(externalFavorites, referenced)
      }
    } catch (error) {
      console.warn('[imageStorageMaintenance] Failed to load favorites payload for GC:', error)
    }
  }

  return referenced
}

async function runImageStorageGcNow(
  preferenceService: IPreferenceService,
  imageStorageService: IImageStorageService,
  getFavoritesPayload?: FavoritesPayloadProvider | null,
) {
  const referenced = await collectReferencedImageIds(preferenceService, getFavoritesPayload)
  const allMetadata = await imageStorageService.listAllMetadata()
  const orphanIds = allMetadata
    .map((m) => m.id)
    .filter((id) => !referenced.has(id))

  if (orphanIds.length === 0) return
  await imageStorageService.deleteImages(orphanIds)
}

let gcTimer: ReturnType<typeof setTimeout> | null = null
let gcPauseCount = 0
let pendingGcServices: {
  preferenceService: IPreferenceService
  imageStorageService: IImageStorageService
  getFavoritesPayload: FavoritesPayloadProvider | null
} | null = null
let defaultFavoritesPayloadProvider: FavoritesPayloadProvider | null = null

/** Keep imported assets alive until their session/favorite references are written. */
export function pauseImageStorageGc(): () => void {
  gcPauseCount += 1
  if (gcTimer) clearTimeout(gcTimer)
  gcTimer = null
  let released = false
  return () => {
    if (released) return
    released = true
    gcPauseCount -= 1
    if (!gcPauseCount && pendingGcServices) schedulePendingGc(0)
  }
}

function schedulePendingGc(delayMs: number) {
  if (gcPauseCount || gcTimer) return
  gcTimer = setTimeout(() => {
    gcTimer = null
    const services = pendingGcServices
    pendingGcServices = null
    if (!services) return

    void withSessionMaintenance(() => queueImageStorageMaintenance(async () => {
      // A GC queued before the lease must not run after import starts either.
      if (gcPauseCount) {
        pendingGcServices ??= services
        return
      }
      try {
        await runImageStorageGcNow(
          services.preferenceService,
          services.imageStorageService,
          services.getFavoritesPayload,
        )
      } catch (e) {
        console.error('[imageStorageMaintenance] GC failed:', e)
      }
    })).catch(error => console.error('[imageStorageMaintenance] GC coordination failed:', error))
  }, delayMs)
}

/**
 * Best-effort schedule for image storage GC.
 * Coalesces multiple calls into a single run and serializes with saveSession().
 */
export function scheduleImageStorageGc(
  preferenceService: IPreferenceService,
  imageStorageService: IImageStorageService,
  opts?: {
    delayMs?: number
    /** Optional runtime provider of favorites payload for asset reachability scan. */
    getFavoritesPayload?: FavoritesPayloadProvider | null
  },
) {
  // LAN HTTP can use IndexedDB CAS without Web Locks. Keep orphan images rather
  // than race another window importing assets whose references are not saved yet.
  // Explicit storage-management actions remain available; this GC is best-effort.
  if (preferenceService.compareAndSet && !hasSessionLocks()) return
  const hasFavoritesProviderOverride = !!opts && Object.prototype.hasOwnProperty.call(opts, 'getFavoritesPayload')
  if (hasFavoritesProviderOverride) {
    defaultFavoritesPayloadProvider = opts?.getFavoritesPayload ?? null
  }

  pendingGcServices = {
    preferenceService,
    imageStorageService,
    getFavoritesPayload: hasFavoritesProviderOverride
      ? (opts?.getFavoritesPayload ?? null)
      : defaultFavoritesPayloadProvider,
  }

  schedulePendingGc(opts?.delayMs ?? 0)
}
