import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const OPENROUTER_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B IT (Free)',
    description: 'Google Gemma 3 27B 免费模型，通过 OpenRouter 访问',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 96000
    }
  }
]

export class OpenRouterAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'openrouter',
      name: 'OpenRouter',
      description: 'OpenRouter 聚合多种 AI 模型的 OpenAI 兼容 API',
      requiresApiKey: true,
      defaultBaseURL: 'https://openrouter.ai/api/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://openrouter.ai/settings/keys',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string'
        }
      }
    }
  }

  public getModels(): TextModel[] {
    return OPENROUTER_STATIC_MODELS.map((definition) => {
      const baseModel = this.buildDefaultModel(definition.id)

      return {
        ...baseModel,
        name: definition.name,
        description: definition.description,
        capabilities: {
          ...baseModel.capabilities,
          ...(definition.capabilities ?? {})
        },
        defaultParameterValues: definition.defaultParameterValues
          ? {
              ...(baseModel.defaultParameterValues ?? {}),
              ...definition.defaultParameterValues
            }
          : baseModel.defaultParameterValues
      }
    })
  }
}
