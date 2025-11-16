<!-- 优化模式选择器组件 - 使用 Naive UI RadioGroup -->
<template>
  <NRadioGroup
    :value="modelValue"
    @update:value="updateOptimizationMode"
    size="small"
    class="optimization-mode-selector"
  >
    <NRadioButton
      v-if="!hideSystemOption"
      value="system"
      :title="systemHelp"
    >
      {{ systemLabel }}
    </NRadioButton>
    <NRadioButton
      value="user"
      :title="userHelp"
    >
      {{ userLabel }}
    </NRadioButton>
  </NRadioGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NRadioGroup, NRadioButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { OptimizationMode } from '@prompt-optimizer/core'
import type { FunctionMode } from '../composables/mode'

const { t } = useI18n()

interface Props {
  modelValue: OptimizationMode
  /** 是否隐藏系统提示词选项（用于临时禁用功能） */
  hideSystemOption?: boolean
  /** 当前功能模式，用于决定显示文案 */
  functionMode?: FunctionMode
}

interface Emits {
  (e: 'update:modelValue', value: OptimizationMode): void
  (e: 'change', value: OptimizationMode): void
}

const props = withDefaults(defineProps<Props>(), {
  hideSystemOption: false,
  functionMode: 'basic',
})
const emit = defineEmits<Emits>()

// 根据功能模式动态获取按钮文本
const systemLabel = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.optimizationMode.message')
    : t('promptOptimizer.systemPrompt')
})

const userLabel = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.optimizationMode.variable')
    : t('promptOptimizer.userPrompt')
})

const systemHelp = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.system.tooltip')
    : t('promptOptimizer.systemPromptHelp')
})

const userHelp = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.user.tooltip')
    : t('promptOptimizer.userPromptHelp')
})

/**
 * 更新优化模式
 */
const updateOptimizationMode = (mode: OptimizationMode) => {
  emit('update:modelValue', mode)
  emit('change', mode)
}
</script>

<style scoped>
/* 响应式设计 - 移动端全宽显示 */
@media (max-width: 640px) {
  .optimization-mode-selector {
    width: 100%;
  }

  .optimization-mode-selector :deep(.n-radio-button) {
    flex: 1;
  }
}
</style>