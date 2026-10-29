<template>
  <ModelSelector v-bind="$attrs" :model-value="modelValue" :groups="groups"
    :selected-config="selected?.primary" :selected-label="selected?.raw.model?.name || selected?.raw.modelId"
    :placeholder="placeholder" :disabled="disabled" :size="size" :aria-label="ariaLabel"
    :scope-text="t('model.selector.columnScope')" :show-config-action="showConfigAction"
    @update:model-value="emit('update:modelValue', $event)" @focus="emit('focus')"
    @update:show="emit('update:show', $event)" @config="configure" />
</template>

<script setup lang="ts">
import { computed, inject, unref, type MaybeRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImageModelConfig } from '@prompt-optimizer/core'
import type { SelectOption } from '../types/select-options'
import ModelSelector from './ModelSelector.vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue?: string
  options: MaybeRef<SelectOption<ImageModelConfig>[]>
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  placeholder?: string
  ariaLabel?: string
  showConfigAction?: boolean
}>(), { modelValue: '', showConfigAction: true })
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'update:show': [value: boolean]; focus: []; config: [] }>()
const { t } = useI18n()
const openModelManager = inject<((tab: 'image', configId?: string) => void | Promise<void>) | null>('openModelManager', null)
const options = computed(() => unref(props.options))
const selected = computed(() => options.value.find(option => option.value === props.modelValue))
// Image generation still selects saved configurations. Capability filtering
// stays with the workspace; selecting a row never edits a shared config.
const groups = computed(() => [
  ...options.value.filter(option => option.value === props.modelValue),
  ...options.value.filter(option => option.value !== props.modelValue),
].map(option => ({
  value: option.value, label: option.primary, searchText: option.secondary,
  configurable: props.showConfigAction,
  choices: [{ value: option.value, label: option.raw.model?.name || option.raw.modelId, searchText: option.raw.modelId }],
})))
async function configure(id?: string) {
  if (id && openModelManager) await openModelManager('image', id)
  else emit('config')
}
</script>
