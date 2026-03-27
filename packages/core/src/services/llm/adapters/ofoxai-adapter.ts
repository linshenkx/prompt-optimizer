import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const OFOXAI_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'OpenAI GPT-4o Mini，通过 OfoxAI 访问',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 128000
    }
  }
]

export class OfoxAIAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'ofoxai',
      name: 'OfoxAI',
      description: 'OfoxAI 统一 API 网关，支持 100+ LLM 模型，OpenAI 兼容格式',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.ofox.ai/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://ofox.ai',
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
    return OFOXAI_STATIC_MODELS.map((definition) => {
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
