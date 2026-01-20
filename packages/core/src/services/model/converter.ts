import type { ModelConfig, TextModelConfig, TextProvider, TextModel } from './types';
import type { ITextAdapterRegistry } from '../llm/types';
import { splitOverridesBySchema } from './parameter-utils';
import { ModelError } from './errors';
import { MODEL_ERROR_CODES } from '../../constants/error-codes';

/**
 * 将传统 ModelConfig 转换为 TextModelConfig（使用 Registry 获取元数据）
 *
 * 此函数用于向后兼容，将旧格式配置转换为新架构格式
 *
 * @param key 配置键名
 * @param legacy 传统配置对象
 * @param registry Adapter注册表实例（用于获取Provider和Model元数据）
 * @returns 转换后的 TextModelConfig
 */
export async function convertLegacyToTextModelConfigWithRegistry(
  key: string,
  legacy: ModelConfig,
  registry: ITextAdapterRegistry
): Promise<TextModelConfig> {
  // 根据 provider 确定 providerId
  let providerId: string;
  switch (legacy.provider) {
    case 'gemini':
      providerId = 'gemini';
      break;
    case 'anthropic':
      providerId = 'anthropic';
      break;
    case 'deepseek':
      providerId = 'deepseek';
      break;
    case 'siliconflow':
      providerId = 'siliconflow';
      break;
    case 'zhipu':
      providerId = 'zhipu';
      break;
    case 'openai':
    case 'custom':
    default:
      providerId = 'openai';
      break;
  }

  try {
    // 通过 Registry 获取 Adapter
    const adapter = registry.getAdapter(providerId);

    // 从 Adapter 获取 Provider 元数据
    const providerMeta: TextProvider = adapter.getProvider();

    // 从 Adapter 获取 Model 元数据
    let modelMeta: TextModel | undefined;
    const staticModels = adapter.getModels();
    modelMeta = staticModels.find(m => m.id === legacy.defaultModel);

    // 如果静态模型列表中没有找到，使用 buildDefaultModel
    if (!modelMeta) {
      console.warn(`[Converter] Model ${legacy.defaultModel} not found in static models, building default`);
      modelMeta = adapter.buildDefaultModel(legacy.defaultModel);
    }

    const schema = modelMeta.parameterDefinitions ?? [];
    const legacyParams = legacy.llmParams || {};
    const { builtIn, custom } = splitOverridesBySchema(schema, legacyParams);

    // 构建 TextModelConfig
    const textModelConfig: TextModelConfig = {
      id: key,
      name: legacy.name,
      enabled: legacy.enabled,
      providerMeta: providerMeta,
      modelMeta: modelMeta,
      connectionConfig: {
        apiKey: legacy.apiKey,
        baseURL: legacy.baseURL
      },
      paramOverrides: builtIn,
      customParamOverrides: custom
    };

    return textModelConfig;
  } catch (error) {
    console.error(`[Converter] Failed to convert legacy config for ${key}:`, error);
    // Fallback：使用 OpenAI Adapter 并禁用配置
    try {
      const openaiAdapter = registry.getAdapter('openai');
      const providerMeta = openaiAdapter.getProvider();
      const modelMeta = openaiAdapter.buildDefaultModel(legacy.defaultModel);

      return {
        id: key,
        name: legacy.name,
        enabled: false, // 转换失败，禁用配置
        providerMeta: providerMeta,
        modelMeta: modelMeta,
        connectionConfig: {
          apiKey: legacy.apiKey,
          baseURL: legacy.baseURL
        },
        paramOverrides: legacy.llmParams || {}
      };
    } catch (fallbackError) {
      console.error(`[Converter] Fallback to OpenAI also failed for ${key}:`, fallbackError);
      const details = error instanceof Error ? error.message : String(error)
      throw new ModelError(MODEL_ERROR_CODES.CONFIG_ERROR, `Failed to convert config ${key}: ${details}`);
    }
  }
}

/**
 * 将传统 ModelConfig 转换为 TextModelConfig（使用硬编码元数据）
 *
 * 此函数为后备方案，不依赖 Registry，避免循环依赖
 *
 * @param key 配置键名
 * @param legacy 传统配置对象
 * @returns 转换后的 TextModelConfig
 */
export function convertLegacyToTextModelConfig(
  key: string,
  legacy: ModelConfig
): TextModelConfig {
  // 根据 provider 确定 providerId
  let providerId: string;
  switch (legacy.provider) {
    case 'gemini':
      providerId = 'gemini';
      break;
    case 'anthropic':
      providerId = 'anthropic';
      break;
    case 'deepseek':
      providerId = 'deepseek';
      break;
    case 'siliconflow':
      providerId = 'siliconflow';
      break;
    case 'zhipu':
      providerId = 'zhipu';
      break;
    case 'openai':
    case 'custom':
    default:
      providerId = 'openai';
      break;
  }

  // 构建 Provider 元数据
  const providerMeta: TextProvider = createProviderMeta(providerId, legacy);

  // 构建 Model 元数据
  const modelMeta: TextModel = createModelMeta(legacy.defaultModel, providerId, legacy);

  const schema = modelMeta.parameterDefinitions ?? [];
  const legacyParams = legacy.llmParams || {};
  const { builtIn, custom } = splitOverridesBySchema(schema, legacyParams);

  // 构建 TextModelConfig
  const textModelConfig: TextModelConfig = {
    id: key,
    name: legacy.name,
    enabled: legacy.enabled,
    providerMeta: providerMeta,
    modelMeta: modelMeta,
    connectionConfig: {
      apiKey: legacy.apiKey,
      baseURL: legacy.baseURL
    },
    paramOverrides: builtIn,
    customParamOverrides: custom
  };

  return textModelConfig;
}

/**
 * 创建 Provider 元数据
 */
function createProviderMeta(providerId: string, legacy: ModelConfig): TextProvider {
  if (providerId === 'gemini') {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Generative AI models',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
      supportsDynamicModels: false,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'deepseek') {
    return {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'DeepSeek OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://api.deepseek.com/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'siliconflow') {
    return {
      id: 'siliconflow',
      name: 'SiliconFlow',
      description: 'SiliconFlow OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://api.siliconflow.cn/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'zhipu') {
    return {
      id: 'zhipu',
      name: 'Zhipu AI',
      description: 'Zhipu GLM OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
      supportsDynamicModels: false,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'anthropic') {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Anthropic Claude models',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.anthropic.com/v1',
      supportsDynamicModels: false,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else {
    // OpenAI 及兼容 API - 始终使用 'OpenAI' 作为 Provider 名称
    return {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT models and OpenAI-compatible APIs',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://api.openai.com/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'organization', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          organization: 'string',
          timeout: 'number'
        }
      }
    };
  }
}

/**
 * 创建 Model 元数据
 */
function createModelMeta(modelId: string, providerId: string, legacy: ModelConfig): TextModel {
  // 默认的 capabilities
  const defaultCapabilities = {
        supportsTools: providerId !== 'gemini', // Gemini 工具支持可能不同
    supportsReasoning: modelId.includes('o1') || modelId.includes('reasoner') || modelId.includes('thinking'),
    maxContextLength: 4096
  };

  // 根据模型 ID 调整 capabilities
  if (modelId.includes('gpt-4o')) {
    defaultCapabilities.maxContextLength = 128000;
  } else if (modelId.includes('gemini')) {
    defaultCapabilities.maxContextLength = 1000000;
    defaultCapabilities.supportsTools = true;
  } else if (modelId.includes('claude')) {
    defaultCapabilities.maxContextLength = 200000;
  } else if (modelId.includes('deepseek')) {
    defaultCapabilities.maxContextLength = 64000;
  }

  if (providerId === 'siliconflow') {
    defaultCapabilities.supportsTools = false;
    defaultCapabilities.maxContextLength = 8192;
  } else if (providerId === 'zhipu') {
    defaultCapabilities.maxContextLength = 128000;
  }

  if (modelId.includes('glm-4-air')) {
    defaultCapabilities.supportsTools = false;
  }

  // 构建参数定义
  const parameterDefinitions = createParameterDefinitions(providerId);

  return {
    id: modelId,
    name: modelId,
    description: `Model ${modelId} from ${legacy.name}`,
    providerId: providerId,
    capabilities: defaultCapabilities,
    parameterDefinitions: parameterDefinitions,
    defaultParameterValues: legacy.llmParams || {}
  };
}

/**
 * 创建参数定义
 */
function createParameterDefinitions(providerId: string): readonly any[] {
  if (providerId === 'gemini') {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        type: 'number',
        defaultValue: 1,
        minValue: 0,
        maxValue: 2,
        step: 0.1
      },
      {
        name: 'maxOutputTokens',
        labelKey: 'params.maxOutputTokens.label',
        descriptionKey: 'params.maxOutputTokens.description',
        type: 'integer',
        defaultValue: 8192,
        minValue: 1,
        unitKey: 'params.tokens.unit',
        step: 1
      }
    ];
  } else {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        type: 'number',
        defaultValue: 1,
        minValue: 0,
        maxValue: 2,
        step: 0.1
      },
      {
        name: 'max_tokens',
        labelKey: 'params.max_tokens.label',
        descriptionKey: 'params.max_tokens.description',
        type: 'integer',
        minValue: 1,
        unitKey: 'params.tokens.unit',
        step: 1
      }
    ];
  }
}

/**
 * 检测配置是否为传统格式
 *
 * @param config 配置对象
 * @returns 如果是传统格式返回 true
 */
export function isLegacyConfig(config: any): config is ModelConfig {
  return (
    config &&
    typeof config === 'object' &&
    'provider' in config &&
    'baseURL' in config &&
    'defaultModel' in config &&
    !('providerMeta' in config) &&
    !('modelMeta' in config)
  );
}

/**
 * 检测配置是否为新格式
 *
 * @param config 配置对象
 * @returns 如果是新格式返回 true
 */
export function isTextModelConfig(config: any): config is TextModelConfig {
  return (
    config &&
    typeof config === 'object' &&
    'providerMeta' in config &&
    'modelMeta' in config &&
    'connectionConfig' in config
  );
}
