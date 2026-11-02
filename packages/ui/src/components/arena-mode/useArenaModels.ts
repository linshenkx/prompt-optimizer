import { computed, type ComputedRef } from 'vue'
import { decodeTextModelSelection, encodeTextModelSelection, type ArenaContestant, type ImageModel, type ImageModelConfig, type TextModelConfig } from '@prompt-optimizer/core'
import { useArenaSession } from '../../stores/session/useArenaSession'
import { getPiniaServices } from '../../plugins/pinia'
import type { ModelSelectOption } from '../../types/select-options'
import { loadImageModelOptions } from '../../composables/model/imageModelCatalog'
import type { ModelSelectorGroup } from '../../types/model-selector'

interface ArenaModels {
  textOptions: ComputedRef<ModelSelectOption[]>
  selection(c: ArenaContestant): string
  select(c: ArenaContestant, value: string): void
  metadata(c: ArenaContestant): TextModelConfig['modelMeta'] | ImageModel | null
  compatible(c: ArenaContestant, model?: TextModelConfig['modelMeta'] | ImageModel | null): boolean
  imageGroups(catalog: Record<string, ImageModel[]>): ModelSelectorGroup[]
  loadImages(config: ImageModelConfig): Promise<ImageModel[]>
}

/** Presentation and capability rules only. Text discovery belongs to TextModelSelector. */
export function useArenaModels(): ArenaModels {
  const session = useArenaSession()
  const textOptions = computed<ModelSelectOption[]>(() => session.configurations.text.map(raw => ({ value: raw.id, primary: raw.name, secondary: raw.providerMeta.name, raw })))
  const selection = (c: ArenaContestant) => c.configKey && c.modelId ? (c.kind === 'image' ? 'image:' : '') + encodeTextModelSelection(c.configKey, c.modelId) : ''
  const select = (c: ArenaContestant, value: string) => {
    c.kind = value.startsWith('image:') ? 'image' : 'text'
    const decoded = decodeTextModelSelection(c.kind === 'image' ? value.slice(6) : value)
    c.configKey = decoded?.configId || value
    c.modelId = decoded?.modelId || session.configurations.text.find(m => m.id === value)?.modelMeta.id || ''
  }
  const metadata = (c: ArenaContestant): TextModelConfig['modelMeta'] | ImageModel | null => {
    const config = session.resolveConfig(c)
    return config ? 'modelMeta' in config ? config.modelMeta : config.model : null
  }
  const compatible = (c: ArenaContestant, model = metadata(c)) => {
    if (!model) return false
    if (c.kind === 'text') return true
    const caps = (model as ImageModel).capabilities
    return session.state.images.length > 1 ? !!caps.multiImage : session.state.images.length ? caps.image2image : caps.text2image
  }
  const imageGroups = (catalog: Record<string, ImageModel[]>) => session.configurations.image.map(config => {
    const available = new Map([config.model, ...(catalog[config.id] || [])].map(model => [model.id, model]))
    for (const c of session.state.contestants.filter(c => c.kind === 'image' && c.configKey === config.id)) {
      const resolved = session.resolveConfig(c)
      if (resolved && 'model' in resolved && !available.has(resolved.model.id)) available.set(resolved.model.id, resolved.model)
    }
    return {
      value: 'image:' + config.id, label: config.name, kind: 'image' as const, configurable: true,
      choices: [...available.values()].map(model => ({
        value: 'image:' + encodeTextModelSelection(config.id, model.id), label: model.name || model.id, searchText: model.id,
        disabled: !compatible({ kind: 'image' } as ArenaContestant, model),
      })),
    }
  })
  const loadImages = async (config: ImageModelConfig) => {
    const services = getPiniaServices()
    return services ? loadImageModelOptions(services, config) : []
  }
  return { textOptions, selection, select, metadata, compatible, imageGroups, loadImages }
}
