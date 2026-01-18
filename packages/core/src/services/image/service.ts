import {
  IImageModelManager,
  ImageRequest,
  ImageResult,
  IImageService,
  IImageAdapterRegistry,
  ImageModelConfig,
  ImageModel,
  Text2ImageRequest,
  Image2ImageRequest
} from './types'
import { createImageAdapterRegistry } from './adapters/registry'
import { BaseError } from '../llm/errors'
import { IMAGE_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'
import { mergeOverrides } from '../model/parameter-utils'

class ImageError extends BaseError {
  constructor(code: string, message?: string, params?: ErrorParams) {
    super(code, message, params)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export class ImageService implements IImageService {
  private readonly registry: IImageAdapterRegistry
  private readonly imageModelManager: IImageModelManager

  constructor(imageModelManager: IImageModelManager, registry?: IImageAdapterRegistry) {
    this.imageModelManager = imageModelManager
    this.registry = registry ?? createImageAdapterRegistry()
  }

  async validateRequest(request: ImageRequest): Promise<void> {
    // 兼容入口：仍按是否携带 inputImage 判断模式。
    // 注意：这是 legacy 行为；推荐调用方使用显式的 validateText2ImageRequest/validateImage2ImageRequest。
    if (request.inputImage) {
      const image2image: Image2ImageRequest = { ...request, inputImage: request.inputImage }
      await this.validateImage2ImageRequest(image2image)
      return
    }

    const { inputImage: _inputImage, ...rest } = request
    const text2image: Text2ImageRequest = rest
    await this.validateText2ImageRequest(text2image)
  }

  async validateText2ImageRequest(request: Text2ImageRequest): Promise<void> {
    // 显式文生图：不允许携带 inputImage（即使调用方用 any 绕过类型）
    const unsafeInputImage = (request as unknown as { inputImage?: unknown }).inputImage
    if (unsafeInputImage !== undefined && unsafeInputImage !== null) {
      throw new ImageError(IMAGE_ERROR_CODES.TEXT2IMAGE_INPUT_IMAGE_NOT_ALLOWED)
    }

    await this.validateBaseRequest(request)

    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    // 能力校验：优先使用 config.model（动态/自定义模型），静态列表作为兜底
    const configModel = config.model
    const staticModels = this.registry.getStaticModels(config.providerId)
    const staticModel = staticModels.find(m => m.id === config.modelId)
    const capabilities = configModel?.capabilities ?? staticModel?.capabilities
    const modelName = configModel?.name ?? staticModel?.name ?? config.modelId

    if (capabilities && !capabilities.text2image) {
      // 对于仅支持图生图的模型，给出更明确指引
      if (capabilities.image2image) {
        throw new ImageError(IMAGE_ERROR_CODES.MODEL_ONLY_SUPPORTS_IMAGE2IMAGE_NEED_INPUT, undefined, { modelName })
      }
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_TEXT2IMAGE, undefined, { modelName })
    }
  }

  async validateImage2ImageRequest(request: Image2ImageRequest): Promise<void> {
    await this.validateBaseRequest(request)

    if (!request.inputImage) {
      throw new ImageError(IMAGE_ERROR_CODES.IMAGE2IMAGE_INPUT_IMAGE_REQUIRED)
    }

    // 强制仅支持 base64 输入图（不支持 url）
    const unsafeUrl = (request.inputImage as unknown as { url?: unknown }).url
    if (typeof unsafeUrl === 'string' && unsafeUrl.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_URL_NOT_SUPPORTED)
    }

    if (!request.inputImage.b64 || typeof request.inputImage.b64 !== 'string' || !request.inputImage.b64.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED)
    }

    // 复用原有的输入图像格式/大小校验
    this.validateInputImage(request.inputImage)

    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    // 能力校验：优先使用 config.model（动态/自定义模型），静态列表作为兜底
    const configModel = config.model
    const staticModels = this.registry.getStaticModels(config.providerId)
    const staticModel = staticModels.find(m => m.id === config.modelId)
    const capabilities = configModel?.capabilities ?? staticModel?.capabilities
    const modelName = configModel?.name ?? staticModel?.name ?? config.modelId

    if (capabilities && !capabilities.image2image) {
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2IMAGE, undefined, { modelName })
    }
  }

  private async validateBaseRequest(request: Pick<ImageRequest, 'prompt' | 'configId' | 'count'>): Promise<void> {
    // 验证基本字段
    if (!request?.prompt || !request.prompt.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.PROMPT_EMPTY)
    }

    if (!request?.configId || !request.configId.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_ID_EMPTY)
    }

    // 验证配置是否存在且启用
    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }
    if (!config.enabled) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_ENABLED, undefined, { configName: config.name })
    }

    // 快速验证：仅检查提供商是否存在（本地操作）
    try {
      this.registry.getAdapter(config.providerId)
    } catch {
      throw new ImageError(IMAGE_ERROR_CODES.PROVIDER_NOT_FOUND, undefined, { providerId: config.providerId })
    }

    // 验证生成数量（仅支持单图）
    const count = request.count ?? 1
    if (count !== 1) {
      throw new ImageError(IMAGE_ERROR_CODES.ONLY_SINGLE_IMAGE_SUPPORTED)
    }
  }

  private validateInputImage(inputImage: { b64: string; mimeType?: string }): void {
    // validateImage2ImageRequest 已经校验 b64 非空

    // 验证输入图像格式
    if (typeof inputImage.b64 !== 'string') {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_INVALID_FORMAT)
    }

    // 验证输入图像 MIME 类型和大小
    const mime = (inputImage.mimeType || '').toLowerCase()
    if (mime && mime !== 'image/png' && mime !== 'image/jpeg') {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_UNSUPPORTED_MIME, undefined, { mimeType: inputImage.mimeType })
    }

    // 估算 base64 大小：每4字符≈3字节，去除末尾填充
    const len = inputImage.b64.length
    const padding = (inputImage.b64.endsWith('==') ? 2 : inputImage.b64.endsWith('=') ? 1 : 0)
    const bytes = Math.floor((len * 3) / 4) - padding
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (bytes > maxSize) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_TOO_LARGE, undefined, { maxSizeMB: 10 })
    }
  }

  async generateText2Image(request: Text2ImageRequest): Promise<ImageResult> {
    await this.validateText2ImageRequest(request)
    return await this.generateInternal(request)
  }

  async generateImage2Image(request: Image2ImageRequest): Promise<ImageResult> {
    await this.validateImage2ImageRequest(request)
    return await this.generateInternal(request)
  }

  async generate(request: ImageRequest): Promise<ImageResult> {
    // 兼容入口：保留原行为
    await this.validateRequest(request)
    return await this.generateInternal(request)
  }

  private async generateInternal(request: ImageRequest): Promise<ImageResult> {
    // 获取配置
    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    // 获取适配器
    const adapter = this.registry.getAdapter(config.providerId)
    const runtimeConfig = this.prepareRuntimeConfig(config)
    const runtimeRequest = this.prepareRuntimeRequest(request, runtimeConfig)

    try {
      // 调用适配器生成
      const result = await adapter.generate(runtimeRequest, runtimeConfig)

      // 确保返回结果包含完整的元数据
      if (!result.metadata) {
        result.metadata = {
          providerId: config.providerId,
          modelId: config.modelId,
          configId: config.id
        }
      } else {
        // 补充溯源信息
        result.metadata.providerId = config.providerId
        result.metadata.modelId = config.modelId
        result.metadata.configId = config.id
      }

      return result
    } catch (error) {
      // Preserve structured errors (code/params) thrown by service/adapters.
      // Only wrap truly unknown errors as GENERATION_FAILED.
      if (error instanceof BaseError) {
        throw error
      }
      if (isRecord(error) && typeof error.code === 'string') {
        throw error
      }
      // 注意：不要把底层 message 拼给用户，交给 UI 用 code+params 翻译。
      const details = error instanceof Error ? error.message : String(error)
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, details, { details })
    }
  }


  // 新增：连接测试（不要求配置已保存）
  async testConnection(config: ImageModelConfig): Promise<ImageResult> {
    // 构造一个最小的请求（根据模型能力选择文本或图像测试）
    const adapter = this.registry.getAdapter(config.providerId)
    const runtimeConfig = this.prepareRuntimeConfig(config)
    const caps = (config.model?.capabilities) || this.registry.getStaticModels(config.providerId).find(m => m.id === config.modelId)?.capabilities || { text2image: true }
    const testType: 'text2image' | 'image2image' = caps.text2image ? 'text2image' : 'image2image'
    const maybeTestRequestProvider = adapter as unknown as {
      getTestImageRequest?: (type: 'text2image' | 'image2image') => Partial<ImageRequest>
    }
    const baseReq = typeof maybeTestRequestProvider.getTestImageRequest === 'function'
      ? maybeTestRequestProvider.getTestImageRequest(testType)
      : { prompt: 'hello', count: 1 }

    const request: ImageRequest = {
      prompt: baseReq.prompt ?? 'hello',
      configId: config.id || 'test',
      count: baseReq.count ?? 1,
      inputImage: baseReq.inputImage,
      paramOverrides: baseReq.paramOverrides
    }

    // 强制：测试连接如果走 image2image，必须使用 base64 输入（不支持 url）
    if (testType === 'image2image') {
      const unsafeInputImage = (request as unknown as { inputImage?: unknown }).inputImage
      const unsafeB64 = isRecord(unsafeInputImage) ? unsafeInputImage.b64 : undefined
      const unsafeUrl = isRecord(unsafeInputImage) ? unsafeInputImage.url : undefined

      if (typeof unsafeB64 !== 'string' || !unsafeB64.trim()) {
        throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED)
      }
      if (typeof unsafeUrl === 'string' && unsafeUrl.trim()) {
        throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_URL_NOT_SUPPORTED)
      }
    }

    const runtimeRequest = this.prepareRuntimeRequest(request, runtimeConfig)
    // 直接调用适配器，绕过 imageModelManager 的存储查找
    return await adapter.generate(runtimeRequest, runtimeConfig)
  }

  // 新增：获取动态模型
  async getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    return await this.registry.getDynamicModels(providerId, connectionConfig)
  }

  private prepareRuntimeConfig(config: ImageModelConfig): ImageModelConfig {
    const schema = config.model?.parameterDefinitions ?? []

    // 合并参数：支持旧格式的 customParamOverrides（向后兼容）
    // 优先级：requestOverrides > customOverrides
    const mergedOverrides = mergeOverrides({
      schema,
      includeDefaults: false,
      customOverrides: config.customParamOverrides,  // 🔧 兼容旧格式：自定义参数
      requestOverrides: config.paramOverrides        // 当前参数（包含内置 + 可能已合并的自定义）
    })

    return {
      ...config,
      paramOverrides: mergedOverrides
    }
  }

  private prepareRuntimeRequest(request: ImageRequest, config: ImageModelConfig): ImageRequest {
    // 最终兜底：不允许把 url 输入图透传给适配器。
    const unsafeInputImage = (request as unknown as { inputImage?: unknown }).inputImage
    if (isRecord(unsafeInputImage) && typeof unsafeInputImage.url === 'string' && unsafeInputImage.url.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_URL_NOT_SUPPORTED)
    }

    const schema = config.model?.parameterDefinitions ?? []

    // 请求级别的参数覆盖，同样需要考虑旧格式
    const unsafeCustomOverrides = (request as unknown as { customParamOverrides?: unknown }).customParamOverrides
    const customOverrides = isRecord(unsafeCustomOverrides) ? unsafeCustomOverrides : undefined
    const sanitized = mergeOverrides({
      schema,
      includeDefaults: false,
      customOverrides, // 兼容旧字段（向后兼容）
      requestOverrides: request.paramOverrides
    })

    const normalizedOverrides =
      Object.keys(sanitized).length > 0 ? sanitized : undefined

    return {
      ...request,
      paramOverrides: normalizedOverrides
    }
  }
}

export const createImageService = (imageModelManager: IImageModelManager, registry?: IImageAdapterRegistry) => new ImageService(imageModelManager, registry)
