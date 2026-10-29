<template>
  <NTooltip>
    <template #trigger>
      <NButton quaternary size="small" class="compare-role-summary"
        :type="warning ? 'warning' : 'default'" :disabled="disabled"
        :aria-label="`${t('evaluation.compareConfig.dialogTitle')}: ${fullSummary}`"
        data-testid="test-compare-settings" @click="emit('click')">
        <template #icon><SlidersHorizontal /></template>
        <span class="compare-role-summary__text">{{ summary }}</span>
        <CircleAlert v-if="warning" class="compare-role-summary__warning" :size="14" />
      </NButton>
    </template>
    <div class="compare-role-summary__tooltip">
      <strong>{{ t('evaluation.compareConfig.dialogTitle') }}</strong>
      <div v-for="entry in entries" :key="entry.id">
        {{ entry.label }} · {{ getRoleLabel(entry) }}
        <span> — {{ buildCompareRoleTooltipCopy(t, entry)?.source }}</span>
      </div>
      <div v-if="warning">{{ warning }}</div>
    </div>
  </NTooltip>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NTooltip } from 'naive-ui'
import { SlidersHorizontal, CircleAlert } from '@lucide/vue'
import { buildCompareRoleTooltipCopy, getCompareRoleLabel, type CompareRoleUiEntry } from './compare-ui'
const props = defineProps<{
  entries: (CompareRoleUiEntry & { id: string; label: string })[]
  warning?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ click: [] }>()
const { t } = useI18n()
const getRoleLabel = (entry: CompareRoleUiEntry) => {
  if (entry.effectiveRole === 'target') return t('test.config.target')
  return entry.effectiveRole ? getCompareRoleLabel(t, entry.effectiveRole) : t('test.config.unassigned')
}
const summary = computed(() => props.entries.map(entry => `${entry.label} ${getRoleLabel(entry)}`).join(' · '))
const fullSummary = computed(() => [summary.value, props.warning].filter(Boolean).join(' · '))
</script>
<style scoped>
.compare-role-summary { min-width: 28px; max-width: 100%; font-size: 12px; height: 28px; padding: 0 4px; }
.compare-role-summary :deep(.n-button__content) { min-width: 0; overflow: hidden; }
.compare-role-summary__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compare-role-summary__warning { flex: none; margin-left: 4px; }
.compare-role-summary__tooltip { max-width: 360px; display: grid; gap: 6px; }
</style>
