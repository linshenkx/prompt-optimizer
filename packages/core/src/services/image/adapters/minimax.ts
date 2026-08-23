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

const MINIMAX_MODELS = ['image-01', 'image-01-live'] as const
const ASPECT_RATIOS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'] as const

/** MiniMax image generation adapter for both text-to-image and subject references. */
export class MinimaxImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }

  getProvider(): ImageProvider {
    return {
      id: 'minimax',
      name: 'MiniMax',
      description: 'MiniMax image generation and subject-reference editing',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.minimax.io/v1',
      supportsDynamicModels: false,
      apiKeyUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: { apiKey: 'string', baseURL: 'string' }
      }
    }
  }

  getModels(): ImageModel[] {
    return MINIMAX_MODELS.map((id) => ({
      id,
      name: `MiniMax ${id}`,
      description: 'MiniMax image generation model with subject-reference input',
      providerId: 'minimax',
      capabilities: { text2image: true, image2image: true, multiImage: false },
      parameterDefinitions: this.getParameterDefinitions(id),
      defaultParameterValues: this.getDefaultParameterValues(id)
    }))
  }

  protected getParameterDefinitions(_modelId: string): readonly ImageParameterDefinition[] {
    return [
      {
        name: 'aspect_ratio',
        labelKey: 'image.params.aspectRatio.label',
        descriptionKey: 'image.params.aspectRatio.description',
        type: 'string',
        defaultValue: '1:1',
        allowedValues: [...ASPECT_RATIOS]
      },
      {
        name: 'response_format',
        labelKey: 'image.params.responseFormat.label',
        descriptionKey: 'image.params.responseFormat.description',
        type: 'string',
        defaultValue: 'base64',
        allowedValues: ['url', 'base64']
      },
      {
        name: 'prompt_optimizer',
        labelKey: 'image.params.promptOptimizer.label',
        descriptionKey: 'image.params.promptOptimizer.description',
        type: 'boolean',
        defaultValue: false
      }
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return { aspect_ratio: '1:1', response_format: 'base64', prompt_optimizer: false }
  }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') return { prompt: 'a simple red flower', count: 1 }
    return {
      prompt: 'a portrait with a warm studio background',
      count: 1,
      inputImage: {
        b64: AbstractImageProviderAdapter.TEST_IMAGE_BASE64.split(',')[1],
        mimeType: 'image/png'
      }
    }
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const overrides: Record<string, unknown> = {
      ...config.paramOverrides,
      ...request.paramOverrides
    }
    const inputImages = Array.isArray(request.inputImages) && request.inputImages.length > 0
      ? request.inputImages
      : request.inputImage ? [request.inputImage] : []
    const payload: Record<string, unknown> = {
      model: config.modelId,
      prompt: request.prompt,
      n: 1,
      response_format: 'base64',
      ...overrides
    }
    delete payload.n
    payload.n = 1
    if (inputImages.length > 0) {
      payload.subject_reference = inputImages.map((image) => ({
        type: 'character',
        image_file: `data:${image.mimeType || 'image/png'};base64,${image.b64}`
      }))
    }

    const response = await this.apiCall(config, '/image_generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    const data = response?.data
    const images = Array.isArray(data?.image_base64)
      ? data.image_base64.map((b64: unknown) => ({ b64, mimeType: 'image/png' }))
      : Array.isArray(data?.image_urls)
        ? data.image_urls.map((url: unknown) => ({ url, mimeType: 'image/png' }))
        : []
    if (images.length === 0) throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    return {
      images,
      metadata: { providerId: 'minimax', modelId: config.modelId, configId: config.id, usage: response?.metadata }
    }
  }

  private async apiCall(config: ImageModelConfig, endpoint: string, options: RequestInit): Promise<any> {
    const response = await fetch(this.resolveEndpointUrl(config, endpoint), options)
    if (!response.ok) {
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `MiniMax API error: ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    const statusCode = data?.base_resp?.status_code
    if (typeof statusCode === 'number' && statusCode !== 0) {
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `MiniMax API error: ${statusCode} ${data?.base_resp?.status_msg || 'unknown error'}`)
    }
    return data
  }
}
