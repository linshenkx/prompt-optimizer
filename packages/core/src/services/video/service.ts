import type { IPreferenceService } from '../preference/types'
import { ARK_VIDEO_BASE_URL, getVideoModelSpec, resolveVideoConfigModel, videoWireModel } from '../video-model/catalog'
import { DEFAULT_VIDEO_CONFIG_ID, VideoModelManager, summarizeVideoModel, type VideoModelConfig, type VideoModelSummary } from '../video-model/manager'
import { validateVideoImages } from './http'
import { MiniMaxVideoAdapter } from './minimax'
import { checkVideoInputCompatibility, inferVideoCapabilityMode, resolveVideoParams } from './params'
import { ArkVideoAdapter } from './seedance'
import type { VideoGenerationInput, VideoProviderId, VideoRunIdentity, VideoTaskResult } from './types'

export interface VideoService extends Pick<VideoModelManager, 'listModels' | 'getConfig' | 'saveConfig' | 'setEnabled' | 'removeConfig'> {
  model(configId?: string): Promise<VideoModelSummary>
  testConnection(configId: string): Promise<void>
  create(input: VideoGenerationInput): Promise<string>
  query(id: string, configId?: string, baseURL?: string, identity?: VideoRunIdentity): Promise<VideoTaskResult>
  cancel(id: string, configId?: string, baseURL?: string, identity?: VideoRunIdentity): Promise<void>
}

interface VideoAdapter {
  testConnection(config: VideoModelConfig): Promise<void>
  create(config: VideoModelConfig, input: VideoGenerationInput): Promise<string>
  query(config: VideoModelConfig, id: string): Promise<VideoTaskResult>
  cancel?(config: VideoModelConfig, id: string): Promise<void>
}
export class VideoAdapterRegistry {
  private readonly adapters: Record<VideoProviderId, VideoAdapter>
  constructor(send: typeof fetch) {
    const ark = new ArkVideoAdapter(send)
    const minimax = new MiniMaxVideoAdapter(send)
    this.adapters = { ark, byteplus: ark, minimax, 'minimax-intl': minimax }
  }
  get(provider: VideoProviderId) { return this.adapters[provider] }
}

export function createVideoService(preferences: IPreferenceService, send: typeof fetch = fetch): VideoService {
  const manager = new VideoModelManager(preferences)
  const registry = new VideoAdapterRegistry(send)
  const configForRun = async (configId?: string, expectedBaseURL?: string, identity?: Partial<VideoRunIdentity>) => {
    const saved = await manager.getConfig(configId ?? DEFAULT_VIDEO_CONFIG_ID)
    const pinnedURL = expectedBaseURL ?? (configId ? undefined : ARK_VIDEO_BASE_URL)
    if ((pinnedURL && saved.baseURL !== pinnedURL) ||
        (identity?.providerId && identity.providerId !== saved.providerId) ||
        (identity?.configModelId && identity.configModelId !== saved.modelId)) throw new Error('video.error.configChanged')
    const config = identity?.configModelId && identity.modelId ? resolveVideoConfigModel(saved, identity.modelId) : saved
    if (!config ||
        (identity?.modelId && identity.modelId !== config.modelId) ||
        (identity?.model && identity.model !== videoWireModel(config))) throw new Error('video.error.configChanged')
    return config
  }
  return {
    listModels: () => manager.listModels(),
    getConfig: id => manager.getConfig(id),
    saveConfig: (config, previous) => manager.saveConfig(config, previous),
    setEnabled: (id, enabled) => manager.setEnabled(id, enabled),
    removeConfig: id => manager.removeConfig(id),
    async model(id = DEFAULT_VIDEO_CONFIG_ID) { return summarizeVideoModel(await manager.getConfig(id)) },
    async testConnection(id) {
      const config = await manager.getConfig(id)
      await registry.get(config.providerId).testConnection(config)
    },
    async create(input) {
      const config = await configForRun(input.configId, input.baseURL, input)
      if (!config.enabled) throw new Error('video.error.configChanged')
      if (!input.prompt.trim()) throw new Error('video.error.request')
      const spec = getVideoModelSpec(config.modelId, config.providerId)!
      const mode = input.capabilityMode ?? inferVideoCapabilityMode(input.references)
      const compatible = checkVideoInputCompatibility(spec, mode, input.references)
      if (!compatible.compatible) throw new Error(compatible.reasonKey)
      validateVideoImages(input)
      const { params } = resolveVideoParams(spec, input.params, { mode, images: input.references })
      return registry.get(config.providerId).create(config, { ...input, providerId: config.providerId, modelId: config.modelId, capabilityMode: mode, params })
    },
    async query(id, configId, baseURL, identity) {
      const config = await configForRun(configId, baseURL, identity)
      return registry.get(config.providerId).query(config, id)
    },
    async cancel(id, configId, baseURL, identity) {
      const config = await configForRun(configId, baseURL, identity)
      const adapter = registry.get(config.providerId)
      if (!adapter.cancel || !getVideoModelSpec(config.modelId, config.providerId)?.capabilities.supportsCancel) throw new Error('video.error.noCancel')
      await adapter.cancel(config, id)
    },
  }
}

export const createSeedanceService = createVideoService
