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

const SEEDREAM_40_MODEL_ID = 'doubao-seedream-4-0-250828'
const SEEDREAM_45_MODEL_ID = 'doubao-seedream-4-5-251128'
const SEEDREAM_50_LITE_MODEL_ID = 'doubao-seedream-5-0-lite-260128'

const SEEDREAM_40_SIZE_VALUES = ['1K', '2K', '4K', '1024x1024', '512x512', '768x768', '1024x768', '768x1024'] as const
const SEEDREAM_45_SIZE_VALUES = ['2K', '4K', '2048x2048'] as const
const SEEDREAM_50_LITE_SIZE_VALUES = ['2K', '4K', '2048x2048'] as const

type SeedreamModelSpec = {
  id: string
  name: string
  description: string
  capabilities: ImageModel['capabilities']
  parameterDefinitions: readonly ImageParameterDefinition[]
  defaultParameterValues: Record<string, unknown>
}

const SEEDREAM_MODEL_SPECS: readonly SeedreamModelSpec[] = [
  {
    id: SEEDREAM_40_MODEL_ID,
    name: 'Doubao Seedream 4.0',
    description: 'Doubao Seedream 4.0 high-quality image generation model',
    capabilities: {
      text2image: true,
      image2image: true,
      multiImage: true
    },
    parameterDefinitions: [
      {
        name: 'size',
        labelKey: 'params.size.label',
        descriptionKey: 'params.size.description',
        type: 'string',
        defaultValue: '2K',
        allowedValues: [...SEEDREAM_40_SIZE_VALUES]
      },
      {
        name: 'sequential_image_generation',
        labelKey: 'params.sequentialGeneration.label',
        descriptionKey: 'params.sequentialGeneration.description',
        type: 'string',
        defaultValue: 'disabled',
        allowedValues: ['disabled']
      },
      {
        name: 'response_format',
        labelKey: 'params.responseFormat.label',
        descriptionKey: 'params.responseFormat.description',
        type: 'string',
        defaultValue: 'b64_json',
        allowedValues: ['b64_json', 'url']
      },
      {
        name: 'watermark',
        labelKey: 'params.watermark.label',
        descriptionKey: 'params.watermark.description',
        type: 'boolean',
        defaultValue: false
      }
    ],
    defaultParameterValues: {
      size: '2K',
      sequential_image_generation: 'disabled',
      response_format: 'b64_json',
      watermark: false
    }
  },
  {
    id: SEEDREAM_45_MODEL_ID,
    name: 'Doubao Seedream 4.5',
    description: 'Doubao Seedream 4.5 high-quality image generation model',
    capabilities: {
      text2image: true,
      image2image: true,
      multiImage: true
    },
    parameterDefinitions: [
      {
        name: 'size',
        labelKey: 'params.size.label',
        descriptionKey: 'params.size.description',
        type: 'string',
        defaultValue: '2048x2048',
        allowedValues: [...SEEDREAM_45_SIZE_VALUES]
      },
      {
        name: 'sequential_image_generation',
        labelKey: 'params.sequentialGeneration.label',
        descriptionKey: 'params.sequentialGeneration.description',
        type: 'string',
        defaultValue: 'disabled',
        allowedValues: ['disabled']
      },
      {
        name: 'response_format',
        labelKey: 'params.responseFormat.label',
        descriptionKey: 'params.responseFormat.description',
        type: 'string',
        defaultValue: 'b64_json',
        allowedValues: ['b64_json', 'url']
      },
      {
        name: 'watermark',
        labelKey: 'params.watermark.label',
        descriptionKey: 'params.watermark.description',
        type: 'boolean',
        defaultValue: false
      }
    ],
    defaultParameterValues: {
      size: '2048x2048',
      sequential_image_generation: 'disabled',
      response_format: 'b64_json',
      watermark: false
    }
  },
  {
    id: SEEDREAM_50_LITE_MODEL_ID,
    name: 'Doubao Seedream 5.0 Lite',
    description: 'Doubao Seedream 5.0 Lite high-quality image generation model',
    capabilities: {
      text2image: true,
      image2image: true,
      multiImage: false
    },
    parameterDefinitions: [
      {
        name: 'size',
        labelKey: 'params.size.label',
        descriptionKey: 'params.size.description',
        type: 'string',
        defaultValue: '2048x2048',
        allowedValues: [...SEEDREAM_50_LITE_SIZE_VALUES]
      },
      {
        name: 'output_format',
        labelKey: 'params.outputFormat.label',
        descriptionKey: 'params.outputFormat.description',
        type: 'string',
        defaultValue: 'png',
        allowedValues: ['png', 'jpeg', 'webp']
      },
      {
        name: 'tools',
        labelKey: 'params.tools.label',
        descriptionKey: 'params.tools.description',
        type: 'string',
        defaultValue: [],
        tags: ['string-array']
      }
    ],
    defaultParameterValues: {
      size: '2048x2048',
      output_format: 'png',
      tools: []
    }
  }
] as const

export class SeedreamImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    if (/\/api\/v3$/.test(trimmed)) return trimmed
    if (/\/api$/.test(trimmed)) return `${trimmed}/v3`
    return `${trimmed}/api/v3`
  }
  getProvider(): ImageProvider {
    return {
      id: 'seedream',
      name: 'Seedream',
      description: 'Seedream image generation models',
      requiresApiKey: true,
      defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      supportsDynamicModels: false,  // 不支持动态获取
      apiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
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
    return SEEDREAM_MODEL_SPECS.map((spec) => ({
      id: spec.id,
      name: spec.name,
      description: spec.description,
      providerId: 'seedream',
      capabilities: { ...spec.capabilities },
      parameterDefinitions: this.getParameterDefinitions(spec.id),
      defaultParameterValues: this.getDefaultParameterValues(spec.id)
    }))
  }

  protected getParameterDefinitions(modelId: string): readonly ImageParameterDefinition[] {
    return this.getModelSpec(modelId).parameterDefinitions.map(definition => ({ ...definition }))
  }

  protected getDefaultParameterValues(modelId: string): Record<string, unknown> {
    return { ...this.getModelSpec(modelId).defaultParameterValues }
  }

  // public async validateConnection(connectionConfig: Record<string, any>): Promise<boolean> {
  //   try {
  //     this.validateConnectionConfig(connectionConfig)
  //     return true
  //   } catch {
  //     return false
  //   }
  // }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: '一朵花',
        count: 1
      }
    }

    if (testType === 'image2image') {
      return {
        prompt: '把它变成红色',
        count: 1,
        inputImage: {
          b64: AbstractImageProviderAdapter.TEST_IMAGE_BASE64.split(',')[1], // 去掉data:前缀
          mimeType: 'image/png'
        }
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const overrides: Record<string, any> = { ...config.paramOverrides, ...request.paramOverrides }
    const payload = this.buildPayload(request, config, overrides)

    const inputImages = Array.isArray(request.inputImages)
      ? request.inputImages.filter((image) => typeof image?.b64 === 'string' && image.b64.trim().length > 0)
      : []

    if (inputImages.length > 1) {
      payload.image = inputImages.map((image) => {
        const mime = image.mimeType || 'image/png'
        return `data:${mime};base64,${image.b64}`
      })
    } else if (request.inputImage?.b64) {
      const mime = request.inputImage.mimeType || 'image/png'
      payload.image = `data:${mime};base64,${request.inputImage.b64}`
    } else if (inputImages.length === 1) {
      const mime = inputImages[0].mimeType || 'image/png'
      payload.image = `data:${mime};base64,${inputImages[0].b64}`
    }

    const response = await this.apiCall(config, '/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = response

    // 解析响应
    const images = data.data?.map((item: any) => ({
      url: item.url,
      b64: item.b64_json,
      mimeType: 'image/png'
    })) || []

    if (images.length === 0) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

      return {
      images,
      metadata: {
        providerId: 'seedream',
        modelId: config.modelId,
        configId: config.id,
        usage: data.usage
      }
    }
  }

  private async apiCall(config: ImageModelConfig, endpoint: string, options: any) {
    const url = this.resolveEndpointUrl(config, endpoint)
    const response = await fetch(url, options)
    if (!response.ok) {
      let errorMessage: string
      try {
        const errorData = await response.json()
        errorMessage = errorData?.error?.message || errorData?.message || response.statusText
      } catch {
        errorMessage = response.statusText
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Seedream API error: ${response.status} ${errorMessage}`)
    }
    return await response.json()
  }

  private getModelSpec(modelId: string): SeedreamModelSpec {
    return SEEDREAM_MODEL_SPECS.find(spec => spec.id === modelId) || {
      id: modelId,
      name: modelId,
      description: `Custom Seedream model ${modelId}`,
      capabilities: {
        text2image: true,
        image2image: true,
        multiImage: false
      },
      parameterDefinitions: [
        {
          name: 'size',
          labelKey: 'params.size.label',
          descriptionKey: 'params.size.description',
          type: 'string',
          defaultValue: '2K',
          allowedValues: [...SEEDREAM_40_SIZE_VALUES]
        },
        {
          name: 'response_format',
          labelKey: 'params.responseFormat.label',
          descriptionKey: 'params.responseFormat.description',
          type: 'string',
          defaultValue: 'b64_json',
          allowedValues: ['b64_json', 'url']
        }
      ],
      defaultParameterValues: {
        size: '2K',
        response_format: 'b64_json'
      }
    }
  }

  private buildPayload(request: ImageRequest, config: ImageModelConfig, rawOverrides: Record<string, any>): Record<string, unknown> {
    const overrides = { ...rawOverrides }
    delete overrides.n
    delete overrides.batch_size

    if (config.modelId === SEEDREAM_50_LITE_MODEL_ID) {
      delete overrides.response_format
      delete overrides.sequential_image_generation
      delete overrides.watermark

      return {
        model: config.modelId,
        prompt: request.prompt,
        response_format: 'b64_json',
        ...overrides,
        n: 1
      }
    }

    delete overrides.response_format

    return {
      model: config.modelId,
      prompt: request.prompt,
      sequential_image_generation: 'disabled',
      response_format: 'b64_json',
      ...overrides,
      n: 1
    }
  }
}
