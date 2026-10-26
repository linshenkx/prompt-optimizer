import type { ITextAdapterRegistry } from '../llm/types'
import type { ParameterDefinition, TextModel, TextModelConfig, TextProvider } from './types'

export interface TextModelIdentity {
  providerId: string
  modelId: string
}

export interface ResolveTextModelMetadataInput {
  providerId: string
  modelId: string
  registry: ITextAdapterRegistry
  existingProviderMeta?: TextProvider
  existingModelMeta?: TextModel
}

export interface ResolvedTextModelMetadata {
  providerMeta: TextProvider
  modelMeta: TextModel
}

export function getTextModelConfigIdentity(
  config: Partial<TextModelConfig>
): TextModelIdentity | null {
  const providerId = config.providerId
    || config.providerMeta?.id
    || config.modelMeta?.providerId
  const modelId = config.modelId || config.modelMeta?.id

  if (!providerId || !modelId) {
    return null
  }

  return { providerId, modelId }
}

/**
 * Resolve provider/model metadata from the selected provider/model identity.
 *
 * Existing metadata is only reused when it belongs to the same identity. This
 * keeps edit flows from accidentally carrying stale provider snapshots across
 * provider switches.
 */
export function resolveTextModelMetadata({
  providerId,
  modelId,
  registry,
  existingProviderMeta,
  existingModelMeta,
}: ResolveTextModelMetadataInput): ResolvedTextModelMetadata {
  const adapter = registry.getAdapter(providerId)

  const providerMeta = existingProviderMeta?.id === providerId
    ? existingProviderMeta
    : adapter.getProvider()

  const modelMeta =
    existingModelMeta?.id === modelId && existingModelMeta.providerId === providerId
      ? existingModelMeta
      : adapter.getModels().find((model) => model.id === modelId) || adapter.buildDefaultModel(modelId)

  return {
    providerMeta,
    modelMeta,
  }
}

export function hasTextModelMetadataIdentityMismatch(
  providerMeta: Pick<TextProvider, 'id'> | undefined,
  modelMeta: Pick<TextModel, 'providerId'> | undefined
): boolean {
  return !!providerMeta?.id && !!modelMeta?.providerId && providerMeta.id !== modelMeta.providerId
}

export function hasExplicitTextModelIdentity(config: Partial<TextModelConfig>): boolean {
  return !!config.providerId || !!config.modelId
}

/** Current editing/validation rules, without replacing the stored snapshot or runtime defaults. */
export function resolveTextModelParameterDefinitions({
  providerId,
  modelId,
  connectionConfig,
  savedDefinitions,
  registry,
}: {
  providerId: string
  modelId: string
  connectionConfig: TextModelConfig['connectionConfig']
  savedDefinitions: readonly ParameterDefinition[]
  registry: ITextAdapterRegistry
}): readonly ParameterDefinition[] {
  try {
    const adapter = registry.getAdapter(providerId)
    const provider = adapter.getProvider()
    // The compatible provider's catalog is a convenience list, not a schema
    // declaration for an arbitrary gateway, even when model IDs happen to match.
    if (provider.id === 'openai-compatible') return savedDefinitions

    const normalizeEndpoint = (endpoint: string) => endpoint.trim()
      .replace(/\{(\w+)\}/g, (placeholder, field: string) => String(connectionConfig[field] ?? placeholder))
      .replace(/\/+$/, '')
    const endpoint = connectionConfig.baseURL || provider.defaultBaseURL
    if (typeof endpoint !== 'string' || !endpoint) return savedDefinitions
    const declaredEndpoints = [
      provider.defaultBaseURL,
      ...(provider.regionalEndpoints ?? []).flatMap(region => [region.openaiBaseURL, region.anthropicBaseURL]),
    ]
    if (!declaredEndpoints.some(url => url && normalizeEndpoint(url) === normalizeEndpoint(endpoint))) {
      return savedDefinitions
    }

    const model = adapter.getModels().find(model => model.id === modelId && model.providerId === providerId)
    if (!model) return savedDefinitions
    const currentNames = new Set(model.parameterDefinitions.map(definition => definition.name))
    return [
      ...model.parameterDefinitions,
      ...savedDefinitions.filter(definition => !currentNames.has(definition.name)),
    ]
  } catch {
    // Private/removed models and unavailable registries retain their own rules.
    return savedDefinitions
  }
}
