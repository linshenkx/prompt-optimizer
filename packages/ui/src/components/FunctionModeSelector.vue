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
      @click="handleModeClick('basic')"
    >
      {{ t('nav.basicMode') }}
    </NRadioButton>
    <NRadioButton
      data-testid="function-mode-pro"
      value="pro"
      :title="t('nav.contextMode')"
      @click="handleModeClick('pro')"
    >
      {{ t('nav.contextMode') }}
    </NRadioButton>
    <NRadioButton
      data-testid="function-mode-image"
      value="image"
      :title="t('nav.imageMode')"
      @click="handleModeClick('image')"
    >
      {{ t('nav.imageMode') }}
    </NRadioButton>
    <NRadioButton data-testid="function-mode-arena" value="arena" @click="handleModeClick('arena')">{{ t('arena.title') }}</NRadioButton>
  </NRadioGroup>
</template>

<script setup lang="ts">
import { NRadioGroup, NRadioButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: 'basic' | 'pro' | 'image' | 'arena'
  allowReselect?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: 'basic' | 'pro' | 'image' | 'arena'): void
  (e: 'change', value: 'basic' | 'pro' | 'image' | 'arena'): void
}

const props = withDefaults(defineProps<Props>(), {
  allowReselect: false,
})
const emit = defineEmits<Emits>()

/**
 * 更新功能模式
 */
const updateFunctionMode = (mode: 'basic' | 'pro' | 'image' | 'arena') => {
  emit('update:modelValue', mode)
  emit('change', mode)
}

const handleModeClick = (mode: 'basic' | 'pro' | 'image' | 'arena') => {
  if (props.allowReselect && props.modelValue === mode) {
    emit('change', mode)
  }
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
