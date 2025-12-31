import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const ZHIPU_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    description: 'GLM-4.7 是最新的旗舰模型系列，专为智能体应用打造的基础模型',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 128000
    }
  },
  {
    id: 'glm-4.6',
    name: 'GLM-4.6',
    description: 'GLM-4.6 是最新的旗舰模型系列，专为智能体应用打造的基础模型',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 128000
    }
  }
]

export class ZhipuAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'zhipu',
      name: 'Zhipu AI',
      description: 'Zhipu GLM OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
      supportsDynamicModels: true,
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
    return ZHIPU_STATIC_MODELS.map((definition) => {
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
