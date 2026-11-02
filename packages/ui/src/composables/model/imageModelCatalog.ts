import type { ImageModelConfig, ImageModel } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

/** Shared discovery path; consumers own their selection and persistence. */
export async function loadImageModelOptions(services: AppServices, config: ImageModelConfig): Promise<ImageModel[]> {
  const registry = services.imageAdapterRegistry
  const staticModels = registry?.getStaticModels(config.providerId) || []
  const dynamic = registry?.supportsDynamicModels(config.providerId) && services.imageService
    ? await services.imageService.getDynamicModels(config.providerId, config.connectionConfig || {}) : []
  return [...new Map([...(dynamic.length ? dynamic : staticModels), config.model].map(m => [m.id, m])).values()]
}
