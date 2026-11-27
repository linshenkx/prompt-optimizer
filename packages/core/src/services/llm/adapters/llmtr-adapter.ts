import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const LLMTR_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'qwen/qwen3.8-27b-free',
    name: 'Qwen3.8 27B (free daily quota)',
    description: 'Example LLMTR model ID in vendor/model form. Other models appear after the API key is saved.'
  }
]

export class LlmtrAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'llmtr',
      name: 'LLMTR',
      description: 'Prepaid OpenAI-compatible gateway for many hosted models, including daily-quota free models',
      requiresApiKey: true,
      defaultBaseURL: 'https://llmtr.com/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://llmtr.com/dashboard/keys',
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
    return LLMTR_STATIC_MODELS.map((definition) => {
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
