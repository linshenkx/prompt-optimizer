import { IImportExportable } from '../../interfaces/import-export'
import type { UnifiedParameterDefinition } from '../model/parameter-schema'
import type { BaseProvider } from '../shared/types'

// 重新导出共享类型，保持向后兼容
export type { ConnectionSchema } from '../shared/types'

// === 图像参数定义 ===

export interface ImageParameterDefinition extends UnifiedParameterDefinition {
  labelKey: string                // UI 文案 i18n key，如 "params.size.label"
  descriptionKey: string          // UI 描述 i18n key，如 "params.size.description"
  allowedValueLabelKeys?: string[] // 枚举值的 i18n keys
}

// === 核心架构类型（三层分离：Provider → Model → Configuration） ===

/**
 * 图像服务提供商静态定义
 * 扩展 BaseProvider，添加图像模型特有的属性（目前无额外属性）
 */
export interface ImageProvider extends BaseProvider {
  // 目前与 BaseProvider 完全一致，未来可扩展图像模型特有属性
}

// 模型静态定义（由适配器提供）
export interface ImageModel {
  readonly id: string                    // 模型唯一标识，如 'dall-e-3', 'kolors'
  readonly name: string                  // 显示名称，如 'DALL-E 3', 'Kolors'
  readonly description?: string          // 模型描述
  readonly providerId: string            // 所属 provider，如 'openai'
  readonly capabilities: {
    text2image: boolean                  // 支持文本生图
    image2image: boolean                 // 支持图生图
    multiImage?: boolean                 // 支持多图输入（可选）
  }
  readonly parameterDefinitions: readonly ImageParameterDefinition[] // 模型特定参数定义
  readonly defaultParameterValues?: Record<string, unknown>          // 默认参数值
}

// 用户图像模型配置（Configuration层）
export interface ImageModelConfig {
  id: string                             // 配置唯一标识
  name: string                           // 用户自定义名称
  providerId: string                     // 引用的 provider
  modelId: string                        // 引用的 model
  enabled: boolean                       // 是否启用此配置

  // 连接配置（可选覆盖）
  connectionConfig?: {
    apiKey?: string                      // API 密钥
    baseURL?: string                     // 覆盖默认 API 地址
    [key: string]: any                   // 支持其他连接参数（如 organization, region 等）
  }

  // 参数覆盖（统一字段）
  paramOverrides?: Record<string, unknown> // 覆盖模型默认参数（包含内置和自定义参数）

  /**
   * @deprecated 已废弃，将在 v3.0 移除
   * 旧版本的自定义参数字段，现已合并到 paramOverrides
   * 仅用于向后兼容读取旧数据，新代码不应使用此字段
   */
  customParamOverrides?: Record<string, unknown>

  // 自包含数据（新增）
  provider: ImageProvider              // 完整的提供商信息副本
  model: ImageModel                    // 完整的模型信息副本
}

// === 基础类型（请求/结果/进度） ===

export interface ImageInputRef {
  b64?: string
  url?: string
  mimeType?: string
}

export interface ImageRequest {
  prompt: string
  configId: string                        // 直接使用配置ID，简化调用
  inputImage?: ImageInputRef               // 可选的输入图像
  count?: number                           // 生成数量，默认 1
  paramOverrides?: Record<string, unknown> // 临时参数覆盖，不影响保存的配置
}

export interface ImageResultItem {
  b64?: string
  url?: string
  mimeType?: string
}

export interface ImageResult {
  images: ImageResultItem[]                // 图像结果
  text?: string                            // 新增：可选的文本输出（多模态）
  metadata?: {
    providerId: string                     // 溯源：使用的 provider
    modelId: string                        // 溯源：使用的 model
    configId: string                       // 溯源：使用的配置
    finishReason?: string                  // 完成原因
    usage?: any                            // 使用统计
    [key: string]: any                     // 扩展字段
  }
}

export interface ImageProgressHandlers {
  onProgress?: (stage: 'queued' | 'generating' | 'done' | string | number) => void
  onPreview?: (img: { b64: string }) => void
  onComplete?: (result: ImageResult) => void
  onError?: (error: Error) => void
}

// === 管理器接口 ===

export interface IImageModelManager extends IImportExportable {
  // 初始化（写入默认配置/补齐缺失默认项）
  ensureInitialized?(): Promise<void>
  isInitialized?(): Promise<boolean>
  // 配置 CRUD 操作
  addConfig(config: ImageModelConfig): Promise<void>
  updateConfig(id: string, updates: Partial<ImageModelConfig>): Promise<void>
  deleteConfig(id: string): Promise<void>
  getConfig(id: string): Promise<ImageModelConfig | null>
  getAllConfigs(): Promise<ImageModelConfig[]>
  getEnabledConfigs(): Promise<ImageModelConfig[]>
}

// === 适配器接口 ===

// 统一的适配器接口（所有适配器都必须实现）
export interface IImageProviderAdapter {
  // 静态信息获取（编译时确定）
  getProvider(): ImageProvider
  getModels(): ImageModel[]                // 静态模型列表，总是可用（用于离线/默认展示）

  // 动态模型获取（允许空实现）
  getModelsAsync(connectionConfig: Record<string, any>): Promise<ImageModel[]>

  // 构建默认模型（支持不存在的模型ID）
  buildDefaultModel(modelId: string): ImageModel

  // 动态生成行为（基于配置自动获取模型信息）
  generate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult>
}

// === 注册表接口 ===

export interface IImageAdapterRegistry {
  // 基础适配器管理
  getAdapter(providerId: string): IImageProviderAdapter

  // 元数据查询
  getAllProviders(): ImageProvider[]

  // 静态模型获取（即时可用）
  getStaticModels(providerId: string): ImageModel[]

  // 动态模型获取（需要连接配置）
  getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]>

  // 统一的模型获取接口（自动选择静态或动态）
  getModels(providerId: string, connectionConfig?: Record<string, any>): Promise<ImageModel[]>

  // 获取所有静态模型的组合视图
  getAllStaticModels(): Array<{ provider: ImageProvider; model: ImageModel }>

  // 能力检查
  supportsDynamicModels(providerId: string): boolean

  // 验证方法
  validateProviderModel(providerId: string, modelId: string): boolean
}

// === 服务接口 ===

export interface IImageService {
  // 核心生成功能
  generate(request: ImageRequest): Promise<ImageResult>

  // 辅助功能
  validateRequest(request: ImageRequest): Promise<void>
  // 新增：连接测试（直接使用临时配置，不依赖已保存的配置）
  testConnection(config: ImageModelConfig): Promise<ImageResult>
  // 新增：获取动态模型列表（如支持）
  getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]>
}

// 导出抽象基类
export { AbstractImageProviderAdapter } from './adapters/abstract-adapter'

