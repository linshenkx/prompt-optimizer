/*
 * Prompt Optimizer - AI prompt optimization tool
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * OrcaRouter model catalog: bounded live discovery, per-capability filtering,
 * and a small verified cold-start seed.
 *
 * The single source of truth for the model list is `GET {apiBase}/models` on
 * the configured API origin (default `https://api.orcarouter.ai/v1`). When that
 * succeeds it is authoritative and the seed is *not* mixed into the result.
 * When it fails, only the verified seed is offered, and it is reported as
 * degraded so the UI can say so.
 */

import {
  buildOrcaRouterModelsUrl,
  resolveOrcaRouterOrigins,
  type OrcaRouterOriginOptions
} from './origins'
import type { TextModel } from '../model/types'

/** Upper bounds so one catalog response cannot consume unbounded memory. */
export const ORCAROUTER_CATALOG_TIMEOUT_MS = 10_000
export const ORCAROUTER_CATALOG_MAX_BYTES = 512 * 1024
export const ORCAROUTER_CATALOG_MAX_ITEMS = 500
export const ORCAROUTER_CATALOG_MAX_DESCRIPTION_CHARS = 512

/** Endpoint types this client can actually speak over the OpenAI SDK. */
export const ORCAROUTER_SUPPORTED_ENDPOINT_TYPES = [
  'openai',
  'anthropic',
  'gemini',
  'openai-response'
] as const

/** Endpoint types that are never text-chat, even when `openai` is present. */
const NON_TEXT_ENDPOINT_TYPES = new Set([
  'image-generation',
  'openai-video',
  'jina-rerank',
  'embedding',
  'embeddings'
])

/** Capabilities the catalog is filtered by. */
export type OrcaCatalogCapability =
  | 'chat'
  | 'image-understanding'
  | 'embedding'
  | 'image'
  | 'video'
  | 'rerank'

/** Non-text modalities an entry point can actually upload. */
export type OrcaInputModality = 'image' | 'audio' | 'video'

export interface OrcaCatalogRequirements {
  capability: OrcaCatalogCapability
  /** Additional fail-closed requirement for multimodal entry points. */
  requiredInputModalities?: readonly OrcaInputModality[]
}

interface RawCatalogEntry {
  id: string
  name?: string
  description?: string
  supported_endpoint_types?: unknown
  architecture?: { input_modalities?: unknown }
  context_length?: unknown
  max_completion_tokens?: unknown
}

/** A catalog model plus the metadata the capability filter depends on. */
export interface OrcaCatalogModel {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly supportedEndpointTypes: readonly string[]
  /** `undefined` means "not declared" and fails closed for multimodal. */
  readonly inputModalities?: readonly string[]
  readonly maxContextLength?: number
}

export interface OrcaCatalogSnapshot {
  readonly models: readonly OrcaCatalogModel[]
  /** `live` = authoritative discovery result; `seed` = verified fallback. */
  readonly source: 'live' | 'seed'
  /** True when the live catalog could not be used. */
  readonly degraded: boolean
  /** Safe, secret-free reason for the degraded state. */
  readonly degradedReason?: string
  /** The catalog origin actually queried. */
  readonly catalogUrl: string
  /** Number of records the catalog advertised before filtering/capping. */
  readonly reportedCount: number
}

/**
 * Verified cold-start seed, kept deliberately small. IDs keep the
 * `vendor/model` namespace exactly as advertised by the catalog.
 *
 * Provenance is not uniform, so it is stated per entry rather than claimed for
 * the set as a whole. On the last manual probe of the default origin
 * (`GET https://api.orcarouter.ai/v1/models`, 2026-09-17) the catalog returned
 * `orcarouter/auto` and `deepseek/deepseek-v4-pro` plus a set of DeepSeek
 * variants; neither `openai/gpt-5.5` nor `anthropic/claude-opus-4.8` nor
 * `google/gemini-3.5-flash` appeared in that response. Those three are carried
 * from the verification campaign's designated fallback list with their
 * capability metadata intact, which is exactly the outage case this seed
 * exists for.
 *
 * Two consequences worth being explicit about:
 *  - This list is only ever consulted when live discovery fails. A successful
 *    `GET /v1/models` is authoritative and the seed is never mixed into it, so
 *    an entry that has since left the catalog disappears from the dropdown as
 *    soon as discovery works.
 *  - Capability metadata below (context window, input modalities, reasoning
 *    effort ladder) is preserved verbatim and is never inferred from a model
 *    name. `hasEveryModality` fails closed, so an entry whose modalities are
 *    not declared cannot reach a multimodal dropdown.
 */
export interface OrcaSeedModel {
  id: string
  name: string
  description: string
  maxContextLength: number
  supportsReasoning: boolean
  /** Reasoning-effort ladder retained from live metadata when verified. */
  reasoningEfforts?: readonly string[]
  inputModalities: readonly string[]
}

export const ORCAROUTER_VERIFIED_SEED: readonly OrcaSeedModel[] = [
  {
    id: 'openai/gpt-5.5',
    name: 'OpenAI: GPT-5.5',
    description: 'OpenAI flagship reasoning model via OrcaRouter with the verified low/medium/high/xhigh effort ladder.',
    maxContextLength: 400000,
    supportsReasoning: true,
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    inputModalities: ['text', 'image']
  },
  {
    id: 'anthropic/claude-opus-4.8',
    name: 'Anthropic: Claude Opus 4.8',
    description: 'Anthropic Claude Opus 4.8 via OrcaRouter for long-context reasoning and agentic work.',
    maxContextLength: 200000,
    supportsReasoning: true,
    inputModalities: ['text', 'image']
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Google: Gemini 3.5 Flash',
    description: 'Google Gemini 3.5 Flash via OrcaRouter, tuned for fast multimodal workloads.',
    maxContextLength: 1048576,
    supportsReasoning: true,
    inputModalities: ['text', 'image']
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek: DeepSeek V4 Pro',
    description: 'DeepSeek V4 Pro flagship MoE with a 1M context, verified on the live catalog.',
    maxContextLength: 1048576,
    supportsReasoning: true,
    inputModalities: ['text']
  },
  {
    id: 'orcarouter/auto',
    name: 'OrcaRouter: Auto',
    description: 'OrcaRouter adaptive routing across the models available to this workspace.',
    maxContextLength: 128000,
    supportsReasoning: false,
    inputModalities: ['text']
  }
]

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
}

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.floor(value)
}

function truncate(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

/**
 * Accept only entries shaped like the documented catalog record. Unknown or
 * malformed records are dropped rather than guessed at.
 */
export function parseOrcaCatalogEntry(raw: unknown): OrcaCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as RawCatalogEntry
  const id = typeof entry.id === 'string' ? entry.id.trim() : ''
  if (!id) return null

  const declaredModalities = Array.isArray(entry.architecture?.input_modalities)
    ? toStringArray(entry.architecture?.input_modalities)
    : undefined

  return {
    id,
    name: truncate(entry.name, ORCAROUTER_CATALOG_MAX_DESCRIPTION_CHARS) ?? id,
    description: truncate(entry.description, ORCAROUTER_CATALOG_MAX_DESCRIPTION_CHARS),
    supportedEndpointTypes: toStringArray(entry.supported_endpoint_types),
    inputModalities: declaredModalities && declaredModalities.length > 0 ? declaredModalities : undefined,
    maxContextLength: toPositiveInt(entry.context_length)
  }
}

/** True when the record advertises at least one endpoint type we can speak. */
export function isTextCapable(model: OrcaCatalogModel): boolean {
  const types = model.supportedEndpointTypes
  if (types.length === 0) return false
  if (types.some((type) => NON_TEXT_ENDPOINT_TYPES.has(type))) return false
  return types.some((type) =>
    (ORCAROUTER_SUPPORTED_ENDPOINT_TYPES as readonly string[]).includes(type)
  )
}

function hasEveryModality(
  model: OrcaCatalogModel,
  required: readonly OrcaInputModality[]
): boolean {
  // Fail closed: an undeclared modality list never satisfies a multimodal need.
  if (!model.inputModalities || model.inputModalities.length === 0) return false
  const declared = model.inputModalities.map((item) => item.toLowerCase())
  return required.every((modality) => declared.includes(modality))
}

/**
 * Apply the filter for one entry point. Each AI input entry point passes its
 * own requirements so a dropdown can never offer a model the entry point
 * cannot use.
 */
export function filterOrcaModelsForCapability(
  models: readonly OrcaCatalogModel[],
  requirements: OrcaCatalogRequirements
): OrcaCatalogModel[] {
  const { capability, requiredInputModalities } = requirements

  if (capability === 'embedding') {
    return models.filter((model) => model.supportedEndpointTypes.includes('embedding'))
  }
  if (capability === 'image') {
    return models.filter((model) => model.supportedEndpointTypes.includes('image-generation'))
  }
  if (capability === 'video') {
    return models.filter((model) => model.supportedEndpointTypes.includes('openai-video'))
  }
  if (capability === 'rerank') {
    return models.filter((model) => model.supportedEndpointTypes.includes('jina-rerank'))
  }

  // chat + image-understanding both require a text-capable record first.
  const textCapable = models.filter(isTextCapable)
  if (capability === 'chat') return textCapable

  const required = requiredInputModalities ?? ['image']
  return textCapable.filter((model) => hasEveryModality(model, required))
}

/**
 * Convert a raw `GET /v1/models` payload into bounded catalog models.
 * Malformed payloads yield an empty list rather than an exception, so the
 * caller can fall back to the verified seed.
 */
export function parseOrcaCatalogResponse(payload: unknown): {
  models: OrcaCatalogModel[]
  reportedCount: number
  truncated: boolean
} {
  const data = (payload as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) {
    return { models: [], reportedCount: 0, truncated: false }
  }

  const reportedCount = data.length
  const capped = data.slice(0, ORCAROUTER_CATALOG_MAX_ITEMS)
  const models: OrcaCatalogModel[] = []
  const seen = new Set<string>()

  for (const raw of capped) {
    const parsed = parseOrcaCatalogEntry(raw)
    if (!parsed || seen.has(parsed.id)) continue
    seen.add(parsed.id)
    models.push(parsed)
  }

  return { models, reportedCount, truncated: reportedCount > capped.length }
}

/** The verified seed expressed as catalog models. */
export function getOrcaSeedCatalogModels(): OrcaCatalogModel[] {
  return ORCAROUTER_VERIFIED_SEED.map((seed) => ({
    id: seed.id,
    name: seed.name,
    description: seed.description,
    supportedEndpointTypes: [...ORCAROUTER_SUPPORTED_ENDPOINT_TYPES],
    inputModalities: [...seed.inputModalities],
    maxContextLength: seed.maxContextLength
  }))
}

function seedSnapshot(catalogUrl: string, reason: string, reportedCount = 0): OrcaCatalogSnapshot {
  return {
    models: getOrcaSeedCatalogModels(),
    source: 'seed',
    degraded: true,
    degradedReason: reason,
    catalogUrl,
    reportedCount
  }
}

export interface FetchOrcaCatalogOptions extends OrcaRouterOriginOptions {
  /** Bearer key. Not required by the public catalog but preferred when held. */
  apiKey?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/** Read a response body with a hard byte cap. */
async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader?.()
  if (!reader) {
    const text = await response.text()
    return text.slice(0, maxBytes)
  }

  const decoder = new TextDecoder()
  let received = 0
  let text = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value?.byteLength ?? 0
    if (received > maxBytes) {
      text += decoder.decode(value, { stream: true })
      await reader.cancel().catch(() => undefined)
      break
    }
    text += decoder.decode(value, { stream: true })
  }

  text += decoder.decode()
  return text.slice(0, maxBytes)
}

/**
 * Fetch the live catalog. Any failure produces a degraded, seed-backed
 * snapshot instead of an exception — a catalog outage must never make the
 * provider unusable.
 */
export async function fetchOrcaCatalog(
  options: FetchOrcaCatalogOptions = {}
): Promise<OrcaCatalogSnapshot> {
  const origins = resolveOrcaRouterOrigins(options)
  const catalogUrl = buildOrcaRouterModelsUrl(origins.apiBaseUrl, 'chat')

  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined)
  if (!fetchImpl) {
    return seedSnapshot(catalogUrl, 'No fetch implementation is available')
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  const timeoutMs = options.timeoutMs ?? ORCAROUTER_CATALOG_TIMEOUT_MS
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined

  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.apiKey?.trim()) {
      headers.Authorization = `Bearer ${options.apiKey.trim()}`
    }

    const response = await fetchImpl(catalogUrl, {
      method: 'GET',
      headers,
      signal: controller?.signal
    })

    if (!response.ok) {
      return seedSnapshot(catalogUrl, `Model catalog returned HTTP ${response.status}`)
    }

    const body = await readBoundedBody(response, ORCAROUTER_CATALOG_MAX_BYTES)
    const { models, reportedCount, truncated } = parseOrcaCatalogResponse(JSON.parse(body))

    if (models.length === 0) {
      return seedSnapshot(catalogUrl, 'Model catalog returned no usable records', reportedCount)
    }

    return {
      models,
      source: 'live',
      degraded: truncated,
      degradedReason: truncated
        ? `Model catalog was capped at ${ORCAROUTER_CATALOG_MAX_ITEMS} records`
        : undefined,
      catalogUrl,
      reportedCount
    }
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `Model catalog timed out after ${timeoutMs}ms`
      : 'Model catalog could not be reached'
    return seedSnapshot(catalogUrl, reason)
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface ResolveOrcaModelsOptions extends FetchOrcaCatalogOptions {
  requirements: OrcaCatalogRequirements
}

/**
 * Catalog fetch + capability filter in one call. The returned `options` are
 * the exact list that must be bound to the model selector.
 */
export async function resolveOrcaModelOptions(
  options: ResolveOrcaModelsOptions
): Promise<{ snapshot: OrcaCatalogSnapshot; models: OrcaCatalogModel[] }> {
  const snapshot = await fetchOrcaCatalog(options)
  return {
    snapshot,
    models: filterOrcaModelsForCapability(snapshot.models, options.requirements)
  }
}

/**
 * Map a catalog model onto the repository's `TextModel` shape, preserving the
 * vendor/model namespace, context window and reasoning ladder.
 */
export function toOrcaTextModel(
  model: OrcaCatalogModel,
  providerId: string,
  seed?: OrcaSeedModel
): TextModel {
  const supportsReasoning = seed?.supportsReasoning ?? inferReasoningSupport(model)
  const maxContextLength = model.maxContextLength ?? seed?.maxContextLength

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    providerId,
    capabilities: {
      supportsTools: true,
      supportsReasoning,
      ...(maxContextLength ? { maxContextLength } : {})
    },
    parameterDefinitions: [],
    defaultParameterValues: {}
  }
}

/**
 * Reasoning support is only claimed when the catalog or the verified seed
 * states it — never inferred from a model's name.
 */
function inferReasoningSupport(model: OrcaCatalogModel): boolean {
  return ORCAROUTER_VERIFIED_SEED.some((seed) => seed.id === model.id && seed.supportsReasoning)
}

/** Verified seed entry for a model id, when one exists. */
export function findOrcaSeedModel(modelId: string): OrcaSeedModel | undefined {
  return ORCAROUTER_VERIFIED_SEED.find((seed) => seed.id === modelId)
}

/** Reasoning-effort ladder retained for a verified model, when known. */
export function getOrcaReasoningEfforts(modelId: string): readonly string[] | undefined {
  return findOrcaSeedModel(modelId)?.reasoningEfforts
}
