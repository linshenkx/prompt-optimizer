<template>
  <NSelect
    :value="modelValue?.id || null"
    @update:value="handleTemplateSelect"
    :options="selectOptions"
    :placeholder="t('template.select')"
    :loading="!isReady"
    size="medium"
    @focus="handleFocus"
    filterable
  >
    <template #empty>
      <NSpace vertical align="center" class="py-4">
        <NText class="text-center text-gray-500">{{ t('template.noAvailableTemplates') }}</NText>
        <NButton 
          type="tertiary" 
          size="small" 
          @click="$emit('manage', props.type)" 
          class="w-full mt-2" 
          ghost 
        > 
          <template #icon> 
            <FileText />
          </template> 
          {{ t('template.configure') }} 
        </NButton>
      </NSpace>
    </template>
  </NSelect>
</template>

<script setup lang="ts">
import { FileText } from '@lucide/vue'
import { ref, computed, watch, inject, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NSelect, NButton, NSpace, NText } from 'naive-ui'
import type { OptimizationMode, Template, TemplateMetadata } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'

const { t } = useI18n()

type TemplateType = TemplateMetadata['templateType'];

const props = defineProps({
  modelValue: {
    type: Object as () => Template | null,
    default: null
  },
  type: {
    type: String as () => TemplateType,
    required: true,
    validator: (value: string): boolean => (
      ['optimize', 'userOptimize', 'text2imageOptimize', 'image2imageOptimize', 'multiimageOptimize', 'imageIterate', 'iterate', 'conversationMessageOptimize', 'contextUserOptimize', 'contextIterate'] as string[]
    ).includes(value)
  },
  optimizationMode: {
    type: String as () => OptimizationMode,
    required: true
  },
  // 移除services prop，统一使用inject
})

const emit = defineEmits<{
  'update:modelValue': [template: Template | null]
  'manage': [type: TemplateType]
  'select': [template: Template, showToast?: boolean]
}>()

const isReady = ref(false)

// 通过inject获取services，要求不能为null
const services = inject<Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[TemplateSelect] Services were not injected correctly. Make sure App provides the services instance.')
}

// 从services中获取templateManager
const templateManager = computed(() => {
  const servicesValue = services.value
  if (!servicesValue) {
    throw new Error('[TemplateSelect] Services are not initialized. Make sure the application has started correctly.')
  }

  const manager = servicesValue.templateManager
  if (!manager) {
    throw new Error('[TemplateSelect] TemplateManager is not initialized. Make sure the service is configured correctly.')
  }

  console.debug('[TemplateSelect] templateManager computed:', {
    hasServices: !!servicesValue,
    hasTemplateManager: !!manager,
    servicesKeys: Object.keys(servicesValue)
  })
  return manager
})

// 选择框选项
const selectOptions = computed(() => {
  const templateOptions = templates.value.map(template => ({
    label: template.name,
    value: template.id,
    template: template,
    isBuiltin: template.isBuiltin,
    description: template.metadata.description || t('template.noDescription'),
    type: 'template'
  }))
  
  // 如果没有模板，返回空数组让placeholder显示
  if (templateOptions.length === 0) {
    return []
  }
  
  // 添加配置按钮选项
  const configOption = {
    label: t('template.configure'),
    value: '__config__',
    type: 'config'
  }
  
  return [...templateOptions, configOption]
})

// 处理模板选择
const handleTemplateSelect = (value: string | null) => {
  // 如果选择的是配置选项，不更新值，直接触发配置事件
  if (value === '__config__') {
    emit('manage', props.type)
    return
  }
  
  const template = templates.value.find(t => t.id === value) || null
  if (template && template.id !== props.modelValue?.id) {
    emit('update:modelValue', template)
    emit('select', template, true)
  }
}

// 处理焦点事件
const handleFocus = async () => {
  if (!isReady.value) {
    await ensureTemplateManagerReady()
    await loadTemplatesByType()
  }
}

// 确保模板管理器已准备就绪
const ensureTemplateManagerReady = async () => {
  // templateManager的检查已经在computed中进行，这里直接使用
  isReady.value = true
  console.debug('[TemplateSelect] Template manager is ready')
  return true
}

// 改为响应式数据，因为需要异步加载
const templates = ref<Template[]>([])

// 异步加载模板列表
const loadTemplatesByType = async () => {
  if (!isReady.value || !templateManager.value) {
    throw new Error('Template manager is not ready or not available')
  }

  // 统一使用异步方法，立即抛错不静默处理
  const typeTemplates = await templateManager.value.listTemplatesByType(props.type)
  templates.value.splice(0, templates.value.length, ...typeTemplates)
}

// 添加对services变化的监听
watch(
  () => services.value?.templateManager,
  async (newTemplateManager) => {
    if (newTemplateManager) {
      console.debug('[TemplateSelect] Detected a template manager change; starting initialization...')
      await ensureTemplateManagerReady()
      await loadTemplatesByType()
    } else {
      // 立即抛错，不静默处理
      isReady.value = false
      templates.value.splice(0, templates.value.length)
      throw new Error('[TemplateSelect] Template manager is not available')
    }
  },
  { immediate: true, deep: true }
)

// 监听props.type变化，重新加载模板
watch(
  () => props.type,
  async () => {
    if (isReady.value) {
      await loadTemplatesByType()
    } else {
      throw new Error('[TemplateSelect] Cannot load templates: manager not ready')
    }
  }
)

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
const deepCompareTemplateContent = (content1: string | Array<{role: string; content: string}>, content2: string | Array<{role: string; content: string}>): boolean => {
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
const refreshTemplates = async () => {
  try {
    // 重新加载模板列表
    await loadTemplatesByType()
    
    // 检查当前选中的模板是否仍然有效
    const currentTemplate = props.modelValue
    if (currentTemplate && currentTemplate.isBuiltin) {
      // 对于内置模板，需要重新获取以确保语言正确
      try {
        const updatedTemplate = await templateManager.value?.getTemplate(currentTemplate.id)
        if (updatedTemplate && deepCompareTemplateContent(updatedTemplate.content, currentTemplate.content) === false) {
          // 模板内容已更新（比如语言切换），通知父组件
          emit('update:modelValue', updatedTemplate)
          emit('select', updatedTemplate, false) // 静默更新，不显示toast
        }
      } catch (error) {
        console.warn('[TemplateSelect] Failed to get updated template:', error)
        // 如果获取失败，尝试选择第一个可用的模板
        const availableTemplates = templates.value.filter(t => t.metadata.templateType === props.type)
        if (availableTemplates.length > 0) {
          emit('update:modelValue', availableTemplates[0])
          emit('select', availableTemplates[0], false) // 静默选择
        }
      }
    }
  } catch (error) {
    console.error('[TemplateSelect] Failed to refresh templates:', error)
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
</script>

 
