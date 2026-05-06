import type { ImageInputCompatibilityOptions, ImageInputRef } from './types'

const STANDARD_LLM_INPUT_MIME_TYPES = new Set(['image/png', 'image/jpeg'])
const MAX_LLM_INPUT_IMAGE_BYTES = 10 * 1024 * 1024

export function isStandardLlmInputMimeType(mimeType?: string): boolean {
  const mime = mimeType?.trim().toLowerCase()
  return !mime || STANDARD_LLM_INPUT_MIME_TYPES.has(mime)
}

export async function normalizeImageInputForLlm<T extends ImageInputRef>(
  input: T,
  options: ImageInputCompatibilityOptions = {}
): Promise<T> {
  if (input.mimeType?.trim().toLowerCase() === 'image/jpg') {
    return {
      ...input,
      mimeType: 'image/jpeg',
    }
  }

  if (isStandardLlmInputMimeType(input.mimeType)) {
    return input
  }

  const converter = options.imageInputConverter ?? convertImageInputWithBrowserCanvas
  if (!converter) {
    return input
  }

  try {
    const converted = await converter({ b64: input.b64, mimeType: input.mimeType })
    if (!converted?.b64 || estimateBase64Bytes(converted.b64) > MAX_LLM_INPUT_IMAGE_BYTES) {
      return input
    }

    return {
      ...input,
      b64: stripDataUrlPrefix(converted.b64),
      mimeType: converted.mimeType || 'image/png',
    }
  } catch {
    return input
  }
}

export async function normalizeImageInputsForLlm<T extends ImageInputRef>(
  inputs: readonly T[] | undefined,
  options: ImageInputCompatibilityOptions = {}
): Promise<T[] | undefined> {
  if (!inputs) {
    return undefined
  }

  return await Promise.all(inputs.map((input) => normalizeImageInputForLlm(input, options)))
}

async function convertImageInputWithBrowserCanvas(input: ImageInputRef): Promise<ImageInputRef | null> {
  if (!canUseBrowserCanvasConversion()) {
    return null
  }

  const bytes = decodeBase64(stripDataUrlPrefix(input.b64))
  if (!bytes) {
    return null
  }

  const blob = new Blob([toArrayBuffer(bytes)], { type: input.mimeType || 'application/octet-stream' })
  const bitmap = await createImageBitmap(blob)
  try {
    const pngBlob = await renderBitmapToPngBlob(bitmap)
    if (!pngBlob) {
      return null
    }

    const b64 = await blobToBase64(pngBlob)
    return { b64, mimeType: 'image/png' }
  } finally {
    bitmap.close()
  }
}

function canUseBrowserCanvasConversion(): boolean {
  return (
    typeof Blob !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    (typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined')
  )
}

async function renderBitmapToPngBlob(bitmap: ImageBitmap): Promise<Blob | null> {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.drawImage(bitmap, 0, 0)
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.drawImage(bitmap, 0, 0)
    return await canvas.convertToBlob({ type: 'image/png' })
  }

  return null
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  return encodeBase64(new Uint8Array(buffer))
}

function decodeBase64(base64: string): Uint8Array | null {
  if (!base64) {
    return null
  }

  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  return null
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
  }

  return ''
}

function estimateBase64Bytes(base64: string): number {
  const cleanBase64 = stripDataUrlPrefix(base64)
  const padding = cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0
  return Math.floor((cleanBase64.length * 3) / 4) - padding
}

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(',')
  return value.startsWith('data:') && commaIndex >= 0 ? value.slice(commaIndex + 1) : value
}
