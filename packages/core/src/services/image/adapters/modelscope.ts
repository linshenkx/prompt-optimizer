import { AbstractImageProviderAdapter } from './abstract-adapter'
import { ImageError } from '../errors'
import type {
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  ImageParameterDefinition
} from '../types'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'

/**
 * ModelScope (魔搭) 图像生成适配器
 *
 * API 端点: https://api-inference.modelscope.cn/v1/images/generations
 * 免费额度: 每天 2000 次调用
 * 文档: https://modelscope.cn/docs/model-service/API-Inference/intro
 *
 * 支持的模型：
 * - Tongyi-MAI/Z-Image-Turbo: 6B 参数高效图像生成模型（已验证可用）
 * - 其他模型请访问 ModelScope 文档查看当前支持列表
 * - 可以通过 buildDefaultModel() 创建任意模型 ID 的配置进行测试
 *
 * 环境变量支持:
 * - MODELSCOPE_API_KEY: SDK Token (Docker 环境，无 VITE_ 前缀)
 * - VITE_MODELSCOPE_API_KEY: SDK Token (开发环境，Vite 构建)
 */
export class ModelScopeImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    // 确保 URL 以 /v1 结尾
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }

  getProvider(): ImageProvider {
    return {
      id: 'modelscope',
      name: 'ModelScope',
      description: 'ModelScope 魔搭社区图像生成服务，每天免费 2000 次调用',
      requiresApiKey: true,
      defaultBaseURL: 'https://api-inference.modelscope.cn/v1',
      supportsDynamicModels: false,
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

  getModels(): ImageModel[] {
    return [
      {
        id: 'Tongyi-MAI/Z-Image-Turbo',
        name: 'Z-Image-Turbo',
        description: 'Z-Image-Turbo 6B 参数高效图像生成模型，擅长人像生成和快速出图（10步以内）',
        providerId: 'modelscope',
        capabilities: {
          text2image: true,
          image2image: false,
          multiImage: false
        },
        parameterDefinitions: this.getDefaultParameterDefinitions(),
        defaultParameterValues: {
          size: '1024x1024',
          n: 1
        }
      }
    ]
  }

  private getDefaultParameterDefinitions(): ImageParameterDefinition[] {
    return [
      {
        name: 'size',
        labelKey: 'image.params.size.label',
        descriptionKey: 'image.params.size.description',
        type: 'string',
        defaultValue: '1024x1024',
        allowedValues: ['1024x1024', '1536x1024', '1024x1536']
      },
      {
        name: 'n',
        labelKey: 'image.params.count.label',
        descriptionKey: 'image.params.count.description',
        type: 'integer',
        defaultValue: 1,
        minValue: 1,
        maxValue: 4
      }
    ]
  }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: '一朵简单的红色花朵',
        count: 1
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected getParameterDefinitions(_modelId: string): readonly ImageParameterDefinition[] {
    return this.getDefaultParameterDefinitions()
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      size: '1024x1024',
      n: 1
    }
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    // ModelScope 适配器仅支持文生图
    if (request.inputImage) {
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2IMAGE, undefined, { modelName: config.modelId })
    }

    return await this.generateImage(request, config)
  }

  private async generateImage(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const url = this.resolveEndpointUrl(config, '/images/generations')

    const merged: Record<string, any> = {
      ...config.paramOverrides,
      ...request.paramOverrides
    }

    const payload = {
      model: config.modelId,
      prompt: request.prompt,
      size: merged.size || '1024x1024',
      n: merged.n || request.count || 1
    }

    // 提交异步任务
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Async-Mode': 'true' // 异步模式
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      let errorMessage = `ModelScope API error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.message || errorData.error?.message) {
          errorMessage = errorData.message || errorData.error.message
        }
      } catch {
        // 忽略 JSON 解析错误
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, errorMessage)
    }

    const submitData = await response.json()
    const taskId = submitData.task_id

    if (!taskId) {
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, 'No task_id received from ModelScope API')
    }

    // 轮询任务状态
    return await this.pollTaskResult(taskId, config, 120, 3000)
  }

  /**
   * 轮询任务结果
   */
  private async pollTaskResult(
    taskId: string,
    config: ImageModelConfig,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<ImageResult> {
    const taskUrl = this.resolveEndpointUrl(config, `/tasks/${taskId}`)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))

      const response = await fetch(taskUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
          'X-ModelScope-Task-Type': 'image_generation'
        }
      })

      if (!response.ok) {
        // 尝试解析错误响应体以提供更详细的错误信息
        let errorMessage = `${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message
          }
        } catch {
          // 如果无法解析 JSON，使用默认错误信息
        }
        throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Failed to poll task status: ${errorMessage}`)
      }

      const data = await response.json()
      const status = data.task_status

      if (status === 'SUCCEED') {
        // 任务成功，解析结果
        const outputImages = data.output_images || []
        if (outputImages.length === 0) {
          throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
        }

        const images = outputImages.map((imageUrl: string) => ({
          url: imageUrl,
          mimeType: 'image/png'
        }))

        return {
          images,
          metadata: {
            providerId: 'modelscope',
            modelId: config.modelId,
            configId: config.id,
            taskId
          }
        }
      } else if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED' || status === 'CANCELED') {
        // 任务失败或被取消，提取错误信息
        const errorMessage = data.error?.message || data.error || data.message || 'Unknown error'
        throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Task ${status.toLowerCase()}: ${errorMessage}`)
      } else if (status !== 'PENDING' && status !== 'RUNNING' && status !== 'PROCESSING') {
        // 未知的终态，视为失败
        throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Unknown task status: ${status}`)
      }
      // task_status 为 PENDING、RUNNING 或 PROCESSING，继续轮询
    }

    throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Task timeout after ${maxAttempts} attempts`)
  }

}
