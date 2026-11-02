import type { IImageStorageService, ImageResult } from '@prompt-optimizer/core'

import { computeStableImageId } from '../stores/session/imageStorageMaintenance'

type ImageSourceType = 'generated' | 'uploaded'

export type ImagePayload = {
  b64: string
  mimeType: string
}

const DATA_URL_BASE64_RE = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/iu

const parseDataUrlPayload = (source: string): ImagePayload | null => {
  const raw = String(source || '').trim()
  if (!raw) return null

  const match = raw.match(DATA_URL_BASE64_RE)
  if (!match) return null

  const mimeType = (match[1] || 'application/octet-stream').trim()
  const b64 = (match[2] || '').trim()
  if (!b64) return null

  return { b64, mimeType }
}

const inferMimeTypeFromBytes = (bytes: Uint8Array): string | null => {
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

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
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

const fetchImagePayloadFromUrl = async (absoluteUrl: string): Promise<ImagePayload> => {
  const resp = await fetch(absoluteUrl, { method: 'GET' })
  if (!resp.ok) {
    throw new Error(`Image request failed: ${resp.status}`)
  }

  const headerType = resp.headers.get('content-type')
  const mimeType = typeof headerType === 'string' ? headerType.split(';')[0].trim() : ''
  const ab = await resp.arrayBuffer()
  const bytes = new Uint8Array(ab)
  const inferredMimeType = inferMimeTypeFromBytes(bytes)
  const finalMimeType =
    mimeType && mimeType !== 'application/octet-stream'
      ? mimeType
      : inferredMimeType || mimeType || 'application/octet-stream'

  type BufferLike = {
    from: (data: ArrayBuffer) => { toString: (encoding: 'base64') => string }
  }

  const maybeBuffer = (globalThis as unknown as { Buffer?: BufferLike }).Buffer
  if (maybeBuffer && typeof maybeBuffer.from === 'function') {
    const b64 = maybeBuffer.from(ab).toString('base64')
    return { b64, mimeType: finalMimeType }
  }

  if (typeof FileReader === 'undefined') {
    throw new Error('FileReader is not available to decode image payload')
  }

  const blob = new Blob([ab], { type: finalMimeType })

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image blob'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })

  const parsed = parseDataUrlPayload(dataUrl)
  if (!parsed?.b64) {
    throw new Error('Failed to decode image data URL payload')
  }

  return {
    b64: parsed.b64,
    mimeType: parsed.mimeType || finalMimeType,
  }
}

export const normalizeImageSourceToPayload = async (
  source: string,
): Promise<ImagePayload | null> => {
  const raw = String(source || '').trim()
  if (!raw) return null

  const dataUrlPayload = parseDataUrlPayload(raw)
  if (dataUrlPayload) return dataUrlPayload

  if (/^https?:\/\//u.test(raw)) {
    return fetchImagePayloadFromUrl(raw)
  }

  return null
}

type PersistImagePayloadOptions = {
  payload: ImagePayload
  storageService: IImageStorageService | null | undefined
  sourceType?: ImageSourceType
  metadata?: {
    prompt?: string
    modelId?: string
    configId?: string
  }
}

const assertStorageQuotaForPayload = async (
  storageService: IImageStorageService,
  imageId: string,
  payload: ImagePayload,
): Promise<void> => {
  const config = typeof storageService.getConfig === 'function'
    ? storageService.getConfig()
    : null

  if (!config || config.quotaStrategy !== 'reject') {
    return
  }

  const existing = await storageService.getMetadata(imageId)
  if (existing) {
    return
  }

  const stats = typeof storageService.getStorageStats === 'function'
    ? await storageService.getStorageStats()
    : null

  if (!stats) {
    return
  }

  const nextCount = stats.count + 1
  const nextTotalBytes = stats.totalBytes + Math.floor(payload.b64.length * 0.75)

  if (
    typeof config.maxCount === 'number' &&
    Number.isFinite(config.maxCount) &&
    nextCount > config.maxCount
  ) {
    throw new Error(
      `Image storage quota exceeded: projected count ${nextCount} exceeds maxCount ${config.maxCount}`,
    )
  }

  if (
    typeof config.maxCacheSize === 'number' &&
    Number.isFinite(config.maxCacheSize) &&
    nextTotalBytes > config.maxCacheSize
  ) {
    throw new Error(
      `Image storage quota exceeded: projected size ${nextTotalBytes} exceeds maxCacheSize ${config.maxCacheSize}`,
    )
  }
}

export const persistImagePayloadAsAssetId = async (
  opts: PersistImagePayloadOptions,
): Promise<string | null> => {
  const { payload, storageService, sourceType = 'uploaded', metadata } = opts
  if (!storageService || !payload?.b64) return null

  const imageId = await computeStableImageId(payload.b64, payload.mimeType)
  await assertStorageQuotaForPayload(storageService, imageId, payload)
  const existing = await storageService.getMetadata(imageId)
  if (!existing) {
    await storageService.saveImage({
      metadata: {
        id: imageId,
        mimeType: payload.mimeType,
        sizeBytes: Math.floor(payload.b64.length * 0.75),
        createdAt: Date.now(),
        accessedAt: Date.now(),
        source: sourceType,
        metadata,
      },
      data: payload.b64,
    })
  }

  return imageId
}

export const normalizeGeneratedImagePayload = async (image: ImageResult['images'][number]): Promise<ImagePayload | null> => {
  if (image.b64) return parseDataUrlPayload(image.b64) || { b64: image.b64, mimeType: image.mimeType || 'image/png' }
  return image.url ? normalizeImageSourceToPayload(image.url) : null
}

export const persistGeneratedImage = async (
  image: ImageResult['images'][number], storageService: IImageStorageService | null | undefined,
  metadata?: PersistImagePayloadOptions['metadata'],
): Promise<string | null> => {
  const payload = await normalizeGeneratedImagePayload(image)
  return payload ? persistImagePayloadAsAssetId({ payload, storageService, sourceType: 'generated', metadata }) : null
}

type PersistImageSourceOptions = {
  source: string
  storageService: IImageStorageService | null | undefined
  sourceType?: ImageSourceType
  metadata?: {
    prompt?: string
    modelId?: string
    configId?: string
  }
}

/**
 * Persists an image source (data URL or http URL) into image storage and returns an asset id.
 */
export const persistImageSourceAsAssetId = async (
  opts: PersistImageSourceOptions,
): Promise<string | null> => {
  const { source, storageService, sourceType = 'uploaded', metadata } = opts
  if (!storageService) return null

  const payload = await normalizeImageSourceToPayload(source)
  if (!payload) return null

  return persistImagePayloadAsAssetId({
    payload,
    storageService,
    sourceType,
    metadata,
  })
}

type PersistImageSourcesOptions = {
  sources: string[]
  storageService: IImageStorageService | null | undefined
  sourceType?: ImageSourceType
  metadata?: {
    prompt?: string
    modelId?: string
    configId?: string
  }
}

export const persistImageSourcesAsAssetIds = async (
  opts: PersistImageSourcesOptions,
): Promise<string[]> => {
  const { sources, storageService, sourceType, metadata } = opts
  if (!storageService || !Array.isArray(sources) || sources.length === 0) return []

  const ids = await Promise.all(
    sources.map(async (source) => {
      try {
        return await persistImageSourceAsAssetId({
          source,
          storageService,
          sourceType,
          metadata,
        })
      } catch (error) {
        console.warn('[ImageAssetStorage] Failed to persist image source as asset id:', error)
        return null
      }
    }),
  )

  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}

export const resolveAssetIdToDataUrl = async (
  assetId: string,
  storageService: IImageStorageService | null | undefined,
): Promise<string | null> => {
  if (!storageService || !assetId) return null
  const fullImageData = await storageService.getImage(assetId)
  if (!fullImageData) return null

  const mimeType = fullImageData.metadata.mimeType || 'application/octet-stream'
  return `data:${mimeType};base64,${fullImageData.data}`
}
