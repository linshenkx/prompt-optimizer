<template>
  <NCard class="test-global-controls" size="small" :style="{ flexShrink: 0 }">
    <div class="test-workspace-toolbar test-area-top" :class="{ 'test-workspace-toolbar--compact': compact }">
      <div class="test-group-count">
        <NText depth="2" class="test-area-label">{{ t(compact ? 'workspace.testGroups' : 'test.title') }}</NText>
        <NRadioGroup :value="count" size="small" :disabled="running"
          :aria-label="t('workspace.testGroups')" @update:value="updateCount">
          <NRadioButton v-for="value in [2, 3, 4]" :key="value" :value="value"
            :disabled="value === 4 && !canUseFourColumns"
            :data-testid="columnTestIdPrefix ? `${columnTestIdPrefix}-${value}` : undefined">{{ value }}</NRadioButton>
        </NRadioGroup>
      </div>
      <div v-if="!compact && $slots.comparison" class="test-comparison-entry"><slot name="comparison" /></div>
      <div v-if="!compact" class="test-global-actions">
        <NButton type="primary" size="small" :loading="running" :disabled="running"
          :data-testid="runTestId" @click="emit('run')">{{ t('test.layout.runAll') }}</NButton>
        <slot name="evaluation" />
      </div>
    </div>
  </NCard>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton, NCard, NRadioButton, NRadioGroup, NText } from 'naive-ui'
defineProps<{
  count: number
  running?: boolean
  compact?: boolean
  canUseFourColumns: boolean
  runTestId: string
  columnTestIdPrefix?: string
}>()
const emit = defineEmits<{ 'update:count': [value: 2 | 3 | 4]; run: [] }>()
const updateCount = (value: unknown) => {
  if (value === 2 || value === 3 || value === 4) emit('update:count', value)
}
const { t } = useI18n()
</script>

<style scoped>
.test-workspace-toolbar { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; }
.test-group-count { display: flex; align-items: center; gap: 6px; flex: none; }
.test-area-label { font-size: 12px; white-space: nowrap; }
.test-group-count :deep(.n-radio-button) { padding: 0 9px; font-size: 13px; }
.test-comparison-entry { flex: 1 1 0; min-width: 28px; }
.test-global-actions { display: flex; align-items: center; gap: 4px; flex: none; margin-inline-start: auto; }
.test-global-actions :deep(.n-button) { font-size: 13px; }
</style>
