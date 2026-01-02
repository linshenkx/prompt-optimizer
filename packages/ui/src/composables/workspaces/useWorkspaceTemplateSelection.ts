/**
 * 工作区模板选择逻辑（通用）
 *
 * 功能：
 * - 从 session store 读取/写入 selectedTemplateId 和 selectedIterateTemplateId
 * - 根据模板类型过滤选项列表
 * - 刷新模板选项列表（支持竞态保护）
 * - 提供模板对象（由 id 派生）
 *
 * @param services - AppServices 实例
 * @param sessionStore - Session store 实例
 * @param optimizeTemplateType - 优化模板类型（如 'conversationMessageOptimize' 或 'contextUserOptimize'）
 * @param iterateTemplateType - 迭代模板类型（如 'contextIterate'）
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { AppServices } from '../../types/services'
import type { TemplateSelectOption } from '../../types/select-options'
import type { Template } from '@prompt-optimizer/core'
import { DataTransformer } from '../../utils/data-transformer'

type WorkspaceTemplateType = Parameters<AppServices['templateManager']['listTemplatesByType']>[0]

type WorkspaceTemplateSessionStore = {
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  updateTemplate: (id: string | null) => void
  updateIterateTemplate: (id: string | null) => void
}

export function useWorkspaceTemplateSelection<T extends WorkspaceTemplateSessionStore>(
  services: Ref<AppServices | null>,
  sessionStore: T,
  optimizeTemplateType: WorkspaceTemplateType,
  iterateTemplateType: WorkspaceTemplateType
) {
  const templateOptions = ref<TemplateSelectOption[]>([])
  const iterateTemplateOptions = ref<TemplateSelectOption[]>([])

  const selectedTemplate = ref<Template | null>(null)
  const selectedIterateTemplate = ref<Template | null>(null)

  // 优化模板 ID（双向绑定）
  const selectedTemplateId = computed<string>({
    get: () => sessionStore.selectedTemplateId ?? '',
    set: (value: string) => {
      sessionStore.updateTemplate(value || null)
    }
  })

  // 迭代模板 ID（双向绑定）
  const selectedIterateTemplateId = computed<string>({
    get: () => sessionStore.selectedIterateTemplateId ?? '',
    set: (value: string) => {
      sessionStore.updateIterateTemplate(value || null)
    }
  })

  // 刷新优化模板列表
  let optimizeTemplateResolveToken = 0
  const refreshOptimizeTemplates = async () => {
    const mgr = services.value?.templateManager
    if (!mgr) {
      templateOptions.value = []
      selectedTemplate.value = null
      return
    }

    const token = ++optimizeTemplateResolveToken
    try {
      const list = await mgr.listTemplatesByType(optimizeTemplateType)
      if (token !== optimizeTemplateResolveToken) return

      templateOptions.value = DataTransformer.templatesToSelectOptions(list || [])

      // 根据 selectedTemplateId 解析模板对象
      selectedTemplate.value =
        selectedTemplateId.value
          ? (list || []).find(t => t.id === selectedTemplateId.value) || null
          : null
    } catch (error) {
      if (token !== optimizeTemplateResolveToken) return
      console.error('[useWorkspaceTemplateSelection] refreshOptimizeTemplates failed:', error instanceof Error ? error.message : String(error), error)
      templateOptions.value = []
      selectedTemplate.value = null
    }
  }

  // 刷新迭代模板列表
  let iterateTemplateResolveToken = 0
  const refreshIterateTemplates = async () => {
    const mgr = services.value?.templateManager
    if (!mgr) {
      iterateTemplateOptions.value = []
      selectedIterateTemplate.value = null
      return
    }

    const token = ++iterateTemplateResolveToken
    try {
      const list = await mgr.listTemplatesByType(iterateTemplateType)
      if (token !== iterateTemplateResolveToken) return

      iterateTemplateOptions.value = DataTransformer.templatesToSelectOptions(list || [])

      // 根据 selectedIterateTemplateId 解析模板对象
      selectedIterateTemplate.value =
        selectedIterateTemplateId.value
          ? (list || []).find(t => t.id === selectedIterateTemplateId.value) || null
          : null
    } catch (error) {
      if (token !== iterateTemplateResolveToken) return
      console.error('[useWorkspaceTemplateSelection] refreshIterateTemplates failed:', error instanceof Error ? error.message : String(error), error)
      iterateTemplateOptions.value = []
      selectedIterateTemplate.value = null
    }
  }

  // 监听 templateManager 变化，刷新模板选项
  watch(
    () => services.value?.templateManager,
    () => {
      void refreshOptimizeTemplates()
      void refreshIterateTemplates()
    },
    { immediate: true }
  )

  // 监听 selectedTemplateId 变化，更新 selectedTemplate 对象
  watch(
    () => selectedTemplateId.value,
    () => {
      void refreshOptimizeTemplates()
    }
  )

  // 监听 selectedIterateTemplateId 变化，更新 selectedIterateTemplate 对象
  watch(
    () => selectedIterateTemplateId.value,
    () => {
      void refreshIterateTemplates()
    }
  )

  return {
    templateOptions,
    iterateTemplateOptions,
    selectedTemplateId,
    selectedIterateTemplateId,
    selectedTemplate,
    selectedIterateTemplate,
    refreshOptimizeTemplates,
    refreshIterateTemplates
  }
}
