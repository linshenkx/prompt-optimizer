<template>
  <div class="optimization-controls-container">
    <div class="optimization-controls" :class="{ 'optimization-controls--compact': compact, 'optimization-controls--single': !$slots.template }">
      <div class="optimization-controls__field">
        <div class="optimization-controls__label-row">
          <NText depth="2" class="optimization-controls__label">{{ modelLabel || t('promptOptimizer.optimizeModel') }}</NText>
          <slot name="model-label-extra" />
        </div>
        <slot name="model" />
      </div>
      <div v-if="$slots.template" class="optimization-controls__field">
        <NText depth="2" class="optimization-controls__label">{{ templateLabel || t('promptOptimizer.templateLabel') }}</NText>
        <slot name="template" />
      </div>
      <div class="optimization-controls__actions">
        <slot name="extra" />
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
defineProps<{ compact?: boolean; modelLabel?: string; templateLabel?: string }>()
const { t } = useI18n()
</script>

<style scoped>
.optimization-controls-container { min-width: 0; width: 100%; container-type: inline-size; }
.optimization-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) max-content; gap: 8px; align-items: end; }
.optimization-controls--single { grid-template-columns: minmax(0, 1fr) max-content; }
.optimization-controls__field { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.optimization-controls__field :deep(.swc-select) { min-width: 0 !important; width: 100%; }
.optimization-controls__label { font-size: 12px; line-height: 20px; white-space: nowrap; }
.optimization-controls__label-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.optimization-controls__actions { display: flex; align-items: center; justify-content: end; gap: 8px; }
.optimization-controls__actions :deep(.n-button) { flex: none; font-size: 14px; }
@container (max-width: 440px) {
  .optimization-controls:not(.optimization-controls--compact) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .optimization-controls:not(.optimization-controls--compact) .optimization-controls__actions { grid-column: 1 / -1; }
}
.optimization-controls--compact { grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr) max-content; gap: 6px; }
.optimization-controls--compact.optimization-controls--single { grid-template-columns: minmax(0, 1fr) max-content; }
.optimization-controls--compact .optimization-controls__label { display: none; }
.optimization-controls--compact .optimization-controls__label-row { display: none; }
.optimization-controls--compact .optimization-controls__actions { min-width: 0; }
.optimization-controls--compact .optimization-controls__field :deep(.text-model-selector) { height: 44px; }
.optimization-controls--compact .optimization-controls__actions :deep(.n-button) { min-width: 48px; height: 44px; padding: 0 10px; }
</style>
