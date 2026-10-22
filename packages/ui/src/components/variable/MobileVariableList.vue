<template>
  <div class="mobile-variable-list">
    <article v-for="variable in variables" :key="variable.name" class="mobile-variable-item">
      <button v-if="!readonly" class="mobile-variable-main" :disabled="disabled" @click="$emit('edit', variable)">
        <strong>{{ formatName(variable.name) }}</strong>
        <span class="mobile-variable-summary">{{ variable.value }}</span>
      </button>
      <details v-else class="mobile-variable-details">
        <summary>
          <strong>{{ formatName(variable.name) }}</strong>
          <span class="mobile-variable-summary">{{ predefined ? description(variable.name) : variable.value }}</span>
        </summary>
        <pre>{{ variable.value }}</pre>
      </details>
      <NDropdown trigger="click" :options="actions" @select="key => handleAction(key, variable.name)">
        <NButton quaternary :disabled="disabled" :aria-label="`${t('common.actions')}: ${variable.name}`">⋯</NButton>
      </NDropdown>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NDropdown } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VariableSource } from '../../types/variable'

const props = defineProps<{
  variables: Array<{ name: string; value: string; source: VariableSource }>
  disabled?: boolean
  readonly?: boolean
  predefined?: boolean
}>()
const emit = defineEmits<{
  edit: [variable: { name: string; value: string; source: VariableSource }]
  copy: [name: string]
  delete: [name: string]
}>()
const { t } = useI18n()
const formatName = (name: string) => `{{${name}}}`
const description = (name: string) => {
  const key = `variables.predefinedDescriptions.${name}`
  const value = t(key)
  return value === key ? name : value
}
const actions = computed(() => [
  { key: 'copy', label: t('common.copy') },
  ...(!props.readonly ? [{ key: 'delete', label: t('common.delete') }] : []),
])
const handleAction = (key: string, name: string) => {
  if (key === 'copy') emit('copy', name)
  if (key === 'delete' && !props.readonly) emit('delete', name)
}
</script>

<style scoped>
.mobile-variable-item {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 0;
  border-bottom: 1px solid var(--compact-border);
}
.mobile-variable-main,
.mobile-variable-details {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: inherit;
  text-align: left;
}
.mobile-variable-main {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.mobile-variable-main:disabled { opacity: .6; cursor: default; }
.mobile-variable-item strong {
  display: block;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.mobile-variable-summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  color: var(--compact-muted);
  font-size: 13px;
  line-height: 1.5;
  margin-top: 4px;
}
.mobile-variable-details summary { cursor: pointer; }
.mobile-variable-details pre {
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
  margin: 8px 0 0;
}
</style>
