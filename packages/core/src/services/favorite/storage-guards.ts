import type { FavoritePrompt } from './types'
import { FavoriteValidationError } from './errors'
import { TypeMapper } from './type-mapper'

const TEXT_ENCODER = new TextEncoder()

export const INLINE_IMAGE_DATA_URL_RE = /^data:image\/[a-z0-9.+-]+(?:;charset=[^;,]+)?;base64,/iu

export const FAVORITE_ITEM_HARD_LIMIT_BYTES = 512 * 1024
export const FAVORITES_SOFT_LIMIT_BYTES = 2 * 1024 * 1024
export const FAVORITES_HARD_LIMIT_BYTES = 8 * 1024 * 1024
const FAVORITES_SOFT_WARNING_HEADROOM_BYTES = 8 * 1024

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isFunctionMode = (
  value: unknown,
): value is FavoritePrompt['functionMode'] =>
  value === 'basic' || value === 'context' || value === 'image' || value === 'video'

const isOptimizationMode = (
  value: unknown,
): value is NonNullable<FavoritePrompt['optimizationMode']> =>
  value === 'system' || value === 'user'

const isImageSubMode = (
  value: unknown,
): value is NonNullable<FavoritePrompt['imageSubMode']> =>
  value === 'text2image' || value === 'image2image' || value === 'multiimage'

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const parseTimestamp = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber) && asNumber >= 0) {
      return asNumber
    }

    const asDate = Date.parse(value)
    if (!Number.isNaN(asDate) && asDate >= 0) {
      return asDate
    }
  }

  return fallback
}

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean),
    ),
  )
}

export const getSerializedByteLength = (value: string): number =>
  TEXT_ENCODER.encode(value).byteLength

export const assertFavoriteMetadataHasNoInlineImages = (
  value: unknown,
  path = 'metadata',
  seen: WeakSet<object> = new WeakSet(),
): void => {
  if (typeof value === 'string') {
    if (INLINE_IMAGE_DATA_URL_RE.test(value.trim())) {
      throw new FavoriteValidationError(
        `Favorite metadata cannot contain inline image data URLs (${path})`,
      )
    }
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  if (seen.has(value as object)) {
    return
  }
  seen.add(value as object)

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertFavoriteMetadataHasNoInlineImages(item, `${path}[${index}]`, seen)
    })
    return
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    assertFavoriteMetadataHasNoInlineImages(child, `${path}.${key}`, seen)
  })
}

export const assertFavoriteFitsItemBudget = (favorite: FavoritePrompt): number => {
  const serializedFavorite = JSON.stringify(favorite)
  const itemBytes = getSerializedByteLength(serializedFavorite)

  if (itemBytes > FAVORITE_ITEM_HARD_LIMIT_BYTES) {
    throw new FavoriteValidationError(
      `Favorite entry exceeds hard limit of ${FAVORITE_ITEM_HARD_LIMIT_BYTES} bytes`,
    )
  }

  return itemBytes
}

export const assertFavoritesPayloadWithinBudget = (
  favorites: FavoritePrompt[],
  options?: {
    warnOnSoftLimit?: boolean
    logWarning?: (message: string) => void
  },
): {
  totalBytes: number
  softLimitExceeded: boolean
} => {
  favorites.forEach((favorite) => {
    assertFavoriteMetadataHasNoInlineImages(favorite.metadata)
    assertFavoriteFitsItemBudget(favorite)
  })

  const totalBytes = getSerializedByteLength(JSON.stringify(favorites))
  if (totalBytes > FAVORITES_HARD_LIMIT_BYTES) {
    throw new FavoriteValidationError(
      `favorites payload exceeds hard limit of ${FAVORITES_HARD_LIMIT_BYTES} bytes`,
    )
  }

  const softLimitExceeded =
    totalBytes > FAVORITES_SOFT_LIMIT_BYTES - FAVORITES_SOFT_WARNING_HEADROOM_BYTES
  if (softLimitExceeded && options?.warnOnSoftLimit) {
    const logWarning = options.logWarning ?? console.warn
    logWarning(
      `favorites payload exceeds soft limit (${totalBytes} bytes > ${FAVORITES_SOFT_LIMIT_BYTES} bytes)`,
    )
  }

  return {
    totalBytes,
    softLimitExceeded,
  }
}

export const normalizeFavoriteRecord = (
  value: unknown,
  fallbackTimestamp = Date.now(),
): FavoritePrompt => {
  if (!isPlainObject(value)) {
    throw new FavoriteValidationError('Favorite entry must be an object')
  }

  const raw = value as Record<string, unknown>
  const rawContent = typeof raw.content === 'string' ? raw.content : ''
  if (!rawContent.trim()) {
    throw new FavoriteValidationError('Favorite prompt content cannot be empty')
  }

  const content = rawContent
  const metadata = isPlainObject(raw.metadata) ? { ...raw.metadata } : undefined
  const originalContent = toTrimmedString(raw.originalContent)
  const nextMetadata = originalContent
    ? { ...(metadata || {}), originalContent }
    : metadata

  assertFavoriteMetadataHasNoInlineImages(nextMetadata)

  let functionMode: FavoritePrompt['functionMode'] = isFunctionMode(raw.functionMode)
    ? raw.functionMode
    : 'basic'
  let optimizationMode: FavoritePrompt['optimizationMode'] = isOptimizationMode(
    raw.optimizationMode,
  )
    ? raw.optimizationMode
    : undefined
  let imageSubMode: FavoritePrompt['imageSubMode'] = isImageSubMode(raw.imageSubMode)
    ? raw.imageSubMode
    : undefined

  if (!isFunctionMode(raw.functionMode)) {
    optimizationMode = 'system'
  }

  if (functionMode === 'basic' || functionMode === 'context') {
    imageSubMode = undefined
    if (!optimizationMode) {
      optimizationMode = 'system'
    }
  } else {
    optimizationMode = undefined
  }

  const mapping = {
    functionMode,
    optimizationMode,
    imageSubMode,
  }

  if (!TypeMapper.validateMapping(mapping)) {
    throw new FavoriteValidationError(
      `Invalid favorite mode mapping: functionMode=${String(functionMode)}, optimizationMode=${String(optimizationMode)}, imageSubMode=${String(imageSubMode)}`,
    )
  }

  const createdAt = parseTimestamp(raw.createdAt, fallbackTimestamp)
  const updatedAt = parseTimestamp(raw.updatedAt, createdAt)
  const title =
    toTrimmedString(raw.title) ||
    (content.length > 50 ? `${content.slice(0, 50)}...` : content)

  const favorite: FavoritePrompt = {
    id:
      toTrimmedString(raw.id) ||
      `fav_salvaged_${createdAt}_${Math.random().toString(36).slice(2, 11)}`,
    title,
    content,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    createdAt,
    updatedAt,
    tags: normalizeTags(raw.tags),
    category: toTrimmedString(raw.category),
    useCount:
      typeof raw.useCount === 'number' && Number.isFinite(raw.useCount) && raw.useCount >= 0
        ? raw.useCount
        : 0,
    functionMode,
    optimizationMode:
      functionMode === 'basic' || functionMode === 'context'
        ? (optimizationMode as 'system' | 'user')
        : undefined,
    imageSubMode:
      functionMode === 'image'
        ? (imageSubMode as 'text2image' | 'image2image' | 'multiimage')
        : undefined,
    metadata: nextMetadata,
  }

  assertFavoriteFitsItemBudget(favorite)

  return favorite
}
