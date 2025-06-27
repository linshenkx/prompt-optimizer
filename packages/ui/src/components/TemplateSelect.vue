<template>
  <div class="relative">
    <button
      @click.stop="isOpen = !isOpen"
      class="theme-template-select-button"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2 min-w-0">
          <span v-if="modelValue" class="theme-text truncate">
            {{ modelValue.name }}
          </span>
          <span v-else class="theme-placeholder">
            {{ t('template.select') }}
          </span>
        </div>
        <span class="theme-text">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </span>
      </div>
    </button>

    <div v-if="isOpen" 
         class="theme-dropdown"
         :style="dropdownStyle"
         @click.stop
         v-click-outside="() => isOpen = false"
    >
      <div class="p-2 max-h-64 overflow-y-auto">
        <div v-for="template in templates" 
             :key="template.id"
             @click="selectTemplate(template)"
             class="theme-dropdown-item"
             :class="[
               modelValue?.id === template.id
                 ? 'theme-dropdown-item-active'
                 : 'theme-dropdown-item-inactive'
             ]"
        >
          <div class="flex items-center justify-between">
            <span>{{ template.name }}</span>
            <span v-if="template.isBuiltin" 
                  class="text-xs px-1.5 py-0.5 rounded theme-dropdown-item-tag">
              {{ t('common.builtin') }}
            </span>
          </div>
          <p class="text-xs theme-dropdown-item-description mt-1"
             :title="template.metadata.description || t('template.noDescription')">
            {{ template.metadata.description || t('template.noDescription') }}
          </p>
        </div>
      </div>
      <div class="theme-dropdown-section">
        <button
          @click="$emit('manage')"
          class="theme-dropdown-config-button"
        >
          <span>📝</span>
          <span>{{ t('template.configure') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { templateManager } from '@prompt-optimizer/core'
import { clickOutside } from '../directives/clickOutside'
import type { OptimizationMode } from '@prompt-optimizer/core'

const { t } = useI18n()

interface Template {
  id: string;
  name: string;
  content: string | Array<{role: string; content: string}>;
  isBuiltin?: boolean;
  metadata: {
    description?: string;
    templateType: 'optimize' | 'userOptimize' | 'iterate';
  };
}

type TemplateType = 'optimize' | 'userOptimize' | 'iterate';

const props = defineProps({
  modelValue: {
    type: Object as () => Template | null,
    default: null
  },
  type: {
    type: String as () => TemplateType,
    required: true,
    validator: (value: string): boolean => ['optimize', 'userOptimize', 'iterate'].includes(value)
  },
  optimizationMode: {
    type: String as () => OptimizationMode,
    default: 'system'
  }
})

const vClickOutside = clickOutside
const emit = defineEmits(['update:modelValue', 'manage', 'select'])

const isOpen = ref(false)
const dropdownStyle = ref<Record<string, string>>({})
const refreshTrigger = ref(0)

// 计算下拉菜单位置
const updateDropdownPosition = () => {
  if (!isOpen.value) return
  
  // 获取按钮元素
  const button = document.querySelector('.theme-template-select-button')
  if (!button) return

  const buttonRect = button.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  
  // 计算右侧剩余空间
  const rightSpace = viewportWidth - buttonRect.right
  
  // 如果右侧空间不足，则向左对齐
  if (rightSpace < 300) {
    dropdownStyle.value = {
      right: '0',
      left: 'auto'
    }
  } else {
    dropdownStyle.value = {
      left: '0',
      right: 'auto'
    }
  }
}

// 监听窗口大小变化
const handleResize = () => {
  updateDropdownPosition()
}

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  // 确保模板管理器已初始化
  await templateManager.ensureInitialized()
  refreshTemplates()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

// 监听下拉框打开状态
watch(isOpen, async (newValue) => {
  if (newValue) {
    // 打开时刷新列表
    refreshTrigger.value++
    nextTick(() => {
      updateDropdownPosition()
    })
  }
})

const templates = computed(() => {
  // 使用 refreshTrigger 触发重新计算
  refreshTrigger.value
  // 检查模板管理器是否已初始化
  if (!templateManager.isInitialized()) {
    return []
  }

  // 使用按类型筛选方法
  return templateManager.listTemplatesByType(props.type)
})

// 添加对optimizationMode变化的监听
watch(
  () => props.optimizationMode,
  (newOptimizationMode, oldOptimizationMode) => {
    if (newOptimizationMode !== oldOptimizationMode) {
      // optimizationMode变化时，静默刷新模板列表（避免重复toast）
      refreshTemplates()
    }
  }
)

// 添加对模板列表变化的监听
watch(
  templates,  // 监听模板列表
  (newTemplates) => {
    const currentTemplate = props.modelValue
    // 只有在模板列表真正发生变化，且当前模板不在新列表中时才自动切换
    if (currentTemplate && !newTemplates.find(t => t.id === currentTemplate.id)) {
      const firstTemplate = newTemplates.find(t => t.metadata.templateType === props.type) || null
      // 避免重复触发：只在实际发生变化时emit
      if (firstTemplate && firstTemplate.id !== currentTemplate?.id) {
        emit('update:modelValue', firstTemplate)
        // 静默选择，不显示toast
        emit('select', firstTemplate, false)
      }
    }
  },
  { deep: true }
)

/**
 * 深度比较模板内容
 * 支持 string 和 Array<{role: string; content: string}> 两种类型
 * 修复 BugBot 发现的数组引用比较问题
 */
const deepCompareTemplateContent = (content1: any, content2: any): boolean => {
  // 类型相同性检查
  if (typeof content1 !== typeof content2) {
    return false
  }
  
  // 字符串类型直接比较
  if (typeof content1 === 'string') {
    return content1 === content2
  }
  
  // 数组类型深度比较
  if (Array.isArray(content1) && Array.isArray(content2)) {
    if (content1.length !== content2.length) {
      return false
    }
    
    return content1.every((item1, index) => {
      const item2 = content2[index]
      return item1.role === item2.role && item1.content === item2.content
    })
  }
  
  // 其他情况使用 JSON 序列化比较（兜底方案）
  return JSON.stringify(content1) === JSON.stringify(content2)
}

/**
 * 刷新模板列表和当前选中的模板
 * 职责：
 * 1. 刷新模板列表显示
 * 2. 检查当前选中模板是否需要更新（如语言切换）
 * 3. 处理模板不存在的情况（自动选择默认模板）
 */
const refreshTemplates = () => {
  refreshTrigger.value++

  // 检查模板管理器是否已初始化
  if (!templateManager.isInitialized()) {
    return
  }

  const currentTemplates = templateManager.listTemplatesByType(props.type)
  const currentTemplate = props.modelValue

  // 处理当前选中模板的更新（主要用于语言切换场景）
  if (currentTemplate) {
    try {
      const updatedTemplate = templateManager.getTemplate(currentTemplate.id)
      // 使用深度比较检查模板内容是否发生变化（修复 BugBot 发现的数组比较问题）
      if (updatedTemplate && (
        updatedTemplate.name !== currentTemplate.name ||
        !deepCompareTemplateContent(updatedTemplate.content, currentTemplate.content)
      )) {
        // 验证更新后的模板是否还匹配当前类型过滤器（修复类型过滤器忽略问题）
        if (updatedTemplate.metadata.templateType === props.type) {
          // 通过 v-model 更新父组件状态
          emit('update:modelValue', updatedTemplate)
          // 静默更新，不显示用户提示
          emit('select', updatedTemplate, false)
          return
        }
        // 如果类型不匹配，继续执行后续逻辑选择合适的模板
      }
    } catch (error) {
      console.warn('[TemplateSelect] Failed to get updated template:', error)
    }
  }

  // 处理模板不存在的情况：当前模板已被删除或不在当前类型列表中
  if (!currentTemplate || !currentTemplates.find(t => t.id === currentTemplate.id)) {
    const defaultTemplate = currentTemplates[0] || null
    if (defaultTemplate && defaultTemplate.id !== currentTemplate?.id) {
      emit('update:modelValue', defaultTemplate)
      // 静默选择，不显示用户提示
      emit('select', defaultTemplate, false)
    }
  }
}

/**
 * 暴露给父组件的接口
 * 
 * refresh(): 当外部状态变化（如语言切换、模板管理操作）时，
 * 父组件可以调用此方法通知子组件刷新数据。
 * 子组件负责检查数据变化并通过 v-model 更新父组件状态。
 * 
 * 职责分工：
 * - 父组件：检测需要刷新的时机，调用 refresh()
 * - 子组件：执行具体的刷新逻辑，管理自身状态，通过事件通知父组件
 */
defineExpose({
  refresh: refreshTemplates
})

const selectTemplate = (template: Template) => {
  // 避免选择相同模板时的重复调用
  if (template.id === props.modelValue?.id) {
    isOpen.value = false
    return
  }
  
  emit('update:modelValue', template)
  // 用户主动选择时显示toast（传递true参数）
  emit('select', template, true)
  isOpen.value = false
  // 选择后不需要再次刷新列表，避免连锁反应
}
</script>

<style scoped>
.theme-template-select-button {
  position: relative;
}
</style> 