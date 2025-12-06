import { TextModelConfig, TextProvider, TextModel } from './types';
import { ValidatedCustomModelEnvConfig, scanCustomModelEnvVars } from '../../utils/environment';
import { getDefaultTextModels } from './defaults';

/**
 * 获取静态模型键列表
 * 通过创建临时静态模型配置来动态获取键列表，避免硬编码
 */
function getStaticModelKeys(): string[] {
  const tempStaticModels = getDefaultTextModels();
  return Object.keys(tempStaticModels);
}

/**
 * 生成自定义模型的显示名称
 * @param suffix 后缀名
 * @returns 格式化的显示名称
 */
export function generateCustomModelName(suffix: string): string {
  // 将下划线和连字符替换为空格，并转换为标题格式
  return suffix
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * 将已验证的自定义模型环境变量配置转换为 TextModelConfig
 * 输入的配置已通过 validateCustomModelConfig 验证，确保所有必需字段存在
 * @param envConfig 已验证的环境变量配置
 * @returns TextModelConfig对象
 */
export function generateTextModelConfig(envConfig: ValidatedCustomModelEnvConfig): TextModelConfig {
  // 输入配置已通过验证，直接使用（所有必需字段已确保存在）
  const modelName = generateCustomModelName(envConfig.suffix);

  // OpenAI 兼容 Provider（所有自定义模型都使用 OpenAI 兼容 API）
  const customProvider: TextProvider = {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI-compatible API',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.openai.com/v1',
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

  // 自定义模型元数据
  const customModel: TextModel = {
    id: envConfig.model,
    name: modelName,
    description: `Custom model: ${envConfig.model}`,
    providerId: 'openai',
    capabilities: {
      supportsTools: false,
      supportsReasoning: false,
      maxContextLength: 4096
    },
    parameterDefinitions: [
      {
        name: 'temperature',
        type: 'number',
        description: 'Sampling temperature',
        default: 1,
        min: 0,
        max: 2
      }
    ],
    defaultParameterValues: {
      temperature: 1
    }
  };

  return {
    id: `custom_${envConfig.suffix}`,
    name: modelName,
    enabled: true,
    providerMeta: customProvider,
    modelMeta: customModel,
    connectionConfig: {
      apiKey: envConfig.apiKey,
      baseURL: envConfig.baseURL
    },
    paramOverrides: {}
  };
}

/**
 * 生成所有动态自定义模型配置（TextModelConfig格式）
 * @returns 动态模型配置映射
 */
export function generateDynamicModels(): Record<string, TextModelConfig> {
  const dynamicModels: Record<string, TextModelConfig> = {};

  try {
    // 获取已验证的自定义模型配置（scanCustomModelEnvVars已完成所有验证）
    const customModelConfigs = scanCustomModelEnvVars();

    Object.entries(customModelConfigs).forEach(([suffix, envConfig]) => {
      try {
        const modelKey = `custom_${suffix}`;

        // 检查是否与静态模型key冲突（动态获取静态模型键，避免硬编码）
        const staticModelKeys = getStaticModelKeys();
        if (staticModelKeys.includes(suffix)) {
          console.warn(`[generateDynamicModels] Suffix conflict: ${suffix} conflicts with static model, skipping`);
          return;
        }

        // 配置已通过验证，直接生成模型配置
        dynamicModels[modelKey] = generateTextModelConfig(envConfig);
        console.log(`[generateDynamicModels] Generated model: ${modelKey} (${dynamicModels[modelKey].name})`);
      } catch (error) {
        console.error(`[generateDynamicModels] Error generating model for ${suffix}:`, error);
        // 继续处理其他模型，不因单个模型错误而中断
      }
    });

    console.log(`[generateDynamicModels] Successfully generated ${Object.keys(dynamicModels).length} dynamic custom models`);
  } catch (error) {
    console.error('[generateDynamicModels] Error scanning custom model environment variables:', error);
  }

  return dynamicModels;
}
