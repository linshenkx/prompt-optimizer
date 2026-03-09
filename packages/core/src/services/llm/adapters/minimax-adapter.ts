import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const MINIMAX_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'MiniMax-M2.5',
    name: 'MiniMax M2.5',
    description: 'MiniMax latest flagship model with advanced capabilities',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1000000
    }
  },
  {
    id: 'MiniMax-M2.5-highspeed',
    name: 'MiniMax M2.5 HighSpeed',
    description: 'MiniMax high-speed model optimized for fast inference',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1000000
    }
  }
]

export class MinimaxAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'minimax',
      name: 'MiniMax',
      description: 'MiniMax AI models via OpenAI-compatible API',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.minimax.io/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
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
    return MINIMAX_STATIC_MODELS.map((definition) => {
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
