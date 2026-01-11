import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const DEEPSEEK_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'DeepSeek chat model via OpenAI-compatible API',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 128000
    }
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    description: 'DeepSeek reasoning model with step-by-step thinking outputs',
    capabilities: {
      supportsReasoning: true,
      maxContextLength: 128000
    }
  }
]

export class DeepseekAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'DeepSeek OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.deepseek.com/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://platform.deepseek.com/api_keys',
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
    return DEEPSEEK_STATIC_MODELS.map((definition) => {
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
