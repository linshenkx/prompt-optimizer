import type { ParameterDefinition, TextModel, TextModelConfig, TextProvider } from '../types'
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
    id: 'openrouter/free',
    name: 'OpenRouter Free Models Router',
    description: 'OpenRouter router that selects a compatible free model for each request',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 200000
    }
  }
]

const MINIMAX_MODEL_IDS = ['minimax/minimax-m3.1-flash:free', 'minimax/minimax-m3']

export class OpenRouterAdapter extends OpenAIAdapter {
  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    const models = await super.getModelsAsync(config)
    return models
      .filter(model => !model.id.startsWith('minimax/') || MINIMAX_MODEL_IDS.includes(model.id))
      .sort((a, b) => a.id.startsWith('minimax/') && b.id.startsWith('minimax/')
        ? MINIMAX_MODEL_IDS.indexOf(a.id) - MINIMAX_MODEL_IDS.indexOf(b.id)
        : 0)
  }

  protected getParameterDefinitions(modelId: string): readonly ParameterDefinition[] {
    const definitions = super.getParameterDefinitions(modelId)
    if (!MINIMAX_MODEL_IDS.includes(modelId)) return definitions

    return definitions
      .filter(parameter => modelId !== 'minimax/minimax-m3' || parameter.name !== 'reasoning_effort')
      .map(parameter => parameter.name === 'reasoning_effort'
        ? {
            ...parameter,
            description: 'Thinking depth for MiniMax M3.1 Flash. Thinking is always enabled.',
            descriptionKey: undefined,
            defaultValue: 'max',
            default: 'max',
            allowedValues: ['low', 'medium', 'high', 'xhigh', 'max']
          }
        : ['max_tokens', 'max_completion_tokens'].includes(parameter.name)
          ? { ...parameter, maxValue: modelId === MINIMAX_MODEL_IDS[0] ? 524288 : 512000,
              max: modelId === MINIMAX_MODEL_IDS[0] ? 524288 : 512000 }
          : parameter)
  }

  public buildDefaultModel(modelId: string): TextModel {
    const model = super.buildDefaultModel(modelId)
    if (!MINIMAX_MODEL_IDS.includes(modelId)) return model
    // Use the gateway catalog's context limits, independently of the direct API.
    return {
      ...model,
      capabilities: { ...model.capabilities, maxContextLength: modelId === MINIMAX_MODEL_IDS[0] ? 1000000 : 1048576 }
    }
  }

  public getProvider(): TextProvider {
    return {
      id: 'openrouter',
      name: 'OpenRouter',
      description: 'OpenAI-compatible gateway for accessing models from many providers',
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
