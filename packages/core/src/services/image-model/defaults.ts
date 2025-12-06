import type { ImageModelConfig, IImageAdapterRegistry } from '../image/types'
import { ImageAdapterRegistry } from '../image/adapters/registry'
import { getEnvVar } from '../../utils/environment'

/**
 * 图像模型默认配置生成器
 * 返回完整的自包含配置对象，包含provider和model完整信息
 *
 * baseURL 和默认 modelId 从 Adapter 获取，避免硬编码
 *
 * @param registry 可选，图像适配器注册表（用于依赖注入和测试）
 */
export function getDefaultImageModels(registry?: IImageAdapterRegistry): Record<string, ImageModelConfig> {
  const adapterRegistry = registry || new ImageAdapterRegistry()

  // 环境变量
  const GEMINI_API_KEY = getEnvVar('VITE_GEMINI_API_KEY').trim()
  const SEEDREAM_API_KEY = (
    getEnvVar('VITE_SEEDREAM_API_KEY') ||
    getEnvVar('VITE_ARK_API_KEY')).trim()
  const SEEDREAM_BASE_URL = (
    getEnvVar('VITE_SEEDREAM_BASE_URL') ||
    getEnvVar('VITE_ARK_BASE_URL')).trim()
  const OPENROUTER_API_KEY = getEnvVar('VITE_OPENROUTER_API_KEY').trim()
  const SILICONFLOW_API_KEY = getEnvVar('VITE_SILICONFLOW_API_KEY').trim()
  const OPENAI_API_KEY = getEnvVar('VITE_OPENAI_API_KEY').trim()
  const OPENAI_BASE_URL = getEnvVar('VITE_OPENAI_BASE_URL').trim()
  const DASHSCOPE_API_KEY = getEnvVar('VITE_DASHSCOPE_API_KEY').trim()

  // 辅助函数：获取 Provider 的默认 baseURL
  const getDefaultBaseURL = (providerId: string): string => {
    const adapter = adapterRegistry.getAdapter(providerId)
    return adapter.getProvider().defaultBaseURL || ''
  }

  // 辅助函数：获取 Provider 的第一个模型 ID 作为默认
  const getDefaultModelId = (providerId: string): string => {
    const models = adapterRegistry.getStaticModels(providerId)
    return models[0]?.id || providerId
  }

  // 辅助函数：构建完整配置
  const buildConfig = (
    configId: string,
    name: string,
    providerId: string,
    modelId: string,
    enabled: boolean,
    connectionConfig?: any,
    paramOverrides?: any
  ): ImageModelConfig => {
    const adapter = adapterRegistry.getAdapter(providerId)
    const provider = adapter.getProvider()

    // 尝试从静态模型列表获取模型信息
    let model = adapterRegistry.getStaticModels(providerId).find(m => m.id === modelId)

    // 如果静态模型不存在，使用buildDefaultModel构建
    if (!model) {
      model = adapter.buildDefaultModel(modelId)
    }

    // 合并模型默认参数和用户指定的参数覆盖
    // 用户指定的参数优先级更高
    const modelDefaults = model.defaultParameterValues || {}
    const mergedParamOverrides = { ...modelDefaults, ...(paramOverrides ?? {}) }

    return {
      id: configId,
      name,
      providerId,
      modelId,
      enabled,
      connectionConfig,
      paramOverrides: mergedParamOverrides,
      customParamOverrides: {},
      provider,
      model
    }
  }

  // 预设配置列表
  // baseURL 优先使用环境变量，否则从 Provider 获取默认值
  // modelId 使用 Provider 的第一个模型作为默认
  const entries = [
    {
      id: 'image-openrouter-nanobanana',
      name: 'OpenRouter Nano Banana',
      providerId: 'openrouter',
      modelId: getDefaultModelId('openrouter'),
      enabled: !!OPENROUTER_API_KEY,
      connectionConfig: {
        apiKey: OPENROUTER_API_KEY,
        baseURL: getDefaultBaseURL('openrouter')
      },
      paramOverrides: {}
    },
    {
      id: 'image-gemini-nanobanana',
      name: 'Gemini Nano Banana',
      providerId: 'gemini',
      modelId: getDefaultModelId('gemini'),
      enabled: !!GEMINI_API_KEY,
      connectionConfig: {
        apiKey: GEMINI_API_KEY,
        baseURL: getDefaultBaseURL('gemini')
      },
      paramOverrides: { outputMimeType: 'image/png' }
    },
    {
      id: 'image-openai-gpt',
      name: 'OpenAI GPT Image 1',
      providerId: 'openai',
      modelId: getDefaultModelId('openai'),
      enabled: !!OPENAI_API_KEY,
      connectionConfig: {
        apiKey: OPENAI_API_KEY,
        baseURL: OPENAI_BASE_URL || getDefaultBaseURL('openai')
      },
      paramOverrides: { size: '1024x1024', quality: 'auto', background: 'auto' }
    },
    {
      id: 'image-siliconflow-kolors',
      name: 'SiliconFlow Kolors',
      providerId: 'siliconflow',
      modelId: getDefaultModelId('siliconflow'),
      enabled: !!SILICONFLOW_API_KEY,
      connectionConfig: {
        apiKey: SILICONFLOW_API_KEY,
        baseURL: getDefaultBaseURL('siliconflow')
      },
      paramOverrides: { image_size: '1024x1024', num_inference_steps: 20, guidance_scale: 7.5, outputMimeType: 'image/png' }
    },
    {
      id: 'image-seedream',
      name: 'Doubao Seedream 4.0',
      providerId: 'seedream',
      modelId: getDefaultModelId('seedream'),
      enabled: !!SEEDREAM_API_KEY,
      connectionConfig: {
        apiKey: SEEDREAM_API_KEY,
        baseURL: SEEDREAM_BASE_URL || getDefaultBaseURL('seedream')
      },
      paramOverrides: { size: '1024x1024', watermark: false, outputMimeType: 'image/png' }
    },
    {
      id: 'image-dashscope',
      name: 'DashScope Qwen',
      providerId: 'dashscope',
      modelId: getDefaultModelId('dashscope'),
      enabled: !!DASHSCOPE_API_KEY,
      connectionConfig: {
        apiKey: DASHSCOPE_API_KEY,
        baseURL: getDefaultBaseURL('dashscope')
      },
      paramOverrides: {}
    }
  ]

  const models: Record<string, ImageModelConfig> = {}
  for (const e of entries) {
    models[e.id] = buildConfig(e.id, e.name, e.providerId, e.modelId, e.enabled, e.connectionConfig, e.paramOverrides)
  }

  return models
}

// 直接导出所有图像模型配置（保持向后兼容，与文本模型风格一致）
export const defaultImageModels = getDefaultImageModels()
