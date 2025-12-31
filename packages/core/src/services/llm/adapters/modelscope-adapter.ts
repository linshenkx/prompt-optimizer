import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

/**
 * ModelScope (魔搭) 静态模型定义
 * 参考: https://modelscope.cn/docs/model-service/API-Inference/intro
 */
const MODELSCOPE_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    name: 'Qwen3-Coder-480B-A35B-Instruct',
    description: '通义千问 Qwen/Qwen3-Coder-480B-A35B-Instruct，专为代码生成和理解优化',
    capabilities: {
      supportsTools: false, // 未验证 ModelScope 的工具调用兼容性
      supportsReasoning: false,
      maxContextLength: 131072
    }
  }
]

/**
 * ModelScope (魔搭) 适配器
 * 基于 OpenAI 兼容 API 实现
 *
 * API 端点: https://api-inference.modelscope.cn/v1
 * 免费额度: 每天 2000 次调用
 * 文档: https://modelscope.cn/docs/model-service/API-Inference/intro
 *
 * 环境变量支持:
 * - MODELSCOPE_API_KEY: SDK Token (Docker 环境，无 VITE_ 前缀)
 * - VITE_MODELSCOPE_API_KEY: SDK Token (开发环境，Vite 构建)
 */
export class ModelScopeAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'modelscope',
      name: 'ModelScope',
      description: '阿里云魔搭社区 API 推理服务，每天免费 2000 次调用',
      requiresApiKey: true,
      defaultBaseURL: 'https://api-inference.modelscope.cn/v1',
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
    return MODELSCOPE_STATIC_MODELS.map((definition) => {
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
