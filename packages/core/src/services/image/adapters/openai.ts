import { AbstractImageProviderAdapter } from './abstract-adapter'
import type {
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  ImageParameterDefinition
} from '../types'

export class OpenAIImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }
  getProvider(): ImageProvider {
    return {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT Image 图像生成服务',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.openai.com/v1',
      supportsDynamicModels: false,
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
        id: 'gpt-image-1',
        name: 'GPT Image 1',
        description: 'OpenAI GPT Image 1 多功能图像生成模型，支持文生图和图像编辑',
        providerId: 'openai',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: false
        },
        parameterDefinitions: [
          {
            name: 'size',
            labelKey: 'image.params.size.label',
            descriptionKey: 'image.params.size.description',
            type: 'string',
            defaultValue: '1024x1024',
            allowedValues: ['1024x1024', '1536x1024', '1024x1536', 'auto']
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
            allowedValues: ['auto', 'transparent', 'opaque']
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

    throw new Error(`Unsupported test type: ${testType}`)
  }

  protected getParameterDefinitions(_modelId: string): readonly ImageParameterDefinition[] {
    // GPT Image 1 使用统一的参数定义，n参数固定为1不暴露给用户
    return [
      {
        name: 'size',
        labelKey: 'image.params.size.label',
        descriptionKey: 'image.params.size.description',
        type: 'string',
        defaultValue: '1024x1024',
        allowedValues: ['1024x1024', '1536x1024', '1024x1536', 'auto']
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
        allowedValues: ['auto', 'transparent', 'opaque']
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

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const hasInputImage = !!request.inputImage

    if (hasInputImage) {
      // 图像编辑模式：使用 /images/edits 端点
      return await this.generateImageEdit(request, config)
    } else {
      // 文生图模式：使用 /images/generations 端点
      return await this.generateImage(request, config)
    }
  }

  private async generateImage(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const merged: Record<string, any> = {
      model: config.modelId,
      prompt: request.prompt,
      response_format: 'b64_json',
      output_format: 'png', // 固定为png
      stream: false,
      // 合并参数覆盖（先合并，后强制覆盖）
      ...config.paramOverrides,
      ...request.paramOverrides
    }
    // 隐藏并固定多图相关参数
    delete (merged as any).n
    delete (merged as any).batch_size
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

  private async generateImageEdit(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    if (!request.inputImage) {
      throw new Error('Input image is required for image editing')
    }

    // 创建FormData
    const formData = new FormData()
    formData.append('model', config.modelId)
    formData.append('prompt', request.prompt)
    formData.append('response_format', 'b64_json')
    formData.append('output_format', 'png') // 固定为png

    // 添加参数覆盖（隐藏多图相关参数）
    const allParams: Record<string, any> = { ...config.paramOverrides, ...request.paramOverrides }
    delete allParams.n
    delete allParams.batch_size
    for (const [key, value] of Object.entries(allParams)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    }

    // 固定单图
    formData.append('n', '1')

    // 转换base64图像为Blob
    const imageBlob = this.base64ToBlob(
      request.inputImage.b64 || '',
      request.inputImage.mimeType || 'image/png'
    )
    formData.append('image', imageBlob, 'input.png')

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

  private parseImageResponse(response: any, config: ImageModelConfig): ImageResult {
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response format from OpenAI API')
    }

    const images = response.data.map((item: any) => {
      if (!item.b64_json) {
        throw new Error('No base64 image data received from OpenAI API')
      }

      // 构建 data URL
      const dataUrl = `data:image/png;base64,${item.b64_json}`

      return {
        b64: item.b64_json,
        mimeType: 'image/png',
        url: dataUrl
      }
    })

    return {
      images,
      text: response.data[0]?.revised_prompt, // GPT Image 可能提供修订后的提示词
      metadata: {
        providerId: 'openai',
        modelId: config.modelId,
        configId: config.id,
        usage: response.usage,
        created: response.created
      }
    }
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    // 移除data URL前缀（如果存在）
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64
    // 兼容浏览器与 Node/Electron：优先使用 atob；否则使用 Node 的 Buffer
    let bytes: Uint8Array
    if (typeof atob === 'function') {
      const bin = atob(cleanBase64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      bytes = arr
    } else if (typeof (globalThis as any).Buffer !== 'undefined') {
      const buf = (globalThis as any).Buffer.from(cleanBase64, 'base64')
      bytes = new Uint8Array(buf)
    } else {
      throw new Error('Base64 decoding is not supported in this environment')
    }
    // 使用 Uint8Array 直接创建 Blob，避免 SharedArrayBuffer 类型问题
    return new Blob([new Uint8Array(bytes)], { type: mimeType })
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
      throw new Error(errorMessage)
    }

    return await response.json()
  }
}
