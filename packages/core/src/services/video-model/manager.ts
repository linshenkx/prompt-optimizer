import { z } from 'zod'
import { VIDEO_CREATE_SESSION_KEY } from '../../constants/storage-keys'
import type { IImportExportable } from '../../interfaces/import-export'
import { getEnvVar } from '../../utils/environment'
import type { IPreferenceService } from '../preference/types'
import type { VideoRun } from '../video/session'

export const SEEDANCE_MODEL = 'doubao-seedance-2-0-fast-260128'
export const ARK_VIDEO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
export const DEFAULT_VIDEO_CONFIG_ID = 'seedance'
export const VIDEO_MODEL_PREFERENCE = 'video-model/seedance'

export function normalizeVideoBaseURL(value: string): string {
  try {
    const url = new URL(value.trim())
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash) {
      return url.href.replace(/\/+$/, '')
    }
  } catch { /* The same field error covers malformed URLs and unsupported schemes. */ }
  throw new Error('video.error.baseURL')
}

const configSchema = z.object({
  id: z.string().trim().min(1),
  providerId: z.literal('ark'),
  name: z.string().trim().min(1),
  model: z.string().trim().min(1),
  baseURL: z.string(),
  apiKey: z.string().trim(),
  enabled: z.boolean(),
}).strict()
export type VideoModelConfig = z.infer<typeof configSchema>
export type VideoModelSummary = Omit<VideoModelConfig, 'apiKey'> & {
  configured: boolean
  keySource: 'saved' | 'environment' | 'none'
}

export const defaultVideoConfig = (): VideoModelConfig => ({
  id: DEFAULT_VIDEO_CONFIG_ID, providerId: 'ark', name: 'Seedance 2.0 Fast', model: SEEDANCE_MODEL,
  baseURL: ARK_VIDEO_BASE_URL, apiKey: '', enabled: true,
})

function parseConfig(value: unknown): VideoModelConfig {
  const result = configSchema.safeParse(value)
  if (!result.success) throw new Error('video.error.config')
  return { ...result.data, baseURL: normalizeVideoBaseURL(result.data.baseURL) }
}

function parseList(value: unknown): VideoModelConfig[] {
  if (!Array.isArray(value)) throw new Error('video.error.config')
  const configs = value.map(parseConfig)
  if (new Set(configs.map(config => config.id)).size !== configs.length) throw new Error('video.error.config')
  return configs
}

function readConfigs(raw: unknown): VideoModelConfig[] {
  if (raw == null) return [defaultVideoConfig()]
  if (Array.isArray(raw)) return parseList(raw)
  const legacy = z.object({ model: z.string().optional(), apiKey: z.string().optional() }).strict().safeParse(raw)
  if (!legacy.success) throw new Error('video.error.config')
  const model = legacy.data.model?.trim() || SEEDANCE_MODEL
  return [{ ...defaultVideoConfig(), model, name: model === SEEDANCE_MODEL ? 'Seedance 2.0 Fast' : model,
    apiKey: legacy.data.apiKey?.trim() || '' }]
}

function environmentKey() {
  return getEnvVar('VITE_SEEDANCE_API_KEY') || getEnvVar('ARK_API_KEY') ||
    getEnvVar('VITE_ARK_API_KEY') || getEnvVar('VITE_SEEDREAM_API_KEY') || ''
}

// Credentials from the app environment belong to the official Ark API.
export function resolveVideoApiKey(config: VideoModelConfig): string {
  return config.apiKey || (config.baseURL === ARK_VIDEO_BASE_URL ? environmentKey() : '')
}

export function summarizeVideoModel(config: VideoModelConfig): VideoModelSummary {
  const { apiKey, ...publicFields } = config
  const keySource = apiKey ? 'saved' : resolveVideoApiKey(config) ? 'environment' : 'none'
  return { ...publicFields, keySource, configured: keySource !== 'none' }
}

export class VideoModelManager implements IImportExportable {
  constructor(private readonly preferences: IPreferenceService) {}

  private read() {
    return this.preferences.get<unknown>(VIDEO_MODEL_PREFERENCE, null)
  }

  async listModels(): Promise<VideoModelSummary[]> {
    return readConfigs(await this.read()).map(summarizeVideoModel)
  }

  async getConfig(id: string): Promise<VideoModelConfig> {
    const config = readConfigs(await this.read()).find(item => item.id === id)
    if (!config) throw new Error('video.error.configMissing')
    return config
  }

  private async write(expected: unknown, configs: VideoModelConfig[]): Promise<void> {
    if (!this.preferences.compareAndSet) {
      await this.preferences.set(VIDEO_MODEL_PREFERENCE, configs)
    } else if (!await this.preferences.compareAndSet(VIDEO_MODEL_PREFERENCE, expected, configs)) {
      throw new Error('video.error.configChanged')
    }
  }

  private async assertTaskEndpointAvailable(id: string) {
    const value = await this.preferences.get<{ runs?: VideoRun[] } | string | null>(VIDEO_CREATE_SESSION_KEY, null)
    const session = typeof value === 'string' ? JSON.parse(value) : value
    if (session?.runs?.some((run: VideoRun) => (run.configId ?? DEFAULT_VIDEO_CONFIG_ID) === id &&
      ['submitting', 'unknown', 'queued', 'running'].includes(run.status))) {
      throw new Error('video.error.configInUse')
    }
  }

  async saveConfig(value: VideoModelConfig, previous: VideoModelConfig | null): Promise<void> {
    const config = parseConfig(value)
    const raw = await this.read()
    const configs = readConfigs(raw)
    const existing = configs.find(item => item.id === config.id)
    if (JSON.stringify(existing ?? null) !== JSON.stringify(previous && parseConfig(previous))) {
      throw new Error('video.error.configChanged')
    }
    if (existing && existing.baseURL !== config.baseURL) await this.assertTaskEndpointAvailable(config.id)
    await this.write(raw, existing ? configs.map(item => item.id === config.id ? config : item) : [...configs, config])
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const existing = await this.getConfig(id)
    await this.saveConfig({ ...existing, enabled }, existing)
  }

  async removeConfig(id: string): Promise<void> {
    const raw = await this.read()
    const configs = readConfigs(raw)
    await this.assertTaskEndpointAvailable(id)
    await this.write(raw, configs.filter(item => item.id !== id))
  }

  async exportData(): Promise<VideoModelConfig[] | null> {
    const raw = await this.read()
    return raw == null ? null : readConfigs(raw)
  }

  async importData(value: unknown): Promise<void> {
    const incoming = parseList(value)
    const raw = await this.read()
    if (raw == null && incoming.find(config => config.id === DEFAULT_VIDEO_CONFIG_ID)?.baseURL !== ARK_VIDEO_BASE_URL) {
      await this.assertTaskEndpointAvailable(DEFAULT_VIDEO_CONFIG_ID)
    }
    const configs = new Map((raw == null ? [] : readConfigs(raw)).map(config => [config.id, config]))
    for (const config of incoming) {
      const old = configs.get(config.id)
      if (old && old.baseURL !== config.baseURL) await this.assertTaskEndpointAvailable(config.id)
      configs.set(config.id, config)
    }
    await this.write(raw, [...configs.values()])
  }

  async validateData(data: unknown): Promise<boolean> {
    try { parseList(data); return true } catch { return false }
  }

  async getDataType(): Promise<string> { return 'videoModels' }
}
