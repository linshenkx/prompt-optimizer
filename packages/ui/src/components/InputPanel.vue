<!-- 输入面板组件 -->
<template>
  <div class="space-y-3">
    <!-- 标题 -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
      <label class="block text-lg theme-label">{{ label }}</label>
      <div class="flex items-center space-x-3">
        <slot name="optimization-mode-selector"></slot>
        <button
          @click="openFullscreen"
          class="px-3 py-1.5 theme-button-secondary flex items-center space-x-2"
          :title="$t('common.expand')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 输入框 -->
    <div class="relative">
      <textarea
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        class="w-full theme-input resize-none"
        :placeholder="placeholder"
        rows="4"
      ></textarea>
    </div>

    <!-- 控制面板 -->
    <div class="flex items-center gap-2">
      <!-- 模型选择 -->
      <div class="min-w-[120px] w-fit shrink-0">
        <label class="block text-sm theme-label mb-1.5">{{ modelLabel }}</label>
        <slot name="model-select"></slot>
      </div>
      
      <!-- 提示词模板选择 -->
      <div v-if="templateLabel" class="flex-1 min-w-0">
        <label class="block text-sm theme-label mb-1.5 truncate">{{ templateLabel }}</label>
        <slot name="template-select"></slot>
      </div>

      <!-- 控制按钮组插槽 -->
      <slot name="control-buttons"></slot>

      <!-- 提交按钮 -->
      <div class="min-w-[60px]">
        <div class="h-[20px] mb-1.5"><!-- 占位，与其他元素对齐 --></div>
        <button
          @click="$emit('submit')"
          :disabled="loading || disabled || !modelValue.trim()"
          class="w-full h-10 theme-button-primary flex items-center truncate justify-center space-x-1"
        >
          <span>{{ loading ? loadingText : buttonText }}</span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- 全屏弹窗 -->
  <FullscreenDialog v-model="isFullscreen" :title="label">
    <div class="h-full flex flex-col">
      <textarea
        v-model="fullscreenValue"
        class="w-full h-full min-h-[70vh] p-4 theme-input resize-none overflow-auto flex-1"
        :placeholder="placeholder"
      ></textarea>
    </div>
  </FullscreenDialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFullscreen } from '../composables/useFullscreen'
import FullscreenDialog from './FullscreenDialog.vue'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  selectedModel: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  modelLabel: {
    type: String,
    required: true
  },
  templateLabel: {
    type: String,
    default: ''
  },
  buttonText: {
    type: String,
    required: true
  },
  loadingText: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'update:selectedModel', 'submit', 'configModel'])

// 定义插槽类型 - 使用更兼容的方式
defineSlots<{
  'optimization-mode-selector': (props: Record<string, never>) => any
  'model-select': (props: Record<string, never>) => any
  'template-select': (props: Record<string, never>) => any
  'control-buttons': (props: Record<string, never>) => any
}>()

// 使用全屏组合函数
const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
  computed(() => props.modelValue),
  (value) => emit('update:modelValue', value)
)
</script>