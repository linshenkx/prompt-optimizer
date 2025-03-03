<!-- 输入面板组件 -->
<template>
  <div class="space-y-3">
    <!-- 标题 -->
    <div class="flex justify-between items-center">
      <label class="block text-sm theme-label">{{ label }}</label>
    </div>

    <!-- 输入框 -->
    <div class="relative">
      <textarea
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        class="w-full px-4 py-3 theme-input resize-none"
        :placeholder="placeholder"
        rows="4"
      ></textarea>
    </div>

    <!-- 控制面板 -->
    <div class="flex items-center gap-3">
      <!-- 模型选择 -->
      <div class="min-w-[120px] w-fit">
        <label class="block text-sm theme-label mb-1.5">{{ modelLabel }}</label>
        <slot name="model-select"></slot>
      </div>
      
      <!-- 提示词模板选择 -->
      <div class="flex-1">
        <label v-if="templateLabel" class="block text-sm theme-label mb-1.5">{{ templateLabel }}</label>
        <slot name="template-select"></slot>
      </div>

      <!-- 提交按钮 -->
      <div class="w-[140px]">
        <div class="h-[29px]"><!-- 占位，与其他元素对齐 --></div>
        <button
          @click="$emit('submit')"
          :disabled="loading || disabled || !modelValue.trim()"
          class="w-full h-10 theme-button-primary flex items-center justify-center space-x-2"
        >
          <span>{{ loading ? loadingText : buttonText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

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
</script>