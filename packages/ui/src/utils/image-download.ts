type UrlApi = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>

type DownloadImageSourceOptions = {
  filename?: string
  fetchImpl?: typeof fetch
  urlApi?: UrlApi
  mimeType?: string | null
  now?: Date
}

type BuildImageDownloadFilenameOptions = {
  filename?: string
  src?: string | null
  mimeType?: string | null
  now?: Date
}

const DEFAULT_EXTENSION = 'png'
const DEFAULT_FILENAME_PREFIX = 'prompt-optimizer'

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
}

const DATA_URL_PATTERN = /^data:([^;,]+)?(?:;base64)?,/i
const HTTP_URL_PATTERN = /^https?:\/\//i
const BLOB_URL_PATTERN = /^blob:/i

const inferExtensionFromMime = (mimeType: string | null | undefined): string | undefined => {
  if (!mimeType) return undefined
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()]
}

const inferExtensionFromFilename = (filename: string): string | undefined => {
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex < 0 || lastDotIndex === filename.length - 1) {
    return undefined
  }

  const rawExtension = filename.slice(lastDotIndex + 1).trim().toLowerCase()
  if (!rawExtension) return undefined
  return rawExtension === 'jpeg' ? 'jpg' : rawExtension
}

const ensureFilename = (baseName: string, extension?: string): string => {
  if (!extension) return baseName
  if (baseName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
    return baseName
  }
  return `${baseName}.${extension}`
}

const inferFilenameFromSource = (src: string): string | undefined => {
  const dataUrlMatch = src.match(DATA_URL_PATTERN)
  if (dataUrlMatch) {
    return ensureFilename(DEFAULT_FILENAME_PREFIX, inferExtensionFromMime(dataUrlMatch[1]))
  }

  try {
    const url = new URL(src, 'http://local.invalid')
    const lastSegment = url.pathname.split('/').filter(Boolean).pop()
    if (lastSegment) {
      return decodeURIComponent(lastSegment)
    }
  } catch {
    // Ignore parsing failures and fall through to default filename.
  }

  return undefined
}

const formatTimestampPart = (value: number, length = 2): string => String(value).padStart(length, '0')

const formatTimestamp = (date: Date): string =>
  `${date.getFullYear()}${formatTimestampPart(date.getMonth() + 1)}${formatTimestampPart(date.getDate())}-${formatTimestampPart(date.getHours())}${formatTimestampPart(date.getMinutes())}${formatTimestampPart(date.getSeconds())}-${formatTimestampPart(date.getMilliseconds(), 3)}`

const inferDownloadExtension = (options: {
  filename?: string
  src?: string | null
  mimeType?: string | null
}): string => {
  return (
    inferExtensionFromFilename(options.filename || '') ||
    inferExtensionFromMime(options.mimeType) ||
    inferExtensionFromFilename(inferFilenameFromSource(options.src || '') || '') ||
    DEFAULT_EXTENSION
  )
}

export const buildImageDownloadFilename = (
  options: BuildImageDownloadFilenameOptions = {},
): string => {
  const trimmedFilename = options.filename?.trim()
  if (trimmedFilename) {
    return trimmedFilename
  }

  const extension = inferDownloadExtension(options)
  return `${DEFAULT_FILENAME_PREFIX}-${formatTimestamp(options.now || new Date())}.${extension}`
}

const triggerAnchorDownload = (url: string, filename: string) => {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

const decodeBase64Payload = (payload: string): ArrayBuffer => {
  const binary = globalThis.atob(payload)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return buffer
}

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [, payload = ''] = dataUrl.split(',', 2)
  const mimeTypeMatch = dataUrl.match(DATA_URL_PATTERN)
  const mimeType = mimeTypeMatch?.[1] || 'application/octet-stream'
  const bytes = decodeBase64Payload(payload)
  return new Blob([bytes], { type: mimeType })
}

const downloadBlob = (blob: Blob, filename: string, urlApi: UrlApi) => {
  const objectUrl = urlApi.createObjectURL(blob)
  try {
    triggerAnchorDownload(objectUrl, filename)
  } finally {
    urlApi.revokeObjectURL(objectUrl)
  }
}

export const downloadImageSource = async (
  src: string | null | undefined,
  options: DownloadImageSourceOptions = {},
): Promise<boolean> => {
  if (!src || typeof document === 'undefined') {
    return false
  }

  const filename = buildImageDownloadFilename({
    filename: options.filename,
    src,
    mimeType: options.mimeType,
    now: options.now,
  })
  const urlApi = options.urlApi || URL

  if (src.match(DATA_URL_PATTERN)) {
    downloadBlob(dataUrlToBlob(src), filename, urlApi)
    return true
  }

  if (src.match(BLOB_URL_PATTERN)) {
    triggerAnchorDownload(src, filename)
    return true
  }

  if (src.match(HTTP_URL_PATTERN)) {
    const fetchImpl = options.fetchImpl || globalThis.fetch
    if (typeof fetchImpl === 'function') {
      try {
        const response = await fetchImpl(src)
        if (!response.ok) {
          throw new Error(`Failed to fetch image source: ${response.status}`)
        }
        const blob = await response.blob()
        downloadBlob(blob, filename, urlApi)
        return true
      } catch {
        triggerAnchorDownload(src, filename)
        return true
      }
    }
  }

  triggerAnchorDownload(src, filename)
  return true
}
