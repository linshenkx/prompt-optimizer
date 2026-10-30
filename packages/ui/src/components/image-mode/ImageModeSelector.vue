<template>
  <NRadioGroup :value="modelValue" size="small" :disabled="disabled" @update:value="handleModeUpdate">
    <NRadioButton
      data-testid="image-sub-mode-text2image"
      :value="'text2image'"
      @click="handleReselect('text2image', $event)"
      :disabled="disabled"
    >
      {{ t('imageMode.text2image') }}
    </NRadioButton>
    <NRadioButton
      data-testid="image-sub-mode-image2image"
      :value="'image2image'"
      @click="handleReselect('image2image', $event)"
      :disabled="disabled"
    >
      {{ t('imageMode.image2image') }}
    </NRadioButton>
    <NRadioButton
      data-testid="image-sub-mode-multiimage"
      :value="'multiimage'"
      @click="handleReselect('multiimage', $event)"
      :disabled="disabled"
    >
      {{ t('imageMode.multiimage') }}
    </NRadioButton>
  </NRadioGroup>
</template>

<script setup lang="ts">
import { NRadioGroup, NRadioButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

export type ImageMode = 'text2image' | 'image2image' | 'multiimage'

interface Props {
  modelValue: ImageMode
  disabled?: boolean
  allowReselect?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: ImageMode): void
  (e: 'change', value: ImageMode): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  allowReselect: false,
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

const handleModeUpdate = (value: string | number | boolean) => {
  if (value === props.modelValue) return
  if (value === 'text2image' || value === 'image2image' || value === 'multiimage') {
    handleModeChange(value)
  }
}

const handleReselect = (mode: ImageMode, event: MouseEvent) => {
  // A label click also forwards a click to its input; handle only that activation.
  if (!(event.target instanceof HTMLInputElement)) return
  if (props.allowReselect && props.modelValue === mode) handleModeChange(mode)
}

const handleModeChange = (mode: ImageMode) => {
  if (props.disabled) return
  if (props.modelValue === mode && !props.allowReselect) return

  emit('update:modelValue', mode)
  emit('change', mode)
}
</script>
