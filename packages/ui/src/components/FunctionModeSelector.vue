<!-- 功能模式选择器组件 - 使用 Naive UI RadioGroup -->
<template>
  <NRadioGroup data-testid="function-mode-selector"
    :value="modelValue"
    @update:value="updateFunctionMode"
    size="small"
    class="function-mode-selector"
  >
    <NRadioButton
      data-testid="function-mode-basic"
      value="basic"
      :title="t('nav.basicMode')"
    >
      {{ t('nav.basicMode') }}
    </NRadioButton>
    <NRadioButton
      data-testid="function-mode-pro"
      value="pro"
      :title="t('nav.contextMode')"
    >
      {{ t('nav.contextMode') }}
    </NRadioButton>
    <NRadioButton
      data-testid="function-mode-image"
      value="image"
      :title="t('nav.imageMode')"
    >
      {{ t('nav.imageMode') }}
    </NRadioButton>
  </NRadioGroup>
</template>

<script setup lang="ts">
import { NRadioGroup, NRadioButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: 'basic' | 'pro' | 'image'
}

interface Emits {
  (e: 'update:modelValue', value: 'basic' | 'pro' | 'image'): void
  (e: 'change', value: 'basic' | 'pro' | 'image'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

/**
 * 更新功能模式
 */
const updateFunctionMode = (mode: 'basic' | 'pro' | 'image') => {
  emit('update:modelValue', mode)
  emit('change', mode)
}
</script>

<style scoped>
/* 响应式设计 - 移动端全宽显示 */
@media (max-width: 640px) {
  .function-mode-selector {
    width: 100%;
  }

  .function-mode-selector :deep(.n-radio-button) {
    flex: 1;
  }
}
</style>