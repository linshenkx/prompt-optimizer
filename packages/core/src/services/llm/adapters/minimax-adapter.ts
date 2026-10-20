import type { ParameterDefinition, TextModel, TextModelConfig, TextProvider } from '../types'
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
    id: 'MiniMax-M3.1-Flash',
    name: 'MiniMax M3.1 Flash',
    description: 'Fast reasoning and coding model with adjustable thinking depth',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    }
  },
  {
    id: 'MiniMax-M3',
    name: 'MiniMax M3',
    description: 'Flagship model with enhanced reasoning and coding',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
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

  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    await super.getModelsAsync(config)
    // Keep the curated fallback order even when discovery omits a current model.
    // Explicit saved/custom IDs still use buildDefaultModel.
    return this.getModels()
  }

  protected getParameterDefinitions(modelId: string): readonly ParameterDefinition[] {
    const definitions = super.getParameterDefinitions(modelId)
    if (modelId !== 'MiniMax-M3.1-Flash' && modelId !== 'MiniMax-M3') return definitions

    return definitions
      .filter(parameter => modelId !== 'MiniMax-M3' || parameter.name !== 'reasoning_effort')
      .map(parameter => {
        if (parameter.name === 'reasoning_effort') {
          return {
            ...parameter,
            description: 'Thinking depth for MiniMax M3.1 Flash. Thinking is always enabled.',
            descriptionKey: undefined,
            defaultValue: 'max',
            default: 'max',
            allowedValues: ['low', 'medium', 'high', 'xhigh', 'max']
          }
        }
        if (modelId === 'MiniMax-M3.1-Flash' &&
            ['max_tokens', 'max_completion_tokens'].includes(parameter.name)) {
          return { ...parameter, maxValue: 524288, max: 524288 }
        }
        return parameter
      })
  }

  protected getDefaultParameterValues(modelId: string): Record<string, unknown> {
    return modelId === 'MiniMax-M3.1-Flash' ? { reasoning_effort: 'max' } : super.getDefaultParameterValues(modelId)
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
