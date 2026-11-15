import { getTextModelConfigIdentity } from '../model/metadata-resolver'
import { isLegacyConfig, isTextModelConfig } from '../model/converter'
import type { FavoritePrompt } from '../favorite/types'
import { isPromptAsset, promptAssetFromFavorite } from '../prompt-model/favorite'
import { createPromptContract, isPromptModeKey } from '../prompt-model/mode'
import { PROMPT_MODEL_SCHEMA_VERSION, type PromptAsset } from '../prompt-model/types'
import type { PublicStoredModel } from './types'

export type AssetReadErrorCode = 'INVALID_INPUT' | 'SOURCE_DATA_MISSING' | 'SOURCE_DATA_INVALID' |
  'SOURCE_READ_FAILED' | 'SCHEMA_UNSUPPORTED' | 'ASSET_VERSION_NOT_FOUND' | 'ASSET_CONTENT_UNSUPPORTED' |
  'REVISION_CONFLICT' | 'INVALID_CURSOR' | 'REVISION_UNAVAILABLE'

/** Never attach a raw exception/cause, key, record, path or SDK message. */
export class AssetReadError extends Error {
  readonly code: AssetReadErrorCode
  constructor(code: AssetReadErrorCode) {
    super(`Read-only asset access failed (${code}).`)
    this.name = 'AssetReadError'
    this.code = code
  }
}

export const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
export const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === 'string')
const time = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const requireData: (condition: unknown) => asserts condition = condition => {
  if (!condition) throw new AssetReadError('SOURCE_DATA_INVALID')
}
const noUnversionedEnvelope = (v: unknown) => {
  if (record(v) && Object.prototype.hasOwnProperty.call(v, 'schemaVersion')) throw new AssetReadError('SCHEMA_UNSUPPORTED')
}

export function parseModels(value: unknown): Array<{ raw: Record<string, unknown>; model: Omit<PublicStoredModel, 'revision'> }> {
  noUnversionedEnvelope(value)
  requireData(record(value))
  return Object.keys(value).sort().map(configKey => {
    const raw = value[configKey]
    requireData(text(configKey) && record(raw))
    noUnversionedEnvelope(raw)
    requireData(text(raw.name) && typeof raw.enabled === 'boolean')
    if (isTextModelConfig(raw)) {
      requireData(record(raw.providerMeta) && record(raw.modelMeta) && record(raw.connectionConfig))
      requireData(text(raw.providerMeta.id) && text(raw.modelMeta.id) && text(raw.modelMeta.providerId))
      requireData((raw.providerId === undefined || text(raw.providerId)) && (raw.modelId === undefined || text(raw.modelId)))
      const identity = getTextModelConfigIdentity(raw)
      requireData(identity)
      const aligned = identity.providerId === raw.providerMeta.id && identity.providerId === raw.modelMeta.providerId && identity.modelId === raw.modelMeta.id
      const caps = raw.modelMeta.capabilities
      requireData(record(caps) && typeof caps.supportsTools === 'boolean')
      requireData(caps.supportsReasoning === undefined || typeof caps.supportsReasoning === 'boolean')
      requireData(caps.maxContextLength === undefined || (time(caps.maxContextLength) && caps.maxContextLength > 0))
      // Stale metadata cannot describe an explicitly selected different model.
      const capabilities: PublicStoredModel['capabilities'] = aligned ? {
        supportsTools: caps.supportsTools,
        ...(caps.supportsReasoning !== undefined ? { supportsReasoning: caps.supportsReasoning } : {}),
        ...(caps.maxContextLength !== undefined ? { maxContextLength: caps.maxContextLength } : {}),
      } : {}
      return { raw, model: { configKey, name: raw.name, enabled: raw.enabled, ...identity, capabilities,
        executable: false, unavailableReason: !raw.enabled ? 'MODEL_DISABLED' : aligned ? 'EXECUTION_NOT_CONNECTED' : 'MODEL_METADATA_MISMATCH' } }
    }
    requireData(isLegacyConfig(raw) && text(raw.provider) && text(raw.defaultModel) && typeof raw.baseURL === 'string')
    // Preserve the saved identity. The legacy converter's unknown-provider fallback
    // and inferred capabilities/defaults are inappropriate for strict discovery.
    return { raw, model: { configKey, name: raw.name, enabled: raw.enabled,
      providerId: raw.provider === 'custom' ? 'openai-compatible' : raw.provider,
      modelId: raw.defaultModel, capabilities: {}, executable: false,
      unavailableReason: 'MODEL_REQUIRES_MIGRATION' } }
  })
}

function validateContent(value: unknown) {
  requireData(record(value))
  switch (value.kind) {
    case 'text': case 'image-prompt': requireData(typeof value.text === 'string'); break
    case 'messages':
      requireData(Array.isArray(value.messages) && value.messages.every(message => record(message) &&
        typeof message.role === 'string' && ['system', 'user', 'assistant', 'tool'].includes(message.role) && typeof message.content === 'string'))
      break
    default: throw new AssetReadError('SCHEMA_UNSUPPORTED')
  }
}

function validateAsset(value: unknown): asserts value is PromptAsset {
  requireData(record(value))
  if (value.schemaVersion !== PROMPT_MODEL_SCHEMA_VERSION) throw new AssetReadError('SCHEMA_UNSUPPORTED')
  requireData(isPromptAsset(value) && strings(value.tags) && Array.isArray(value.contract.variables))
  const contract = createPromptContract(value.contract.modeKey)
  requireData(value.contract.family === contract.family && (!('subMode' in contract) || ('subMode' in value.contract && value.contract.subMode === contract.subMode)))
  const variableNames = new Set<string>()
  for (const variable of value.contract.variables) {
    requireData(record(variable) && text(variable.name) && typeof variable.required === 'boolean' && !variableNames.has(variable.name))
    requireData(variable.type === undefined || ['string', 'number', 'boolean', 'enum'].includes(variable.type))
    requireData(variable.options === undefined || strings(variable.options))
    requireData(variable.defaultValue === undefined || typeof variable.defaultValue === 'string')
    variableNames.add(variable.name)
  }
  const ids = new Set<string>()
  for (const version of value.versions) {
    requireData(record(version) && text(version.id) && Number.isSafeInteger(version.version) && version.version > 0 && time(version.createdAt) && !ids.has(version.id))
    validateContent(version.content)
    ids.add(version.id)
  }
  requireData(ids.size > 0 && ids.has(value.currentVersionId) && time(value.createdAt) && time(value.updatedAt))
}

export function parseFavorites(value: unknown): Array<{ raw: Record<string, unknown>; favoriteId: string; asset: PromptAsset }> {
  noUnversionedEnvelope(value)
  requireData(Array.isArray(value))
  const ids = new Set<string>()
  const assetIds = new Set<string>()
  return value.map(raw => {
    requireData(record(raw))
    noUnversionedEnvelope(raw)
    requireData(text(raw.id) && text(raw.title) && typeof raw.content === 'string' && strings(raw.tags) && time(raw.createdAt) && time(raw.updatedAt) && !ids.has(raw.id))
    requireData(raw.metadata === undefined || record(raw.metadata))
    requireData(raw.functionMode === undefined || typeof raw.functionMode === 'string')
    if (raw.functionMode !== undefined && !['basic', 'context', 'image'].includes(raw.functionMode)) throw new AssetReadError('SCHEMA_UNSUPPORTED')
    requireData(raw.optimizationMode === undefined || (typeof raw.optimizationMode === 'string' && ['system', 'user'].includes(raw.optimizationMode)))
    requireData(raw.imageSubMode === undefined || (typeof raw.imageSubMode === 'string' && ['text2image', 'image2image', 'multiimage'].includes(raw.imageSubMode)))
    // An invalid/future embedded asset must never fall through to legacy projection.
    if (record(raw.metadata) && Object.prototype.hasOwnProperty.call(raw.metadata, 'promptAsset')) validateAsset(raw.metadata.promptAsset)
    const asset = promptAssetFromFavorite(raw as unknown as FavoritePrompt)
    validateAsset(asset)
    requireData(isPromptModeKey(asset.contract.modeKey) && !assetIds.has(asset.id))
    ids.add(raw.id)
    assetIds.add(asset.id)
    return { raw, favoriteId: raw.id, asset }
  }).sort((a, b) => a.favoriteId < b.favoriteId ? -1 : a.favoriteId > b.favoriteId ? 1 : 0)
}
