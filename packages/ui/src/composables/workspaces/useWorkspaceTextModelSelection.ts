/**
 * 工作区 Text 模型选择逻辑（通用，Image 模式使用）
 *
 * 功能：
 * - 从 session store 读取/写入 selectedTextModelKey
 * - 刷新文本模型选项列表
 * - 自动兜底选择第一个可用模型（写回 session store，单一真源）
 * - 竞态保护（避免快速切换/刷新导致旧请求覆盖新请求）
 *
 * @param services - AppServices 实例
 * @param sessionStore - Session store 实例（ImageText2ImageSession / ImageImage2ImageSession）
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { AppServices } from '../../types/services'
import type { ModelSelectOption } from '../../types/select-options'
import { DataTransformer } from '../../utils/data-transformer'

type WorkspaceTextModelSessionStore = {
  selectedTextModelKey: string
  updateTextModel: (key: string) => void
}

export function useWorkspaceTextModelSelection<T extends WorkspaceTextModelSessionStore>(
  services: Ref<AppServices | null>,
  sessionStore: T
) {
  const textModelOptions = ref<ModelSelectOption[]>([])

  const selectedTextModelKey = computed<string>({
    get: () => sessionStore.selectedTextModelKey ?? '',
    set: (value: string) => sessionStore.updateTextModel(value || '')
  })

  let refreshToken = 0
  const refreshTextModels = async () => {
    const mgr = services.value?.modelManager
    if (!mgr) {
      textModelOptions.value = []
      return
    }

    const token = ++refreshToken
    try {
      if (typeof (mgr as any).ensureInitialized === 'function') {
        await (mgr as any).ensureInitialized()
      }

      const enabledModels = await mgr.getEnabledModels()
      if (token !== refreshToken) return

      textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels)

      const fallback = textModelOptions.value[0]?.value || ''
      const keys = new Set(textModelOptions.value.map(opt => opt.value))
      const current = selectedTextModelKey.value

      const invalid = current && !keys.has(current)
      const emptyNeedsFallback = !current && !!fallback
      if ((invalid || emptyNeedsFallback) && fallback) {
        selectedTextModelKey.value = fallback
      }
    } catch (error) {
      console.error('[useWorkspaceTextModelSelection] refreshTextModels failed:', error instanceof Error ? error.message : String(error), error)
      textModelOptions.value = []
    }
  }

  watch(
    () => services.value?.modelManager,
    () => {
      void refreshTextModels()
    },
    { immediate: true }
  )

  return {
    textModelOptions,
    selectedTextModelKey,
    refreshTextModels,
  }
}

