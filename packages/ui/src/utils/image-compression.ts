import {
  DEFAULT_IMAGE_INPUT_POLICY,
  normalizeImageMimeType,
  type ImageInputRef,
} from '@prompt-optimizer/core'

export const DEFAULT_MAX_IMAGE_BYTES = DEFAULT_IMAGE_INPUT_POLICY.maxOutputBytes
export const DEFAULT_MAX_SOURCE_IMAGE_BYTES = DEFAULT_IMAGE_INPUT_POLICY.maxSourceBytes
export const DEFAULT_MAX_IMAGE_DIMENSION = DEFAULT_IMAGE_INPUT_POLICY.maxDimension

const MATERIAL_DIMENSION_RATIO = 0.8
const MATERIAL_JPEG_QUALITY = 0.8

export type ImageCompressionReason = 'dimensions' | 'quality'

export class ImagePreparationError extends Error {
  constructor(
    public readonly code: 'unsupported-type' | 'source-too-large' | 'compression-failed',
    message: string,
  ) {
    super(message)
    this.name = 'ImagePreparationError'
  }
}

export interface DecodedImageSource {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

export interface ImageCompressionRuntime {
  decode: (file: File) => Promise<DecodedImageSource>
  encode: (
    image: DecodedImageSource,
    width: number,
    height: number,
    mimeType: string,
    quality?: number,
  ) => Promise<Blob>
}

export interface ImageCompressionOptions {
  maxBytes?: number
  maxSourceBytes?: number
  maxDimension?: number
  runtime?: ImageCompressionRuntime
}

export interface ImageCompressionResult {
  file: File
  compressed: boolean
  originalBytes: number
  outputBytes: number
  originalWidth: number
  originalHeight: number
  outputWidth: number
  outputHeight: number
  outputQuality?: number
  requiresConfirmation: boolean
  confirmationReasons: ImageCompressionReason[]
}

const loadImageElement = (file: File): Promise<DecodedImageSource> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(objectUrl),
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to decode image'))
    }
    image.src = objectUrl
  })

const browserRuntime: ImageCompressionRuntime = {
  async decode(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file)
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          dispose: () => bitmap.close(),
        }
      } catch {
        // Some embedded browsers expose createImageBitmap but reject valid images.
      }
    }

    return loadImageElement(file)
  },

  encode(image, width, height, mimeType, quality) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Canvas is unavailable'))
        return
      }

      if (mimeType === 'image/jpeg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
      }
      context.drawImage(image.source, 0, 0, width, height)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to encode image')),
        mimeType,
        quality,
      )
    })
  },
}

const clampDimension = (value: number) => Math.max(1, Math.round(value))

const nextScale = (blobBytes: number, maxBytes: number) => {
  const estimated = Math.sqrt(maxBytes / blobBytes) * 0.92
  return Math.min(0.9, Math.max(0.5, estimated))
}

const createResult = (
  file: File,
  outputFile: File,
  originalWidth: number,
  originalHeight: number,
  outputWidth: number,
  outputHeight: number,
  outputQuality?: number,
): ImageCompressionResult => {
  const originalLongEdge = Math.max(originalWidth, originalHeight)
  const outputLongEdge = Math.max(outputWidth, outputHeight)
  const confirmationReasons: ImageCompressionReason[] = []

  if (outputLongEdge / originalLongEdge < MATERIAL_DIMENSION_RATIO) {
    confirmationReasons.push('dimensions')
  }
  if (outputQuality !== undefined && outputQuality < MATERIAL_JPEG_QUALITY) {
    confirmationReasons.push('quality')
  }

  return {
    file: outputFile,
    compressed: outputFile !== file,
    originalBytes: file.size,
    outputBytes: outputFile.size,
    originalWidth,
    originalHeight,
    outputWidth,
    outputHeight,
    outputQuality,
    requiresConfirmation: confirmationReasons.length > 0,
    confirmationReasons,
  }
}

export const compressImageFile = async (
  file: File,
  options: ImageCompressionOptions = {},
): Promise<ImageCompressionResult> => {
  const mimeType = normalizeImageMimeType(file.type)
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
    throw new ImagePreparationError('unsupported-type', `Unsupported image MIME type: ${file.type || 'unknown'}`)
  }

  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_IMAGE_BYTES
  if (file.size > maxSourceBytes) {
    throw new ImagePreparationError('source-too-large', `Image exceeds ${maxSourceBytes} bytes`)
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION
  const runtime = options.runtime ?? browserRuntime
  const decoded = await runtime.decode(file)

  try {
    const dimensionLimitScale = Math.min(
      1,
      maxDimension / Math.max(decoded.width, decoded.height),
    )
    let width = clampDimension(decoded.width * dimensionLimitScale)
    let height = clampDimension(decoded.height * dimensionLimitScale)

    if (file.size <= maxBytes && dimensionLimitScale === 1 && file.type === mimeType) {
      return createResult(
        file,
        file,
        decoded.width,
        decoded.height,
        decoded.width,
        decoded.height,
      )
    }

    let quality: number | undefined = mimeType === 'image/jpeg'
      ? DEFAULT_IMAGE_INPUT_POLICY.jpegQuality
      : undefined
    let smallestBlob: Blob | null = null
    let smallestWidth = width
    let smallestHeight = height
    let smallestQuality = quality

    for (let attempt = 0; attempt < DEFAULT_IMAGE_INPUT_POLICY.maxAttempts; attempt += 1) {
      const blob = await runtime.encode(decoded, width, height, mimeType, quality)

      if (!smallestBlob || blob.size < smallestBlob.size) {
        smallestBlob = blob
        smallestWidth = width
        smallestHeight = height
        smallestQuality = quality
      }

      if (blob.size <= maxBytes) {
        const outputFile = new File([blob], file.name, {
          type: mimeType,
          lastModified: file.lastModified,
        })
        return createResult(
          file,
          outputFile,
          decoded.width,
          decoded.height,
          width,
          height,
          quality,
        )
      }

      if (quality !== undefined && quality > DEFAULT_IMAGE_INPUT_POLICY.minJpegQuality) {
        quality = Math.max(
          DEFAULT_IMAGE_INPUT_POLICY.minJpegQuality,
          Number((quality - 0.05).toFixed(2)),
        )
        continue
      }

      const scale = nextScale(blob.size, maxBytes)
      const nextWidth = clampDimension(width * scale)
      const nextHeight = clampDimension(height * scale)
      if (
        (nextWidth === width && nextHeight === height)
        || (width <= DEFAULT_IMAGE_INPUT_POLICY.minDimension && height <= DEFAULT_IMAGE_INPUT_POLICY.minDimension)
      ) {
        break
      }

      width = nextWidth
      height = nextHeight
      quality = mimeType === 'image/jpeg' ? 0.82 : undefined
    }

    throw new ImagePreparationError(
      'compression-failed',
      `Unable to compress image below ${maxBytes} bytes (smallest: ${smallestBlob?.size ?? file.size} bytes at ${smallestWidth}x${smallestHeight}, quality ${smallestQuality ?? 'lossless'})`,
    )
  } finally {
    decoded.dispose()
  }
}

export const prepareImageFiles = async (
  files: readonly File[],
  confirmMaterialChange: (results: readonly ImageCompressionResult[]) => Promise<boolean>,
  options: ImageCompressionOptions = {},
): Promise<ImageCompressionResult[] | null> => {
  const results = await Promise.all(files.map((file) => compressImageFile(file, options)))
  const materialChanges = results.filter((result) => result.requiresConfirmation)
  if (materialChanges.length > 0 && !await confirmMaterialChange(materialChanges)) {
    return null
  }
  return results
}

export const fileToImageInputRef = async (file: File): Promise<ImageInputRef> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
  return {
    b64: dataUrl.split(',', 2)[1] || '',
    mimeType: normalizeImageMimeType(file.type) || 'image/png',
  }
}

export const imageInputRefToFile = (
  image: Pick<ImageInputRef, 'b64' | 'mimeType'>,
  index = 0,
): File => {
  const mimeType = normalizeImageMimeType(image.mimeType) || 'image/png'
  const binary = atob(image.b64)
  const bytes = new Uint8Array(binary.length)
  for (let offset = 0; offset < binary.length; offset += 1) {
    bytes[offset] = binary.charCodeAt(offset)
  }
  const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png'
  return new File([bytes], `image-${index + 1}.${extension}`, { type: mimeType })
}

export const formatImageBytes = (bytes: number) => {
  const megabytes = bytes / (1024 * 1024)
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`
}

export const formatImageDimensions = (width: number, height: number) => `${width}×${height}`
