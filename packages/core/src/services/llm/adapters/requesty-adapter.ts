import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const REQUESTY_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o mini',
    description: 'OpenAI GPT-4o mini served through Requesty',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 128000
    }
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    description: 'Anthropic Claude Sonnet 4.5 served through Requesty',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 200000
    }
  }
]

export class RequestyAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'requesty',
      name: 'Requesty',
      description: 'OpenAI-compatible gateway for accessing models from many providers',
      requiresApiKey: true,
      defaultBaseURL: 'https://router.requesty.ai/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://app.requesty.ai/api-keys',
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
    return REQUESTY_STATIC_MODELS.map((definition) => {
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
