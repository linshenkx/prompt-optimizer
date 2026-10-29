import { decodeTextModelSelection, getTextModelSelectionConfigId } from '@prompt-optimizer/core'
import type { ModelSelectOption } from '../types/select-options'

export { getTextModelSelectionConfigId }

export function findTextModelSelection(options: ModelSelectOption[], key: string): ModelSelectOption | undefined {
  const option = options.find(item => item.value === getTextModelSelectionConfigId(key))
  const selection = decodeTextModelSelection(key)
  if (!option || !selection || !option.raw?.modelMeta) return option
  const current = option.raw.modelMeta
  return {
    ...option, value: key,
    raw: { ...option.raw, modelId: selection.modelId, modelMeta: {
      ...current, id: selection.modelId,
      name: current.id === selection.modelId ? current.name : selection.modelId,
    } },
  }
}
