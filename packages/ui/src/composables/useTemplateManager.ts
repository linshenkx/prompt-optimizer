import { ref, watch, computed, reactive } from 'vue'
import type { Ref } from 'vue'
import { useToast } from './useToast'
import { useI18n } from 'vue-i18n'
import { usePreferences } from './usePreferenceManager'
import type { Template, ITemplateManager } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'

interface TemplateSelector extends Element {
  __vueParentComponent?: {
    ctx?: {
      refresh?: () => void
    }
  }
}

export interface TemplateManagerHooks {
  showTemplates: boolean
  currentType: string
  handleTemplateSelect: (template: Template | null, type: string, showToast?: boolean) => void
  openTemplateManager: (type: string) => void
  handleTemplateManagerClose: (refreshCallback?: () => void) => void
}

export interface TemplateManagerOptions {
  selectedOptimizeTemplate: Ref<Template | null>
  selectedUserOptimizeTemplate: Ref<Template | null>
  selectedIterateTemplate: Ref<Template | null>
  // saveTemplateSelection现在完全由useTemplateManager内部实现
}

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

  // 创建一个 reactive 状态对象
  const state = reactive<TemplateManagerHooks>({
    showTemplates: false,
    currentType: '', // 不设置默认值，必须明确指定
    handleTemplateSelect: (template: Template | null, type: string, showToast: boolean = true) => {
      console.log(t('log.info.templateSelected'), {
        template: template ? {
          id: template.id,
          name: template.name,
          type: template.metadata?.templateType
        } : null,
        type
      })

      if (type === 'optimize') {
        selectedOptimizeTemplate.value = template
      } else if (type === 'userOptimize') {
        selectedUserOptimizeTemplate.value = template
      } else {
        selectedIterateTemplate.value = template
      }

      if (template) {
        // 使用内部的保存逻辑，异步执行但不等待
        saveTemplateSelection(template, type as 'optimize' | 'userOptimize' | 'iterate').catch(error => {
          console.error('[useTemplateManager] 保存模板选择失败:', error)
          toast.error('保存模板选择失败')
        })

        // 只在明确要求时显示toast
        if (showToast) {
          let typeText = ''
          if (type === 'optimize') {
            typeText = t('common.optimize')
          } else if (type === 'userOptimize') {
            typeText = '用户提示词优化'
          } else {
            typeText = t('common.iterate')
          }
          toast.success(t('toast.success.templateSelected', {
            type: typeText,
            name: template.name
          }))
        }
      }
    },
    openTemplateManager: (type: string) => {
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
  const saveTemplateSelection = async (template: Template, type: 'optimize' | 'userOptimize' | 'iterate') => {
    let storageKey: string;
    switch (type) {
      case 'optimize':
        storageKey = TEMPLATE_SELECTION_KEYS.SYSTEM_OPTIMIZE_TEMPLATE;
        break;
      case 'userOptimize':
        storageKey = TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE;
        break;
      case 'iterate':
        storageKey = TEMPLATE_SELECTION_KEYS.ITERATE_TEMPLATE;
        break;
      default:
        throw new Error(`[useTemplateManager] 未知的模板类型，无法保存: ${type}`);
    }
    await setPreference(storageKey, template.id)
  }

  // Initialize template selection
  const initTemplateSelection = async () => {
    try {

      const loadTemplate = async (
        type: 'optimize' | 'userOptimize' | 'iterate',
        storageKey: string,
        targetRef: Ref<Template | null>
      ) => {
        const savedTemplateId = await getPreference(storageKey, null)
        
        if (typeof savedTemplateId === 'string' && savedTemplateId) {
          try {
            // 检查templateManager是否可用
            if (!templateManager.value) {
              console.warn('TemplateManager not available, cannot load saved template')
              toast.warning(`模板管理器不可用，已重置为默认值。`)
            } else {
              const template = await templateManager.value.getTemplate(savedTemplateId);
            if (template && template.metadata.templateType === type) {
              targetRef.value = template;
              return; // 成功加载，直接返回
            }
              // 如果模板不存在或类型不匹配，则会继续执行下面的回退逻辑
              toast.warning(`模板 (ID: ${savedTemplateId}) 加载失败或类型不匹配，已重置为默认值。`);
            }
          } catch (error) {
            toast.warning(`加载已保存的模板 (ID: ${savedTemplateId}) 失败，已重置为默认值。`);
          }
        }
        
        // 检查templateManager是否可用
        if (!templateManager.value) {
          console.warn('TemplateManager not available, cannot load templates')
          toast.error(`模板管理器不可用，无法加载模板。`)
          return
        }
        
        // 回退逻辑：加载该类型的第一个模板
        const templates = await templateManager.value.listTemplatesByType(type)
        if (templates.length > 0) {
          targetRef.value = templates[0]
          await setPreference(storageKey, templates[0].id) // 保存新的默认值
        } else {
          toast.error(`没有可用的 ${type} 类型模板。`);
        }
      };
      
      // 并行加载所有模板
      await Promise.all([
        loadTemplate('optimize', TEMPLATE_SELECTION_KEYS.SYSTEM_OPTIMIZE_TEMPLATE, selectedOptimizeTemplate),
        loadTemplate('userOptimize', TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE, selectedUserOptimizeTemplate),
        loadTemplate('iterate', TEMPLATE_SELECTION_KEYS.ITERATE_TEMPLATE, selectedIterateTemplate),
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

  // 监听模板变化，自动保存到存储
  watch(() => selectedOptimizeTemplate.value, async (newTemplate, oldTemplate) => {
    if (newTemplate && oldTemplate && newTemplate.id !== oldTemplate.id) {
      try {
        await saveTemplateSelection(newTemplate, 'optimize')
        toast.success(t('toast.success.templateSelected', {
          type: t('common.optimize'),
          name: newTemplate.name
        }))
      } catch (error) {
        console.error('[useTemplateManager] 保存系统优化模板失败:', error)
        toast.error('保存模板选择失败')
      }
    }
  })

  watch(() => selectedUserOptimizeTemplate.value, async (newTemplate, oldTemplate) => {
    if (newTemplate && oldTemplate && newTemplate.id !== oldTemplate.id) {
      try {
        await saveTemplateSelection(newTemplate, 'userOptimize')
        toast.success(t('toast.success.templateSelected', {
          type: '用户提示词优化',
          name: newTemplate.name
        }))
      } catch (error) {
        console.error('[useTemplateManager] 保存用户优化模板失败:', error)
        toast.error('保存模板选择失败')
      }
    }
  })

  watch(() => selectedIterateTemplate.value, async (newTemplate, oldTemplate) => {
    if (newTemplate && oldTemplate && newTemplate.id !== oldTemplate.id) {
      try {
        await saveTemplateSelection(newTemplate, 'iterate')
        toast.success(t('toast.success.templateSelected', {
          type: t('common.iterate'),
          name: newTemplate.name
        }))
      } catch (error) {
        console.error('[useTemplateManager] 保存迭代模板失败:', error)
        toast.error('保存模板选择失败')
      }
    }
  })

  return state
}