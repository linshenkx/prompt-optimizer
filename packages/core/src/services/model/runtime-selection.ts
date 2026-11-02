import type { TextModelConfig } from './types'
import type { ITextAdapterRegistry } from '../llm/types'
import { resolveTextModelMetadata } from './metadata-resolver'
import { mergeOverrides } from './parameter-utils'
import type { ImageModelConfig, IImageAdapterRegistry } from '../image/types'
import type { ArenaEffectiveConfig } from '../arena/types'

export interface RuntimeModelSelection {
  modelId?: string
  /** In-memory execution snapshot, never persisted in workspace state. */
  configSnapshot?: TextModelConfig
}

export function resolveRuntimeImageModel(base: ImageModelConfig, selection: Omit<RuntimeModelSelection, 'configSnapshot'>, registry: IImageAdapterRegistry): ImageModelConfig {
  const modelId = selection.modelId?.trim() || base.modelId
  const adapter = registry.getAdapter(base.providerId)
  const model = modelId === base.modelId ? base.model : adapter.getModels().find(m => m.id === modelId) ?? adapter.buildDefaultModel(modelId)
  const inherited = modelId === base.modelId ? { ...base.customParamOverrides, ...base.paramOverrides }
    : Object.fromEntries(Object.entries(base.paramOverrides || {}).filter(([key]) => model.parameterDefinitions.some(p => p.name === key)))
  return { ...base, modelId, model, connectionConfig: { ...base.connectionConfig }, customParamOverrides: undefined,
    paramOverrides: mergeOverrides({ schema: model.parameterDefinitions, requestOverrides: inherited }) }
}

/** Capture the resolved settings and schema defaults without copying API keys,
 * authorization headers, or other arbitrary connection fields into sessions. */
export function describeRuntimeModel(config: TextModelConfig | ImageModelConfig): ArenaEffectiveConfig {
  const text = 'modelMeta' in config
  const connection: Record<string, unknown> = {}
  for (const key of ['baseURL', 'baseUrl', 'endpoint', 'region', 'apiVersion', 'organization', 'project', 'requestStyle', 'timeout', 'accountId', 'deploymentName']) {
    const value = config.connectionConfig?.[key]
    if (typeof value === 'number' || typeof value === 'boolean') { connection[key] = value; continue }
    if (typeof value !== 'string') continue
    try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; connection[key] = url.toString() }
    catch { connection[key] = value }
  }
  const clean = (value: unknown): unknown => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !/api.?key|secret|password|authorization|credential|access.?token|headers/i.test(key)).map(([key, item]) => [key, clean(item)])) : value
  return { providerId: text ? config.providerMeta.id : config.providerId,
    modelId: text ? config.modelMeta.id : config.modelId, connection,
    parameters: clean(mergeOverrides({ schema: text ? config.modelMeta.parameterDefinitions : config.model.parameterDefinitions,
      includeDefaults: true, customOverrides: config.customParamOverrides, requestOverrides: config.paramOverrides })) as Record<string, unknown> }
}

/** A request-local selection. Connection settings and the saved configuration never change. */
export function resolveRuntimeTextModel(base: TextModelConfig, selection: RuntimeModelSelection, registry: ITextAdapterRegistry): TextModelConfig {
  const modelId = selection.modelId?.trim() || base.modelMeta.id
  const metadata = resolveTextModelMetadata({ providerId: base.providerMeta.id, modelId, registry,
    existingProviderMeta: base.providerMeta, existingModelMeta: base.modelMeta })
  const schema = metadata.modelMeta.parameterDefinitions
  const changed = modelId !== base.modelMeta.id
  const inherited = changed
    ? Object.fromEntries(Object.entries(base.paramOverrides || {}).filter(([key]) => schema.some(p => p.name === key)))
    : { ...base.customParamOverrides, ...base.paramOverrides }
  return { ...base, ...metadata, modelId, connectionConfig: { ...base.connectionConfig }, customParamOverrides: undefined,
    paramOverrides: mergeOverrides({ schema, includeDefaults: false, requestOverrides: inherited }) }
}
