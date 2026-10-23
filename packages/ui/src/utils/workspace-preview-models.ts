import type { IImageAdapterRegistry, IImageModelManager, IModelManager, ITextAdapterRegistry } from '@prompt-optimizer/core'

export const WORKSPACE_PREVIEW_IMAGE_MODEL_ID = 'image-mobile-preview-magpie'
export const WORKSPACE_PREVIEW_TEXT_MODEL_ID = 'text-mobile-preview-magpie'

/** Only relocate our local gateway presets, never a user's remote endpoint. */
function relocatedPreviewBaseURL(baseURL: string | undefined, origin: string): string | undefined {
  try {
    if (!baseURL) return undefined
    const previous = new URL(baseURL)
    const next = new URL('/__local_magpie/v1', origin)
    const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/
    if (!['http:', 'https:'].includes(previous.protocol) || !['http:', 'https:'].includes(next.protocol) ||
      !localHost.test(previous.hostname) || previous.pathname.replace(/\/$/, '') !== '/__local_magpie/v1' ||
      previous.search || previous.hash || previous.username || previous.password || previous.origin === next.origin) return undefined
    return next.href
  } catch {
    return undefined
  }
}

/** Used by the explicitly enabled private preview after changing its local origin. */
export async function relocateWorkspacePreviewModels(
  textManager: Pick<IModelManager, 'getModel' | 'updateModel'>,
  imageManager: Pick<IImageModelManager, 'getConfig' | 'updateConfig'>,
  options: { enabled: boolean; origin: string },
): Promise<void> {
  if (!options.enabled) return
  for (const [id, name] of [[WORKSPACE_PREVIEW_TEXT_MODEL_ID, 'Mobile Preview · Gemini'], ['custom_mobile_preview', 'Mobile Preview']]) {
    const model = await textManager.getModel(id)
    if (!model?.enabled || model.name !== name || model.providerId !== 'openai-compatible' ||
      model.modelId !== 'antigravity/gemini-3.8-flash' || model.connectionConfig.apiKey !== 'magpie-prompt-optimizer' ||
      Object.keys(model.connectionConfig).some(key => !['baseURL', 'apiKey', 'requestStyle'].includes(key))) continue
    const baseURL = relocatedPreviewBaseURL(model.connectionConfig.baseURL, options.origin)
    if (baseURL) await textManager.updateModel(id, { connectionConfig: { ...model.connectionConfig, baseURL } })
  }
  const image = await imageManager.getConfig(WORKSPACE_PREVIEW_IMAGE_MODEL_ID)
  const imageConnection = image?.connectionConfig
  if (!image?.enabled || image.name !== 'Mobile Preview · GPT Image' || image.providerId !== 'openai' ||
    image.modelId !== 'codex/gpt-image-2' || !imageConnection || imageConnection.apiKey !== 'magpie-prompt-optimizer' ||
    Object.keys(imageConnection).some(key => !['baseURL', 'apiKey'].includes(key))) return
  const baseURL = relocatedPreviewBaseURL(imageConnection.baseURL, options.origin)
  if (baseURL) await imageManager.updateConfig(image.id, { connectionConfig: { ...imageConnection, baseURL } })
}

/** Upgrade only our known former preview preset; never migrate edited or disabled models. */
export async function migrateWorkspacePreviewTextModel(
  manager: Pick<IModelManager, 'getModel' | 'updateModel'>,
  registry: Pick<ITextAdapterRegistry, 'getAdapter'>,
  options: { enabled: boolean; origin: string; legacyApiKey?: string },
): Promise<boolean> {
  if (!options.enabled) return false
  const old = await manager.getModel('custom_mobile_preview')
  if (!old?.enabled || old.name !== 'Mobile Preview' || old.modelId !== 'Qwen/Qwen3-32B' ||
    !options.legacyApiKey || old.connectionConfig.apiKey !== options.legacyApiKey ||
    old.connectionConfig.baseURL?.replace(/\/$/, '') !== 'https://api.siliconflow.cn/v1' ||
    Object.keys(old.paramOverrides || {}).length > 0 || Object.keys(old.customParamOverrides || {}).length > 0 ||
    (old.connectionConfig.requestStyle && old.connectionConfig.requestStyle !== 'chat_completions') ||
    Object.keys(old.connectionConfig).some(key => !['baseURL', 'apiKey', 'requestStyle'].includes(key))) return false
  const adapter = registry.getAdapter('openai-compatible')
  const model = adapter.buildDefaultModel('antigravity/gemini-3.8-flash')
  await manager.updateModel('custom_mobile_preview', {
    providerId: 'openai-compatible', modelId: model.id, providerMeta: adapter.getProvider(), modelMeta: model,
    connectionConfig: { apiKey: 'magpie-prompt-optimizer', baseURL: new URL('/__local_magpie/v1', options.origin).href },
  })
  return true
}

/** The image-editing optimizer needs a text model that can also read reference images. */
export async function seedWorkspacePreviewTextModel(
  manager: Pick<IModelManager, 'getModel' | 'addModel'>,
  registry: Pick<ITextAdapterRegistry, 'getAdapter'>,
  options: { enabled: boolean; origin: string },
): Promise<boolean> {
  if (!options.enabled || await manager.getModel(WORKSPACE_PREVIEW_TEXT_MODEL_ID)) return false
  const adapter = registry.getAdapter('openai-compatible')
  const model = adapter.buildDefaultModel('antigravity/gemini-3.8-flash')
  await manager.addModel(WORKSPACE_PREVIEW_TEXT_MODEL_ID, {
    id: WORKSPACE_PREVIEW_TEXT_MODEL_ID, name: 'Mobile Preview · Gemini', enabled: true,
    providerId: 'openai-compatible', modelId: model.id,
    providerMeta: adapter.getProvider(), modelMeta: model,
    connectionConfig: { apiKey: 'magpie-prompt-optimizer', baseURL: new URL('/__local_magpie/v1', options.origin).href },
    paramOverrides: {},
  })
  return true
}

/** Seed only the explicitly enabled private preview, without replacing saved user choices. */
export async function seedWorkspacePreviewImageModel(
  manager: Pick<IImageModelManager, 'getConfig' | 'addConfig'>,
  registry: Pick<IImageAdapterRegistry, 'getAdapter'>,
  options: { enabled: boolean; origin: string },
): Promise<boolean> {
  if (!options.enabled) return false
  if (await manager.getConfig(WORKSPACE_PREVIEW_IMAGE_MODEL_ID)) return false

  const adapter = registry.getAdapter('openai')
  const model = adapter.buildDefaultModel('codex/gpt-image-2')
  await manager.addConfig({
    id: WORKSPACE_PREVIEW_IMAGE_MODEL_ID,
    name: 'Mobile Preview · GPT Image',
    providerId: 'openai',
    modelId: model.id,
    enabled: true,
    connectionConfig: {
      // Magpie holds provider credentials; this is an application attribution label.
      apiKey: 'magpie-prompt-optimizer',
      baseURL: new URL('/__local_magpie/v1', options.origin).href,
    },
    paramOverrides: { ...model.defaultParameterValues, quality: 'low' },
    provider: adapter.getProvider(),
    model,
  })
  return true
}
