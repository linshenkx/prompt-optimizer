<template>
  <div class="test-variant-config" :data-feedback-tone="feedbackTone || undefined"
    :style="{ '--test-config-error': themeVars.errorColor, '--test-model-color': themeVars.textColor2, '--test-config-color': themeVars.textColor3 }">
    <div class="test-variant-config__source">
      <span class="test-variant-config__letter">{{ label }}</span>
      <TestPanelVersionSelect
        :value="version" :options="sourceOptions" :disabled="disabled"
        appearance="text" :test-id="versionTestId"
        @update:value="emit('update:version', $event)"
      />
      <NButton quaternary size="small" class="test-variant-config__icon"
        :title="t('workspace.viewPrompt')" :aria-label="`${label} ${t('workspace.viewPrompt')}`"
        @click="emit('preview')"><template #icon><Eye /></template></NButton>
      <NButton secondary circle size="small" class="test-variant-config__run"
        :loading="running" :disabled="disabled && !running" :data-testid="runTestId"
        :title="t('test.layout.runThisColumn')" :aria-label="`${label} ${t('test.layout.runThisColumn')}`"
        @click="emit('run')"><template #icon><Play /></template></NButton>
    </div>
    <div class="test-variant-config__model">
      <NTooltip :show="(hoverDetails || focusDetails) && !menuOpen && !detailsDismissed && !!selectedOption"
        :theme-overrides="tooltipThemeOverrides" :overlay-style="tooltipOverlayStyle"
        :content-style="tooltipContentStyle" placement="top-start"
        @update:show="hoverDetails = $event">
        <template #trigger>
          <div class="test-variant-config__select"
            @focusin="focusDetails = true; detailsDismissed = false" @focusout="focusDetails = false"
            @mouseenter="detailsDismissed = false" @keydown.esc.capture="detailsDismissed = true">
            <SelectWithConfig
              :model-value="modelKey" :options="options" :get-primary="getConfigLabel"
              :get-secondary="getModelDetails" :get-value="OptionAccessors.getValue"
              :aria-label="`${label} ${t('test.model')}: ${modelTitle}`"
              :data-testid="modelTestId" :disabled="disabled" size="small" :bordered="false"
              :selected-tooltip="false" :show-config-action="true" :show-empty-config-c-t-a="true"
              :placeholder="t('model.select.placeholder')" :style="{ minWidth: 0, width: '100%' }"
              @update:model-value="emit('update:modelKey', String($event ?? ''))"
              @update:show="menuOpen = $event"
              @focus="refreshModels?.()" @config="emit('config')"
            />
          </div>
        </template>
        <div v-if="selectedOption" class="test-variant-config__details">
          <strong>{{ selectedOption.primary }}</strong>
          <span>{{ getFullModelLabel(selectedOption) }}</span>
          <span>{{ selectedOption.secondary }}</span>
        </div>
      </NTooltip>
      <TextModelQuickSwitch :model-key="modelKey" :options="options" :disabled="disabled"
        :refresh-models="refreshModels" icon-only :scope-hint="t('test.config.sharedConfigHint')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NTooltip, useThemeVars } from 'naive-ui'
import { Eye, Play } from '@lucide/vue'
import type { TextModelConfig } from '@prompt-optimizer/core'
import type { ModelSelectOption, SelectOption } from '../types/select-options'
import type { TestPanelVersionOption } from '../utils/testPanelVersion'
import { OptionAccessors } from '../utils/data-transformer'
import SelectWithConfig from './SelectWithConfig.vue'
import TextModelQuickSwitch from './TextModelQuickSwitch.vue'
import TestPanelVersionSelect from './TestPanelVersionSelect.vue'
import { useTooltipTheme } from '../composables/ui/useTooltipTheme'

const props = defineProps<{
  label: string
  version: string | number
  versionOptions: TestPanelVersionOption[]
  modelKey: string
  options: ModelSelectOption[]
  disabled?: boolean
  running?: boolean
  feedbackTone?: 'change' | 'error' | null
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
const hoverDetails = ref(false)
const focusDetails = ref(false)
const menuOpen = ref(false)
const detailsDismissed = ref(false)
const { tooltipThemeOverrides, tooltipOverlayStyle, tooltipContentStyle } = useTooltipTheme({ maxWidth: '360px' })
const sourceOptions = computed(() => props.versionOptions.map(option => {
  const replacement = option.value === 'workspace' ? t('test.config.current')
    : option.value === 0 ? t('test.config.original') : null
  return replacement ? { ...option, label: replacement,
    fullLabel: option.fullLabel.replace(option.label, replacement) } : option
}))
const getFullModelLabel = (option: SelectOption) => {
  const config = option.raw as TextModelConfig | undefined
  return config?.modelMeta?.name || config?.modelMeta?.id || option.primary
}
const getConfigLabel = (option: SelectOption) => option.primary
const getModelDetails = (option: SelectOption) => `${getFullModelLabel(option)} · ${option.secondary}`
const selectedOption = computed(() => props.options.find(option => option.value === props.modelKey))
const modelTitle = computed(() => {
  const option = selectedOption.value
  return option ? `${getFullModelLabel(option)} · ${option.primary} · ${option.secondary}` : ''
})
</script>

<style scoped>
.test-variant-config { min-width: 0; display: grid; gap: 6px; }
.test-variant-config__source { display: flex; align-items: center; gap: 4px; min-width: 0; height: 28px; }
.test-variant-config__letter { flex: none; width: 12px; font-size: 12px; color: var(--n-text-color-3); }
.test-variant-config__source > :deep(.test-panel-version-select) { flex: 1; min-width: 0; width: 0; }
.test-variant-config__icon, .test-variant-config__run { flex: none; width: 28px; height: 28px; }
.test-variant-config__model { display: grid; grid-template-columns: minmax(0, 1fr) 24px; gap: 4px; align-items: center; min-width: 0; margin-inline-start: 16px; }
.test-variant-config__select { min-width: 0; }
.test-variant-config__model :deep(.n-base-selection) { --n-height: 28px !important; --n-font-size: 13px !important; }
.test-variant-config__model :deep(.n-base-selection-overlay) { padding-inline-start: 4px; }
.test-variant-config__model :deep(.n-base-selection .swc-primary) { color: color-mix(in srgb, var(--test-model-color) 70%, var(--test-config-color)); font-size: 13px; font-weight: 400; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.test-variant-config__details { display: grid; gap: 4px; overflow-wrap: anywhere; }
@media (hover: hover) and (pointer: fine) {
  .test-variant-config__model > .text-model-quick-switch { opacity: 0; pointer-events: none; transition: opacity 120ms ease; }
  .test-variant-config__model:hover > .text-model-quick-switch,
  .test-variant-config__model:focus-within > .text-model-quick-switch,
  .test-variant-config__model:has([aria-expanded='true']) > .text-model-quick-switch { opacity: 1; pointer-events: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .test-variant-config__model > .text-model-quick-switch { transition: none; }
}
.test-variant-config[data-feedback-tone='error'] { outline: 1px solid var(--test-config-error); outline-offset: 3px; border-radius: 4px; }
</style>
