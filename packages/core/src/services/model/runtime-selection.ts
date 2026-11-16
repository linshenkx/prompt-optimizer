import type { TextModelConfig } from './types'
import type { ITextAdapterRegistry } from '../llm/types'
import { resolveTextModelMetadata } from './metadata-resolver'
import { mergeOverrides } from './parameter-utils'
import type { ImageModelConfig, IImageAdapterRegistry } from '../image/types'
import type { ArenaEffectiveConfig } from '../arena/types'
import { cleanLocalParameterOverrides } from './local-parameters'
import type { UnifiedParameterDefinition } from './parameter-schema'

export interface RuntimeModelSelection {
  modelId?: string
  paramOverrides?: Record<string, unknown>
  /** In-memory execution snapshot, never persisted in workspace state. */
  configSnapshot?: TextModelConfig
}

function inheritParameters(base: { customParamOverrides?: Record<string, unknown>; paramOverrides?: Record<string, unknown> },
  previousSchema: readonly UnifiedParameterDefinition[], schema: readonly UnifiedParameterDefinition[]): Record<string, unknown> {
  const previousNames = new Set(previousSchema.map(definition => definition.name))
  const names = new Set(schema.map(definition => definition.name))
  // Keep gateway/custom parameters. Only discard declared options that the selected model no longer defines.
  return Object.fromEntries(Object.entries({ ...base.customParamOverrides, ...base.paramOverrides })
    .filter(([name]) => !previousNames.has(name) || names.has(name)))
}

export function resolveRuntimeImageModel(base: ImageModelConfig, selection: Omit<RuntimeModelSelection, 'configSnapshot'>, registry: IImageAdapterRegistry): ImageModelConfig {
  const modelId = selection.modelId?.trim() || base.modelId
  const adapter = registry.getAdapter(base.providerId)
  const model = modelId === base.modelId ? base.model : adapter.getModels().find(m => m.id === modelId) ?? adapter.buildDefaultModel(modelId)
  const inherited = inheritParameters(base, base.model.parameterDefinitions, model.parameterDefinitions)
  return { ...base, modelId, model, connectionConfig: { ...base.connectionConfig }, customParamOverrides: undefined,
    paramOverrides: mergeOverrides({ schema: model.parameterDefinitions, requestOverrides: { ...inherited, ...cleanLocalParameterOverrides(selection.paramOverrides) } }) }
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
  return { providerId: text ? config.providerMeta.id : config.providerId,
    modelId: text ? config.modelMeta.id : config.modelId, connection,
    parameters: cleanLocalParameterOverrides(mergeOverrides({ schema: text ? config.modelMeta.parameterDefinitions : config.model.parameterDefinitions,
      includeDefaults: true, customOverrides: config.customParamOverrides, requestOverrides: config.paramOverrides })) }
}

/** A request-local selection. Connection settings and the saved configuration never change. */
export function resolveRuntimeTextModel(base: TextModelConfig, selection: RuntimeModelSelection, registry: ITextAdapterRegistry): TextModelConfig {
  const modelId = selection.modelId?.trim() || base.modelMeta.id
  const providerId = base.providerId || base.providerMeta.id
  const metadata = resolveTextModelMetadata({ providerId, modelId, registry,
    existingProviderMeta: base.providerMeta, existingModelMeta: base.modelMeta })
  const schema = metadata.modelMeta.parameterDefinitions
  const inherited = inheritParameters(base, base.modelMeta.parameterDefinitions, schema)
  return { ...base, ...metadata, providerId, modelId, connectionConfig: { ...base.connectionConfig }, customParamOverrides: undefined,
    paramOverrides: mergeOverrides({ schema, includeDefaults: false, requestOverrides: { ...inherited, ...cleanLocalParameterOverrides(selection.paramOverrides) } }) }
}
