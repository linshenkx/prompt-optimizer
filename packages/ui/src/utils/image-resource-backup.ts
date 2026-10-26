import type {
  FullImageData,
  IImageStorageService,
  ImageMetadata,
} from '@prompt-optimizer/core'

export type ImageResourceManifestEntryBase = {
  kind: 'image'
  id: string
  path: string
  mimeType?: string
  sizeBytes?: number
  createdAt?: number
  accessedAt?: number
  source?: ImageMetadata['source']
  metadata?: ImageMetadata['metadata']
  sha256?: string
}

export type ImageResourceRestoreReport<Problem> = {
  restored: number
  skipped: number
  missing: Problem[]
  corrupt: Problem[]
  errors: string[]
}

export type ImageResourceStorage = Pick<IImageStorageService, 'getImage' | 'saveImage'> &
  Partial<Pick<IImageStorageService, 'getConfig' | 'getStorageStats' | 'getMetadata'>>

export const copyBytes = (bytes: Uint8Array): Uint8Array => {
  const out = new globalThis.Uint8Array(bytes.byteLength)
  out.set(bytes)
  return out
}

export const bytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const view = copyBytes(bytes)
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return globalThis.btoa(binary)
}

export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = globalThis.atob(base64)
  const bytes = new globalThis.Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export const sha256Hex = async (bytes: Uint8Array): Promise<string | undefined> => {
  if (!globalThis.crypto?.subtle) return undefined
  try {
    const digestBytes: Uint8Array<ArrayBuffer> = new Uint8Array(bytes.byteLength)
    digestBytes.set(bytes)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', digestBytes)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return undefined
  }
}

export const extensionFromMimeType = (mimeType: string): string => {
  const normalized = mimeType.toLowerCase().split(';')[0].trim()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/gif') return 'gif'
  if (normalized === 'image/svg+xml') return 'svg'
  return 'bin'
}

export const safeImageResourceFileName = (
  id: string,
  mimeType: string,
  contentHash?: string,
): string =>
  [
    encodeURIComponent(id),
    ...(contentHash ? [contentHash] : []),
    extensionFromMimeType(mimeType),
  ].join('.')

export const inferMimeTypeFromBytes = (bytes: Uint8Array): string | null => {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif'
  }

  return null
}

export const resolveResourceMimeType = (
  declaredMimeType: string | undefined,
  bytes: Uint8Array,
): string =>
  inferMimeTypeFromBytes(bytes) || declaredMimeType || 'application/octet-stream'

export const normalizeImageResourceMetadata = (
  entry: ImageResourceManifestEntryBase,
  sizeBytes: number,
  mimeType: string,
): ImageMetadata => ({
  id: entry.id,
  mimeType,
  sizeBytes,
  createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
  accessedAt: Date.now(),
  source: entry.source === 'generated' ? 'generated' : 'uploaded',
  ...(entry.metadata ? { metadata: entry.metadata } : {}),
})

export const validateImageResourceBytes = async (
  entry: ImageResourceManifestEntryBase,
  bytes: Uint8Array,
): Promise<'ok' | 'empty' | 'corrupt'> => {
  if (bytes.byteLength === 0) return 'empty'

  if (entry.sha256) {
    const actualHash = await sha256Hex(bytes)
    if (!actualHash) {
      throw new Error('Image SHA-256 verification is unavailable in this browser context')
    }
    if (actualHash !== entry.sha256) {
      return 'corrupt'
    }
  }

  if (entry.sizeBytes !== undefined && (
    typeof entry.sizeBytes !== 'number' || !Number.isFinite(entry.sizeBytes) || entry.sizeBytes < 0
  )) return 'corrupt'

  if (
    !entry.sha256 &&
    typeof entry.sizeBytes === 'number' &&
    (entry.sizeBytes === 0 || Math.abs(entry.sizeBytes - bytes.byteLength) > 2)
  ) {
    return 'corrupt'
  }

  return 'ok'
}

export const createFullImageDataFromResource = (
  entry: ImageResourceManifestEntryBase,
  bytes: Uint8Array,
): FullImageData => ({
  metadata: normalizeImageResourceMetadata(
    entry,
    bytes.byteLength,
    resolveResourceMimeType(entry.mimeType, bytes),
  ),
  data: bytesToBase64(bytes),
})

/** Reusing an ID is safe only when the target has the same actual bytes. */
export const hasMatchingImageResource = async (
  entry: Pick<ImageResourceManifestEntryBase, 'id'>,
  bytes: Uint8Array,
  storageService: Pick<IImageStorageService, 'getImage'>,
): Promise<boolean> => {
  const existing = await storageService.getImage(entry.id)
  if (!existing?.data) return false

  let existingBytes: Uint8Array
  try {
    existingBytes = base64ToBytes(existing.data)
  } catch {
    throw new Error(`Image ID conflict: ${entry.id} has invalid local image bytes`)
  }
  if (existingBytes.byteLength !== bytes.byteLength ||
    !existingBytes.every((byte, index) => byte === bytes[index])) {
    throw new Error(`Image ID conflict: ${entry.id} has different local image content`)
  }
  return true
}

/** Check the union before the first write, so a restore cannot silently evict images. */
export const assertImageRestoreCapacity = async (
  images: FullImageData[],
  storageService: ImageResourceStorage,
): Promise<void> => {
  if (!images.length || !storageService.getConfig || !storageService.getStorageStats) return
  const config = storageService.getConfig()
  const stats = await storageService.getStorageStats()
  let nextCount = stats.count
  let nextBytes = stats.totalBytes
  const planned = new Map<string, FullImageData>()
  for (const image of images) {
    const previous = planned.get(image.metadata.id)
    if (previous && previous.data !== image.data) {
      throw new Error(`Image ID conflict: ${image.metadata.id} occurs with different backup content`)
    }
    planned.set(image.metadata.id, image)
  }

  for (const image of planned.values()) {
    const existing = storageService.getMetadata
      ? await storageService.getMetadata(image.metadata.id)
      : (await storageService.getImage(image.metadata.id))?.metadata
    if (!existing) nextCount += 1
    nextBytes += base64ToBytes(image.data).byteLength - (existing?.sizeBytes ?? 0)
  }
  if (typeof config.maxCount === 'number' && Number.isFinite(config.maxCount) &&
    nextCount > config.maxCount) {
    throw new Error(`Image restore exceeds storage quota: ${nextCount} images exceeds ${config.maxCount}`)
  }
  if (typeof config.maxCacheSize === 'number' && Number.isFinite(config.maxCacheSize) &&
    nextBytes > config.maxCacheSize) {
    throw new Error(`Image restore exceeds storage quota: ${nextBytes} bytes exceeds ${config.maxCacheSize}`)
  }
}

export const restoreImageResource = async (
  entry: ImageResourceManifestEntryBase,
  bytes: Uint8Array,
  storageService: ImageResourceStorage,
): Promise<'restored' | 'skipped'> => {
  if (await hasMatchingImageResource(entry, bytes, storageService)) {
    return 'skipped'
  }

  await storageService.saveImage(createFullImageDataFromResource(entry, bytes), { preventEviction: true })
  return 'restored'
}

export const hasImageResourceRestoreProblems = <Problem>(
  report: ImageResourceRestoreReport<Problem>,
): boolean =>
  report.missing.length > 0 ||
  report.corrupt.length > 0 ||
  report.errors.length > 0

export const formatImageResourceRestoreProblemDetails = <Problem>(
  report: ImageResourceRestoreReport<Problem>,
): string =>
  [
    report.missing.length ? `missing=${report.missing.length}` : '',
    report.corrupt.length ? `corrupt=${report.corrupt.length}` : '',
    report.errors.length ? `errors=${report.errors.length}` : '',
  ].filter(Boolean).join(', ')

export const assertImageResourceRestoreReportSafe = <Problem>(
  report: ImageResourceRestoreReport<Problem>,
  label: string,
): void => {
  if (!hasImageResourceRestoreProblems(report)) {
    return
  }

  throw new Error(`${label} resource validation failed: ${formatImageResourceRestoreProblemDetails(report)}`)
}
