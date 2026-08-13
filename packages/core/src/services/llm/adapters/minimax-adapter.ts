import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const MINIMAX_REGIONAL_ENDPOINTS = [
  {
    region: 'global_en',
    openaiBaseURL: 'https://api.minimax.io/v1',
    anthropicBaseURL: 'https://api.minimax.io/anthropic',
    docsRoot: 'https://platform.minimax.io/docs'
  },
  {
    region: 'cn_zh',
    openaiBaseURL: 'https://api.minimaxi.com/v1',
    anthropicBaseURL: 'https://api.minimaxi.com/anthropic',
    docsRoot: 'https://platform.minimaxi.com/docs'
  }
] as const

const MINIMAX_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'MiniMax-M3',
    name: 'MiniMax M3',
    description: 'Latest flagship model with enhanced reasoning and coding',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    }
  },
  {
    id: 'MiniMax-M2.7',
    name: 'MiniMax M2.7',
    description: 'Previous flagship model retained for compatibility',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 204800
    }
  },
  {
    id: 'MiniMax-M2.7-highspeed',
    name: 'MiniMax M2.7 HighSpeed',
    description: 'High-speed version of M2.7 for low-latency scenarios',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 204800
    }
  }
]

export class MinimaxAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'minimax',
      name: 'MiniMax',
      description: 'MiniMax AI models via OpenAI-compatible API. The default endpoint is global; Mainland China users should use https://api.minimaxi.com/v1.',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.minimax.io/v1',
      regionalEndpoints: MINIMAX_REGIONAL_ENDPOINTS,
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
