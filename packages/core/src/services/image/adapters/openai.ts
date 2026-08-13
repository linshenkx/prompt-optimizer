import { AbstractImageProviderAdapter } from './abstract-adapter'
import type {
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  ImageParameterDefinition
} from '../types'
import { ImageError } from '../errors'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'

const GPT_IMAGE_2_SIZE_VALUES = [
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '2048x2048',
  '2048x1152',
  '3840x2160',
  '2160x3840',
  'auto'
] as const

const GPT_IMAGE_2_BACKGROUND_VALUES = ['auto', 'opaque'] as const

export class OpenAIImageAdapter extends AbstractImageProviderAdapter {
  private static readonly FORCED_SINGLE_OUTPUT_PARAM_KEYS = ['n', 'batch_size', 'outputMimeType', 'response_format']

  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }
  getProvider(): ImageProvider {
    return {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT Image generation service',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.openai.com/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://platform.openai.com/api-keys',
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
        id: 'gpt-image-2',
        name: 'GPT Image 2',
        description: 'OpenAI GPT Image 2 image generation model with text-to-image and image editing support',
        providerId: 'openai',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [
          {
            name: 'size',
            labelKey: 'image.params.size.label',
            descriptionKey: 'image.params.size.description',
            type: 'string',
            defaultValue: '1024x1024',
            allowedValues: [...GPT_IMAGE_2_SIZE_VALUES]
          },
          {
            name: 'quality',
            labelKey: 'image.params.quality.label',
            descriptionKey: 'image.params.quality.description',
            type: 'string',
            defaultValue: 'auto',
            allowedValues: ['auto', 'high', 'medium', 'low']
          },
          {
            name: 'background',
            labelKey: 'image.params.background.label',
            descriptionKey: 'image.params.background.description',
            type: 'string',
            defaultValue: 'auto',
            allowedValues: [...GPT_IMAGE_2_BACKGROUND_VALUES]
          }
        ],
        defaultParameterValues: {
          size: '1024x1024',
          quality: 'auto',
          background: 'auto'
        }
      }
    ]
  }

  public async getModelsAsync(connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    const baseURL = connectionConfig?.baseURL || this.getProvider().defaultBaseURL
    const url = `${this.normalizeBaseUrl(baseURL)}/models`
    const apiKey = connectionConfig?.apiKey

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        }
      })

      if (!response.ok) {
        console.warn(`OpenAI models API error: ${response.status}`)
        return this.getModels()
      }

      const data = await response.json()
      const rawModels = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : []

      const models = rawModels
        .map((model: any) => this.toDynamicModel(model))
        .filter((model: ImageModel | null): model is ImageModel => !!model)
        .sort((a: ImageModel, b: ImageModel) => Number(this.isImageModelHint(b)) - Number(this.isImageModelHint(a)))

      return models.length > 0 ? models : this.getModels()
    } catch (error) {
      console.warn('Failed to fetch OpenAI models:', error)
      return this.getModels()
    }
  }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: 'a simple red flower',
        count: 1
      }
    }

    if (testType === 'image2image') {
      return {
        prompt: 'make this image more colorful',
        inputImage: {
          b64: AbstractImageProviderAdapter.TEST_IMAGE_BASE64.split(',')[1], // 去除data URL前缀
          mimeType: 'image/png'
        },
        count: 1
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected getParameterDefinitions(_modelId: string): readonly ImageParameterDefinition[] {
    // GPT Image 2 使用统一的参数定义，n参数固定为1不暴露给用户
    return [
      {
        name: 'size',
        labelKey: 'image.params.size.label',
        descriptionKey: 'image.params.size.description',
        type: 'string',
        defaultValue: '1024x1024',
        allowedValues: [...GPT_IMAGE_2_SIZE_VALUES]
      },
      {
        name: 'quality',
        labelKey: 'image.params.quality.label',
        descriptionKey: 'image.params.quality.description',
        type: 'string',
        defaultValue: 'auto',
        allowedValues: ['auto', 'high', 'medium', 'low']
      },
      {
        name: 'background',
        labelKey: 'image.params.background.label',
        descriptionKey: 'image.params.background.description',
        type: 'string',
        defaultValue: 'auto',
        allowedValues: [...GPT_IMAGE_2_BACKGROUND_VALUES]
      }
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      size: '1024x1024',
      quality: 'auto',
      background: 'auto'
    }
  }

  private toDynamicModel(model: any): ImageModel | null {
    const id = typeof model === 'string' ? model : model?.id
    if (!id || typeof id !== 'string') {
      return null
    }

    const name = typeof model?.name === 'string' ? model.name : id
    const description = typeof model?.description === 'string'
      ? model.description
      : `${name} model`

    return {
      id,
      name,
      description,
      providerId: 'openai',
      capabilities: {
        text2image: true,
        image2image: true,
        multiImage: true
      },
      parameterDefinitions: this.getParameterDefinitions(id),
      defaultParameterValues: this.getDefaultParameterValues(id)
    }
  }

  private isImageModelHint(model: ImageModel): boolean {
    const text = `${model.id} ${model.name} ${model.description || ''}`.toLowerCase()
    return text.includes('image')
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const inputImages = this.getEditInputImages(request)

    if (inputImages.length > 0) {
      // 图像编辑模式：使用 /images/edits 端点
      return await this.generateImageEdit(request, config, inputImages)
    } else {
      // 文生图模式：使用 /images/generations 端点
      return await this.generateImage(request, config)
    }
  }

  private async generateImage(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const merged: Record<string, any> = {
      model: config.modelId,
      prompt: request.prompt,
      output_format: 'png', // 固定为png
      stream: false,
      // 合并参数覆盖（先合并，后强制覆盖）
      ...this.getOpenAIParamOverrides(request, config)
    }
    const payload = { ...merged, n: 1 }

    const response = await this.apiCall(config, '/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    return this.parseImageResponse(response, config)
  }

  private async generateImageEdit(
    request: ImageRequest,
    config: ImageModelConfig,
    inputImages: NonNullable<ImageRequest['inputImages']>
  ): Promise<ImageResult> {
    if (inputImages.length === 0) {
      throw new ImageError(IMAGE_ERROR_CODES.IMAGE2IMAGE_INPUT_IMAGE_REQUIRED)
    }

    // 创建FormData
    const formData = new FormData()
    formData.append('model', config.modelId)
    formData.append('prompt', request.prompt)
    formData.append('output_format', 'png') // 固定为png

    // 添加参数覆盖（隐藏结果数量与 UI 内部参数）
    const allParams = this.getOpenAIParamOverrides(request, config)
    for (const [key, value] of Object.entries(allParams)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    }

    // 固定生成一张结果图
    formData.append('n', '1')

    const imageFieldName = inputImages.length > 1 ? 'image[]' : 'image'
    inputImages.forEach((inputImage, index) => {
      const mimeType = inputImage.mimeType || 'image/png'
      const imageBlob = this.base64ToBlob(inputImage.b64 || '', mimeType)
      formData.append(imageFieldName, imageBlob, `input-${index + 1}.${this.getFileExtension(mimeType)}`)
    })

    const response = await this.apiCall(config, '/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`
        // 不设置Content-Type，让浏览器自动设置multipart/form-data边界
      },
      body: formData
    })

    return this.parseImageResponse(response, config)
  }

  private getEditInputImages(request: ImageRequest): NonNullable<ImageRequest['inputImages']> {
    if (Array.isArray(request.inputImages) && request.inputImages.length > 0) {
      return request.inputImages
    }

    return request.inputImage ? [request.inputImage] : []
  }

  private getOpenAIParamOverrides(
    request: ImageRequest,
    config: ImageModelConfig
  ): Record<string, any> {
    const params: Record<string, any> = { ...config.paramOverrides, ...request.paramOverrides }
    for (const key of OpenAIImageAdapter.FORCED_SINGLE_OUTPUT_PARAM_KEYS) {
      delete params[key]
    }
    return params
  }

  private getFileExtension(mimeType: string): string {
    const normalized = mimeType.toLowerCase()
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
    if (normalized.includes('webp')) return 'webp'
    return 'png'
  }

  private parseImageResponse(response: any, config: ImageModelConfig): ImageResult {
    if (!response.data || !Array.isArray(response.data)) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

    const images = response.data.map((item: any) => {
      if (item.b64_json) {
        // GPT Image 系列默认返回 base64；无需发送已废弃的 response_format 参数。
        const dataUrl = `data:image/png;base64,${item.b64_json}`

        return {
          b64: item.b64_json,
          mimeType: 'image/png',
          url: dataUrl
        }
      }

      if (item.url) {
        return {
          url: item.url,
          mimeType: 'image/png'
        }
      }

        throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    })

    return {
      images,
      text: response.data[0]?.revised_prompt, // GPT Image 可能提供修订后的提示词
      metadata: {
        providerId: 'openai',
        modelId: config.modelId,
        configId: config.id,
        usage: response.usage
      }
    }
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    // 移除data URL前缀（如果存在）
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64
    // 兼容浏览器与 Node/Electron：优先使用 atob；否则使用 Node 的 Buffer
    if (typeof atob === 'function') {
      const bin = atob(cleanBase64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return new Blob([arr], { type: mimeType })
    } else if (typeof (globalThis as any).Buffer !== 'undefined') {
      const buf = (globalThis as any).Buffer.from(cleanBase64, 'base64')
      // 创建新的 Uint8Array 并复制数据，确保使用普通 ArrayBuffer
      const arr = new Uint8Array(buf.length)
      for (let i = 0; i < buf.length; i++) {
        arr[i] = buf[i]
      }
      return new Blob([arr], { type: mimeType })
    } else {
      throw new ImageError(IMAGE_ERROR_CODES.BASE64_DECODING_NOT_SUPPORTED)
    }
  }

  private async apiCall(config: ImageModelConfig, endpoint: string, options: any) {
    const url = this.resolveEndpointUrl(config, endpoint)
    const response = await fetch(url, options)

    if (!response.ok) {
      // 直接穿透错误，保持与其他适配器一致
      let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // 忽略JSON解析错误，使用默认错误消息
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, errorMessage)
    }

    return await response.json()
  }
}
