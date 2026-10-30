<template>
  <div class="test-variant-config" :data-feedback-tone="feedbackTone || undefined"
    :style="{ '--test-config-error': themeVars.errorColor, '--test-model-color': themeVars.textColor2, '--test-config-color': themeVars.textColor3 }">
    <div class="test-variant-config__source">
      <span :key="feedbackKey" class="test-variant-config__letter">{{ label }}</span>
      <TestPanelVersionSelect
        :value="version" :options="sourceOptions" :disabled="disabled"
        appearance="text" :test-id="versionTestId"
        @update:value="emit('update:version', $event)"
      />
      <NButton quaternary size="small" class="test-variant-config__icon"
        :title="t('workspace.viewPrompt')" :aria-label="`${label} ${t('workspace.viewPrompt')}`"
        @click="emit('preview')"><template #icon><Eye /></template></NButton>
      <span class="test-variant-config__run-trigger" :title="runTooltip || t('test.layout.runThisColumn')">
        <NButton secondary circle size="small" class="test-variant-config__run"
          :loading="running" :disabled="runDisabled ?? (disabled && !running)" :data-testid="runTestId"
          :aria-label="`${label} ${t('test.layout.runThisColumn')}`"
          @click="emit('run')"><template #icon><Play /></template></NButton>
      </span>
    </div>
    <div class="test-variant-config__model">
      <slot name="model">
        <TextModelSelector :model-value="modelKey" :options="options || []" scope="column"
          :aria-label="label + ' ' + t('test.model')" :data-testid="modelTestId"
          :disabled="disabled" size="small"
          @update:model-value="emit('update:modelKey', $event)"
          @focus="refreshModels?.()" @config="emit('config')" />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, useThemeVars } from 'naive-ui'
import { Eye, Play } from '@lucide/vue'
import type { ModelSelectOption } from '../types/select-options'
import type { TestPanelVersionOption } from '../utils/testPanelVersion'
import TextModelSelector from './TextModelSelector.vue'
import TestPanelVersionSelect from './TestPanelVersionSelect.vue'

const props = defineProps<{
  label: string
  version: string | number
  versionOptions: TestPanelVersionOption[]
  modelKey: string
  options?: ModelSelectOption[]
  disabled?: boolean
  runDisabled?: boolean
  runTooltip?: string
  running?: boolean
  feedbackTone?: 'change' | 'error' | null
  feedbackKey?: number
  refreshModels?: () => Promise<void>
  versionTestId: string
  modelTestId: string
  runTestId: string
}>()
const emit = defineEmits<{
  'update:version': [value: string | number]
  'update:modelKey': [value: string]
  preview: []
  run: []
  config: []
}>()
const { t } = useI18n()
const themeVars = useThemeVars()
const sourceOptions = computed(() => props.versionOptions.map(option => {
  const replacement = option.value === 'workspace' ? t('workspace.optimizeWorkspace')
    : option.value === 0 ? t('promptOptimizer.originalPrompt') : null
  return replacement ? { ...option, label: replacement,
    fullLabel: option.fullLabel.replace(option.label, replacement) } : option
}))
</script>

<style scoped>
.test-variant-config { min-width: 0; display: grid; gap: 6px; }
.test-variant-config__source { display: flex; align-items: center; gap: 4px; min-width: 0; height: 28px; }
.test-variant-config__letter { flex: none; width: 12px; font-size: 12px; color: var(--n-text-color-3); }
.test-variant-config__source > :deep(.test-panel-version-select) { flex: 1; min-width: 0; width: 0; }
.test-variant-config__icon, .test-variant-config__run { flex: none; width: 28px; height: 28px; }
.test-variant-config__run-trigger { flex: none; display: inline-flex; }
.test-variant-config__model { min-width: 0; margin-inline-start: 16px; }
.test-variant-config__select { min-width: 0; }
.test-variant-config[data-feedback-tone='error'] { outline: 1px solid var(--test-config-error); outline-offset: 3px; border-radius: 4px; }
.test-variant-config[data-feedback-tone='change'] .test-variant-config__letter { animation: test-source-change 780ms ease-out; }
@keyframes test-source-change { 30% { opacity: 0.45; } }
@media (prefers-reduced-motion: reduce) {
  .test-variant-config[data-feedback-tone='change'] .test-variant-config__letter { animation: none; }
}
</style>
