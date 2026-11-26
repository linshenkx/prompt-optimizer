import type { IPreferenceService } from '../preference/types'
import {
  ARK_VIDEO_BASE_URL, DEFAULT_VIDEO_CONFIG_ID, SEEDANCE_MODEL, VideoModelManager, resolveVideoApiKey, summarizeVideoModel,
  type VideoModelConfig, type VideoModelSummary,
} from '../video-model/manager'

export { SEEDANCE_MODEL } from '../video-model/manager'
export const VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const
export const VIDEO_RESOLUTIONS = ['480p', '720p'] as const
export const VIDEO_ROLES = ['character', 'style', 'first_frame', 'last_frame'] as const
export type VideoReferenceRole = typeof VIDEO_ROLES[number]
export interface VideoParams {
  duration: number
  ratio: typeof VIDEO_RATIOS[number]
  resolution: typeof VIDEO_RESOLUTIONS[number]
}
export const DEFAULT_VIDEO_PARAMS: VideoParams = { duration: 4, ratio: '16:9', resolution: '480p' }
export const isVideoParams = (value: unknown): value is VideoParams => {
  const p = value as VideoParams | null
  return !!p && Number.isInteger(p.duration) && p.duration >= 4 && p.duration <= 15 &&
    VIDEO_RATIOS.includes(p.ratio) && VIDEO_RESOLUTIONS.includes(p.resolution)
}
export interface VideoReference { role: VideoReferenceRole; url: string }
export function videoReferenceError(roles: VideoReferenceRole[]) {
  if (roles.length > 4 || roles.some(role => !VIDEO_ROLES.includes(role))) return 'references'
  const first = roles.filter(role => role === 'first_frame').length
  const last = roles.filter(role => role === 'last_frame').length
  if (first > 1 || last > 1 || (last && !first) || ((first || last) && roles.length !== first + last)) return 'frames'
  return null
}
// Ark public online price for Seedance 2.0 Fast at 480p/720p, without video input.
const FAST_CNY_PER_MILLION = 37
export function videoTokenRate(model: string, baseURL?: string): number | null {
  return model === SEEDANCE_MODEL && baseURL === ARK_VIDEO_BASE_URL ? FAST_CNY_PER_MILLION : null
}
export function videoUsageCost(outputTokens: number, rate: number): number {
  return outputTokens * rate / 1_000_000
}
export function estimateVideoCost(params: VideoParams, rate = FAST_CNY_PER_MILLION): number {
  const pixels = params.resolution === '480p'
    ? { '16:9': 864*496, '9:16': 496*864, '4:3': 752*560, '3:4': 560*752, '1:1': 640*640, '21:9': 992*432 }
    : { '16:9': 1280*720, '9:16': 720*1280, '4:3': 1112*834, '3:4': 834*1112, '1:1': 960*960, '21:9': 1470*630 }
  return videoUsageCost(pixels[params.ratio] * 24 * params.duration / 1024, rate)
}
export interface VideoGenerationInput {
  model: string
  prompt: string
  params: VideoParams
  references: VideoReference[]
  configId?: string
  baseURL?: string
}
export function seedancePromptText(prompt: string, references: { role: VideoReferenceRole }[], legacy = false) {
  const chinese = /\p{Script=Han}/u.test(prompt)
  const roles = references.flatMap(({ role }, index) => {
    if (role !== 'character' && role !== 'style') return []
    const number = index + 1
    if (legacy) return [`Image ${number}: ${role} reference.`]
    const mention = new RegExp(`@(?:Image|图片|圖片)\\s*${number}(?!\\d)`, 'i')
    if (mention.test(prompt)) return []
    return [chinese ? `@图片${number} 用作${role === 'character' ? '主体' : '风格'}参考。` : `@Image${number} is a ${role} reference.`]
  })
  return roles.length ? [prompt, roles.join(' ')].join('\n\n') : prompt
}
export function buildSeedanceRequest(input: VideoGenerationInput) {
  if (!input.model.trim() || !input.prompt.trim() || !isVideoParams(input.params)) throw new Error('video.error.request')
  const roleError = videoReferenceError(input.references.map(r => r.role))
  if (roleError) throw new Error(`video.error.${roleError}`)
  const images = input.references.map(({ role, url }) => {
    if (!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(url)) throw new Error('video.error.references')
    return { type: 'image_url', image_url: { url }, role: role === 'character' || role === 'style' ? 'reference_image' : role }
  })
  return { model: input.model, content: [{ type: 'text', text: seedancePromptText(input.prompt, input.references) }, ...images],
    ...input.params, generate_audio: false, watermark: false }
}
export const VIDEO_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired'] as const
export type VideoTaskStatus = typeof VIDEO_STATUSES[number]
export interface VideoTaskResult {
  id: string; status: VideoTaskStatus; videoUrl?: string; expiresAt?: number; tokens?: number; totalTokens?: number; error?: string
}
function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}
function httpsUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  try { return new URL(value).protocol === 'https:' ? value : undefined } catch { return undefined }
}
function expiration(url: string, updated: unknown) {
  const query = new URL(url).searchParams
  const stamp = query.get('X-Tos-Date')?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  const ttl = Number(query.get('X-Tos-Expires'))
  if (stamp && ttl > 0 && Number.isFinite(ttl)) {
    const [, y, m, d, h, min, s] = stamp
    return Date.UTC(+y, +m - 1, +d, +h, +min, +s) + ttl * 1000
  }
  return (Number(updated) * 1000 || Date.now()) + 86_400_000
}
export interface VideoService extends Pick<VideoModelManager, 'listModels' | 'getConfig' | 'saveConfig' | 'setEnabled' | 'removeConfig'> {
  model(configId?: string): Promise<VideoModelSummary>
  testConnection(configId: string): Promise<void>
  create(input: VideoGenerationInput): Promise<string>
  query(id: string, configId?: string, baseURL?: string): Promise<VideoTaskResult>
  cancel(id: string, configId?: string, baseURL?: string): Promise<void>
}

export function createSeedanceService(preferences: IPreferenceService, send: typeof fetch = fetch): VideoService {
  const manager = new VideoModelManager(preferences)
  const configForRun = async (configId?: string, expectedBaseURL?: string) => {
    const config = await manager.getConfig(configId ?? DEFAULT_VIDEO_CONFIG_ID)
    // Pre-manager jobs were always submitted to the official Ark URL.
    const pinnedURL = expectedBaseURL ?? (configId ? undefined : ARK_VIDEO_BASE_URL)
    if (pinnedURL && config.baseURL !== pinnedURL) throw new Error('video.error.configChanged')
    return config
  }
  const taskPath = (id: string) => {
    if (!/^[\w.-]+$/.test(id) || id === '.' || id === '..') throw new Error('video.error.request')
    return '/' + encodeURIComponent(id)
  }
  const request = async (config: VideoModelConfig, method: string, suffix: string, body?: unknown) => {
    const apiKey = resolveVideoApiKey(config)
    if (!apiKey) throw new Error('video.error.key')
    const res = await send(config.baseURL + '/contents/generations/tasks' + suffix, {
      method, redirect: 'error', headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000),
    })
    const data = await res.text()
    if (!res.ok) {
      let detail: string | undefined
      try { detail = JSON.parse(data).error?.message } catch { /* Some proxies return HTML. */ }
      throw new Error(`Ark HTTP ${res.status}${detail ? ': ' + detail : ''}`)
    }
    return data ? JSON.parse(data) : {}
  }
  return {
    listModels: () => manager.listModels(),
    getConfig: id => manager.getConfig(id),
    saveConfig: (config, previous) => manager.saveConfig(config, previous),
    setEnabled: (id, enabled) => manager.setEnabled(id, enabled),
    removeConfig: id => manager.removeConfig(id),
    async model(id = DEFAULT_VIDEO_CONFIG_ID) { return summarizeVideoModel(await manager.getConfig(id)) },
    async testConnection(configId) {
      const config = await manager.getConfig(configId)
      const result = await request(config, 'GET', '?page_size=1')
      if (!Array.isArray(result?.items)) throw new Error('video.error.connectionResponse')
    },
    async create(input) {
      const config = await configForRun(input.configId, input.baseURL)
      if (!config.enabled || config.model !== input.model) throw new Error('video.error.configChanged')
      const result = await request(config, 'POST', '', buildSeedanceRequest(input))
      if (typeof result?.id !== 'string' || !/^[\w.-]+$/.test(result.id)) throw new Error('video.error.missingId')
      return result.id
    },
    async query(id, configId, baseURL) {
      const config = await configForRun(configId, baseURL)
      const result = await request(config, 'GET', taskPath(id))
      const status = result.status
      if (!VIDEO_STATUSES.includes(status) || result.id !== id) throw new Error('video.error.status')
      const videoUrl = httpsUrl(result.content?.video_url)
      if (status === 'succeeded' && !videoUrl) throw new Error('video.error.result')
      const tokens = tokenCount(result.usage?.completion_tokens)
      const totalTokens = tokenCount(result.usage?.total_tokens)
      return { id, status,
        ...(videoUrl && { videoUrl, expiresAt: expiration(videoUrl, result.updated_at) }),
        ...(tokens !== undefined && { tokens }),
        ...(totalTokens !== undefined && { totalTokens }),
        ...(typeof result.error?.message === 'string' && { error: result.error.message }),
      }
    },
    async cancel(id, configId, baseURL) {
      const config = await configForRun(configId, baseURL)
      await request(config, 'DELETE', taskPath(id))
    },
  }
}
