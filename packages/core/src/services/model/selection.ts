import type { ITextAdapterRegistry } from '../llm/types'
import type { TextModelConfig } from './types'
import { resolveTextModelMetadata } from './metadata-resolver'

// Session/history keys may identify a connection plus a local model choice.
// Plain configuration IDs remain compatible. No virtual configuration or
// credentials are persisted in the selection key.
const PREFIX = 'text-selection:v1:'
export interface TextModelSelection { configId: string; modelId: string }

export function encodeTextModelSelection(configId: string, modelId: string): string {
  return PREFIX + encodeURIComponent(JSON.stringify([configId, modelId]))
}

export function decodeTextModelSelection(key: string): TextModelSelection | null {
  if (!key.startsWith(PREFIX)) return null
  try {
    const value: unknown = JSON.parse(decodeURIComponent(key.slice(PREFIX.length)))
    if (Array.isArray(value) && value.length === 2 && value.every(part => typeof part === 'string' && part.length > 0)) {
      return { configId: value[0], modelId: value[1] }
    }
  } catch { /* Invalid references must not resolve to a different configuration. */ }
  return null
}

export function getTextModelSelectionConfigId(key: string): string {
  return decodeTextModelSelection(key)?.configId ?? key
}

export function resolveTextModelSelection(
  config: TextModelConfig, selection: TextModelSelection, registry: ITextAdapterRegistry,
): TextModelConfig {
  const providerId = config.providerId || config.providerMeta.id
  const metadata = resolveTextModelMetadata({
    providerId, modelId: selection.modelId, registry,
    existingProviderMeta: config.providerMeta, existingModelMeta: config.modelMeta,
  })
  return { ...config, providerId, modelId: selection.modelId, ...metadata }
}
