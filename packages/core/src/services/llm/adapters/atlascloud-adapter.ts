import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const ATLASCLOUD_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'qwen/qwen3.5-flash',
    name: 'Qwen3.5 Flash',
    description: 'Qwen3.5 Flash via Atlas Cloud OpenAI-compatible LLM API',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 131072
    }
  },
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: 'DeepSeek V4 Pro via Atlas Cloud OpenAI-compatible LLM API',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    },
    defaultParameterValues: {
      max_tokens: 1024
    }
  },
  {
    id: 'deepseek-ai/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    description: 'DeepSeek V4 Flash via Atlas Cloud OpenAI-compatible LLM API',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    },
    defaultParameterValues: {
      max_tokens: 1024
    }
  }
]

export class AtlasCloudAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'atlascloud',
      name: 'Atlas Cloud',
      description: 'Atlas Cloud OpenAI-compatible LLM models',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.atlascloud.ai/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://www.atlascloud.ai/console/api-keys',
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
    return ATLASCLOUD_STATIC_MODELS.map((definition) => {
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
