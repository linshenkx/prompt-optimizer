import OpenAI from 'openai'
import type { TextModel, TextModelConfig, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

const RAPID_MLX_DEFAULT_BASE_URL = 'http://localhost:8000/v1'

// Rapid-MLX only requires auth with --api-key; the OpenAI SDK expects a key string.
const RAPID_MLX_FALLBACK_API_KEY = 'rapid-mlx'

interface RapidMLXModelCard extends OpenAI.Models.Model {
  capabilities?: string[]
  context_window?: number | null
  max_model_len?: number | null
}

export class RapidMLXAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'rapid-mlx',
      name: 'Rapid-MLX',
      description: 'Local Rapid-MLX server on Apple Silicon (OpenAI-compatible API)',
      // Browser access can be enabled with --cors-origins.
      corsRestricted: false,
      requiresApiKey: false,
      defaultBaseURL: RAPID_MLX_DEFAULT_BASE_URL,
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
    // No presets: models depend on the local server.
    return []
  }

  protected buildDynamicModels(models: OpenAI.Models.Model[]): TextModel[] {
    const cards = models as RapidMLXModelCard[]
    return cards
      .filter(card => card.capabilities === undefined || card.capabilities.includes('text'))
      .map(card => {
        const model = this.buildDefaultModel(card.id)
        const contextLength = card.max_model_len ?? card.context_window
        return {
          ...model,
          capabilities: {
            ...model.capabilities,
            ...(card.capabilities ? { supportsTools: card.capabilities.includes('tools') } : {}),
            ...(typeof contextLength === 'number' && contextLength > 0
              ? { maxContextLength: contextLength } : {})
          }
        }
      })
  }

  protected createOpenAIInstance(config: TextModelConfig, isStream: boolean = false): OpenAI {
    const rawApiKey = typeof config.connectionConfig.apiKey === 'string' ? config.connectionConfig.apiKey : ''
    const apiKey = rawApiKey.trim() ? rawApiKey : RAPID_MLX_FALLBACK_API_KEY

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
