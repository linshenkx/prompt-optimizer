<template>
  <ModelSelector v-bind="$attrs" :model-value="value || ''" :groups="groups" :selected-label="selectedLabel"
    :placeholder="placeholder" :disabled="disabled" :loading="loading" :size="size"
    :allow-custom="allowCustom" :clearable="clearable" :scope-text="scopeText || t('model.selector.draftScope')"
    @update:model-value="emit('update:value', $event)" @update:show="emit('update:show', $event)" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelSelector from './ModelSelector.vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  value?: string | null
  options: { value?: string | number | null; label?: unknown; disabled?: boolean }[]
  groupLabel?: string
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  clearable?: boolean
  allowCustom?: boolean
  scopeText?: string
  size?: 'small' | 'medium' | 'large'
}>(), { clearable: true, allowCustom: true })
const emit = defineEmits<{ 'update:value': [value: string]; 'update:show': [value: boolean] }>()
const { t } = useI18n()
const label = (option: typeof props.options[number]) => typeof option.label === 'string' ? option.label : String(option.value ?? '')
const selectedLabel = computed(() => {
  const selected = props.options.find(option => String(option.value) === props.value)
  return selected ? label(selected) : props.value || ''
})
const groups = computed(() => {
  const choices = props.options.filter(option => option.value != null).map(option => ({
    value: String(option.value), label: label(option), disabled: option.disabled,
  }))
  if (props.value && !choices.some(choice => choice.value === props.value)) choices.unshift({ value: props.value, label: props.value, disabled: false })
  // Keep the current model visible even when it is beyond the first three.
  const ordered = [...choices.filter(choice => choice.value === props.value), ...choices.filter(choice => choice.value !== props.value)]
  return [{ value: 'models', label: props.groupLabel || t('modelManager.selectModel'), choices: ordered, loading: props.loading }]
})
</script>
