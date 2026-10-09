import { describe, expect, it, vi } from 'vitest'

import {
  ORCAROUTER_CATALOG_MAX_ITEMS,
  ORCAROUTER_SUPPORTED_ENDPOINT_TYPES,
  ORCAROUTER_VERIFIED_SEED,
  fetchOrcaCatalog,
  filterOrcaModelsForCapability,
  findOrcaSeedModel,
  getOrcaReasoningEfforts,
  getOrcaSeedCatalogModels,
  isTextCapable,
  parseOrcaCatalogEntry,
  parseOrcaCatalogResponse,
  resolveOrcaModelOptions,
  toOrcaTextModel,
  type OrcaCatalogModel
} from '../../../src/services/orcarouter/catalog'

/**
 * Fixtures mirroring the real `GET /v1/models` record shape, covering every
 * category the capability filters must separate.
 */
const FIXTURES = {
  textOnly: {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek: DeepSeek V4 Pro',
    supported_endpoint_types: ['openai', 'openai-response'],
    architecture: { input_modalities: ['text'] },
    context_length: 1048576
  },
  imageInputChat: {
    id: 'deepseek/deepseek-v4-flash-vision-exp',
    name: 'DeepSeek: V4 Flash Vision',
    supported_endpoint_types: ['openai', 'openai-response', 'anthropic'],
    architecture: { input_modalities: ['text', 'image'] },
    context_length: 1048576
  },
  undeclaredModalities: {
    id: 'orcarouter/auto',
    name: 'OrcaRouter: Auto',
    supported_endpoint_types: ['openai', 'openai-response', 'anthropic', 'gemini']
    // No architecture block: must fail closed for multimodal.
  },
  embedding: {
    id: 'vendor/embed-large',
    name: 'Embed Large',
    supported_endpoint_types: ['embedding'],
    architecture: { input_modalities: ['text'] }
  },
  imageGeneration: {
    id: 'vendor/img-gen',
    name: 'Image Gen',
    supported_endpoint_types: ['image-generation'],
    architecture: { input_modalities: ['text'] }
  },
  imageGenerationPlusChat: {
    id: 'vendor/gemini-image-chat',
    name: 'Gemini Image Chat',
    // Advertises both; must be excluded from the text chat dropdown.
    supported_endpoint_types: ['openai', 'image-generation'],
    architecture: { input_modalities: ['text', 'image'] }
  },
  video: {
    id: 'vendor/video-1',
    name: 'Video One',
    supported_endpoint_types: ['openai-video'],
    architecture: { input_modalities: ['text'] }
  },
  rerank: {
    id: 'vendor/rerank-1',
    name: 'Rerank One',
    supported_endpoint_types: ['jina-rerank'],
    architecture: { input_modalities: ['text'] }
  }
}

const ALL_MODELS: OrcaCatalogModel[] = Object.values(FIXTURES)
  .map((entry) => parseOrcaCatalogEntry(entry)!)
  .filter(Boolean)

function ids(models: OrcaCatalogModel[]): string[] {
  return models.map((model) => model.id)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('catalog response parsing', () => {
  it('keeps the vendor/model namespace verbatim', () => {
    const { models } = parseOrcaCatalogResponse({ data: [FIXTURES.textOnly, FIXTURES.imageInputChat] })

    expect(ids(models)).toEqual([
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-v4-flash-vision-exp'
    ])
    // No normalization, lowercasing, or namespace stripping.
    expect(models[0].id).toContain('/')
  })

  it('preserves context length and declared input modalities', () => {
    const { models } = parseOrcaCatalogResponse({ data: [FIXTURES.imageInputChat] })

    expect(models[0].maxContextLength).toBe(1048576)
    expect(models[0].inputModalities).toEqual(['text', 'image'])
  })

  it('leaves input modalities undefined when the catalog does not declare them', () => {
    const { models } = parseOrcaCatalogResponse({ data: [FIXTURES.undeclaredModalities] })

    expect(models[0].inputModalities).toBeUndefined()
  })

  it('drops malformed records instead of guessing at their capabilities', () => {
    expect(parseOrcaCatalogEntry(null)).toBeNull()
    expect(parseOrcaCatalogEntry({})).toBeNull()
    expect(parseOrcaCatalogEntry({ id: '   ' })).toBeNull()
    expect(parseOrcaCatalogEntry({ name: 'no id' })).toBeNull()
  })

  it('deduplicates by id and survives a non-array payload', () => {
    const { models, reportedCount } = parseOrcaCatalogResponse({
      data: [FIXTURES.textOnly, FIXTURES.textOnly]
    })

    expect(ids(models)).toEqual(['deepseek/deepseek-v4-pro'])
    expect(reportedCount).toBe(2)
    expect(parseOrcaCatalogResponse({}).models).toEqual([])
    expect(parseOrcaCatalogResponse(null).models).toEqual([])
    expect(parseOrcaCatalogResponse({ data: 'nope' }).models).toEqual([])
  })

  it('caps the number of accepted records', () => {
    const many = Array.from({ length: ORCAROUTER_CATALOG_MAX_ITEMS + 25 }, (_, index) => ({
      id: `vendor/model-${index}`
    }))
    const { models, truncated, reportedCount } = parseOrcaCatalogResponse({ data: many })

    expect(models).toHaveLength(ORCAROUTER_CATALOG_MAX_ITEMS)
    expect(truncated).toBe(true)
    expect(reportedCount).toBe(ORCAROUTER_CATALOG_MAX_ITEMS + 25)
  })
})

describe('text capability detection', () => {
  it('accepts only the endpoint types this client can speak', () => {
    expect(isTextCapable(parseOrcaCatalogEntry(FIXTURES.textOnly)!)).toBe(true)
    expect(isTextCapable(parseOrcaCatalogEntry(FIXTURES.imageInputChat)!)).toBe(true)
    expect(ORCAROUTER_SUPPORTED_ENDPOINT_TYPES).toEqual([
      'openai',
      'anthropic',
      'gemini',
      'openai-response'
    ])
  })

  it('rejects non-text endpoint types even when openai is also advertised', () => {
    expect(isTextCapable(parseOrcaCatalogEntry(FIXTURES.imageGenerationPlusChat)!)).toBe(false)
    expect(isTextCapable(parseOrcaCatalogEntry(FIXTURES.imageGeneration)!)).toBe(false)
    expect(isTextCapable(parseOrcaCatalogEntry(FIXTURES.embedding)!)).toBe(false)
    expect(isTextCapable(parseOrcaCatalogEntry(FIXTURES.video)!)).toBe(false)
    expect(isTextCapable(parseOrcaCatalogEntry(FIXTURES.rerank)!)).toBe(false)
  })

  it('rejects a record that declares no endpoint type at all', () => {
    expect(isTextCapable(parseOrcaCatalogEntry({ id: 'vendor/mystery' })!)).toBe(false)
  })
})

describe('per-entry-point capability filtering', () => {
  it('chat keeps text models and excludes image-generation, video and rerank', () => {
    const chat = filterOrcaModelsForCapability(ALL_MODELS, { capability: 'chat' })

    expect(ids(chat)).toEqual([
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-v4-flash-vision-exp',
      'orcarouter/auto'
    ])
    expect(ids(chat)).not.toContain('vendor/img-gen')
    expect(ids(chat)).not.toContain('vendor/gemini-image-chat')
    expect(ids(chat)).not.toContain('vendor/video-1')
    expect(ids(chat)).not.toContain('vendor/rerank-1')
    expect(ids(chat)).not.toContain('vendor/embed-large')
  })

  it('image understanding narrows chat to models declaring image input', () => {
    const multimodal = filterOrcaModelsForCapability(ALL_MODELS, {
      capability: 'image-understanding',
      requiredInputModalities: ['image']
    })

    expect(ids(multimodal)).toEqual(['deepseek/deepseek-v4-flash-vision-exp'])
    // Fail closed: the undeclared-modality router is not offered.
    expect(ids(multimodal)).not.toContain('orcarouter/auto')
    expect(ids(multimodal)).not.toContain('deepseek/deepseek-v4-pro')
  })

  it('multimodal filtering fails closed when modalities are undeclared', () => {
    const undeclaredOnly = [parseOrcaCatalogEntry(FIXTURES.undeclaredModalities)!]

    expect(
      filterOrcaModelsForCapability(undeclaredOnly, {
        capability: 'chat'
      })
    ).toHaveLength(1)
    expect(
      filterOrcaModelsForCapability(undeclaredOnly, {
        capability: 'image-understanding',
        requiredInputModalities: ['image']
      })
    ).toHaveLength(0)
  })

  it('embedding matches only the embeddings endpoint', () => {
    expect(ids(filterOrcaModelsForCapability(ALL_MODELS, { capability: 'embedding' }))).toEqual([
      'vendor/embed-large'
    ])
  })

  it('image generation matches only image-generation records', () => {
    expect(ids(filterOrcaModelsForCapability(ALL_MODELS, { capability: 'image' }))).toEqual([
      'vendor/img-gen',
      'vendor/gemini-image-chat'
    ])
  })

  it('video and rerank match only their own endpoint types', () => {
    expect(ids(filterOrcaModelsForCapability(ALL_MODELS, { capability: 'video' }))).toEqual([
      'vendor/video-1'
    ])
    expect(ids(filterOrcaModelsForCapability(ALL_MODELS, { capability: 'rerank' }))).toEqual([
      'vendor/rerank-1'
    ])
  })
})

describe('verified cold-start seed', () => {
  it('contains exactly the verified models with their namespace intact', () => {
    expect(ORCAROUTER_VERIFIED_SEED.map((seed) => seed.id)).toEqual([
      'openai/gpt-5.5',
      'anthropic/claude-opus-4.8',
      'google/gemini-3.5-flash',
      'deepseek/deepseek-v4-pro',
      'orcarouter/auto'
    ])
  })

  it('retains the verified GPT-5.5 reasoning effort ladder', () => {
    const efforts = getOrcaReasoningEfforts('openai/gpt-5.5')

    expect(efforts).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(findOrcaSeedModel('openai/gpt-5.5')?.supportsReasoning).toBe(true)
    expect(findOrcaSeedModel('openai/gpt-5.5')?.maxContextLength).toBe(400000)
  })

  it('does not fabricate a reasoning ladder for models without one', () => {
    expect(getOrcaReasoningEfforts('orcarouter/auto')).toBeUndefined()
    expect(findOrcaSeedModel('orcarouter/auto')?.supportsReasoning).toBe(false)
    expect(getOrcaReasoningEfforts('not-a-real-model')).toBeUndefined()
  })

  it('preserves context and modality metadata when mapped to TextModel', () => {
    const seed = getOrcaSeedCatalogModels()
    const pro = toOrcaTextModel(
      seed.find((model) => model.id === 'deepseek/deepseek-v4-pro')!,
      'orcarouter'
    )
    const opus = toOrcaTextModel(
      seed.find((model) => model.id === 'anthropic/claude-opus-4.8')!,
      'orcarouter'
    )

    expect(pro.capabilities.maxContextLength).toBe(1048576)
    expect(pro.capabilities.supportsReasoning).toBe(true)
    expect(opus.capabilities.maxContextLength).toBe(200000)
    // The seed's declared modality survives onto the TextModel catalog record.
    expect(seed.find((model) => model.id === 'openai/gpt-5.5')!.inputModalities).toContain('image')
  })

  it('offers the seed for chat when discovery is unavailable', () => {
    const chat = filterOrcaModelsForCapability(getOrcaSeedCatalogModels(), { capability: 'chat' })

    expect(ids(chat)).toEqual([
      'openai/gpt-5.5',
      'anthropic/claude-opus-4.8',
      'google/gemini-3.5-flash',
      'deepseek/deepseek-v4-pro',
      'orcarouter/auto'
    ])
  })

  it('narrows the seed to image-capable models for multimodal entry points', () => {
    const multimodal = filterOrcaModelsForCapability(getOrcaSeedCatalogModels(), {
      capability: 'image-understanding',
      requiredInputModalities: ['image']
    })

    expect(ids(multimodal)).not.toContain('orcarouter/auto')
    expect(ids(multimodal)).not.toContain('deepseek/deepseek-v4-pro')
    expect(ids(multimodal)).toContain('openai/gpt-5.5')
  })
})

describe('live catalog fetch', () => {
  it('queries the official chat catalog URL with a Bearer key', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return jsonResponse({ data: [FIXTURES.textOnly] })
    }) as unknown as typeof fetch

    const snapshot = await fetchOrcaCatalog({
      getEnv: () => '',
      apiKey: 'sk-orca-fake',
      fetchImpl
    })

    expect(calls[0].url).toBe('https://api.orcarouter.ai/v1/models?capability=chat')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-orca-fake'
    )
    expect(snapshot.source).toBe('live')
    expect(snapshot.degraded).toBe(false)
    expect(snapshot.catalogUrl).toBe('https://api.orcarouter.ai/v1/models?capability=chat')
  })

  it('treats a live result as authoritative without mixing in the seed', async () => {
    // The live catalog advertises exactly one model that is NOT in the seed.
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [FIXTURES.imageInputChat] })
    ) as unknown as typeof fetch

    const snapshot = await fetchOrcaCatalog({ getEnv: () => '', fetchImpl })

    expect(snapshot.source).toBe('live')
    expect(ids(snapshot.models)).toEqual(['deepseek/deepseek-v4-flash-vision-exp'])
    // No seed-only model was appended to a successful live result.
    const seedOnly = ORCAROUTER_VERIFIED_SEED.map((seed) => seed.id).filter(
      (id) => id !== FIXTURES.imageInputChat.id
    )
    for (const id of seedOnly) {
      expect(ids(snapshot.models)).not.toContain(id)
    }
  })

  it('falls back to the verified seed and reports degraded on a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('offline')
    }) as unknown as typeof fetch

    const snapshot = await fetchOrcaCatalog({ getEnv: () => '', fetchImpl })

    expect(snapshot.source).toBe('seed')
    expect(snapshot.degraded).toBe(true)
    expect(snapshot.degradedReason).toMatch(/could not be reached/i)
    expect(ids(snapshot.models)).toEqual(ORCAROUTER_VERIFIED_SEED.map((seed) => seed.id))
  })

  it('falls back to the seed on an HTTP error status', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503)) as unknown as typeof fetch

    const snapshot = await fetchOrcaCatalog({ getEnv: () => '', fetchImpl })

    expect(snapshot.source).toBe('seed')
    expect(snapshot.degradedReason).toMatch(/HTTP 503/)
  })

  it('falls back to the seed when the catalog returns no usable records', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ name: 'no id' }] })
    ) as unknown as typeof fetch

    const snapshot = await fetchOrcaCatalog({ getEnv: () => '', fetchImpl })

    expect(snapshot.source).toBe('seed')
    expect(snapshot.degradedReason).toMatch(/no usable records/i)
  })

  it('never returns free text or an empty list when discovery fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('boom')
    }) as unknown as typeof fetch

    const { snapshot, models } = await resolveOrcaModelOptions({
      getEnv: () => '',
      fetchImpl,
      requirements: { capability: 'chat' }
    })

    expect(snapshot.degraded).toBe(true)
    expect(models.length).toBeGreaterThan(0)
  })

  it('returns an honest empty list when the live catalog has no such capability', async () => {
    // Mirrors the real workspace: 16 chat models, zero embedding models.
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [FIXTURES.textOnly] })
    ) as unknown as typeof fetch

    const { snapshot, models } = await resolveOrcaModelOptions({
      getEnv: () => '',
      fetchImpl,
      requirements: { capability: 'embedding' }
    })

    expect(snapshot.source).toBe('live')
    expect(models).toEqual([])
  })

  it('times out rather than hanging on a stalled catalog', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as unknown as typeof fetch

    const snapshot = await fetchOrcaCatalog({ getEnv: () => '', fetchImpl, timeoutMs: 30 })

    expect(snapshot.source).toBe('seed')
    expect(snapshot.degradedReason).toMatch(/timed out/i)
  })

  it('honours an explicit API override for discovery', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url))
      return jsonResponse({ data: [FIXTURES.textOnly] })
    }) as unknown as typeof fetch

    await fetchOrcaCatalog({
      getEnv: () => '',
      apiBaseUrl: 'https://relay.self-hosted.example/v1',
      fetchImpl
    })

    expect(calls[0]).toBe('https://relay.self-hosted.example/v1/models?capability=chat')
  })

  it('keeps the key out of the catalog URL and out of the degraded reason', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    const snapshot = await fetchOrcaCatalog({
      getEnv: () => '',
      apiKey: 'sk-orca-super-secret',
      fetchImpl
    })

    expect(snapshot.catalogUrl).not.toContain('sk-orca-')
    expect(snapshot.degradedReason ?? '').not.toContain('sk-orca-')
  })
})
