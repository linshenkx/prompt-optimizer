import { TextAdapterRegistry } from '../llm/adapters/registry'
import { RequestConfigError } from '../llm/errors'
import type { IImageUnderstandingService, ImageUnderstandingExecutionRequest, CreateImageUnderstandingServiceOptions } from './types'
import type { ITextAdapterRegistry, StreamHandlers } from '../llm/types'
import type { ImageInputCompatibilityOptions } from '../image/types'
import { normalizeImageInputsForLlm } from '../image/input-normalizer'

export class ImageUnderstandingService implements IImageUnderstandingService {
  private readonly registry: ITextAdapterRegistry
  private readonly imageInputOptions: ImageInputCompatibilityOptions

  constructor(options: CreateImageUnderstandingServiceOptions = {}) {
    this.registry = options.registry ?? new TextAdapterRegistry()
    this.imageInputOptions = { imageInputConverter: options.imageInputConverter }
  }

  async understand(request: ImageUnderstandingExecutionRequest) {
    this.validateRequest(request)

    const providerId = request.modelConfig.providerMeta.id
    const adapter = this.registry.getAdapter(providerId)
    const runtimeRequest = await this.prepareRuntimeRequest(request)

    return await adapter.sendImageUnderstanding(runtimeRequest, request.modelConfig)
  }

  async understandStream(
    request: ImageUnderstandingExecutionRequest,
    callbacks: StreamHandlers
  ) {
    this.validateRequest(request)

    const providerId = request.modelConfig.providerMeta.id
    const adapter = this.registry.getAdapter(providerId)
    const runtimeRequest = await this.prepareRuntimeRequest(request)

    await adapter.sendImageUnderstandingStream(runtimeRequest, request.modelConfig, callbacks)
  }

  private validateRequest(request: ImageUnderstandingExecutionRequest): void {
    if (!request || typeof request !== 'object') {
      throw new RequestConfigError('Image understanding request cannot be empty')
    }

    const modelConfig = request.modelConfig
    if (!modelConfig) {
      throw new RequestConfigError('Model config cannot be empty')
    }

    if (!modelConfig.providerMeta?.id) {
      throw new RequestConfigError('Model provider metadata cannot be empty')
    }

    if (!modelConfig.modelMeta?.id) {
      throw new RequestConfigError('Model metadata cannot be empty')
    }

    if (!modelConfig.enabled) {
      throw new RequestConfigError('Model is not enabled')
    }
  }

  private async prepareRuntimeRequest(
    request: ImageUnderstandingExecutionRequest
  ): Promise<ImageUnderstandingExecutionRequest> {
    const images = await normalizeImageInputsForLlm(request.images, this.imageInputOptions)
    return {
      ...request,
      images: images ?? request.images,
    }
  }
}

export function createImageUnderstandingService(
  options: CreateImageUnderstandingServiceOptions = {}
): IImageUnderstandingService {
  return new ImageUnderstandingService(options)
}
