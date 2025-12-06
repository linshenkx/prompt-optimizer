import { GoogleGenAI } from '@google/genai'
import { AbstractImageProviderAdapter } from './abstract-adapter'
import type {
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig
} from '../types'

export class GeminiImageAdapter extends AbstractImageProviderAdapter {
  getProvider(): ImageProvider {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Gemini 图像生成服务',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
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
        id: 'gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image',
        description: 'Google Gemini 2.5 Flash 图像生成模型（Nano Banana），支持文生图、图生图和多图输入',
        providerId: 'gemini',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [],  // Gemini 不需要用户配置参数
        defaultParameterValues: {
          outputMimeType: 'image/png'
        }
      },
      {
        id: 'gemini-3-pro-image-preview',
        name: 'Gemini 3 Pro Image',
        description: 'Google Gemini 3 Pro 高级图像生成模型（Nano Banana Pro），支持高分辨率输出和高级文本渲染',
        providerId: 'gemini',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [],
        defaultParameterValues: {
          outputMimeType: 'image/png'
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

  protected getParameterDefinitions(_modelId: string): readonly any[] {
    // 基础参数定义（如果需要的话）
    return []
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      outputMimeType: 'image/png'
    }
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const rawBaseUrl = config.connectionConfig?.baseURL?.trim() || ''
    const normalizedBaseUrl = rawBaseUrl ? this.normalizeBaseUrl(rawBaseUrl) : ''

    const genAI = normalizedBaseUrl
      ? new GoogleGenAI({
          apiKey: config.connectionConfig?.apiKey,
          httpOptions: {
            baseUrl: normalizedBaseUrl
          }
        })
      : new GoogleGenAI({ apiKey: config.connectionConfig?.apiKey })

    // 构建请求内容
    let contents: any
    if (request.inputImage) {
      // 图生图：使用数组格式
      contents = [
        { text: request.prompt },
        {
          inlineData: {
            mimeType: request.inputImage.mimeType || 'image/png',
            data: request.inputImage.b64
          }
        }
      ]
    } else {
      // 文生图：直接使用文本
      contents = request.prompt
    }

    try {
      // 调用 Gemini API
      const response = await genAI.models.generateContent({
        model: config.modelId,
        contents
      })

      // 解析响应
      const candidate = response.candidates?.[0]
      if (!candidate) {
        throw new Error('No response candidate received from Gemini')
      }

      const parts = candidate.content?.parts || []
      const resultImages: any[] = []
      let responseText: string | undefined

      // 处理响应部分
      for (const part of parts) {
        if (part.text) {
          responseText = part.text
        } else if (part.inlineData) {
          const imageData = part.inlineData.data
          const mimeType = part.inlineData.mimeType || 'image/png'

          // 构建 data URL
          const dataUrl = `data:${mimeType};base64,${imageData}`

          resultImages.push({
            b64: imageData,
            mimeType,
            url: dataUrl
          })
        }
      }

      if (resultImages.length === 0) {
        throw new Error('No image data received from Gemini')
      }

      return {
        images: resultImages,
        text: responseText,
        metadata: {
          providerId: 'gemini',
          modelId: config.modelId,
          configId: config.id,
          finishReason: candidate.finishReason,
          usage: response.usageMetadata
        }
      }
    } catch (error) {
      // 直接穿透错误，保持与其他适配器一致的错误处理
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`)
      }
      throw new Error(`Gemini API error: ${String(error)}`)
    }
  }
}
