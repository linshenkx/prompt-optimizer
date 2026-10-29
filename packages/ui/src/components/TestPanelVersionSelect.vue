<template>
  <NTooltip
    trigger="hover"
    :disabled="!selectedOption || !tooltipLines.length"
    :theme-overrides="tooltipThemeOverrides"
    :overlay-style="tooltipOverlayStyle"
    :content-style="tooltipContentStyle"
  >
    <template #trigger>
      <NSelect
        :value="value"
        :options="options"
        :render-label="renderOptionLabel"
        :disabled="disabled"
        size="small"
        :bordered="appearance !== 'text'"
        :data-testid="testId"
        class="test-panel-version-select"
        :class="{ 'test-panel-version-select--text': appearance === 'text' }"
        @update:value="handleUpdate"
      />
    </template>
    <div class="test-panel-version-select__tooltip">
      <div class="test-panel-version-select__tooltip-title">
        {{ selectedOption?.fullLabel }}
      </div>
      <div
        v-for="line in tooltipLines"
        :key="line"
        class="test-panel-version-select__tooltip-line"
      >
        {{ line }}
      </div>
    </div>
  </NTooltip>
</template>

<script setup lang="ts">
import { computed, h, type VNodeChild } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NTooltip, type SelectOption } from 'naive-ui'
import type { TestPanelVersionOption } from '../utils/testPanelVersion'
import { useTooltipTheme } from '../composables/ui/useTooltipTheme'

const props = defineProps<{
  value: string | number
  options: TestPanelVersionOption[]
  disabled?: boolean
  testId?: string
  appearance?: 'default' | 'text'
}>()

const emit = defineEmits<{
  'update:value': [value: string | number]
}>()

const { t } = useI18n()
const {
  tooltipThemeOverrides,
  tooltipOverlayStyle,
  tooltipContentStyle,
} = useTooltipTheme({
  maxWidth: '280px',
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
})

const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.value) || null
)

const tooltipLines = computed(() => {
  const option = selectedOption.value
  if (!option) return []

  const lines: string[] = []
  const meta = option.meta
  if (option.value === 'previous' && meta) {
    switch (meta.resolutionReason) {
      case 'currentBase':
        lines.push(t('test.layout.previousHelp.currentBase'))
        break
      case 'earlierSaved':
        lines.push(t('test.layout.previousHelp.earlierSaved'))
        break
      case 'originalFallback':
        lines.push(t('test.layout.previousHelp.originalFallback'))
        break
      default:
        break
    }

    if (meta.isSameAsWorkspace) {
      lines.push(t('test.layout.previousHelp.sameAsWorkspace'))
    }
  }

  if (!lines.length && option.fullLabel !== option.label) {
    lines.push(option.fullLabel)
  }

  return lines
})

const renderOptionLabel = (
  option: SelectOption & { fullLabel?: string }, selected: boolean
): VNodeChild => {
  const fullLabel = typeof option.fullLabel === 'string'
    ? option.fullLabel
    : String(option.label ?? '')
  return h('div', { class: 'test-panel-version-select__menu-label', title: fullLabel },
    selected && props.appearance === 'text' ? String(option.label ?? '') : fullLabel)
}

const handleUpdate = (nextValue: string | number | null) => {
  if (nextValue == null) return
  emit('update:value', nextValue)
}
</script>

<style scoped>
.test-panel-version-select {
  width: 108px;
}
.test-panel-version-select--text :deep(.n-base-selection) { --n-font-size: 13px !important; --n-height: 28px !important; background: transparent; }
.test-panel-version-select--text :deep(.n-base-selection-label) { background: transparent; }
.test-panel-version-select--text :deep(.n-base-selection-label .n-base-selection-input) { padding-left: 4px; }

.test-panel-version-select__menu-label {
  white-space: nowrap;
}

.test-panel-version-select__tooltip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 280px;
}

.test-panel-version-select__tooltip-title {
  font-weight: 600;
}

.test-panel-version-select__tooltip-line {
  line-height: 1.55;
}
</style>
