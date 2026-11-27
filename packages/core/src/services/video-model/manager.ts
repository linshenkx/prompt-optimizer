import { z } from 'zod'
import { VIDEO_CREATE_SESSION_KEY } from '../../constants/storage-keys'
import type { IImportExportable } from '../../interfaces/import-export'
import { getEnvVar } from '../../utils/environment'
import type { IPreferenceService } from '../preference/types'
import type { VideoRun } from '../video/session'

import { ARK_VIDEO_BASE_URL, getVideoModelSpec, isOfficialVideoBaseURL, MINIMAX_INTL_VIDEO_BASE_URL,
  SEEDANCE_MODEL, VIDEO_PROVIDERS, videoWireModel } from './catalog'
import { VIDEO_PROVIDER_IDS } from '../video/types'

export function legacyVideoModelId(wireModel: string) {
  return getVideoModelSpec(wireModel, 'ark') ? wireModel : SEEDANCE_MODEL
}
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
  providerId: z.enum(VIDEO_PROVIDER_IDS),
  name: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  customModel: z.string().trim().min(1).optional(),
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
  id: DEFAULT_VIDEO_CONFIG_ID, providerId: 'ark', name: 'Seedance 2.0 Fast', modelId: SEEDANCE_MODEL,
  baseURL: ARK_VIDEO_BASE_URL, apiKey: '', enabled: true,
})

const legacyConfigSchema = configSchema.omit({ modelId: true, customModel: true }).extend({
  providerId: z.literal('ark'),
  model: z.string().trim().min(1),
}).strict()

function parseConfig(value: unknown): VideoModelConfig {
  const legacy = legacyConfigSchema.safeParse(value)
  if (legacy.success) {
    const { model, ...fields } = legacy.data
    const modelId = legacyVideoModelId(model)
    return parseConfig({ ...fields, modelId, ...(model !== modelId && { customModel: model }) })
  }
  const result = configSchema.safeParse(value)
  if (!result.success) throw new Error('video.error.config')
  const baseURL = normalizeVideoBaseURL(result.data.baseURL)
  const providerId = result.data.providerId === 'minimax' && baseURL === MINIMAX_INTL_VIDEO_BASE_URL
    ? 'minimax-intl' : result.data.providerId
  const config = { ...result.data, providerId, baseURL }
  if (!getVideoModelSpec(config.modelId, config.providerId)) throw new Error('video.error.config')
  return config
}

function parseList(value: unknown): VideoModelConfig[] {
  if (!Array.isArray(value)) throw new Error('video.error.config')
  const configs = value.map(parseConfig)
  if (new Set(configs.map(config => config.id)).size !== configs.length) throw new Error('video.error.config')
  return configs
}

function parseLegacyPreference(raw: unknown): VideoModelConfig[] {
  const legacy = z.object({ model: z.string().optional(), apiKey: z.string().optional() }).strict().safeParse(raw)
  if (!legacy.success) throw new Error('video.error.config')
  const model = legacy.data.model?.trim() || SEEDANCE_MODEL
  const modelId = legacyVideoModelId(model)
  return [parseConfig({ ...defaultVideoConfig(), modelId, ...(model !== modelId && { customModel: model }),
    name: model === modelId ? getVideoModelSpec(modelId)!.name : model, apiKey: legacy.data.apiKey?.trim() || '' })]
}

function readConfigs(raw: unknown): VideoModelConfig[] {
  if (raw == null) return [defaultVideoConfig()]
  return Array.isArray(raw) ? parseList(raw) : parseLegacyPreference(raw)
}

function parseImport(value: unknown): VideoModelConfig[] {
  return Array.isArray(value) ? parseList(value) : parseLegacyPreference(value)
}

function sameTaskEndpoint(a: VideoModelConfig, b: VideoModelConfig) {
  return a.baseURL === b.baseURL && a.providerId === b.providerId && a.modelId === b.modelId &&
    videoWireModel(a) === videoWireModel(b)
}

export function resolveVideoApiKey(config: VideoModelConfig): string {
  if (config.apiKey) return config.apiKey
  if (!isOfficialVideoBaseURL(config.providerId, config.baseURL)) return ''
  return VIDEO_PROVIDERS[config.providerId].envKeys.map(getEnvVar).find(Boolean) ?? ''
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
    if (existing && !sameTaskEndpoint(existing, config)) await this.assertTaskEndpointAvailable(config.id)
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
    const incoming = parseImport(value)
    const raw = await this.read()
    const incomingDefault = incoming.find(config => config.id === DEFAULT_VIDEO_CONFIG_ID)
    if (raw == null && (!incomingDefault || !sameTaskEndpoint(defaultVideoConfig(), incomingDefault))) {
      await this.assertTaskEndpointAvailable(DEFAULT_VIDEO_CONFIG_ID)
    }
    const configs = new Map((raw == null ? [] : readConfigs(raw)).map(config => [config.id, config]))
    for (const config of incoming) {
      const old = configs.get(config.id)
      if (old && !sameTaskEndpoint(old, config)) await this.assertTaskEndpointAvailable(config.id)
      configs.set(config.id, config)
    }
    await this.write(raw, [...configs.values()])
  }

  async validateData(data: unknown): Promise<boolean> {
    try { parseImport(data); return true } catch { return false }
  }

  async getDataType(): Promise<string> { return 'videoModels' }
}
