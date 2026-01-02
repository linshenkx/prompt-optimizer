// 类型定义
export type {
  // 基础类型
  ImageParameterDefinition,
  ImageProvider,
  ImageModel,
  ImageModelConfig,
  ImageInputRef,
  ImageRequest,
  ImageResultItem,
  ImageResult,
  ImageProgressHandlers,

  // 管理器接口
  IImageModelManager,

  // 适配器接口
  IImageProviderAdapter,

  // 注册表接口
  IImageAdapterRegistry,

  // 服务接口
  IImageService,

  // 图像存储类型
  ImageMetadata,
  ImageRef,
  FullImageData,
  ImageStorageConfig,
  IImageStorageService
} from './types'

// 辅助函数
export {
  isImageRef,
  createImageRef
} from './types'

// 抽象基类
export { AbstractImageProviderAdapter } from './adapters/abstract-adapter'

// 图像存储服务
export {
  ImageStorageService,
  createImageStorageService
} from './storage'
