import { reactive, type Ref } from 'vue'

import type { Template } from '@prompt-optimizer/core'

export interface TemplateManagerHooks {
  showTemplates: boolean
  currentType: string
  handleTemplateSelect: (
    template: Template | null,
    type: Template['metadata']['templateType'],
    _showToast?: boolean
  ) => void
  openTemplateManager: (type: Template['metadata']['templateType']) => void
  handleTemplateManagerClose: (refreshCallback?: () => void) => void
}

export interface TemplateManagerOptions {
  selectedOptimizeTemplate: Ref<Template | null>
  selectedUserOptimizeTemplate: Ref<Template | null>
  selectedIterateTemplate: Ref<Template | null>
}

/**
 * TemplateManager Hook（无持久化副作用）
 *
 * Phase 1/2 迁移说明：
 * - 模板选择的持久化已迁移到各 mode 的 Session Store（单一真源）
 * - 本 hook 仅负责：
 *   1) 控制 TemplateManager Modal 展示
 *   2) 将“选择的模板对象”写入调用方提供的 refs（UI 需要）
 *
 * IMPORTANT：
 * - 禁止在此处读写 TEMPLATE_SELECTION_KEYS（避免双真源）
 */
export function useTemplateManager(
  _services: Ref<any>,
  options: TemplateManagerOptions
): TemplateManagerHooks {
  void _services

  const { selectedOptimizeTemplate, selectedUserOptimizeTemplate, selectedIterateTemplate } =
    options

  const state = reactive<TemplateManagerHooks>({
    showTemplates: false,
    currentType: '',
    handleTemplateSelect: (
      template: Template | null,
      type: Template['metadata']['templateType']
    ) => {
      const family = normalizeTypeToFamily(type)
      if (family === 'system') {
        selectedOptimizeTemplate.value = template
      } else if (family === 'user') {
        selectedUserOptimizeTemplate.value = template
      } else {
        selectedIterateTemplate.value = template
      }
    },
    openTemplateManager: (type: Template['metadata']['templateType']) => {
      state.currentType = type
      state.showTemplates = true
    },
    handleTemplateManagerClose: (refreshCallback?: () => void) => {
      if (refreshCallback) refreshCallback()
      state.showTemplates = false
    },
  })

  return state
}

function normalizeTypeToFamily(type: string): 'system' | 'user' | 'iterate' {
  if (
    type === 'optimize' ||
    type === 'conversationMessageOptimize' ||
    type === 'text2imageOptimize' ||
    type === 'image2imageOptimize' ||
    type === 'contextSystemOptimize'
  ) {
    return 'system'
  }
  if (type === 'userOptimize' || type === 'contextUserOptimize') {
    return 'user'
  }
  return 'iterate'
}

