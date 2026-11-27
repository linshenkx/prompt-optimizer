<template>
  <div class="video-param" :data-testid="testId">
    <div class="video-param-label">
      <NText depth="2">{{ t(definition.labelKey) }}</NText>
      <ThemedTooltip v-if="action" :label="actionLabel">
        <NButton text size="tiny" :aria-label="actionLabel" :disabled="disabled"
          :data-testid="testId + '-' + action" @click="emit('action')">
          <template #icon><Split v-if="action === 'split'" /><Merge v-else /></template>
        </NButton>
      </ThemedTooltip>
    </div>
    <NSelect :value="typeof value === 'boolean' ? String(value) : value ?? null" :aria-label="t(definition.labelKey)" :options="options"
      :disabled="disabled || options.length === 1" size="small"
      :placeholder="t('video.mixedValues')" @update:value="update" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Merge, Split } from '@lucide/vue'
import { NButton, NSelect, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VideoParamDefinition, VideoParamValue } from '@prompt-optimizer/core'
import ThemedTooltip from '../common/ThemedTooltip.vue'
import { useVideoSettings } from './useVideoSettings'

const props = defineProps<{
  definition: VideoParamDefinition; value?: VideoParamValue; disabled?: boolean; testId: string; action?: 'split' | 'merge'
}>()
const emit = defineEmits<{ change: [value: VideoParamValue]; action: [] }>()
const { t } = useI18n()
const { paramLabel } = useVideoSettings()
const actionLabel = computed(() => t('video.' + props.action + 'Param', { name: t(props.definition.labelKey) }))
// Naive UI select options accept strings/numbers, so booleans use string values at the view boundary.
const options = computed(() => {
  const def = props.definition
  const values = def.kind === 'boolean' ? [false, true] : def.kind === 'enum' ? def.options
    : Array.from({ length: Math.floor((def.max - def.min) / def.step) + 1 }, (_, i) => def.min + i * def.step)
  return values.map(value => ({ value: typeof value === 'boolean' ? String(value) : value, label: paramLabel(def.key, value) }))
})
function update(value: string | number) {
  emit('change', props.definition.kind === 'boolean' ? value === 'true' : value)
}
</script>

<style scoped>
.video-param { display: grid; min-width: 0; gap: 4px; }
.video-param-label { display: flex; justify-content: space-between; align-items: center; gap: 4px; min-height: 20px; font-size: 12px; }
</style>
