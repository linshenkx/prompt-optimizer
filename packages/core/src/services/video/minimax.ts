import { MINIMAX_H3_MODELS } from '../video-model/catalog'
import type { VideoModelConfig } from '../video-model/manager'
import { encodedTaskId, httpsVideoUrl, multimodalContent, readTaskId, readVideoUsage, requestVideoJSON, videoRequestRejected } from './http'
import type { VideoGenerationInput, VideoTaskResult, VideoTaskStatus } from './types'

const statuses: ReadonlyMap<string, VideoTaskStatus> = new Map([
  ['preparing', 'queued'], ['queueing', 'queued'], ['queued', 'queued'], ['pending', 'queued'],
  ['processing', 'running'], ['running', 'running'],
  ['success', 'succeeded'], ['succeeded', 'succeeded'],
  ['fail', 'failed'], ['failed', 'failed'], ['cancelled', 'cancelled'], ['expired', 'expired'],
])

export class MiniMaxVideoAdapter {
  constructor(private readonly send: typeof fetch) {}
  private async request(config: VideoModelConfig, method: string, path: string, body?: unknown) {
    const data = await requestVideoJSON(this.send, config, 'MiniMax', method, path, body)
    const code = data?.base_resp?.status_code
    if (code != null && code !== 0) {
      if (Number(code) === 1004 || Number(code) === 2049) throw videoRequestRejected('video.error.auth')
      const message = 'MiniMax API ' + code + (data.base_resp.status_msg ? ': ' + data.base_resp.status_msg : '')
      throw [1000, 1001, 1024, 1033, 2066].includes(Number(code)) ? new Error(message) : videoRequestRejected(message)
    }
    return data
  }
  async testConnection(config: VideoModelConfig) {
    // MiniMax List Files is a read-only GET. Its documented success envelope contains
    // base_resp.status_code=0 and a files array, which may be empty.
    // https://platform.minimax.io/docs/api-reference/file-management-list
    const data = await this.request(config, 'GET', '/v1/files/list')
    if (data?.base_resp?.status_code !== 0 || !Array.isArray(data.files)) throw new Error('video.error.connectionResponse')
  }
  async create(config: VideoModelConfig, input: VideoGenerationInput) {
    const { model, prompt, params, references } = input
    const { resolution, duration } = params
    const v2 = MINIMAX_H3_MODELS.includes(config.modelId)
    const payload = v2
      ? { model, content: multimodalContent(input), resolution, duration, ratio: params.ratio,
        generate_audio: params.audio, aigc_watermark: false }
      : { model, prompt, resolution, duration, prompt_optimizer: params.promptOptimizer,
        ...Object.fromEntries(references.map(ref => [ref.role + '_image', ref.url])) }
    const data = await this.request(config, 'POST', v2 ? '/v2/video_generation' : '/v1/video_generation', payload)
    const rawId = data?.task?.id ?? data?.task_id ?? data?.id
    return readTaskId(typeof rawId === 'number' && Number.isSafeInteger(rawId) ? String(rawId) : rawId)
  }
  async query(config: VideoModelConfig, id: string): Promise<VideoTaskResult> {
    const encoded = encodedTaskId(id)
    const data = await this.request(config, 'GET', MINIMAX_H3_MODELS.includes(config.modelId)
      ? '/v2/query/video_generation/' + encoded : '/v1/query/video_generation?task_id=' + encoded)
    const task = data?.task ?? data
    const status = statuses.get(String(task?.status).toLowerCase())
    const returnedId = task?.task_id ?? task?.id
    if (!status || (returnedId == null ? '' : String(returnedId)) !== id) throw new Error('video.error.status')
    const usage = readVideoUsage(task.usage)
    const error = task.error?.message ?? task.error_message
    if (status !== 'succeeded') return { id, status, ...(usage && { usage }), ...(typeof error === 'string' && { error }) }
    let videoUrl = httpsVideoUrl(task.content?.url ?? task.content?.video_url ?? task.video_url ?? task.download_url)
    const fileId = task.file_id ?? task.content?.file_id
    if (!videoUrl && (typeof fileId === 'string' || typeof fileId === 'number') && String(fileId)) {
      const result = await this.request(config, 'GET', '/v1/files/retrieve?file_id=' + encodeURIComponent(fileId))
      videoUrl = httpsVideoUrl(result?.file?.download_url)
    }
    if (!videoUrl) throw new Error('video.error.result')
    return { id, status, videoUrl, ...(usage && { usage }) }
  }
}
