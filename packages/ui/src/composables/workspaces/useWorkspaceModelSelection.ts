/**
 * 工作区模型选择逻辑（通用）
 *
 * 功能：
 * - 从 session store 读取/写入 selectedOptimizeModelKey 和 selectedTestModelKey
 * - 刷新文本模型选项列表
 * - 提供 selectedTestModelInfo（用于测试区域显示）
 * - 自动设置默认值（fallback）
 *
 * @param services - AppServices 实例
 * @param sessionStore - Session store 实例（ProMultiMessageSession 或 ProVariableSession）
 */
import { computed, ref, type Ref } from 'vue'
import type { AppServices } from '../../types/services'
import type { ModelSelectOption } from '../../types/select-options'
import { DataTransformer } from '../../utils/data-transformer'

type WorkspaceModelSessionStore = {
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  updateOptimizeModel: (key: string) => void
  updateTestModel: (key: string) => void
}

export function useWorkspaceModelSelection<T extends WorkspaceModelSessionStore>(
  services: Ref<AppServices | null>,
  sessionStore: T
) {
  const textModelOptions = ref<ModelSelectOption[]>([])

  // 优化模型（双向绑定）
  const selectedOptimizeModelKey = computed<string>({
    get: () => sessionStore.selectedOptimizeModelKey ?? '',
    set: (value: string) => {
      sessionStore.updateOptimizeModel(value || '')
    }
  })

  // 测试模型（双向绑定）
  const selectedTestModelKey = computed<string>({
    get: () => sessionStore.selectedTestModelKey ?? '',
    set: (value: string) => {
      sessionStore.updateTestModel(value || '')
    }
  })

  // 测试模型信息（派生）
  const selectedTestModelInfo = computed(() => {
    const key = selectedTestModelKey.value
    const option = textModelOptions.value.find(opt => opt.value === key)
    return {
      provider: option?.raw?.providerMeta?.name || null,
      model: option?.raw?.modelMeta?.name || null
    }
  })

  // 刷新模型列表
  let refreshModelToken = 0
  const refreshTextModels = async () => {
    const mgr = services.value?.modelManager
    if (!mgr) {
      textModelOptions.value = []
      return
    }

    const token = ++refreshModelToken
    try {
      const enabledModels = await mgr.getEnabledModels()
      if (token !== refreshModelToken) return

      textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels)

      // 自动 fallback：如果当前选中模型不在列表中，使用第一个
      const fallback = textModelOptions.value[0]?.value || ''
      const modelKeys = textModelOptions.value.map(opt => opt.value)

      // 优化模型
      if (selectedOptimizeModelKey.value && !modelKeys.includes(selectedOptimizeModelKey.value)) {
        selectedOptimizeModelKey.value = fallback
      }
      // 测试模型
      if (selectedTestModelKey.value && !modelKeys.includes(selectedTestModelKey.value)) {
        selectedTestModelKey.value = fallback
      }

      // 只在完全没有选中模型时设置默认值
      if (!selectedOptimizeModelKey.value && fallback) {
        selectedOptimizeModelKey.value = fallback
      }
      if (!selectedTestModelKey.value && fallback) {
        selectedTestModelKey.value = fallback
      }
    } catch (error) {
      console.error('[useWorkspaceModelSelection] refreshTextModels failed:', error instanceof Error ? error.message : String(error), error)
      textModelOptions.value = []
    }
  }

  // 监听 modelManager 变化
  // 注意：不使用 immediate: true，避免在 session 恢复前执行
  // 由组件在合适的时机调用 refreshTextModels

  return {
    textModelOptions,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    selectedTestModelInfo,
    refreshTextModels
  }
}
