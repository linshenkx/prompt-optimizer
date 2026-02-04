import OpenAI from 'openai'
import type { TextModel, TextModelConfig, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1'

// Ollama does not require auth, but the OpenAI SDK expects an apiKey string.
const OLLAMA_FALLBACK_API_KEY = 'ollama'

export class OllamaAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'ollama',
      name: 'Ollama',
      description: 'Local Ollama (OpenAI-compatible API)',
      // Ollama can be configured with CORS/reverse-proxy; don't hard-mark it as browser-blocked.
      corsRestricted: false,
      requiresApiKey: false,
      defaultBaseURL: OLLAMA_DEFAULT_BASE_URL,
      supportsDynamicModels: true,
      connectionSchema: {
        required: [],
        optional: ['baseURL', 'apiKey'],
        fieldTypes: {
          baseURL: 'string',
          apiKey: 'string'
        }
      }
    }
  }

  public getModels(): TextModel[] {
    // No presets: Ollama models depend on what's installed locally.
    return []
  }

  protected createOpenAIInstance(config: TextModelConfig, isStream: boolean = false): OpenAI {
    const rawApiKey = typeof config.connectionConfig.apiKey === 'string' ? config.connectionConfig.apiKey : ''
    const apiKey = rawApiKey.trim() ? rawApiKey : OLLAMA_FALLBACK_API_KEY

    const rawBaseURL = typeof config.connectionConfig.baseURL === 'string' ? config.connectionConfig.baseURL : ''
    const baseURL = this.normalizeBaseURL(rawBaseURL)

    const normalizedConfig: TextModelConfig = {
      ...config,
      connectionConfig: {
        ...config.connectionConfig,
        apiKey,
        baseURL
      }
    }

    return super.createOpenAIInstance(normalizedConfig, isStream)
  }

  private normalizeBaseURL(baseURL: string): string {
    const fallback = this.getProvider().defaultBaseURL
    const raw = baseURL.trim() ? baseURL.trim() : fallback
    let normalized = raw.replace(/\/$/, '')

    // Users may paste the full endpoint; keep compatibility with OpenAIAdapter behavior.
    if (normalized.endsWith('/chat/completions')) {
      normalized = normalized.slice(0, -'/chat/completions'.length).replace(/\/$/, '')
    }

    return /\/v1$/.test(normalized) ? normalized : `${normalized}/v1`
  }
}
