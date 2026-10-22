<template>
  <article class="mobile-model-row" :class="{ 'mobile-model-row--disabled': !enabled }">
    <div class="mobile-model-row-main">
      <button type="button" class="mobile-model-row-edit" :aria-label="`${t('common.edit')} ${title}`" @click="emit('edit')">
        <span class="mobile-model-row-title">{{ title }}</span>
        <span v-if="subtitle" class="mobile-model-row-subtitle" :title="subtitle">{{ subtitle }}</span>
      </button>
      <NDropdown trigger="click" placement="bottom-end" :options="menuOptions" @select="key => emit('action', String(key))">
        <NButton quaternary class="mobile-model-row-menu" :aria-label="`${t('modelManager.provider.more')} ${title}`">⋯</NButton>
      </NDropdown>
    </div>
    <div class="mobile-model-row-meta">
      <div class="mobile-model-row-status">
        <span class="mobile-model-row-enabled" :class="{ 'is-enabled': enabled }">{{ enabled ? t('common.enabled') : t('common.disabled') }}</span>
        <slot />
      </div>
      <NButton size="small" secondary :loading="testing" :disabled="testing || testDisabled"
        :aria-label="t('modelManager.testConnectionAriaLabel', { name: title })" @click="emit('test')">
        {{ testLabel || t('common.test') }}
      </NButton>
    </div>
    <div v-if="$slots['test-result']" class="mobile-model-row-result"><slot name="test-result" /></div>
  </article>
</template>

<script setup lang="ts">
import { NButton, NDropdown, useThemeVars, type DropdownOption } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  title: string
  subtitle?: string
  enabled: boolean
  testing?: boolean
  testDisabled?: boolean
  testLabel?: string
  menuOptions: DropdownOption[]
}>()
const emit = defineEmits<{ edit: []; test: []; action: [key: string] }>()
const { t } = useI18n()
const theme = useThemeVars()
</script>

<style scoped>
.mobile-model-row {
  padding: 12px;
  min-width: 0;
  border: 1px solid var(--compact-border);
  border-radius: 12px;
  background: var(--compact-paper);
}
.mobile-model-row-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.mobile-model-row-edit {
  flex: 1;
  min-width: 0;
  padding: 0;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  text-align: left;
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.mobile-model-row-edit:focus-visible {
  outline: 2px solid v-bind('theme.primaryColor');
  outline-offset: 3px;
  border-radius: 4px;
}
.mobile-model-row-title {
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.mobile-model-row-subtitle {
  width: 100%;
  font-size: 12px;
  color: var(--compact-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mobile-model-row-menu {
  flex-shrink: 0;
  width: 40px;
  font-size: 22px;
}
.mobile-model-row-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.mobile-model-row-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  font-size: 12px;
  color: var(--compact-muted);
}
.mobile-model-row-enabled { white-space: nowrap; }
.mobile-model-row-enabled.is-enabled { color: v-bind('theme.primaryColor'); }
.mobile-model-row--disabled .mobile-model-row-title { color: var(--compact-muted); }
.mobile-model-row-result { margin-top: 8px; min-width: 0; }
</style>
