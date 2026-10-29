import { reactive } from 'vue'
import type { ModelOption, TextModelConfig } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

export interface CatalogEntry {
  models: ModelOption[]
  loading: boolean
  failed: boolean
  loadedAt: number
}
interface CatalogState {
  entries: Record<string, CatalogEntry>
  recent: Record<string, string[]>
  pending: Map<string, Promise<void>>
  signatures: Map<string, string>
}
const states = new WeakMap<AppServices, CatalogState>()
const recentKey = 'model-selector:recent:v1:'
const MAX_AGE = 5 * 60 * 1000

export function getTextModelCatalog(services: AppServices): CatalogState {
  let state = states.get(services)
  if (!state) {
    state = {
      entries: reactive({}), recent: reactive({}), pending: new Map(), signatures: new Map(),
    }
    states.set(services, state)
  }
  return state
}

export function mergeModelOptions(...lists: ModelOption[][]): ModelOption[] {
  const seen = new Set<string>()
  return lists.flat().filter(model => {
    if (!model.value || seen.has(model.value)) return false
    seen.add(model.value)
    return true
  })
}

export function rankModelOptions(models: ModelOption[], current: string, recent: string[]): ModelOption[] {
  const priority = Array.from(new Set([current, ...recent])).filter(Boolean)
  const byId = new Map(models.map(model => [model.value, model]))
  return mergeModelOptions(priority.flatMap(id => byId.has(id) ? [byId.get(id)!] : []), models)
}

export async function loadTextModelCatalog(services: AppServices, config: TextModelConfig, force = false): Promise<void> {
  const state = getTextModelCatalog(services)
  // Kept in memory only; a changed endpoint/key invalidates this connection's list.
  const signature = JSON.stringify([config.providerId, config.providerMeta.id, config.connectionConfig])
  const previous = state.entries[config.id]
  if (!force && state.signatures.get(config.id) === signature) {
    if (state.pending.has(config.id)) return state.pending.get(config.id)
    if (previous && !previous.failed && Date.now() - previous.loadedAt < MAX_AGE) return
  }
  state.signatures.set(config.id, signature)
  let staticModels: ModelOption[] = []
  try {
    staticModels = (services.textAdapterRegistry?.getStaticModels(config.providerMeta.id) || [])
      .filter(model => model.id !== 'custom-model' || config.modelMeta.id === model.id)
      .map(model => ({ value: model.id, label: model.name }))
  } catch { /* Private providers still retain their saved model. */ }
  state.entries[config.id] = {
    models: mergeModelOptions([{ value: config.modelMeta.id, label: config.modelMeta.name }], staticModels),
    loading: true, failed: false, loadedAt: 0,
  }
  const entry = state.entries[config.id]
  const task = (async () => {
    await Promise.resolve()
    try {
      if (!(config.id in state.recent)) {
        const saved = await services.preferenceService?.get<unknown>(recentKey + config.id, []).catch(() => [])
        if (!(config.id in state.recent)) state.recent[config.id] = Array.isArray(saved) ? saved.filter(id => typeof id === 'string').slice(0, 12) : []
      }
      if (config.providerMeta.supportsDynamicModels) {
        const models = await services.llmService.fetchModelList(config.providerMeta.id, config)
        if (models.length) {
          const labels = new Map(entry.models.map(model => [model.value, model.label]))
          entry.models = mergeModelOptions(models.map(model => ({
            ...model, label: labels.get(model.value) || model.label,
          })), [{ value: config.modelMeta.id, label: config.modelMeta.name }])
        }
      }
      entry.loadedAt = Date.now()
    } catch {
      entry.failed = true
    } finally {
      entry.loading = false
      if (state.entries[config.id] === entry) state.pending.delete(config.id)
    }
  })()
  state.pending.set(config.id, task)
  return task
}

export async function rememberTextModel(services: AppServices, configId: string, modelId: string): Promise<void> {
  const state = getTextModelCatalog(services)
  const recent = [modelId, ...(state.recent[configId] || []).filter(id => id !== modelId)].slice(0, 12)
  state.recent[configId] = recent
  try { await services.preferenceService?.set(recentKey + configId, recent) } catch {
    // Selection remains valid if optional recent-history persistence is unavailable.
  }
}
