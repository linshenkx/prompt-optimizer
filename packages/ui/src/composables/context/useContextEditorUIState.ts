import { ref, computed, watch, type Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

/**
 * ContextEditor UI 状态管理 Composable
 * 统一管理编辑器的显示模式、标题和状态
 */
export function useContextEditorUIState(
  showContextEditor: Ref<boolean>,
  t: ComposerTranslation
) {
  // 仅显示指定标签页模式（隐藏其他标签页和标签栏）
  const onlyShowTab = ref<'messages' | 'variables' | 'tools' | undefined>(undefined)

  // 根据 onlyShowTab 动态计算编辑器标题
  const title = computed(() => {
    if (!onlyShowTab.value) {
      return t('contextEditor.title')
    }

    const tab = onlyShowTab.value
    const titleMap: Record<string, string> = {
      messages: t('contextEditor.messagesTab'),
      variables: t('contextEditor.variablesTab'),
      tools: t('contextEditor.toolsTab'),
    }

    return titleMap[tab] || t('contextEditor.title')
  })

  // 监听编辑器显示状态，关闭时重置 onlyShowTab
  watch(showContextEditor, (visible) => {
    if (!visible) {
      onlyShowTab.value = undefined
    }
  })

  // 取消处理函数：关闭编辑器并重置状态
  const handleCancel = () => {
    showContextEditor.value = false
    onlyShowTab.value = undefined
  }

  // 打开指定标签页模式
  const openWithTab = (tab: 'messages' | 'variables' | 'tools') => {
    onlyShowTab.value = tab
  }

  // 重置为普通模式（显示所有标签页）
  const resetToNormalMode = () => {
    onlyShowTab.value = undefined
  }

  return {
    onlyShowTab,
    title,
    handleCancel,
    openWithTab,
    resetToNormalMode,
  }
}
