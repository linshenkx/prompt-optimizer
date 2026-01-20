import type {
  IImageProviderAdapter,
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  ImageParameterDefinition
} from '../types'
import { ImageError } from '../errors'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'

/**
 * 抽象图像提供商适配器基类
 * 使用模板方法模式提供统一的验证和错误处理
 */
export abstract class AbstractImageProviderAdapter implements IImageProviderAdapter {
  // 预设测试图片 - 统一管理（64x64简单红色圆圈）
  protected static readonly TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAABGVJREFUeJztm01oXFUUx3/vzZtJMmnapPWjraZN/SCNrS200KKgIGhBXYhQcOHChYJbwY3gQnDhwoWgi4ILQRFciCCCC1sQwYKLii1YC1ppbWsb29Sm+Zg0mWTevHfvcefOm8nMm5lk3ryZvPwgvHvfO+fcO//cc8+79wZCQkJCQkJCQrZJAC5wC3gd+B54HfgCuO7ad4C/KsuLtR3E6gFvAH1AAiwDPwBLwBzwmXveaH4H8ASwF7yfawNYBL4Cfq7VPrMF3AVcB/qATdJ6x8CXwNEa+x6qY8BDwG/AADAKzAJZYMLN7zMfnCYA4G3gJDAJzAO9wPfAEPCKG7vE6sYAfAK8BOwDFoC7gVHgWWARsL0VX6wGYANYBnYCu4BjQMIVKyfdcxH4FrgJfOiOHnAM+BWwgZNAGhjw4rZZM4BF4BzwJ3DCjUWkqaXABeAi8CKQAl4DFoATwB1uxd8wCxQZ0XPBYuAJoO3DfOOZjhvAOeB5V6SdABYZWKkNwAbwDLAKnDZP7Qa+Av4Gzo/xH7IbuOJe+yTwByvBr+3VwxrrQKvkL+Bf4LE2VsU8cBGYIIKfuxRFJiYJAL9nE8zf/M2zW/Ll7zqgBBxoY1XMAmNE8HOXothNJiYJAL9hE9wdGF4IcVlmNPqfk4QsXFkCQu3fBrAjQNVsChFJ6CeS4CaZJqAnQNVsChFZeECCm0y9N0AAGElwk1lTSewNUDWbQkQS3GQaeIsAngBUsyn0E0lwk1lN6NeB3jZWxZOElIQHUC8J/UQS3GRqQh8E2hnfVBL7Atb9phGRhAckuMnUhD4A/N3GqlCShJ5NMMGJJLjJ1AT3AXOEVJS7Qcrb2zhGJMFNpiZ0P/APcG+AqtkUIpLgJlMT2gfs3SaP5N8EEnwP8Kf7gGFgO8x0xyUhK+Dre4K6o82g0o4h2zDTbVpHyMrLanxT9AV9a9VpQWgJV1HKBq4CqeKG6KbL9bbN3OVqw7q1W8gMlLOHh40TzE0hKwqjbO6qFJO5sn+OE9u0JnQGJiXJ1mKdR/gSF5Z9E0ywFaHbXGDEg4j8WjSC7hJyIcmP0SjMCWElwW0MEUH0s4k4zWuIyGKFmGDl5aBGdI/9/8mABDeZmtB7gV4iekKT2BNwD7DfYx4+W5JZd1fI0xDKq+qJakTi0xRzMKTGsR7eI+J9gptMTWg/+Ku6tSXhEt7hCTfgJXjX6wa8hBfwxVPgaLW8hNeUbDK7hVxuLcLVF0zSh3R+Q/hsKIr2+zZLT8jnJOQ7wn5H2O8I+x1hvyPsd4T9jrDfEfY7wn5H2O8I+x1hvyPsd4T9jrDfEfY7wn5H2O8I+x1hfZKwvyVd10ukBOvMNeAj4B9gAnh3+wfbEy9TZx+c7R+Ay3Q2v1ek3gJOufblO7/YnphrCfn8Yr0F7HOfgG35j5tOpK4+GWfA6y4y5ePa8t0v4wyY8pq/Am9tQ10hISEhISEhIaFo/gOE5C7Cek1g0wAAAABJRU5ErkJggg=="

  // 子类必须实现的抽象方法
  public abstract getProvider(): ImageProvider
  public abstract getModels(): ImageModel[]
  protected abstract doGenerate(
    request: ImageRequest,
    config: ImageModelConfig
  ): Promise<ImageResult>

  // 子类必须实现的测试请求构建方法
  protected abstract getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'>

  // 新增的抽象方法：用于构建默认模型对象
  protected abstract getParameterDefinitions(modelId: string): readonly ImageParameterDefinition[]
  protected abstract getDefaultParameterValues(modelId: string): Record<string, unknown>

  // 构建默认模型对象（支持任意模型ID）
  public buildDefaultModel(modelId: string): ImageModel {
    const provider = this.getProvider()

    return {
      id: modelId,
      name: modelId, // 默认使用ID作为名称
      description: `Custom model ${modelId} for ${provider.name}`,
      providerId: provider.id,
      capabilities: {
        text2image: true,
        image2image: true,
        multiImage: true // 默认拥有所有能力
      },
      parameterDefinitions: this.getParameterDefinitions(modelId),
      defaultParameterValues: this.getDefaultParameterValues(modelId)
    }
  }

  // 模板方法：统一的生成流程
  public async generate(
    request: ImageRequest,
    config: ImageModelConfig
  ): Promise<ImageResult> {
    // 1. 验证请求合法性
    this.validateRequest(request, config)

    // 2. 验证配置合法性
    this.validateConfig(config)

    // 3. 调用具体实现（让具体适配器处理模型相关逻辑）
    return await this.doGenerate(request, config)
  }

  // ===== 统一的 URL 解析与代理封装 =====

  // 规范化基础 URL（按提供商约定修正路径后缀）
  protected normalizeBaseUrl(base: string): string {
    // 默认空实现：不做提供商特定规范化，保留调用方传入
    return base
  }

  // 仅返回"基础地址"的最终结果（考虑代理）；用于 SDK 型（如 Gemini）
  protected resolveBaseUrl(config: ImageModelConfig, _isStream: boolean = false): string {
    const rawBase = (config.connectionConfig?.baseURL || this.getProvider().defaultBaseURL || '').trim()
    if (!rawBase) return ''
    const normalizedBase = this.normalizeBaseUrl(rawBase)
    if (!normalizedBase) return ''

    return normalizedBase
  }

  // 返回"完整目标 URL"的最终结果；用于手写 fetch 型适配器
  protected resolveEndpointUrl(
    config: ImageModelConfig,
    endpoint: string,
    _isStream: boolean = false
  ): string {
    const base = this.normalizeBaseUrl((config.connectionConfig?.baseURL || this.getProvider().defaultBaseURL || '').trim())
    const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const full = `${base}${ep}`

    return full
  }

  // 辅助方法：根据modelId获取模型信息
  protected getModelById(modelId: string): ImageModel | undefined {
    return this.getModels().find(model => model.id === modelId)
  }

  // 默认的动态模型获取实现（不支持动态获取的适配器可以使用）
  public async getModelsAsync(_connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    const provider = this.getProvider()
    if (!provider.supportsDynamicModels) {
      throw new ImageError(IMAGE_ERROR_CODES.DYNAMIC_MODELS_NOT_SUPPORTED, undefined, { providerName: provider.name })
    }
    // 子类应该覆盖此方法
    return this.getModels()
  }

  // 默认验证实现（子类可覆盖）
  protected validateRequest(request: ImageRequest, config: ImageModelConfig): void {
    // 基础验证：检查必需字段
    if (!request.prompt || !request.prompt.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.PROMPT_EMPTY)
    }

    if (!config.modelId) {
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_ID_REQUIRED)
    }

    // 对于具体模型能力的验证，交给具体的适配器实现
  }

  protected validateConfig(config: ImageModelConfig): void {
    const provider = this.getProvider()

    if (provider.requiresApiKey && !config.connectionConfig?.apiKey) {
      throw new ImageError(IMAGE_ERROR_CODES.API_KEY_REQUIRED, undefined, { providerName: provider.name })
    }

    if (config.providerId !== provider.id) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_PROVIDER_MISMATCH, undefined, {
        configProviderId: config.providerId,
        adapterProviderId: provider.id
      })
    }
  }

  // 辅助方法：验证连接配置结构
  protected validateConnectionConfig(connectionConfig: Record<string, any>): void {
    const provider = this.getProvider()
    const schema = provider.connectionSchema

    if (!schema) return

    // 验证必需字段
    for (const field of schema.required) {
      if (!(field in connectionConfig)) {
        throw new ImageError(IMAGE_ERROR_CODES.CONNECTION_CONFIG_MISSING_FIELD, undefined, { field })
      }
    }

    // 验证字段类型
    for (const [field, expectedType] of Object.entries(schema.fieldTypes)) {
      if (field in connectionConfig) {
        const actualType = typeof connectionConfig[field]
        if (actualType !== expectedType) {
          throw new ImageError(IMAGE_ERROR_CODES.CONNECTION_CONFIG_INVALID_FIELD_TYPE, undefined, {
            field,
            expectedType,
            actualType
          })
        }
      }
    }
  }
}
