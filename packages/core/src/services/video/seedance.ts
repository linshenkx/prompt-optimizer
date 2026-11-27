import { getVideoModelSpec, SEEDANCE_MODEL } from '../video-model/catalog'
import type { VideoModelConfig } from '../video-model/manager'
import { checkVideoInputCompatibility, inferVideoCapabilityMode, resolveVideoParams } from './params'
import { encodedTaskId, httpsVideoUrl, multimodalContent, readTaskId, readVideoUsage, requestVideoJSON, validateVideoImages } from './http'
import { VIDEO_STATUSES, type VideoGenerationInput, type VideoTaskResult } from './types'

export function buildSeedanceRequest(input: VideoGenerationInput) {
  if (!input.model.trim() || !input.prompt.trim()) throw new Error('video.error.request')
  const spec = getVideoModelSpec(input.modelId ?? input.model, input.providerId) ?? getVideoModelSpec(SEEDANCE_MODEL, 'ark')!
  const mode = input.capabilityMode ?? inferVideoCapabilityMode(input.references)
  const compatibility = checkVideoInputCompatibility(spec, mode, input.references)
  if (!compatibility.compatible) throw new Error(compatibility.reasonKey)
  validateVideoImages(input)
  const { params } = resolveVideoParams(spec, input.params, { mode, images: input.references })
  return { model: input.model, content: multimodalContent(input), duration: params.duration,
    resolution: params.resolution, ratio: params.ratio, generate_audio: params.audio, watermark: false }
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

export class ArkVideoAdapter {
  constructor(private readonly send: typeof fetch) {}
  private request(config: VideoModelConfig, method: string, suffix: string, body?: unknown) {
    const label = config.providerId === 'byteplus' ? 'BytePlus' : 'Ark'
    return requestVideoJSON(this.send, config, label, method, '/contents/generations/tasks' + suffix, body)
  }
  async testConnection(config: VideoModelConfig) {
    const result = await this.request(config, 'GET', '?page_size=1')
    if (!Array.isArray(result?.items)) throw new Error('video.error.connectionResponse')
  }
  async create(config: VideoModelConfig, input: VideoGenerationInput) {
    const result = await this.request(config, 'POST', '', buildSeedanceRequest(input))
    return readTaskId(result?.id)
  }
  async query(config: VideoModelConfig, id: string): Promise<VideoTaskResult> {
    const result = await this.request(config, 'GET', '/' + encodedTaskId(id))
    const status = result?.status
    if (!VIDEO_STATUSES.includes(status) || result.id !== id) throw new Error('video.error.status')
    const videoUrl = httpsVideoUrl(result.content?.video_url)
    if (status === 'succeeded' && !videoUrl) throw new Error('video.error.result')
    const usage = readVideoUsage(result.usage)
    return { id, status, ...(usage && { usage }),
      ...(videoUrl && { videoUrl, expiresAt: expiration(videoUrl, result.updated_at) }),
      ...(typeof result.error?.message === 'string' && { error: result.error.message }) }
  }
  async cancel(config: VideoModelConfig, id: string) {
    await this.request(config, 'DELETE', '/' + encodedTaskId(id))
  }
}
