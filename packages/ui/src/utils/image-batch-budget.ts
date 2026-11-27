import type { ImageInputRef } from '@prompt-optimizer/core'
import { DEFAULT_MAX_IMAGE_BYTES, prepareImageFiles, type ImageCompressionOptions } from './image-compression'

export interface ImageBatchCompressionOptions extends ImageCompressionOptions {
  maxTotalBytes: number
}

// Estimates inline Base64 and per-image framing. Text and provider-specific fields are excluded.
export const estimateImageRequestBytes = (
  images: readonly Pick<ImageInputRef, 'b64' | 'mimeType'>[],
) => images.reduce((total, image) => total + image.b64.length + (image.mimeType?.length ?? 0) + 32, 0)

export const prepareImageBatchForBudget = async (
  files: readonly File[],
  confirmMaterialChange: Parameters<typeof prepareImageFiles>[1],
  { maxTotalBytes, maxBytes = DEFAULT_MAX_IMAGE_BYTES, ...options }: ImageBatchCompressionOptions,
) => {
  if (!files.length) return []
  const perImageBytes = Math.floor(maxTotalBytes / files.length)
  if (!Number.isFinite(perImageBytes) || perImageBytes < 1) {
    throw new RangeError('Image batch byte budget is too small or invalid')
  }
  return prepareImageFiles(files, confirmMaterialChange, {
    ...options,
    maxBytes: Math.min(maxBytes, perImageBytes),
  })
}
