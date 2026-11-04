export type PromptGardenSuggestionStrategy =
  | 'mixed'
  | 'latest'
  | 'random'
  | 'featured'
export type PromptGardenSuggestionSource =
  | 'latest'
  | 'random'
  | 'featured'
  | 'related'

export interface PromptGardenSuggestionItem {
  id: string
  title: string
  summary: string
  excerpt?: string
  categoryPath?: string[]
  importCode: string
  tags: string[]
  mode: string | null
  thumbnailUrl: string | null
  previewUrl?: string
  updatedAt: string | null
  source: PromptGardenSuggestionSource | null
}

export interface PromptGardenSuggestionResponse {
  items: PromptGardenSuggestionItem[]
  browseUrl: string
  nextExclude: string[]
  ttlSeconds: number | null
}

export interface FetchPromptGardenSuggestionsOptions {
  gardenBaseUrl: string
  mode: string
  limit?: number
  strategy?: PromptGardenSuggestionStrategy
  exclude?: string[]
  locale?: string
  timeoutMs?: number
}

const DEFAULT_LIMIT = 3
const DEFAULT_TIMEOUT_MS = 2500
const SOURCE_VALUES = new Set<PromptGardenSuggestionSource>([
  'latest',
  'random',
  'featured',
  'related',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeBaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/, '')

const normalizeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const resolveGardenUrl = (
  gardenBaseUrl: string,
  value: unknown,
): string | null => {
  const raw = normalizeString(value)
  if (!raw) return null

  try {
    return new URL(raw, `${gardenBaseUrl}/`).toString()
  } catch {
    return null
  }
}

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => normalizeString(item))
        .filter(Boolean)
        .slice(0, 3),
    ),
  )
}

const normalizeNextExclude = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => normalizeString(item)).filter(Boolean)),
  )
}

const normalizeSuggestionItem = (
  value: unknown,
  gardenBaseUrl: string,
): PromptGardenSuggestionItem | null => {
  if (!isRecord(value)) return null

  const id = normalizeString(value.id)
  const title = normalizeString(value.title)
  const summary = normalizeString(value.summary)
  const importCode = normalizeString(value.importCode)

  if (!id || !title || !summary || !importCode) return null

  const source = normalizeString(value.source)
  const mode = normalizeString(value.mode)

  return {
    id,
    title,
    summary,
    ...(normalizeString(value.excerpt)
      ? { excerpt: normalizeString(value.excerpt) }
      : {}),
    ...(Array.isArray(value.categoryPath)
      ? {
          categoryPath: value.categoryPath.map(normalizeString).filter(Boolean),
        }
      : {}),
    importCode,
    tags: normalizeTags(value.tags),
    mode: mode || null,
    thumbnailUrl: resolveGardenUrl(gardenBaseUrl, value.thumbnailUrl),
    ...(resolveGardenUrl(gardenBaseUrl, value.previewUrl)
      ? { previewUrl: resolveGardenUrl(gardenBaseUrl, value.previewUrl)! }
      : {}),
    updatedAt: normalizeString(value.updatedAt) || null,
    source: SOURCE_VALUES.has(source as PromptGardenSuggestionSource)
      ? (source as PromptGardenSuggestionSource)
      : null,
  }
}

const buildFallbackBrowseUrl = (
  gardenBaseUrl: string,
  mode: string,
): string => {
  const url = new URL(`${gardenBaseUrl}/prompts`)
  if (mode) {
    url.searchParams.set('mode', mode)
  }
  return url.toString()
}

export const buildPromptGardenSuggestionsUrl = (
  options: FetchPromptGardenSuggestionsOptions,
): string => {
  const gardenBaseUrl = normalizeBaseUrl(options.gardenBaseUrl)
  if (!gardenBaseUrl) {
    throw new Error('Missing Prompt Garden base URL')
  }

  const url = new URL(`${gardenBaseUrl}/api/public/prompts/suggestions`)
  url.searchParams.set('mode', options.mode)
  url.searchParams.set('limit', String(options.limit ?? DEFAULT_LIMIT))
  url.searchParams.set('strategy', options.strategy ?? 'mixed')

  const exclude = Array.from(
    new Set((options.exclude ?? []).map((item) => item.trim()).filter(Boolean)),
  )
  if (exclude.length > 0) {
    url.searchParams.set('exclude', exclude.join(','))
  }

  const locale = normalizeString(options.locale)
  if (locale) {
    url.searchParams.set('locale', locale)
  }

  return url.toString()
}

export const fetchPromptGardenSuggestions = async (
  options: FetchPromptGardenSuggestionsOptions,
): Promise<PromptGardenSuggestionResponse> => {
  const gardenBaseUrl = normalizeBaseUrl(options.gardenBaseUrl)
  const url = buildPromptGardenSuggestionsUrl({
    ...options,
    gardenBaseUrl,
  })

  const data = await fetchGardenJson(
    url,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )

  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => normalizeSuggestionItem(item, gardenBaseUrl))
        .filter((item): item is PromptGardenSuggestionItem => Boolean(item))
    : []

  const browseUrl =
    resolveGardenUrl(gardenBaseUrl, data.browseUrl) ||
    buildFallbackBrowseUrl(gardenBaseUrl, options.mode)

  const ttlSeconds =
    typeof data.ttlSeconds === 'number' &&
    Number.isFinite(data.ttlSeconds) &&
    data.ttlSeconds > 0
      ? Math.floor(data.ttlSeconds)
      : null

  return {
    items,
    browseUrl,
    nextExclude: normalizeNextExclude(data.nextExclude),
    ttlSeconds,
  }
}

export interface FetchPromptGardenCatalogOptions {
  gardenBaseUrl: string
  mode: string
  locale?: string
  query?: string
  offset?: number
  limit?: number
  timeoutMs?: number
}

export interface PromptGardenCatalogResponse {
  items: PromptGardenSuggestionItem[]
  total: number
  nextOffset: number | null
  browseUrl: string
}

const fetchGardenJson = async (
  url: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`Garden request failed: ${response.status}`)
    const data: unknown = await response.json()
    if (!isRecord(data)) throw new Error('Garden response must be an object')
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export const fetchPromptGardenCatalog = async (
  options: FetchPromptGardenCatalogOptions,
): Promise<PromptGardenCatalogResponse> => {
  const baseUrl = normalizeBaseUrl(options.gardenBaseUrl)
  const url = new URL(`${baseUrl}/api/public/prompts/catalog`)
  url.searchParams.set('mode', options.mode)
  url.searchParams.set('limit', String(options.limit ?? 20))
  url.searchParams.set('offset', String(options.offset ?? 0))
  if (options.query?.trim()) url.searchParams.set('q', options.query.trim())
  if (options.locale) url.searchParams.set('locale', options.locale)
  const data = await fetchGardenJson(url.toString(), options.timeoutMs ?? 8000)
  if (
    !Array.isArray(data.items) ||
    typeof data.total !== 'number' ||
    !Number.isInteger(data.total) ||
    data.total < 0
  ) {
    throw new Error('Invalid Garden catalog response')
  }
  const nextOffset = data.nextOffset
  if (
    nextOffset !== null &&
    (typeof nextOffset !== 'number' ||
      !Number.isInteger(nextOffset) ||
      nextOffset <= (options.offset ?? 0) ||
      nextOffset > data.total)
  ) {
    throw new Error('Invalid Garden catalog pagination')
  }
  return {
    items: data.items
      .map((item) => normalizeSuggestionItem(item, baseUrl))
      .filter((item): item is PromptGardenSuggestionItem => Boolean(item)),
    total: data.total,
    nextOffset,
    browseUrl:
      resolveGardenUrl(baseUrl, data.browseUrl) ||
      buildFallbackBrowseUrl(baseUrl, options.mode),
  }
}

export const fetchPromptGardenPreview = async (
  gardenBaseUrl: string,
  importCode: string,
): Promise<string> => {
  const url = `${normalizeBaseUrl(gardenBaseUrl)}/api/public/prompt-source/${encodeURIComponent(importCode)}`
  const data = await fetchGardenJson(url, 8000)
  const prompt = data.prompt
  if (
    data.schema !== 'prompt-garden.prompt.v1' ||
    data.schemaVersion !== 1 ||
    !isRecord(prompt)
  ) {
    throw new Error('Invalid Garden prompt source')
  }
  const text =
    prompt.format === 'text'
      ? normalizeString(prompt.text)
      : prompt.format === 'messages' && Array.isArray(prompt.messages)
        ? prompt.messages
            .map((message) =>
              isRecord(message) ? normalizeString(message.content) : '',
            )
            .filter(Boolean)
            .join('\n\n')
        : ''
  if (!text) throw new Error('Garden prompt source is empty')
  return text
}
