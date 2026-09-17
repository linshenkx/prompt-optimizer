import { describe, expect, it, vi } from 'vitest'

import {
  OrcaRouterAdapter,
  OrcaRouterOAuthAdapter,
  ORCAROUTER_SEED_MODEL_IDS
} from '../../../src/services/llm/adapters/orcarouter-adapter'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import type { TextModelConfig } from '../../../src/services/llm/types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const LIVE_CATALOG = {
  data: [
    {
      id: 'deepseek/deepseek-v4-pro',
      name: 'DeepSeek: DeepSeek V4 Pro',
      supported_endpoint_types: ['openai', 'openai-response'],
      architecture: { input_modalities: ['text'] },
      context_length: 1048576
    },
    {
      id: 'deepseek/deepseek-v4-flash-vision-exp',
      name: 'DeepSeek: V4 Flash Vision',
      supported_endpoint_types: ['openai', 'anthropic'],
      architecture: { input_modalities: ['text', 'image'] },
      context_length: 1048576
    },
    {
      id: 'vendor/image-only',
      name: 'Image Only',
      supported_endpoint_types: ['image-generation'],
      architecture: { input_modalities: ['text'] }
    }
  ]
}

function configFor(providerId: string, apiKey = 'sk-orca-fake'): TextModelConfig {
  const registry = new TextAdapterRegistry()
  const adapter = registry.getAdapter(providerId)
  const provider = adapter.getProvider()
  const model = adapter.getModels()[0]

  return {
    id: providerId,
    name: provider.name,
    enabled: true,
    providerId,
    modelId: model.id,
    providerMeta: provider,
    modelMeta: model,
    connectionConfig: { apiKey, baseURL: provider.defaultBaseURL },
    paramOverrides: {}
  } as TextModelConfig
}

describe('OrcaRouter provider adapters', () => {
  it('registers both authentication entries as first-class providers', () => {
    const registry = new TextAdapterRegistry()
    const ids = registry.getAllProviders().map((provider) => provider.id)

    expect(ids).toContain('orcarouter')
    expect(ids).toContain('orcarouter-oauth')
  })

  it('gives the API-key entry the OrcaRouter name and key console link', () => {
    const provider = new OrcaRouterAdapter().getProvider()

    expect(provider.id).toBe('orcarouter')
    expect(provider.name).toBe('OrcaRouter - API')
    expect(provider.defaultBaseURL).toBe('https://api.orcarouter.ai/v1')
    expect(provider.supportsDynamicModels).toBe(true)
    expect(provider.requiresApiKey).toBe(true)
    expect(provider.apiKeyUrl).toBe('https://www.orcarouter.ai/console/token')
    expect(provider.connectionSchema?.required).toEqual(['apiKey'])
    expect(provider.connectionSchema?.optional).toEqual(['baseURL'])
  })

  it('gives the PKCE entry a distinct name pointing at authorized apps', () => {
    const provider = new OrcaRouterOAuthAdapter().getProvider()

    expect(provider.id).toBe('orcarouter-oauth')
    expect(provider.name).toBe('OrcaRouter - Auth')
    expect(provider.defaultBaseURL).toBe('https://api.orcarouter.ai/v1')
    expect(provider.apiKeyUrl).toBe('https://www.orcarouter.ai/console/authorized-apps')
    expect(provider.name).not.toBe(new OrcaRouterAdapter().getProvider().name)
  })

  it('routes both entries to the same inference origin and model namespace', () => {
    const apiKeyProvider = new OrcaRouterAdapter().getProvider()
    const pkceProvider = new OrcaRouterOAuthAdapter().getProvider()

    // The two entries differ only in how the credential is acquired.
    expect(apiKeyProvider.defaultBaseURL).toBe(pkceProvider.defaultBaseURL)
    expect(apiKeyProvider.defaultBaseURL).toBe('https://api.orcarouter.ai/v1')
  })

  it('offers the verified seed as static models for both entries', () => {
    const apiKeyModels = new OrcaRouterAdapter().getModels().map((model) => model.id)
    const pkceModels = new OrcaRouterOAuthAdapter().getModels().map((model) => model.id)

    expect(apiKeyModels).toEqual([...ORCAROUTER_SEED_MODEL_IDS])
    expect(pkceModels).toEqual([...ORCAROUTER_SEED_MODEL_IDS])
    expect(apiKeyModels).toContain('openai/gpt-5.5')
    expect(apiKeyModels).toContain('orcarouter/auto')
  })

  it('keeps the verified context window on the seed models', () => {
    const pro = new OrcaRouterAdapter()
      .getModels()
      .find((model) => model.id === 'deepseek/deepseek-v4-pro')

    expect(pro?.capabilities.maxContextLength).toBe(1048576)
    expect(pro?.capabilities.supportsReasoning).toBe(true)
  })
})

describe('OrcaRouter model discovery', () => {
  it('discovers chat models from the catalog and drops non-text records', async () => {
    const adapter = new OrcaRouterAdapter()
    const fetchImpl = vi.fn(async () => jsonResponse(LIVE_CATALOG))
    vi.stubGlobal('fetch', fetchImpl)

    try {
      const models = await adapter.getModelsAsync(configFor('orcarouter'), { capability: 'chat' })
      const ids = models.map((model) => model.id)

      expect(ids).toEqual([
        'deepseek/deepseek-v4-pro',
        'deepseek/deepseek-v4-flash-vision-exp'
      ])
      expect(ids).not.toContain('vendor/image-only')
      expect(ids).not.toContain('openai/gpt-5.5')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('narrows to image-capable models for the multimodal entry point', async () => {
    const adapter = new OrcaRouterAdapter()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(LIVE_CATALOG)))

    try {
      const models = await adapter.getModelsAsync(configFor('orcarouter'), {
        capability: 'image-understanding',
        requiredInputModalities: ['image']
      })

      expect(models.map((model) => model.id)).toEqual([
        'deepseek/deepseek-v4-flash-vision-exp'
      ])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('sends the catalog request to the api origin with the user key', async () => {
    const adapter = new OrcaRouterAdapter()
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return jsonResponse(LIVE_CATALOG)
      })
    )

    try {
      await adapter.getModelsAsync(configFor('orcarouter', 'sk-orca-real-key'), {
        capability: 'chat'
      })

      expect(calls[0].url).toBe('https://api.orcarouter.ai/v1/models?capability=chat')
      expect(calls[0].url).not.toContain('www.orcarouter.ai')
      expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
        'Bearer sk-orca-real-key'
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reports a degraded catalog instead of silently substituting the seed', async () => {
    const adapter = new OrcaRouterAdapter()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    try {
      // Discovery must fail loudly, so every caller shows the degraded notice
      // next to the fallback instead of presenting seed entries as live data.
      await expect(
        adapter.getModelsAsync(configFor('orcarouter', 'sk-orca-secret-value'), {
          capability: 'chat'
        })
      ).rejects.toThrow(/catalog is unavailable/i)

      // The verified seed stays available as the labelled offline list.
      expect(adapter.getModels().map((model) => model.id)).toEqual([...ORCAROUTER_SEED_MODEL_IDS])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('never puts the key in a degraded-catalog failure', async () => {
    const adapter = new OrcaRouterAdapter()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 401 }))
    )

    try {
      let message = ''
      try {
        await adapter.getModelsAsync(configFor('orcarouter', 'sk-orca-secret-value'), {
          capability: 'chat'
        })
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }

      expect(message).toMatch(/catalog is unavailable/i)
      expect(message).toContain('HTTP 401')
      expect(message).not.toContain('sk-orca-secret-value')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns a real empty list when the live catalog serves no such capability', async () => {
    const adapter = new OrcaRouterAdapter()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(LIVE_CATALOG)))

    try {
      // The live payload declares no embedding/rerank records. That is an
      // honest empty result, not a reason to fall back to the seed.
      const embeddings = await adapter.getModelsAsync(configFor('orcarouter'), {
        capability: 'embedding'
      })
      const rerank = await adapter.getModelsAsync(configFor('orcarouter'), {
        capability: 'rerank'
      })

      expect(embeddings).toEqual([])
      expect(rerank).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses the configured base URL for a self-hosted deployment', async () => {
    const adapter = new OrcaRouterAdapter()
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        calls.push(String(url))
        return jsonResponse(LIVE_CATALOG)
      })
    )

    try {
      const config = configFor('orcarouter')
      config.connectionConfig.baseURL = 'https://relay.internal.example/v1'

      await adapter.getModelsAsync(config, { capability: 'chat' })

      expect(calls[0]).toBe('https://relay.internal.example/v1/models?capability=chat')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('exposes discovery through the registry for both entries', async () => {
    const registry = new TextAdapterRegistry()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(LIVE_CATALOG)))

    try {
      const models = await registry.getDynamicModels('orcarouter-oauth', configFor('orcarouter-oauth'), {
        capability: 'chat'
      })

      expect(models.length).toBe(2)
      expect(registry.supportsDynamicModels('orcarouter')).toBe(true)
      expect(registry.supportsDynamicModels('orcarouter-oauth')).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not depend on which adapter produced the credential', async () => {
    const registry = new TextAdapterRegistry()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(LIVE_CATALOG)))

    try {
      const viaApiKey = await registry.getDynamicModels('orcarouter', configFor('orcarouter'), {
        capability: 'chat'
      })
      const viaPkce = await registry.getDynamicModels(
        'orcarouter-oauth',
        configFor('orcarouter-oauth'),
        { capability: 'chat' }
      )

      expect(viaApiKey.map((model) => model.id)).toEqual(viaPkce.map((model) => model.id))
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('a successful live catalog stays authoritative', () => {
  /**
   * The registry's generic behaviour is to append static models that dynamic
   * discovery did not return. For OrcaRouter the static list is an outage
   * fallback, so merging it in would advertise models the live catalog never
   * offered. Both the model list and the merged option list must stay equal to
   * the live result.
   */
  it('keeps the seed out of a successful discovery result', async () => {
    const registry = new TextAdapterRegistry()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(LIVE_CATALOG)))

    try {
      const config = configFor('orcarouter')
      const models = await registry.getModels('orcarouter', config, { capability: 'chat' })
      const ids = models.map((model) => model.id)

      expect(ids).toEqual([
        'deepseek/deepseek-v4-pro',
        'deepseek/deepseek-v4-flash-vision-exp'
      ])
      // Every seeded id that the live payload did not advertise is absent.
      // `deepseek/deepseek-v4-pro` is deliberately in both lists and stays,
      // because it genuinely arrived from the live catalog.
      const seededButNotLive = ORCAROUTER_SEED_MODEL_IDS.filter(
        (seedId) => !LIVE_CATALOG.data.some((entry) => entry.id === seedId)
      )
      expect(seededButNotLive.length).toBeGreaterThan(0)
      for (const seedId of seededButNotLive) {
        expect(ids).not.toContain(seedId)
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('falls back to the verified seed when discovery fails, and says so', async () => {
    const registry = new TextAdapterRegistry()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    try {
      // `getDynamicModels` is the path the UI's refresh action uses, and it
      // rejects so the caller can display the failure. Only the convenience
      // `getModels` collapses that into the static list.
      await expect(
        registry.getDynamicModels('orcarouter', configFor('orcarouter'), { capability: 'chat' })
      ).rejects.toThrow(/catalog is unavailable/i)

      // The verified seed is what the degraded path offers, bounded and
      // explicitly labelled by the caller.
      const fallback = await registry.getModels('orcarouter', configFor('orcarouter'), {
        capability: 'chat'
      })
      expect(fallback.map((model) => model.id)).toEqual([...ORCAROUTER_SEED_MODEL_IDS])
      expect(registry.getStaticModels('orcarouter').map((model) => model.id)).toEqual([
        ...ORCAROUTER_SEED_MODEL_IDS
      ])
      expect(registry.supportsDynamicModels('orcarouter')).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('leaves every other provider on the existing merge behaviour', () => {
    const registry = new TextAdapterRegistry()

    expect(registry.dynamicModelsOverrideStatic('orcarouter')).toBe(true)
    expect(registry.dynamicModelsOverrideStatic('orcarouter-oauth')).toBe(true)
    // Unchanged for everyone else, including providers with a curated static list.
    expect(registry.dynamicModelsOverrideStatic('openai')).toBe(false)
    expect(registry.dynamicModelsOverrideStatic('openrouter')).toBe(false)
    expect(registry.dynamicModelsOverrideStatic('not-a-provider')).toBe(false)
  })
})
