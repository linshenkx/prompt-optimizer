import { resolveVideoApiKey, type VideoModelConfig } from '../video-model/manager'
import type { VideoGenerationInput, VideoUsage } from './types'

export function videoRequestRejected(message: string) {
  return Object.assign(new Error(message), { code: 'VIDEO_REQUEST_REJECTED' })
}

export function isVideoTaskId(id: unknown): id is string {
  return typeof id === 'string' && /^[\w.-]+$/.test(id) && id !== '.' && id !== '..'
}
export function encodedTaskId(id: string) {
  if (!isVideoTaskId(id)) throw new Error('video.error.request')
  return encodeURIComponent(id)
}
export function readTaskId(id: unknown) {
  if (!isVideoTaskId(id)) throw new Error('video.error.missingId')
  return id
}
export function httpsVideoUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  try { return new URL(value).protocol === 'https:' ? value : undefined } catch { return undefined }
}
export function multimodalContent(input: VideoGenerationInput) {
  return [{ type: 'text', text: input.prompt }, ...input.references.map(({ role, url }) =>
    ({ type: 'image_url', image_url: { url }, role }))]
}
export function validateVideoImages(input: VideoGenerationInput) {
  if (input.references.some(({ url }) => !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(url))) {
    throw new Error('video.error.references')
  }
}
export function readVideoUsage(value?: Record<string, unknown>): VideoUsage | undefined {
  const usage: VideoUsage = {}
  for (const [field, key] of [['completion_tokens', 'outputTokens'], ['total_tokens', 'totalTokens'], ['output_seconds', 'outputSeconds']] as const) {
    const n = value?.[field]
    if (typeof n === 'number' && n >= 0 && (key === 'outputSeconds' ? Number.isFinite(n) : Number.isSafeInteger(n))) usage[key] = n
  }
  return Object.keys(usage).length ? usage : undefined
}
export async function requestVideoJSON(send: typeof fetch, config: VideoModelConfig, provider: string,
  method: string, path: string, body?: unknown) {
  const key = resolveVideoApiKey(config)
  if (!key) throw new Error('video.error.key')
  const response = await send(config.baseURL + path, {
    method, redirect: 'error', headers: { Authorization: 'Bearer ' + key, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  })
  const raw = await response.text()
  if (!response.ok) {
    let detail: string | undefined
    try {
      const parsed = JSON.parse(raw)
      detail = parsed?.error?.message ?? parsed?.base_resp?.status_msg
    } catch { /* Some proxies return HTML. */ }
    const message = provider + ' HTTP ' + response.status + (detail ? ': ' + detail : '')
    throw response.status >= 400 && response.status < 500 && response.status !== 408
      ? videoRequestRejected(message) : new Error(message)
  }
  return raw ? JSON.parse(raw) : {}
}
