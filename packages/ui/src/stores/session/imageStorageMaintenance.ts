import type { IImageStorageService, IPreferenceService } from '@prompt-optimizer/core'

// Session snapshot keys (single source of truth)
export const IMAGE_TEXT2IMAGE_SESSION_KEY = 'session/v1/image-text2image'
export const IMAGE_IMAGE2IMAGE_SESSION_KEY = 'session/v1/image-image2image'

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

// === GC (keep only images referenced by the two session snapshots) ===

function parseSnapshot(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
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

async function collectReferencedImageIds(
  preferenceService: IPreferenceService,
): Promise<Set<string>> {
  const referenced = new Set<string>()

  const [rawText2Image, rawImage2Image] = await Promise.all([
    preferenceService.get<unknown>(IMAGE_TEXT2IMAGE_SESSION_KEY, null),
    preferenceService.get<unknown>(IMAGE_IMAGE2IMAGE_SESSION_KEY, null),
  ])

  const text2Image = parseSnapshot(rawText2Image)
  const image2Image = parseSnapshot(rawImage2Image)

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

  return referenced
}

async function runImageStorageGcNow(
  preferenceService: IPreferenceService,
  imageStorageService: IImageStorageService,
) {
  const referenced = await collectReferencedImageIds(preferenceService)
  const allMetadata = await imageStorageService.listAllMetadata()
  const orphanIds = allMetadata
    .map((m) => m.id)
    .filter((id) => !referenced.has(id))

  if (orphanIds.length === 0) return
  await imageStorageService.deleteImages(orphanIds)
}

let gcTimer: ReturnType<typeof setTimeout> | null = null
let pendingGcServices: {
  preferenceService: IPreferenceService
  imageStorageService: IImageStorageService
} | null = null

/**
 * Best-effort schedule for image storage GC.
 * Coalesces multiple calls into a single run and serializes with saveSession().
 */
export function scheduleImageStorageGc(
  preferenceService: IPreferenceService,
  imageStorageService: IImageStorageService,
  opts?: { delayMs?: number },
) {
  pendingGcServices = { preferenceService, imageStorageService }

  if (gcTimer) return
  gcTimer = setTimeout(() => {
    gcTimer = null
    const services = pendingGcServices
    pendingGcServices = null
    if (!services) return

    void queueImageStorageMaintenance(async () => {
      try {
        await runImageStorageGcNow(services.preferenceService, services.imageStorageService)
      } catch (e) {
        console.error('[imageStorageMaintenance] GC failed:', e)
      }
    })
  }, opts?.delayMs ?? 0)
}
