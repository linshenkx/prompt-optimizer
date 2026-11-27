import { getVideoModelSpec, videoWireModel, type VideoModelSummary } from '@prompt-optimizer/core'

export function videoModelLabel(model: Pick<VideoModelSummary, 'modelId' | 'providerId' | 'customModel'>): string {
  return model.customModel
    ? videoWireModel(model)
    : getVideoModelSpec(model.modelId, model.providerId)?.name || videoWireModel(model)
}
