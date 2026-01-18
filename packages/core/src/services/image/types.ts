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
  b64: string
  mimeType?: string
}

export interface ImageRequest {
  prompt: string
  configId: string                        // 直接使用配置ID，简化调用
  inputImage?: ImageInputRef               // 可选的输入图像
  count?: number                           // 生成数量，默认 1
  paramOverrides?: Record<string, unknown> // 临时参数覆盖，不影响保存的配置
}

// === 显式模式请求类型（避免用 inputImage 的存在与否隐式推断） ===

/**
 * 文生图请求：不允许携带 inputImage。
 */
export type Text2ImageRequest = Omit<ImageRequest, 'inputImage'> & { inputImage?: never }

/**
 * 图生图请求：必须提供 inputImage。
 */
export type Image2ImageRequest = Omit<ImageRequest, 'inputImage'> & { inputImage: ImageInputRef }

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
  // 核心生成功能（兼容入口：内部仍可能根据 inputImage 判定模式）
  generate(request: ImageRequest): Promise<ImageResult>

  // 显式模式入口：避免模式误判与错误信息混淆
  generateText2Image(request: Text2ImageRequest): Promise<ImageResult>
  generateImage2Image(request: Image2ImageRequest): Promise<ImageResult>

  // 辅助功能（兼容入口）
  validateRequest(request: ImageRequest): Promise<void>

  // 显式校验：用于 UI/调用方提前发现配置与输入不匹配
  validateText2ImageRequest(request: Text2ImageRequest): Promise<void>
  validateImage2ImageRequest(request: Image2ImageRequest): Promise<void>

  // 新增：连接测试（直接使用临时配置，不依赖已保存的配置）
  testConnection(config: ImageModelConfig): Promise<ImageResult>
  // 新增：获取动态模型列表（如支持）
  getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]>
}


// === 图像存储类型（分离存储支持）===

/**
 * 图像元数据（轻量级，不含实际图像数据）
 */
export interface ImageMetadata {
  id: string                    // 唯一标识，格式：img_<timestamp>_<uuid>
  width?: number               // 图像宽度（可选）
  height?: number              // 图像高度（可选）
  mimeType: string             // MIME类型：image/png, image/jpeg
  sizeBytes: number            // 图像大小（字节）
  createdAt: number            // 创建时间戳
  accessedAt: number           // 最后访问时间戳（用于LRU）
  source: 'generated' | 'uploaded'  // 来源：生成 vs 上传
  metadata?: {                 // 关联的生成元数据
    prompt?: string            // 生成提示词
    modelId?: string           // 使用的模型
    configId?: string          // 使用的配置
  }
}

/**
 * 图像引用（用于 Session 存储）
 * 当 Session 持久化时，使用此类型替代完整的图像数据
 */
export interface ImageRef {
  id: string                   // 图像ID
  _type: 'image-ref'          // 类型标记，用于区分引用和实际数据
  b64?: never                 // 明确排除 base64 字段
  url?: never                 // 明确排除 URL 字段
  mimeType?: never            // 明确排除 mimeType 字段
}

/**
 * 完整图像数据（仅在需要时加载）
 * 包含元数据和实际的 base64 图像数据
 */
export interface FullImageData {
  metadata: ImageMetadata
  data: string                 // base64编码的图像数据（不含data URL前缀）
}

/**
 * 图像存储配置
 */
export interface ImageStorageConfig {
  maxCacheSize?: number        // 最大缓存大小（字节），默认 50MB
  maxAge?: number              // 最大保留时间（毫秒），默认 7天
  maxCount?: number            // 最大图像数量，默认 100张
  autoCleanupThreshold?: number  // 自动清理阈值（达到此比例时触发），默认 0.8
}

/**
 * 图像存储服务接口
 * 提供图像的独立存储、查询和清理功能
 */
export interface IImageStorageService {
  // 基础 CRUD 操作
  saveImage(data: FullImageData): Promise<string>  // 返回图像ID
  getImage(id: string): Promise<FullImageData | null>
  getMetadata(id: string): Promise<ImageMetadata | null>
  deleteImage(id: string): Promise<void>

  // 批量操作
  deleteImages(ids: string[]): Promise<void>
  clearAll(): Promise<void>

  // 清理策略
  cleanupOldImages(): Promise<number>  // 返回清理的图像数量
  enforceQuota(): Promise<void>        // 强制执行配额限制

  // 查询和统计
  listAllMetadata(): Promise<ImageMetadata[]>
  getStorageStats(): Promise<{
    count: number
    totalBytes: number
    oldestAt: number | null
    newestAt: number | null
  }>

  // 配置管理
  getConfig(): ImageStorageConfig
  updateConfig(config: Partial<ImageStorageConfig>): Promise<void>

  // 生命周期管理
  close(): Promise<void>
}

/**
 * 辅助函数：判断是否为图像引用
 */
export function isImageRef(item: ImageResultItem): item is ImageRef {
  return '_type' in item && item._type === 'image-ref'
}

/**
 * 辅助函数：创建图像引用
 */
export function createImageRef(id: string): ImageRef {
  return { id, _type: 'image-ref' }
}

// 导出抽象基类
export { AbstractImageProviderAdapter } from './adapters/abstract-adapter'

