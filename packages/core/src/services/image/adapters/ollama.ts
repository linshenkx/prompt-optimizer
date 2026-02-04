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

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1'

export class OllamaImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }

  getProvider(): ImageProvider {
    return {
      id: 'ollama',
      name: 'Ollama',
      description: 'Local Ollama image generation (OpenAI-compatible API)',
      // Ollama can be configured with CORS/reverse-proxy; don't hard-mark it as browser-blocked.
      corsRestricted: false,
      requiresApiKey: false,
      defaultBaseURL: OLLAMA_DEFAULT_BASE_URL,
      supportsDynamicModels: true,
      connectionSchema: {
        required: [],
        optional: ['baseURL', 'apiKey'],
        fieldTypes: {
          baseURL: 'string',
          apiKey: 'string'
        }
      }
    }
  }

  getModels(): ImageModel[] {
    // No presets: Ollama models depend on what's installed locally.
    return []
  }

  public override buildDefaultModel(modelId: string): ImageModel {
    const provider = this.getProvider()
    const displayId = modelId || 'ollama'

    return {
      id: modelId,
      name: displayId,
      description: `Ollama model ${displayId}`,
      providerId: provider.id,
      // Ollama OpenAI-compat currently exposes /images/generations only.
      capabilities: {
        text2image: true,
        image2image: false,
        multiImage: false
      },
      parameterDefinitions: this.getParameterDefinitions(modelId),
      defaultParameterValues: this.getDefaultParameterValues(modelId)
    }
  }

  public async getModelsAsync(connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    // Enforce basic shape/type constraints when fields are provided.
    this.validateConnectionConfig(connectionConfig)

    const baseURL = typeof connectionConfig.baseURL === 'string' ? connectionConfig.baseURL : ''
    const normalizedBase = this.normalizeBaseUrl(baseURL.trim() ? baseURL : this.getProvider().defaultBaseURL)
    const url = `${normalizedBase}/models`

    const rawApiKey = typeof connectionConfig.apiKey === 'string' ? connectionConfig.apiKey : ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (rawApiKey.trim()) {
      headers.Authorization = `Bearer ${rawApiKey.trim()}`
    }

    try {
      const response = await fetch(url, { method: 'GET', headers })
      if (!response.ok) {
        return []
      }

      const data = await response.json()
      const models = Array.isArray(data?.data) ? data.data : []

      return models
        .map((model: any) => (typeof model?.id === 'string' ? model.id.trim() : ''))
        .filter((id: string) => !!id)
        .map((id: string) => this.buildDefaultModel(id))
        .sort((a: ImageModel, b: ImageModel) => a.id.localeCompare(b.id))
    } catch (error) {
      console.warn('[OllamaImageAdapter] Failed to fetch models:', error)
      return []
    }
  }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: 'a simple red flower',
        count: 1
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected getParameterDefinitions(_modelId: string): readonly ImageParameterDefinition[] {
    // Keep this minimal; Ollama's OpenAI-compatible image API is experimental.
    return [
      {
        name: 'size',
        labelKey: 'image.params.size.label',
        descriptionKey: 'image.params.size.description',
        type: 'string',
        defaultValue: '1024x1024',
        allowedValues: ['1024x1024', '1536x1024', '1024x1536', 'auto']
      }
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return { size: '1024x1024' }
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    // Ollama image API only supports text-to-image for now.
    if (request.inputImage) {
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2IMAGE, undefined, { modelName: config.modelId })
    }

    const merged: Record<string, any> = {
      ...config.paramOverrides,
      ...request.paramOverrides
    }

    const size = typeof merged.size === 'string' && merged.size.trim() ? merged.size : '1024x1024'

    const payload = {
      model: config.modelId,
      prompt: request.prompt,
      size,
      response_format: 'b64_json'
    }

    const url = this.resolveEndpointUrl(config, '/images/generations')
    const rawApiKey = typeof config.connectionConfig?.apiKey === 'string' ? config.connectionConfig.apiKey : ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (rawApiKey.trim()) {
      headers.Authorization = `Bearer ${rawApiKey.trim()}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      let errorMessage = `Ollama API error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (typeof errorData?.error?.message === 'string') {
          errorMessage = errorData.error.message
        }
      } catch {
        // ignore JSON parse errors
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, errorMessage)
    }

    const json = await response.json()
    return this.parseImageResponse(json, config)
  }

  private parseImageResponse(response: any, config: ImageModelConfig): ImageResult {
    if (!response?.data || !Array.isArray(response.data)) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

    const images = response.data.map((item: any) => {
      if (!item?.b64_json || typeof item.b64_json !== 'string') {
        throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
      }
      const dataUrl = `data:image/png;base64,${item.b64_json}`
      return {
        b64: item.b64_json,
        mimeType: 'image/png',
        url: dataUrl
      }
    })

    return {
      images,
      metadata: {
        providerId: 'ollama',
        modelId: config.modelId,
        configId: config.id
      }
    }
  }
}
