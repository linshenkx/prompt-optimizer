import { LOCAL_SERVICE_KINDS, type LocalServiceKind } from './local-discovery'
import { normalizeCustomRequestHeaders, validateCustomRequestHeaders, type CustomRequestHeaderInput } from '../../utils/custom-request-headers'

export interface LocalServiceModelRequest {
  kind: LocalServiceKind
  baseURL: string
  apiKey?: string
  providerId?: 'anthropic' | 'openai-compatible'
  customHeaders?: CustomRequestHeaderInput
}

export function isLocalServiceAddress(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash
      && ['', '/v1'].includes(url.pathname.replace(/\/+$/, ''))
  } catch { return false }
}

/** Explicit catalog reads after opening a local service draft. Never guesses models or keys. */
export async function fetchLocalServiceModels(
  input: LocalServiceModelRequest,
  options: { fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ value: string; label: string }[]> {
  if (!input || !LOCAL_SERVICE_KINDS.includes(input.kind)) throw new Error('Invalid local service')
  if (!isLocalServiceAddress(input.baseURL)) throw new Error('Invalid local service address')
  const url = new URL(input.baseURL)
  if (input.apiKey !== undefined && typeof input.apiKey !== 'string') throw new Error('Invalid API key')
  if (input.providerId !== undefined && !['anthropic', 'openai-compatible'].includes(input.providerId)) throw new Error('Invalid local service protocol')
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 10000)])
    : AbortSignal.timeout(options.timeoutMs ?? 10000)
  const request = options.fetch ?? globalThis.fetch
  const key = input.apiKey?.trim()
  const authHeaders: Record<string, string> | undefined = key
    ? input.providerId === 'anthropic' ? { 'x-api-key': key } : { Authorization: `Bearer ${key}` }
    : undefined
  if (!validateCustomRequestHeaders(input.customHeaders).valid) throw new Error('Invalid custom request headers')
  const customHeaders = normalizeCustomRequestHeaders(input.customHeaders)
  const get = async (path: string) => {
    const response = await request(url.origin + path, {
      signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
      ...(authHeaders || customHeaders ? { headers: { ...customHeaders, ...authHeaders } } : {}),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
  let entries: unknown
  if (input.kind === 'ollama') {
    const body = await get('/api/tags')
    entries = Array.isArray(body?.models) ? body.models.map((model: { name?: unknown } | null) => ({ id: model?.name })) : undefined
  } else if (input.kind === 'lmstudio') {
    let body
    let legacy = false
    try { body = await get('/api/v1/models') } catch (error) {
      if (!(error instanceof Error) || error.message !== 'HTTP 404') throw error
      legacy = true
      body = await get('/api/v0/models')
    }
    const models = legacy ? body?.data : body?.models
    if (!Array.isArray(models) || models.some(model => !model
      || !['llm', 'vlm', 'embedding', 'embeddings', 'decision'].includes(model.type)
      || typeof model[legacy ? 'id' : 'key'] !== 'string')) throw new Error('Invalid local model catalog')
    entries = models.filter(model => ['llm', 'vlm'].includes(model.type)).map(model => ({
      id: legacy ? model.id : (model.loaded_instances?.[0]?.id ?? model.key), display_name: model.display_name,
    }))
  } else {
    const body = await get(input.kind === 'cc-switch' && input.providerId === 'anthropic' ? '/v1/models?limit=1000' : '/v1/models')
    entries = input.kind === 'cc-switch' && Array.isArray(body?.models)
      ? body.models.map((model: { slug?: unknown; display_name?: unknown } | null) => ({ id: model?.slug, display_name: model?.display_name }))
      : body?.data
  }
  if (!Array.isArray(entries)) throw new Error('Invalid local model catalog')
  const result: { value: string; label: string }[] = []
  const seen = new Set<string>()
  for (const model of entries) {
    if (typeof model?.id !== 'string' || !model.id.trim()) throw new Error('Invalid local model catalog')
    if (seen.has(model.id)) continue
    seen.add(model.id)
    result.push({ value: model.id, label: typeof model.display_name === 'string' ? model.display_name : model.id })
  }
  return result
}
