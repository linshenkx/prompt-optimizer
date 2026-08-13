import { getBuiltinModelIds, getDefaultTextModels } from '../../../src/services/model/defaults'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

describe('model defaults provider env mapping', () => {
  const originalAnthropicApiKey = process.env.VITE_ANTHROPIC_API_KEY
  const originalCloudflareApiKey = process.env.VITE_CF_API_TOKEN
  const originalCloudflareAccountId = process.env.VITE_CF_ACCOUNT_ID
  const originalLegacyCloudflareApiKey = process.env.CF_API_TOKEN
  const originalLegacyCloudflareAccountId = process.env.CF_ACCOUNT_ID
  const originalCustomApiKey = process.env.VITE_CUSTOM_API_KEY
  const originalCustomApiBaseUrl = process.env.VITE_CUSTOM_API_BASE_URL
  const originalCustomApiModel = process.env.VITE_CUSTOM_API_MODEL
  const originalCustomApiHeaders = process.env.VITE_CUSTOM_API_HEADERS
  const originalGrokApiKey = process.env.VITE_GROK_API_KEY
  const originalXaiApiKey = process.env.VITE_XAI_API_KEY
  const originalMimoTokenPlanApiKey = process.env.VITE_MIMO_TOKEN_PLAN_API_KEY
  const originalMimoTokenPlanApiBaseUrl = process.env.VITE_MIMO_TOKEN_PLAN_API_BASE_URL

  beforeEach(() => {
    delete process.env.VITE_ANTHROPIC_API_KEY
    delete process.env.VITE_CF_API_TOKEN
    delete process.env.VITE_CF_ACCOUNT_ID
    delete process.env.CF_API_TOKEN
    delete process.env.CF_ACCOUNT_ID
    delete process.env.VITE_CUSTOM_API_KEY
    delete process.env.VITE_CUSTOM_API_BASE_URL
    delete process.env.VITE_CUSTOM_API_MODEL
    delete process.env.VITE_CUSTOM_API_HEADERS
    delete process.env.VITE_GROK_API_KEY
    delete process.env.VITE_XAI_API_KEY
    delete process.env.VITE_MIMO_TOKEN_PLAN_API_KEY
    delete process.env.VITE_MIMO_TOKEN_PLAN_API_BASE_URL
  })

  afterAll(() => {
    if (originalAnthropicApiKey === undefined) {
      delete process.env.VITE_ANTHROPIC_API_KEY
    } else {
      process.env.VITE_ANTHROPIC_API_KEY = originalAnthropicApiKey
    }

    if (originalCloudflareApiKey === undefined) {
      delete process.env.VITE_CF_API_TOKEN
    } else {
      process.env.VITE_CF_API_TOKEN = originalCloudflareApiKey
    }

    if (originalCloudflareAccountId === undefined) {
      delete process.env.VITE_CF_ACCOUNT_ID
    } else {
      process.env.VITE_CF_ACCOUNT_ID = originalCloudflareAccountId
    }

    if (originalLegacyCloudflareApiKey === undefined) {
      delete process.env.CF_API_TOKEN
    } else {
      process.env.CF_API_TOKEN = originalLegacyCloudflareApiKey
    }

    if (originalLegacyCloudflareAccountId === undefined) {
      delete process.env.CF_ACCOUNT_ID
    } else {
      process.env.CF_ACCOUNT_ID = originalLegacyCloudflareAccountId
    }

    if (originalCustomApiKey === undefined) {
      delete process.env.VITE_CUSTOM_API_KEY
    } else {
      process.env.VITE_CUSTOM_API_KEY = originalCustomApiKey
    }

    if (originalCustomApiBaseUrl === undefined) {
      delete process.env.VITE_CUSTOM_API_BASE_URL
    } else {
      process.env.VITE_CUSTOM_API_BASE_URL = originalCustomApiBaseUrl
    }

    if (originalCustomApiModel === undefined) {
      delete process.env.VITE_CUSTOM_API_MODEL
    } else {
      process.env.VITE_CUSTOM_API_MODEL = originalCustomApiModel
    }

    if (originalCustomApiHeaders === undefined) {
      delete process.env.VITE_CUSTOM_API_HEADERS
    } else {
      process.env.VITE_CUSTOM_API_HEADERS = originalCustomApiHeaders
    }

    if (originalGrokApiKey === undefined) {
      delete process.env.VITE_GROK_API_KEY
    } else {
      process.env.VITE_GROK_API_KEY = originalGrokApiKey
    }

    if (originalXaiApiKey === undefined) {
      delete process.env.VITE_XAI_API_KEY
    } else {
      process.env.VITE_XAI_API_KEY = originalXaiApiKey
    }

    if (originalMimoTokenPlanApiKey === undefined) {
      delete process.env.VITE_MIMO_TOKEN_PLAN_API_KEY
    } else {
      process.env.VITE_MIMO_TOKEN_PLAN_API_KEY = originalMimoTokenPlanApiKey
    }

    if (originalMimoTokenPlanApiBaseUrl === undefined) {
      delete process.env.VITE_MIMO_TOKEN_PLAN_API_BASE_URL
    } else {
      process.env.VITE_MIMO_TOKEN_PLAN_API_BASE_URL = originalMimoTokenPlanApiBaseUrl
    }
  })

  it('should include anthropic in builtin model ids', () => {
    const builtinModelIds = getBuiltinModelIds()
    expect(builtinModelIds).toContain('anthropic')
  })

  it('should include anthropic config and keep it disabled when api key is empty', () => {
    const models = getDefaultTextModels()

    expect(models.anthropic).toBeDefined()
    expect(models.anthropic.providerMeta.id).toBe('anthropic')
    expect(models.anthropic.enabled).toBe(false)
  })

  it('should enable anthropic when VITE_ANTHROPIC_API_KEY is provided', () => {
    process.env.VITE_ANTHROPIC_API_KEY = 'test-anthropic-key'

    const models = getDefaultTextModels()

    expect(models.anthropic.enabled).toBe(true)
    expect(models.anthropic.connectionConfig.apiKey).toBe('test-anthropic-key')
  })

  it('should include cloudflare in builtin model ids', () => {
    const builtinModelIds = getBuiltinModelIds()
    expect(builtinModelIds).toContain('cloudflare')
  })

  it('should include ollama but keep it disabled without explicit user configuration', () => {
    const builtinModelIds = getBuiltinModelIds()
    const models = getDefaultTextModels()

    expect(builtinModelIds).toContain('ollama')
    expect(models.ollama).toBeDefined()
    expect(models.ollama.providerMeta.id).toBe('ollama')
    expect(models.ollama.providerMeta.requiresApiKey).toBe(false)
    expect(models.ollama.connectionConfig.apiKey).toBe('')
    expect(models.ollama.connectionConfig.baseURL).toBe('http://localhost:11434/v1')
    expect(models.ollama.enabled).toBe(false)
  })

  it('should include Chrome built-in AI but keep it disabled until the user opts in', () => {
    const builtinModelIds = getBuiltinModelIds()
    const models = getDefaultTextModels()

    expect(builtinModelIds).toContain('chrome-built-in')
    expect(models['chrome-built-in']).toBeDefined()
    expect(models['chrome-built-in'].providerMeta.id).toBe('chrome-built-in')
    expect(models['chrome-built-in'].providerMeta.requiresApiKey).toBe(false)
    expect(models['chrome-built-in'].modelMeta.id).toBe('gemini-nano')
    expect(models['chrome-built-in'].enabled).toBe(false)
    expect(models['chrome-built-in'].activationState).toEqual({ userConfigured: false })
  })

  it('should include cloudflare config and keep it disabled when credentials are empty', () => {
    const models = getDefaultTextModels()

    expect(models.cloudflare).toBeDefined()
    expect(models.cloudflare.providerMeta.id).toBe('cloudflare')
    expect(models.cloudflare.enabled).toBe(false)
  })

  it('should enable cloudflare when VITE_CF_API_TOKEN and VITE_CF_ACCOUNT_ID are provided', () => {
    process.env.VITE_CF_API_TOKEN = 'test-cloudflare-token'
    process.env.VITE_CF_ACCOUNT_ID = 'test-cloudflare-account'

    const models = getDefaultTextModels()

    expect(models.cloudflare.enabled).toBe(true)
    expect(models.cloudflare.providerMeta.corsRestricted).toBe(true)
    expect(models.cloudflare.connectionConfig.apiKey).toBe('test-cloudflare-token')
    expect(models.cloudflare.connectionConfig.accountId).toBe('test-cloudflare-account')
    expect(models.cloudflare.modelMeta.id).toBe('@cf/qwen/qwen3-30b-a3b-fp8')
  })

  it('should keep cloudflare disabled when only legacy CF_* variables are provided', () => {
    process.env.CF_API_TOKEN = 'legacy-cloudflare-token'
    process.env.CF_ACCOUNT_ID = 'legacy-cloudflare-account'

    const models = getDefaultTextModels()

    expect(models.cloudflare.enabled).toBe(false)
    expect(models.cloudflare.connectionConfig.apiKey).toBe('')
    expect(models.cloudflare.connectionConfig.accountId).toBe('')
  })

  it('should expose the custom preset as OpenAI-compatible with chat completions but keep it disabled by default', () => {
    const models = getDefaultTextModels()

    expect(models.custom).toBeDefined()
    expect(models.custom.providerMeta.id).toBe('openai-compatible')
    expect(models.custom.providerMeta.name).toBe('OpenAI Compatible (Custom)')
    expect(models.custom.enabled).toBe(false)
    expect(models.custom.connectionConfig.apiKey).toBe('')
    expect(models.custom.connectionConfig.requestStyle).toBe('chat_completions')
  })

  it('should enable the custom preset when explicit custom connection config is provided', () => {
    process.env.VITE_CUSTOM_API_BASE_URL = 'http://localhost:11434/v1'

    const models = getDefaultTextModels()

    expect(models.custom.enabled).toBe(true)
    expect(models.custom.connectionConfig.baseURL).toBe('http://localhost:11434/v1')
  })

  it('should expose VITE_CUSTOM_API_HEADERS on the custom preset connection config', () => {
    process.env.VITE_CUSTOM_API_HEADERS = '{"x-auth-token":"gateway-token"}'

    const models = getDefaultTextModels()

    expect(models.custom.connectionConfig.customHeaders).toEqual({
      'x-auth-token': 'gateway-token'
    })
  })

  it('should use DeepSeek V4 Flash with thinking disabled by default', () => {
    const models = getDefaultTextModels()

    expect(models.deepseek).toBeDefined()
    expect(models.deepseek.providerMeta.id).toBe('deepseek')
    expect(models.deepseek.modelMeta.id).toBe('deepseek-v4-flash')
    expect(models.deepseek.modelMeta.parameterDefinitions.map((definition) => definition.name)).toContain('thinking_type')
    expect(models.deepseek.paramOverrides).toEqual({
      thinking_type: 'disabled'
    })
  })

  it('should include Grok 4.5 with high reasoning effort by default', () => {
    const models = getDefaultTextModels()

    expect(models.grok).toBeDefined()
    expect(models.grok.providerMeta.id).toBe('grok')
    expect(models.grok.modelMeta.id).toBe('grok-4.5')
    expect(models.grok.enabled).toBe(false)
    expect(models.grok.paramOverrides).toEqual({
      reasoning_effort: 'high'
    })
  })

  it('should enable Grok when VITE_XAI_API_KEY is provided', () => {
    process.env.VITE_XAI_API_KEY = 'test-xai-key'

    const models = getDefaultTextModels()

    expect(models.grok.enabled).toBe(true)
    expect(models.grok.connectionConfig.apiKey).toBe('test-xai-key')
  })

  it('should include Xiaomi MiMo Token Plan with MiMo 2.5 Pro and China endpoint by default', () => {
    const builtinModelIds = getBuiltinModelIds()
    const models = getDefaultTextModels()

    expect(builtinModelIds).toContain('xiaomi-mimo-token-plan')
    expect(models['xiaomi-mimo']).toBeUndefined()
    expect(models['xiaomi-mimo-token-plan']).toBeDefined()
    expect(models['xiaomi-mimo-token-plan'].providerMeta.id).toBe('xiaomi-mimo-token-plan')
    expect(models['xiaomi-mimo-token-plan'].modelMeta.id).toBe('mimo-v2.5-pro')
    expect(models['xiaomi-mimo-token-plan'].connectionConfig.baseURL).toBe('https://token-plan-cn.xiaomimimo.com/v1')
    expect(models['xiaomi-mimo-token-plan'].enabled).toBe(false)
  })

  it('should enable Xiaomi MiMo Token Plan from Token Plan env keys only', () => {
    process.env.VITE_MIMO_TOKEN_PLAN_API_KEY = 'tp-test-key'
    process.env.VITE_MIMO_TOKEN_PLAN_API_BASE_URL = 'https://token-plan-sgp.xiaomimimo.com/v1'

    const models = getDefaultTextModels()

    expect(models['xiaomi-mimo-token-plan'].enabled).toBe(true)
    expect(models['xiaomi-mimo-token-plan'].connectionConfig.apiKey).toBe('tp-test-key')
    expect(models['xiaomi-mimo-token-plan'].connectionConfig.baseURL).toBe('https://token-plan-sgp.xiaomimimo.com/v1')
  })
})
