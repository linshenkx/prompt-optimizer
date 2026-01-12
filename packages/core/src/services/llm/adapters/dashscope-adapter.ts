import type { TextModel, TextProvider, ParameterDefinition } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

/**
 * 阿里百炼（DashScope）静态模型定义
 */
const DASHSCOPE_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'qwen3-32b',
    name: 'Qwen3-32B',
    description: '通义千问3代32B模型，性能强劲，推荐使用',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 131072
    }
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    description: '通义千问高性能模型，适合复杂任务，支持超长上下文',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 131072
    }
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    description: '通义千问快速模型，支持超长上下文（1M tokens）',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1000000
    }
  },
  {
    id: 'qwen-flash',
    name: 'Qwen Flash',
    description: '通义千问极速模型，响应快速，适合简单任务',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 131072
    }
  }
]

/**
 * 阿里百炼（DashScope）适配器
 * 基于 OpenAI 兼容 API 实现
 *
 * API 端点: https://dashscope.aliyuncs.com/compatible-mode/v1
 * 文档: https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
 */
export class DashScopeAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'dashscope',
      name: '阿里百炼',
      description: '阿里云百炼大模型服务平台，提供通义千问系列模型',
      requiresApiKey: true,
      defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://bailian.console.aliyun.com/#/api-key',
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
    return DASHSCOPE_STATIC_MODELS.map((definition) => {
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

  /**
   * 获取参数定义
   * 基于阿里百炼 OpenAI 兼容模式 API 文档
   * 文档: https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
   *
   * 注意: enable_thinking, enable_search 等非 OpenAI 标准参数需通过 extra_body 传递
   */
  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        description: 'Sampling temperature (0-2). Higher values make output more random.',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 2,
        min: 0,
        max: 2,
        step: 0.1
      },
      {
        name: 'top_p',
        labelKey: 'params.top_p.label',
        descriptionKey: 'params.top_p.description',
        description: 'Nucleus sampling parameter (0-1). Alternative to temperature.',
        type: 'number',
        defaultValue: 0.8,
        default: 0.8,
        minValue: 0,
        maxValue: 1,
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'max_tokens',
        labelKey: 'params.max_tokens.label',
        descriptionKey: 'params.max_tokens.description',
        description: 'Maximum tokens to generate',
        type: 'integer',
        minValue: 1,
        maxValue: 16384,
        min: 1,
        max: 16384,
        step: 1,
        unitKey: 'params.tokens.unit'
      },
      {
        name: 'presence_penalty',
        labelKey: 'params.presence_penalty.label',
        descriptionKey: 'params.presence_penalty.description',
        description: 'Presence penalty (-2.0 to 2.0). Penalizes tokens based on presence.',
        type: 'number',
        defaultValue: 0,
        default: 0,
        minValue: -2,
        maxValue: 2,
        min: -2,
        max: 2,
        step: 0.1
      },
      {
        name: 'seed',
        labelKey: 'params.seed.label',
        descriptionKey: 'params.seed.description',
        description: 'Seed for deterministic sampling (integer)',
        type: 'integer',
        minValue: 0,
        maxValue: 2147483647,
        min: 0,
        max: 2147483647,
        step: 1
      },
      {
        name: 'enable_thinking',
        labelKey: 'params.enable_thinking.label',
        descriptionKey: 'params.enable_thinking.description',
        description: 'Enable thinking mode for complex reasoning tasks (via extra_body)',
        type: 'boolean',
        defaultValue: false,
        default: false,
        tags: ['extra_body']
      },
      {
        name: 'thinking_budget',
        labelKey: 'params.thinking_budget.label',
        descriptionKey: 'params.thinking_budget.description',
        description: 'Maximum tokens for thinking process. Limits reasoning length (via extra_body)',
        type: 'integer',
        minValue: 0,
        maxValue: 20000,
        min: 0,
        max: 20000,
        step: 100,
        unitKey: 'params.tokens.unit',
        tags: ['extra_body']
      },
      {
        name: 'enable_search',
        labelKey: 'params.enable_search.label',
        descriptionKey: 'params.enable_search.description',
        description: 'Enable internet search for real-time information (via extra_body)',
        type: 'boolean',
        defaultValue: false,
        default: false,
        tags: ['extra_body']
      }
    ]
  }

  /**
   * 获取默认参数值
   * 返回空对象，让服务器使用官方默认值
   */
  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      "enable_thinking": false
    }
  }
}
