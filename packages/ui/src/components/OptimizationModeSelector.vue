<!-- 优化模式选择器组件 - 使用 Naive UI RadioGroup -->
<template>
  <NRadioGroup
    :value="modelValue"
    @update:value="updateOptimizationMode"
    size="small"
    class="optimization-mode-selector"
  >
    <!-- 基础模式：系统 | 用户 -->
    <template v-if="functionMode !== 'pro'">
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
    </template>
    <!-- Pro 模式：变量 | 多对话 -->
    <template v-else>
      <NRadioButton
        value="variable"
        :title="userHelp"
      >
        {{ userLabel }}
      </NRadioButton>
      <NRadioButton
        v-if="!hideSystemOption"
        value="multi"
        :title="systemHelp"
      >
        {{ systemLabel }}
      </NRadioButton>
    </template>
  </NRadioGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NRadioGroup, NRadioButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { BasicSubMode, ProSubMode } from '@prompt-optimizer/core'
import type { FunctionMode } from '../composables/mode'

const { t } = useI18n()

type SubMode = BasicSubMode | ProSubMode

interface Props {
  modelValue: SubMode
  /** 是否隐藏系统提示词选项（用于临时禁用功能） */
  hideSystemOption?: boolean
  /** 当前功能模式，用于决定显示文案 */
  functionMode?: FunctionMode
}

interface Emits {
  (e: 'update:modelValue', value: SubMode): void
  (e: 'change', value: SubMode): void
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
const updateOptimizationMode = (mode: SubMode) => {
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
