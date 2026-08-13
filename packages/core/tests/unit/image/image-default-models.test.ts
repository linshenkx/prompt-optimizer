import { describe, it, expect, beforeEach } from 'vitest'
import { getDefaultImageModels } from '../../../src/services/image-model/defaults'
import { ImageAdapterRegistry } from '../../../src/services/image/adapters/registry'
import { OpenRouterImageAdapter } from '../../../src/services/image/adapters/openrouter'

describe('default image models', () => {
  const env = process.env
  let registry: ImageAdapterRegistry

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.VITE_OPENAI_API_KEY
    delete process.env.VITE_OPENAI_BASE_URL
    delete process.env.VITE_GROK_API_KEY
    delete process.env.VITE_XAI_API_KEY
    delete process.env.VITE_CF_API_TOKEN
    delete process.env.VITE_CF_ACCOUNT_ID
    delete process.env.CF_API_TOKEN
    delete process.env.CF_ACCOUNT_ID
    registry = new ImageAdapterRegistry()
  })

  it('uses VITE_GEMINI_API_KEY for image-gemini models', () => {
    process.env.VITE_GEMINI_API_KEY = 'gemi'
    const models = getDefaultImageModels(registry)
    expect(models['image-gemini-nanobanana'].connectionConfig?.apiKey).toBe('gemi')
    expect(models['image-gemini-nanobanana'].enabled).toBe(true)
  })

  it('prefers VITE_SEEDREAM_API_KEY for seedream', () => {
    process.env.VITE_SEEDREAM_API_KEY = 'seed'
    const models = getDefaultImageModels(registry)
    expect(models['image-seedream'].connectionConfig?.apiKey).toBe('seed')
    expect(models['image-seedream'].enabled).toBe(true)
  })

  it('keeps the builtin image-seedream config pinned to the 4.0 model for compatibility', () => {
    process.env.VITE_SEEDREAM_API_KEY = 'seed'
    const models = getDefaultImageModels(registry)

    expect(models['image-seedream'].modelId).toBe('doubao-seedream-4-0-250828')
    expect(models['image-seedream'].model.name).toBe('Doubao Seedream 4.0')
  })

  it('adds a builtin Seedream 5.0 lite config while keeping the 4.0 config intact', () => {
    process.env.VITE_SEEDREAM_API_KEY = 'seed'
    const models = getDefaultImageModels(registry)

    expect(models['image-seedream-50-lite']).toBeDefined()
    expect(models['image-seedream-50-lite'].providerId).toBe('seedream')
    expect(models['image-seedream-50-lite'].modelId).toBe('doubao-seedream-5-0-lite-260128')
    expect(models['image-seedream-50-lite'].enabled).toBe(true)
  })

  it('includes OpenRouter configuration when API key is present', () => {
    process.env.VITE_OPENROUTER_API_KEY = 'openrouter-key'
    const models = getDefaultImageModels(registry)
    const openrouterModelId = new OpenRouterImageAdapter().getModels()[0].id

    expect(models['image-openrouter-nanobanana']).toBeDefined()
    expect(models['image-openrouter-nanobanana'].providerId).toBe('openrouter')
    expect(models['image-openrouter-nanobanana'].modelId).toBe(openrouterModelId)
    expect(models['image-openrouter-nanobanana'].connectionConfig?.apiKey).toBe('openrouter-key')
    expect(models['image-openrouter-nanobanana'].enabled).toBe(true)
  })

  it('uses GPT Image 2 for the builtin OpenAI image configuration', () => {
    process.env.VITE_OPENAI_API_KEY = 'openai-key'
    const models = getDefaultImageModels(registry)
    const openaiConfig = models['image-openai-gpt']

    expect(openaiConfig).toBeDefined()
    expect(openaiConfig.providerId).toBe('openai')
    expect(openaiConfig.modelId).toBe('gpt-image-2')
    expect(openaiConfig.model.id).toBe('gpt-image-2')
    expect(openaiConfig.model.capabilities.multiImage).toBe(true)
    expect(openaiConfig.connectionConfig?.apiKey).toBe('openai-key')
    expect(openaiConfig.enabled).toBe(true)
  })

  it('disables OpenRouter configuration when API key is missing', () => {
    delete process.env.VITE_OPENROUTER_API_KEY
    const models = getDefaultImageModels(registry)

    expect(models['image-openrouter-nanobanana']).toBeDefined()
    expect(models['image-openrouter-nanobanana'].enabled).toBe(false)
  })

  it('includes Ollama but keeps it disabled without explicit user configuration', () => {
    const models = getDefaultImageModels(registry)
    const ollamaConfig = models['image-ollama']

    expect(ollamaConfig).toBeDefined()
    expect(ollamaConfig.providerId).toBe('ollama')
    expect(ollamaConfig.provider.requiresApiKey).toBe(false)
    expect(ollamaConfig.connectionConfig?.apiKey).toBe('')
    expect(ollamaConfig.connectionConfig?.baseURL).toBe('http://localhost:11434/v1')
    expect(ollamaConfig.enabled).toBe(false)
  })

  it('OpenRouter model has correct provider and model information', () => {
    process.env.VITE_OPENROUTER_API_KEY = 'test-key'
    const models = getDefaultImageModels(registry)
    const openrouterConfig = models['image-openrouter-nanobanana']
    const openrouterModelId = new OpenRouterImageAdapter().getModels()[0].id

    expect(openrouterConfig.provider.id).toBe('openrouter')
    expect(openrouterConfig.provider.name).toBe('OpenRouter')
    expect(openrouterConfig.model.id).toBe(openrouterModelId)
    expect(openrouterConfig.model.capabilities.text2image).toBe(true)
    expect(openrouterConfig.model.capabilities.image2image).toBe(true)
    expect(openrouterConfig.model.capabilities.multiImage).toBe(true)
  })

  it('includes Cloudflare configuration when API token and account id are present', () => {
    process.env.VITE_CF_API_TOKEN = 'cloudflare-token'
    process.env.VITE_CF_ACCOUNT_ID = 'cloudflare-account'

    const models = getDefaultImageModels(registry)
    const cloudflareConfig = models['image-cloudflare-flux-klein']

    expect(cloudflareConfig).toBeDefined()
    expect(cloudflareConfig.providerId).toBe('cloudflare')
    expect(cloudflareConfig.provider.corsRestricted).toBe(true)
    expect(cloudflareConfig.modelId).toBe('@cf/black-forest-labs/flux-2-klein-4b')
    expect(cloudflareConfig.connectionConfig?.apiKey).toBe('cloudflare-token')
    expect(cloudflareConfig.connectionConfig?.accountId).toBe('cloudflare-account')
    expect(cloudflareConfig.enabled).toBe(true)
  })

  it('disables Cloudflare configuration when account id is missing', () => {
    process.env.VITE_CF_API_TOKEN = 'cloudflare-token'
    delete process.env.VITE_CF_ACCOUNT_ID

    const models = getDefaultImageModels(registry)

    expect(models['image-cloudflare-flux-klein']).toBeDefined()
    expect(models['image-cloudflare-flux-klein'].enabled).toBe(false)
  })

  it('keeps Cloudflare disabled when only legacy CF_* variables are provided', () => {
    process.env.CF_API_TOKEN = 'legacy-cloudflare-token'
    process.env.CF_ACCOUNT_ID = 'legacy-cloudflare-account'

    const models = getDefaultImageModels(registry)

    expect(models['image-cloudflare-flux-klein']).toBeDefined()
    expect(models['image-cloudflare-flux-klein'].connectionConfig?.apiKey).toBe('')
    expect(models['image-cloudflare-flux-klein'].connectionConfig?.accountId).toBe('')
    expect(models['image-cloudflare-flux-klein'].enabled).toBe(false)
  })

  it('includes Grok Imagine configuration with the current image-quality model', () => {
    process.env.VITE_GROK_API_KEY = 'grok-image-key'

    const models = getDefaultImageModels(registry)
    const grokConfig = models['image-grok-imagine']

    expect(grokConfig).toBeDefined()
    expect(grokConfig.providerId).toBe('grok')
    expect(grokConfig.modelId).toBe('grok-imagine-image-quality')
    expect(grokConfig.model.capabilities.text2image).toBe(true)
    expect(grokConfig.model.capabilities.image2image).toBe(true)
    expect(grokConfig.model.capabilities.multiImage).toBe(true)
    expect(grokConfig.connectionConfig?.apiKey).toBe('grok-image-key')
    expect(grokConfig.enabled).toBe(true)
  })
})
