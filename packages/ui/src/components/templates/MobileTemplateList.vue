<template>
  <section class="mobile-template-list" data-testid="mobile-template-list">
    <div class="mobile-template-search">
      <NInput :value="search" clearable :placeholder="t('templateManager.searchPlaceholder')" :aria-label="t('templateManager.searchAriaLabel')" @update:value="$emit('update:search', $event)" />
      <NButton type="primary" @click="$emit('add')">{{ t('templateManager.addTemplate') }}</NButton>
    </div>
    <NSelect :value="category" :options="categories" filterable :aria-label="t('workspace.templateCategory')" @update:value="$emit('update:category', $event)" />
    <NText depth="3" class="mobile-template-count">{{ t('templateManager.templateCount', { count: templates.length }) }}</NText>
    <article v-for="template in templates" :key="template.id" class="mobile-template-row">
      <button type="button" class="mobile-template-open" @click="$emit('view', template)">
        <span class="mobile-template-name">{{ template.name }}</span>
        <span v-if="template.metadata.description" class="mobile-template-description">{{ template.metadata.description }}</span>
        <span class="mobile-template-meta">
          <span>{{ template.isBuiltin ? t('common.builtin') : t('common.custom') }}</span>
          <span>{{ Array.isArray(template.content) ? t('templateManager.advancedTemplate') : t('templateManager.simpleTemplate') }}</span>
          <strong v-if="template.id === selectedId">{{ t('template.selected') }}</strong>
        </span>
      </button>
      <NDropdown trigger="click" :options="actions(template)" @select="key => onAction(key, template)">
        <NButton quaternary :aria-label="`${template.name} · ${t('common.actions')}`">···</NButton>
      </NDropdown>
    </article>
    <NEmpty v-if="!templates.length" :description="t('template.noAvailableTemplates')" />
  </section>
</template>

<script setup lang="ts">
import { NButton, NDropdown, NEmpty, NInput, NSelect, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Template } from '@prompt-optimizer/core'

defineProps<{
  templates: Template[]
  categories: Array<{ value: string; label: string }>
  category: string
  search: string
  selectedId?: string
}>()
const emit = defineEmits<{
  'update:category': [value: string]
  'update:search': [value: string]
  add: []
  view: [template: Template]
  edit: [template: Template]
  copy: [template: Template]
  migrate: [template: Template]
  delete: [template: Template]
}>()
const { t } = useI18n()
const actions = (template: Template) => template.isBuiltin
  ? [{ key: 'copy', label: t('templateManager.copyTemplate') }]
  : [
      { key: 'edit', label: t('common.edit') },
      ...(typeof template.content === 'string' ? [{ key: 'migrate', label: t('templateManager.migrate') }] : []),
      { key: 'delete', label: t('common.delete') },
    ]
const onAction = (key: string | number, template: Template) => {
  if (key === 'edit') emit('edit', template)
  else if (key === 'copy') emit('copy', template)
  else if (key === 'migrate') emit('migrate', template)
  else if (key === 'delete') emit('delete', template)
}
</script>

<style scoped>
.mobile-template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.mobile-template-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.mobile-template-count {
  font-size: 12px;
  margin-top: 2px;
}
.mobile-template-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  border-bottom: 1px solid var(--compact-border);
}
.mobile-template-open {
  flex: 1;
  min-width: 0;
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
  padding: 10px 0 12px;
}
.mobile-template-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.mobile-template-description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.6;
  color: var(--compact-muted);
  margin-top: 4px;
}
.mobile-template-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--compact-muted);
}
.mobile-template-meta strong {
  color: var(--n-primary-color);
  font-weight: 500;
}
</style>
