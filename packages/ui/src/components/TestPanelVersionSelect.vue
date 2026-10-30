<template>
  <NPopover
    trigger="hover"
    :show="previewVisible && !menuOpen" :delay="400" :duration="150"
    :disabled="menuOpen || (!previewSource && !tooltipLines.length)"
    :style="previewSource ? { width: 'min(360px, calc(100vw - 32px))' } : { maxWidth: '280px' }"
    @update:show="previewVisible = $event"
  >
    <template #trigger>
      <NSelect
        :value="value" :show="menuOpen"
        @update:show="handleMenuShow" @keydown.esc="previewVisible = false"
        :options="options"
        :render-label="renderOptionLabel"
        :disabled="disabled"
        size="small"
        :bordered="appearance !== 'text'"
        :data-testid="testId"
        class="test-panel-version-select"
        :class="{ 'test-panel-version-select--text': appearance === 'text' }"
        @update:value="handleUpdate"
      >
        <template v-if="previewSource" #action>
          <NButton quaternary block size="small" @click="requestPreview">{{ t('workspace.viewPrompt') }}</NButton>
        </template>
      </NSelect>
    </template>
    <div v-if="previewSource" class="source-hover-preview" data-testid="test-source-hover-preview">
      <div class="source-hover-preview__title">{{ selectedOption?.fullLabel }}</div>
      <div v-for="line in tooltipLines.filter(line => line !== selectedOption?.fullLabel)" :key="line" class="source-hover-preview__meta">{{ line }}</div>
      <div ref="previewBody" class="source-hover-preview__content">{{ previewContent || t('workspace.emptyPromptReference') }}</div>
      <NButton v-if="previewOverflows" text size="small" class="source-hover-preview__full" @click="requestPreview">{{ t('workspace.viewFullPrompt') }}</NButton>
    </div>
    <div v-else class="test-panel-version-select__tooltip">
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
  </NPopover>
</template>

<script setup lang="ts">
import { computed, h, ref, watch, type VNodeChild } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { NSelect, NPopover, NButton, type SelectOption } from 'naive-ui'
import type { TestPanelVersionOption } from '../utils/testPanelVersion'

const props = defineProps<{
  value: string | number
  options: TestPanelVersionOption[]
  disabled?: boolean
  testId?: string
  appearance?: 'default' | 'text'
  previewSource?: () => { content: string; title?: string }
}>()

const emit = defineEmits<{
  'update:value': [value: string | number]
  preview: []
}>()

const { t } = useI18n()
const menuOpen = ref(false)
const previewVisible = ref(false)
const previewContent = computed(() => props.previewSource?.().content ?? '')
const previewBody = ref<HTMLElement | null>(null)
const previewOverflows = ref(false)
const measurePreview = () => {
  const body = previewBody.value
  previewOverflows.value = !!previewContent.value.trim() && !!body && body.clientHeight > 0
    && body.scrollHeight > body.clientHeight + 1
}
useResizeObserver(previewBody, measurePreview)
watch([previewContent, previewBody, previewVisible], measurePreview, { flush: 'post' })
const handleMenuShow = (show: boolean) => {
  previewVisible.value = false
  menuOpen.value = show
}
const requestPreview = () => {
  menuOpen.value = false
  previewVisible.value = false
  emit('preview')
}


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
  return h('div', { class: 'test-panel-version-select__menu-label', title: selected && props.previewSource ? undefined : fullLabel },
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
.source-hover-preview { min-width: 0; }
.source-hover-preview__title { font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.source-hover-preview__meta { font-size: 12px; opacity: .7; margin-bottom: 6px; }
.source-hover-preview__content { max-height: min(240px, 45vh); overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.7; }
.source-hover-preview__full { margin-top: 10px; }
</style>
