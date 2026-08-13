import type { ImageModelConfig, IImageAdapterRegistry } from '../image/types'
import { ImageAdapterRegistry } from '../image/adapters/registry'
import { getEnvVar } from '../../utils/environment'

/**
 * Provider ID -> 环境变量 key 映射（与文本模型风格一致）
 * 新增 Provider 只需在此添加一行
 */
const IMAGE_PROVIDER_ENV_KEYS = {
  openrouter: ['VITE_OPENROUTER_API_KEY'],
  gemini: ['VITE_GEMINI_API_KEY'],
  openai: ['VITE_OPENAI_API_KEY'],
  siliconflow: ['VITE_SILICONFLOW_API_KEY'],
  seedream: ['VITE_SEEDREAM_API_KEY', 'VITE_ARK_API_KEY'],
  dashscope: ['VITE_DASHSCOPE_API_KEY'],
  modelscope: ['VITE_MODELSCOPE_API_KEY'],
  ollama: [],
  cloudflare: ['VITE_CF_API_TOKEN'],
  grok: ['VITE_GROK_API_KEY', 'VITE_XAI_API_KEY']
} as const

type BuiltinImageConfigSpec = {
  providerId: keyof typeof IMAGE_PROVIDER_ENV_KEYS
  configId: string
  modelId?: string
  displayName?: string
}

/**
 * 内置图像配置定义。
 * 允许一个 provider 生成多个内置配置，例如 Seedream 4.0 与 5.0 lite。
 */
const IMAGE_BUILTIN_CONFIGS: readonly BuiltinImageConfigSpec[] = [
  { providerId: 'openrouter', configId: 'image-openrouter-nanobanana' },
  { providerId: 'gemini', configId: 'image-gemini-nanobanana' },
  { providerId: 'openai', configId: 'image-openai-gpt' },
  { providerId: 'siliconflow', configId: 'image-siliconflow-kolors' },
  { providerId: 'seedream', configId: 'image-seedream', modelId: 'doubao-seedream-4-0-250828' },
  { providerId: 'seedream', configId: 'image-seedream-50-lite', modelId: 'doubao-seedream-5-0-lite-260128', displayName: 'Doubao Seedream 5.0 Lite' },
  { providerId: 'dashscope', configId: 'image-dashscope' },
  { providerId: 'modelscope', configId: 'image-modelscope' },
  { providerId: 'ollama', configId: 'image-ollama' },
  { providerId: 'cloudflare', configId: 'image-cloudflare-flux-klein' },
  { providerId: 'grok', configId: 'image-grok-imagine' }
] as const

/**
 * 特殊 baseURL 环境变量（仅需要覆盖的 Provider）
 */
const IMAGE_BASE_URL_ENV_KEYS: Record<string, string> = {
  openai: 'VITE_OPENAI_BASE_URL',
  seedream: 'VITE_SEEDREAM_BASE_URL'
}

/**
 * 额外连接字段的环境变量映射
 */
const IMAGE_EXTRA_CONNECTION_ENV_KEYS: Record<string, Record<string, string[]>> = {
  cloudflare: {
    accountId: ['VITE_CF_ACCOUNT_ID']
  }
}

/**
 * 某些 Provider 需要多个字段都存在时才视为可用
 */
const IMAGE_REQUIRED_CONNECTION_FIELDS: Record<string, string[]> = {
  ollama: [],
  cloudflare: ['apiKey', 'accountId']
}

function getFirstEnvValue(envKeys: readonly string[]): string {
  for (const envKey of envKeys) {
    const value = getEnvVar(envKey).trim()
    if (value) return value
  }
  return ''
}

function hasConnectionValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : !!value
}

function shouldEnableFromRequiredFields(
  connectionConfig: Record<string, unknown>,
  requiredConnectionFields: readonly string[]
): boolean {
  return requiredConnectionFields.length > 0
    && requiredConnectionFields.every(field => hasConnectionValue(connectionConfig[field]))
}

/**
 * 图像模型默认配置生成器
 * 返回完整的自包含配置对象，包含 provider 和 model 完整信息
 *
 * 使用 Provider-Adapter 架构生成完整的元数据，
 * 所有配置信息（Provider ID、名称、BaseURL、默认模型、参数）均从 Adapter 获取。
 *
 * @param registry 可选，图像适配器注册表（用于依赖注入和测试）
 */
export function getDefaultImageModels(registry?: IImageAdapterRegistry): Record<string, ImageModelConfig> {
  const adapterRegistry = registry || new ImageAdapterRegistry()
  const result: Record<string, ImageModelConfig> = {}

  // 批量生成配置（与文本模型风格一致）
  for (const builtinConfig of IMAGE_BUILTIN_CONFIGS) {
    const providerId = builtinConfig.providerId
    const envKeys = IMAGE_PROVIDER_ENV_KEYS[providerId]
    const adapter = adapterRegistry.getAdapter(providerId)
    const provider = adapter.getProvider()
    const models = adapterRegistry.getStaticModels(providerId)
    const defaultModel = models.find(model => model.id === builtinConfig.modelId)
      || models[0]
      || adapter.buildDefaultModel(builtinConfig.modelId || providerId)

    // 获取 API Key（支持备选环境变量）
    const apiKey = getFirstEnvValue(envKeys)

    // 获取 baseURL（支持环境变量覆盖）
    let baseURL = provider.defaultBaseURL || ''
    const baseURLEnvKey = IMAGE_BASE_URL_ENV_KEYS[providerId]
    if (baseURLEnvKey) {
      let envBaseURL = getEnvVar(baseURLEnvKey).trim()
      // Seedream 备选
      if (!envBaseURL && providerId === 'seedream') {
        envBaseURL = getEnvVar('VITE_ARK_BASE_URL').trim()
      }
      if (envBaseURL) baseURL = envBaseURL
    }

    // 直接从模型获取默认参数值（与文本模型一致）
    const defaultParamValues = defaultModel.defaultParameterValues || {}
    const connectionConfig: Record<string, unknown> = { apiKey, baseURL }
    const extraConnectionFields = IMAGE_EXTRA_CONNECTION_ENV_KEYS[providerId] || {}

    for (const [field, fieldEnvKeys] of Object.entries(extraConnectionFields)) {
      connectionConfig[field] = getFirstEnvValue(fieldEnvKeys)
    }

    const requiredConnectionFields = IMAGE_REQUIRED_CONNECTION_FIELDS[providerId] || ['apiKey']
    const enabled = shouldEnableFromRequiredFields(connectionConfig, requiredConnectionFields)

    result[builtinConfig.configId] = {
      id: builtinConfig.configId,
      name: builtinConfig.displayName || provider.name,
      providerId,
      modelId: defaultModel.id,
      enabled,
      connectionConfig,
      paramOverrides: { ...defaultParamValues },
      customParamOverrides: {},
      provider,
      model: defaultModel
    }
  }

  return result
}

/**
 * 获取所有内置图像模型配置的 ID 列表
 * 用于判断某个配置是否为内置模型（而非用户自定义）
 */
export function getBuiltinImageConfigIds(): string[] {
  return IMAGE_BUILTIN_CONFIGS.map(config => config.configId)
}

// 直接导出所有图像模型配置（保持向后兼容，与文本模型风格一致）
export const defaultImageModels = getDefaultImageModels()
