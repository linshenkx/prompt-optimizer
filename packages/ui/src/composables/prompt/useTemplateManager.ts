import { watch, computed, reactive, type Ref } from 'vue'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { usePreferences } from '../storage/usePreferenceManager'
import { TEMPLATE_SELECTION_KEYS, IMAGE_MODE_KEYS, type Template } from '@prompt-optimizer/core'
import { useFunctionMode, type FunctionMode } from '../mode'
import type { AppServices } from '../../types/services'

export interface TemplateManagerHooks {
  showTemplates: boolean
  currentType: string
  handleTemplateSelect: (template: Template | null, type: Template['metadata']['templateType'], showToast?: boolean) => void
  openTemplateManager: (type: Template['metadata']['templateType']) => void
  handleTemplateManagerClose: (refreshCallback?: () => void) => void
}

export interface TemplateManagerOptions {
  selectedOptimizeTemplate: Ref<Template | null>
  selectedUserOptimizeTemplate: Ref<Template | null>
  selectedIterateTemplate: Ref<Template | null>
  // saveTemplateSelection现在完全由useTemplateManager内部实现
}

type StoredTemplateType =
  | 'optimize'
  | 'userOptimize'
  | 'iterate'
  | 'conversationMessageOptimize'
  | 'contextUserOptimize'
  | 'contextIterate'
  | 'text2imageOptimize'
  | 'image2imageOptimize'
  | 'imageIterate'

/**
 * 模板管理器Hook
 * @param services 服务实例引用
 * @param options 选项配置
 * @returns TemplateManagerHooks
 */
export function useTemplateManager(
  services: Ref<AppServices | null>,
  options: TemplateManagerOptions
): TemplateManagerHooks {
  const toast = useToast()
  const { t } = useI18n()
  const { getPreference, setPreference } = usePreferences(services)
  const { selectedOptimizeTemplate, selectedUserOptimizeTemplate, selectedIterateTemplate } = options
  
  // 模型管理器引用
  const templateManager = computed(() => services.value?.templateManager)
  const { functionMode, ensureInitialized: ensureFunctionModeInitialized } = useFunctionMode(services)

  // 创建一个 reactive 状态对象
  const state = reactive<TemplateManagerHooks>({
    showTemplates: false,
    currentType: '', // 不设置默认值，必须明确指定
    handleTemplateSelect: (template: Template | null, type: Template['metadata']['templateType'], showToast: boolean = true) => {
      console.log(t('log.info.templateSelected'), {
        template: template ? {
          id: template.id,
          name: template.name,
          type: template.metadata?.templateType
        } : null,
        type
      })

      // 将选择映射到对应家族（系统/用户/迭代），无论是否为 context* 类型
      const normalized = normalizeTypeToFamily(type)
      if (normalized === 'system') {
        selectedOptimizeTemplate.value = template
      } else if (normalized === 'user') {
        selectedUserOptimizeTemplate.value = template
      } else {
        selectedIterateTemplate.value = template
      }

      if (template) {
        // 使用内部的保存逻辑，异步执行但不等待
        saveTemplateSelection(template, type as StoredTemplateType).catch(error => {
          console.error('[useTemplateManager] 保存模板选择失败:', error)
          toast.error('保存模板选择失败')
        })

        // 不再显示toast提示，移除选择成功的冒泡提示
      }
    },
    openTemplateManager: (type: Template['metadata']['templateType']) => {
      state.currentType = type
      state.showTemplates = true
    },
    handleTemplateManagerClose: (refreshCallback?: () => void) => {
      // Call the refresh callback if provided
      if (refreshCallback) {
        refreshCallback()
        }
      state.showTemplates = false
    }
  })

  // 保存模板选择到存储
  const saveTemplateSelection = async (
    template: Template,
    type: StoredTemplateType
  ) => {
    const storageKey = resolveSelectionKey(type)
    if (!storageKey) return
    await setPreference(storageKey, template.id)
  }

  // Initialize template selection
  const initTemplateSelection = async () => {
    try {
      await ensureFunctionModeInitialized()
      const mode = functionMode.value as FunctionMode

      const loadTemplate = async (
        type: StoredTemplateType,
        storageKey: string,
        targetRef: Ref<Template | null>
      ) => {
        const savedTemplateId = await getPreference(storageKey, null)
        
        if (typeof savedTemplateId === 'string' && savedTemplateId) {
          try {
            const template = await templateManager.value!.getTemplate(savedTemplateId);
            if (template && template.metadata.templateType === type) {
              targetRef.value = template;
              return; // 成功加载，直接返回
            }
            // 如果模板不存在或类型不匹配，则会继续执行下面的回退逻辑
            toast.warning(`模板 (ID: ${savedTemplateId}) 加载失败或类型不匹配，已重置为默认值。`);
          } catch (error) {
            toast.warning(`加载已保存的模板 (ID: ${savedTemplateId}) 失败，已重置为默认值。`);
          }
        }
        
        // 回退逻辑：加载该类型的第一个模板
        const templates = await templateManager.value!.listTemplatesByType(type)
        if (templates.length > 0) {
          targetRef.value = templates[0]
          await setPreference(storageKey, templates[0].id) // 保存新的默认值
        } else {
          toast.error(`没有可用的 ${type} 类型模板。`);
        }
      };
      
      // 依据当前功能模式确定三类类型与存储键
      const sysType: StoredTemplateType = (mode === 'pro') ? 'conversationMessageOptimize' : 'optimize'
      const userType: StoredTemplateType = (mode === 'pro') ? 'contextUserOptimize' : 'userOptimize'
      const itType: StoredTemplateType = (mode === 'pro') ? 'contextIterate' : 'iterate'

      await Promise.all([
        loadTemplate(sysType, resolveSelectionKey(sysType), selectedOptimizeTemplate),
        loadTemplate(userType, resolveSelectionKey(userType), selectedUserOptimizeTemplate),
        loadTemplate(itType, resolveSelectionKey(itType), selectedIterateTemplate),
      ]);

    } catch (error) {
      console.error('初始化模板选择失败:', error)
      toast.error('初始化模板选择失败')
    }
  }

  // 监听服务实例变化，初始化模板选择
  watch(services, async () => {
    if (services.value?.templateManager) {
      await initTemplateSelection()
    }
  }, { immediate: true })

  // 监听模板变化，自动保存到存储（移除toast提示）
  watch(() => selectedOptimizeTemplate.value, async (newTemplate, oldTemplate) => {
    if (newTemplate && oldTemplate && newTemplate.id !== oldTemplate.id) {
      try {
        const mode = functionMode.value as FunctionMode
        const type: StoredTemplateType = (mode === 'pro') ? 'conversationMessageOptimize' : 'optimize'
        await saveTemplateSelection(newTemplate, type)
        // 不再显示toast提示，移除选择成功的冒泡提示
      } catch (error) {
        console.error('[useTemplateManager] 保存系统优化模板失败:', error)
        toast.error('保存模板选择失败')
      }
    }
  })

  watch(() => selectedUserOptimizeTemplate.value, async (newTemplate, oldTemplate) => {
    if (newTemplate && oldTemplate && newTemplate.id !== oldTemplate.id) {
      try {
        const mode = functionMode.value as FunctionMode
        const type: StoredTemplateType = (mode === 'pro') ? 'contextUserOptimize' : 'userOptimize'
        await saveTemplateSelection(newTemplate, type)
        // 不再显示toast提示，移除选择成功的冒泡提示
      } catch (error) {
        console.error('[useTemplateManager] 保存用户优化模板失败:', error)
        toast.error('保存模板选择失败')
      }
    }
  })

  watch(() => selectedIterateTemplate.value, async (newTemplate, oldTemplate) => {
    if (newTemplate && oldTemplate && newTemplate.id !== oldTemplate.id) {
      try {
        const mode = functionMode.value as FunctionMode
        const type: StoredTemplateType = (mode === 'pro') ? 'contextIterate' : 'iterate'
        await saveTemplateSelection(newTemplate, type)
        // 不再显示toast提示，移除选择成功的冒泡提示
      } catch (error) {
        console.error('[useTemplateManager] 保存迭代模板失败:', error)
        toast.error('保存模板选择失败')
      }
    }
  })

  // 当功能模式发生变化时，重新从对应键加载选择
  watch(functionMode, async (mode) => {
    try {
      const sysType: StoredTemplateType = (mode === 'pro') ? 'conversationMessageOptimize' : 'optimize'
      const userType: StoredTemplateType = (mode === 'pro') ? 'contextUserOptimize' : 'userOptimize'
      const itType: StoredTemplateType = (mode === 'pro') ? 'contextIterate' : 'iterate'

      const sysId = await getPreference(resolveSelectionKey(sysType), null)
      const userId = await getPreference(resolveSelectionKey(userType), null)
      const itId = await getPreference(resolveSelectionKey(itType), null)

      // 系统
      if (sysId) {
        try {
          selectedOptimizeTemplate.value = await templateManager.value!.getTemplate(sysId)
        } catch (error) {
          // 忽略模板加载错误，继续执行
          console.warn('Failed to load system template:', error)
        }
      } else {
        const list = await templateManager.value!.listTemplatesByType(sysType)
        if (list.length > 0) {
          selectedOptimizeTemplate.value = list[0]
          await setPreference(resolveSelectionKey(sysType), list[0].id)
        }
      }

      // 用户
      if (userId) {
        try {
          selectedUserOptimizeTemplate.value = await templateManager.value!.getTemplate(userId)
        } catch (error) {
          // 忽略模板加载错误，继续执行
          console.warn('Failed to load user template:', error)
        }
      } else {
        const list = await templateManager.value!.listTemplatesByType(userType)
        if (list.length > 0) {
          selectedUserOptimizeTemplate.value = list[0]
          await setPreference(resolveSelectionKey(userType), list[0].id)
        }
      }

      // 迭代
      if (itId) {
        try {
          selectedIterateTemplate.value = await templateManager.value!.getTemplate(itId)
        } catch (error) {
          // 忽略模板加载错误，继续执行
          console.warn('Failed to load iterate template:', error)
        }
      } else {
        const list = await templateManager.value!.listTemplatesByType(itType)
        if (list.length > 0) {
          selectedIterateTemplate.value = list[0]
          await setPreference(resolveSelectionKey(itType), list[0].id)
        }
      }

    } catch (e) {
      console.warn('[useTemplateManager] 切换功能模式时加载模板失败:', e)
    }
  })

  // 工具函数：将六类类型映射到存储键
  function resolveSelectionKey(
    type: StoredTemplateType
  ): string | null {
    switch (type) {
      case 'optimize':
        return TEMPLATE_SELECTION_KEYS.SYSTEM_OPTIMIZE_TEMPLATE
      case 'userOptimize':
        return TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE
      case 'iterate':
        return TEMPLATE_SELECTION_KEYS.ITERATE_TEMPLATE
      case 'conversationMessageOptimize':
        return TEMPLATE_SELECTION_KEYS.CONTEXT_SYSTEM_OPTIMIZE_TEMPLATE
      case 'contextUserOptimize':
        return TEMPLATE_SELECTION_KEYS.CONTEXT_USER_OPTIMIZE_TEMPLATE
      case 'contextIterate':
        return TEMPLATE_SELECTION_KEYS.CONTEXT_ITERATE_TEMPLATE
      case 'text2imageOptimize':
        return IMAGE_MODE_KEYS.SELECTED_TEMPLATE_TEXT2IMAGE
      case 'image2imageOptimize':
        return IMAGE_MODE_KEYS.SELECTED_TEMPLATE_IMAGE2IMAGE
      case 'imageIterate':
        return IMAGE_MODE_KEYS.SELECTED_ITERATE_TEMPLATE
      default:
        return null
    }
  }

  // 工具函数：将类型归一化到家族
  function normalizeTypeToFamily(
    type: string
  ): 'system' | 'user' | 'iterate' {
    if (type === 'optimize' || type === 'conversationMessageOptimize' || type === 'text2imageOptimize' || type === 'image2imageOptimize') {
      return 'system'
    }
    if (type === 'userOptimize') {
      return 'user'
    }
    return 'iterate'
  }

  return state
} 
