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

  // 避免在 refresh 内部“兜底写回”触发 watch(selectedId) 再次刷新
  let skipNextOptimizeRefresh = false
  let skipNextIterateRefresh = false

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

      const templates = list || []
      if (!templates.length) {
        selectedTemplate.value = null
        return
      }

      const currentId = selectedTemplateId.value
      const found = currentId ? templates.find(t => t.id === currentId) || null : null
      if (found) {
        selectedTemplate.value = found
        return
      }

      // 无选择或已失效：统一兜底为第一个模板
      const fallback = templates[0] || null
      if (fallback) {
        skipNextOptimizeRefresh = true
        sessionStore.updateTemplate(fallback.id)
        selectedTemplate.value = fallback
      } else {
        selectedTemplate.value = null
      }
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

      const templates = list || []
      if (!templates.length) {
        selectedIterateTemplate.value = null
        return
      }

      const currentId = selectedIterateTemplateId.value
      const found = currentId ? templates.find(t => t.id === currentId) || null : null
      if (found) {
        selectedIterateTemplate.value = found
        return
      }

      // 无选择或已失效：统一兜底为第一个模板
      const fallback = templates[0] || null
      if (fallback) {
        skipNextIterateRefresh = true
        sessionStore.updateIterateTemplate(fallback.id)
        selectedIterateTemplate.value = fallback
      } else {
        selectedIterateTemplate.value = null
      }
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
      if (skipNextOptimizeRefresh) {
        skipNextOptimizeRefresh = false
        return
      }
      void refreshOptimizeTemplates()
    }
  )

  // 监听 selectedIterateTemplateId 变化，更新 selectedIterateTemplate 对象
  watch(
    () => selectedIterateTemplateId.value,
    () => {
      if (skipNextIterateRefresh) {
        skipNextIterateRefresh = false
        return
      }
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
