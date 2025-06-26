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

// 改进刷新方法
const refreshTemplates = () => {
  refreshTrigger.value++

  // 检查模板管理器是否已初始化
  if (!templateManager.isInitialized()) {
    return
  }

  const currentTemplates = templateManager.listTemplatesByType(props.type)
  const currentTemplate = props.modelValue

  // 如果当前有选中的模板，尝试获取其最新版本（处理语言切换的情况）
  if (currentTemplate) {
    try {
      const updatedTemplate = templateManager.getTemplate(currentTemplate.id)
      // 如果模板内容发生了变化（比如语言切换），更新选中的模板
      if (updatedTemplate && (
        updatedTemplate.name !== currentTemplate.name ||
        updatedTemplate.content !== currentTemplate.content
      )) {
        emit('update:modelValue', updatedTemplate)
        // 静默更新，不显示toast
        emit('select', updatedTemplate, false)
        return
      }
    } catch (error) {
      console.warn('Failed to get updated template:', error)
    }
  }

  // 仅在当前没有选中模板或选中的模板不在列表中时才自动选择
  if (!currentTemplate || !currentTemplates.find(t => t.id === currentTemplate.id)) {
    const firstTemplate = currentTemplates[0] || null
    if (firstTemplate && firstTemplate.id !== currentTemplate?.id) {
      emit('update:modelValue', firstTemplate)
      // 静默选择，不显示toast（通过传递false参数）
      emit('select', firstTemplate, false)
    }
  }
}

// 暴露刷新方法给父组件
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