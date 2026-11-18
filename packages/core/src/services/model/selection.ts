import type { ITextAdapterRegistry } from '../llm/types'
import type { TextModelConfig } from './types'
import { cleanLocalParameterOverrides } from './local-parameters'
import { resolveRuntimeTextModel } from './runtime-selection'
export { cleanLocalParameterOverrides } from './local-parameters'

// Session/history keys may identify a connection plus a local model choice.
// Plain configuration IDs remain compatible. No virtual configuration or
// credentials are persisted in the selection key.
const PREFIX = 'text-selection:v1:'
const IMAGE_PREFIX = 'image-selection:v1:'
export interface TextModelSelection { configId: string; modelId: string; paramOverrides?: Record<string, unknown> }

function encodeSelection(prefix: string, configId: string, modelId: string, overrides?: Record<string, unknown>): string {
  const parameters = cleanLocalParameterOverrides(overrides)
  return prefix + encodeURIComponent(JSON.stringify(Object.keys(parameters).length ? [configId, modelId, parameters] : [configId, modelId]))
}

export function encodeTextModelSelection(configId: string, modelId: string, overrides?: Record<string, unknown>): string {
  return encodeSelection(PREFIX, configId, modelId, overrides)
}

function decodeSelection(prefix: string, key: string): TextModelSelection | null {
  if (!key.startsWith(prefix)) return null
  try {
    const value: unknown = JSON.parse(decodeURIComponent(key.slice(prefix.length)))
    if (Array.isArray(value) && (value.length === 2 || value.length === 3) && value.slice(0, 2).every(part => typeof part === 'string' && part.length > 0)) {
      if (value.length === 3 && (!value[2] || typeof value[2] !== 'object' || Array.isArray(value[2]))) return null
      return { configId: value[0], modelId: value[1], ...(value.length === 3 ? { paramOverrides: cleanLocalParameterOverrides(value[2]) } : {}) }
    }
  } catch { /* Invalid references must not resolve to a different configuration. */ }
  return null
}

export const decodeTextModelSelection = (key: string): TextModelSelection | null => decodeSelection(PREFIX, key)
export const encodeImageModelSelection = (configId: string, modelId: string, overrides?: Record<string, unknown>): string => encodeSelection(IMAGE_PREFIX, configId, modelId, overrides)
export const decodeImageModelSelection = (key: string): TextModelSelection | null => decodeSelection(IMAGE_PREFIX, key)
export const getImageModelSelectionConfigId = (key: string): string => decodeImageModelSelection(key)?.configId ?? key

export function getTextModelSelectionConfigId(key: string): string {
  return decodeTextModelSelection(key)?.configId ?? key
}

export function resolveTextModelSelection(
  config: TextModelConfig, selection: TextModelSelection, registry: ITextAdapterRegistry,
): TextModelConfig {
  return resolveRuntimeTextModel(config, selection, registry)
}
