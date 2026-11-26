import { computed, ref, watch, type Ref, type WritableComputedRef } from 'vue'
import type { Template } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import type { TemplateSelectOption } from '../../types/select-options'
import { DataTransformer } from '../../utils/data-transformer'

type WorkspaceTemplateType = Parameters<AppServices['templateManager']['listTemplatesByType']>[0]

/** A workspace selection always resolves against the manager's current, language-specific list. */
export function useWorkspaceTemplatePicker(
  services: Ref<AppServices | null>,
  type: WorkspaceTemplateType,
  selectedId: WritableComputedRef<string>,
  matchLocalizedBuiltin = false,
) {
  const options = ref<TemplateSelectOption[]>([])
  const selected = ref<Template | null>(null)
  let revision = 0

  const refresh = async () => {
    const current = ++revision
    const manager = services.value?.templateManager
    try {
      const templates = manager ? await manager.listTemplatesByType(type) : []
      if (current !== revision) return
      options.value = DataTransformer.templatesToSelectOptions(templates)
      const id = selectedId.value
      const localizedId = id.endsWith('-en') ? id.slice(0, -3) : id + '-en'
      selected.value = templates.find(template => template.id === id)
        ?? (matchLocalizedBuiltin && id ? templates.find(template => template.isBuiltin && template.id === localizedId) : undefined)
        ?? templates[0] ?? null
      if (selected.value && selected.value.id !== id) selectedId.value = selected.value.id
    } catch (error) {
      if (current !== revision) return
      console.error('[useWorkspaceTemplatePicker] Failed to load templates', type, error)
      options.value = []
      selected.value = null
    }
  }
  watch(() => services.value?.templateManager, refresh, { immediate: true })
  watch(selectedId, id => {
    if (id !== selected.value?.id) void refresh()
  })
  return { options, selected, refresh }
}

type WorkspaceTemplateSessionStore = {
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  updateTemplate: (id: string | null) => void
  updateIterateTemplate: (id: string | null) => void
}

export function useWorkspaceTemplateSelection(
  services: Ref<AppServices | null>,
  sessionStore: WorkspaceTemplateSessionStore,
  optimizeTemplateType: WorkspaceTemplateType,
  iterateTemplateType: WorkspaceTemplateType,
) {
  const selectedTemplateId = computed({
    get: () => sessionStore.selectedTemplateId ?? '',
    set: (value: string) => sessionStore.updateTemplate(value || null),
  })
  const selectedIterateTemplateId = computed({
    get: () => sessionStore.selectedIterateTemplateId ?? '',
    set: (value: string) => sessionStore.updateIterateTemplate(value || null),
  })
  const optimize = useWorkspaceTemplatePicker(services, optimizeTemplateType, selectedTemplateId)
  const iterate = useWorkspaceTemplatePicker(services, iterateTemplateType, selectedIterateTemplateId)
  return {
    templateOptions: optimize.options,
    iterateTemplateOptions: iterate.options,
    selectedTemplateId,
    selectedIterateTemplateId,
    selectedTemplate: optimize.selected,
    selectedIterateTemplate: iterate.selected,
    refreshOptimizeTemplates: optimize.refresh,
    refreshIterateTemplates: iterate.refresh,
  }
}
