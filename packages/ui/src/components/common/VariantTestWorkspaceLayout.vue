<template>
  <TestWorkspaceLayout :compact="compact" :view="view" :running="running" :has-results="variants.some(item => item.hasPromptSnapshot)" @update:view="$emit('update:view', $event)"
    @scroll="$emit('scroll', $event)" @config-scroll="$emit('config-scroll', $event)">
    <template #input><slot name="input" /></template>
    <template #global-controls><slot name="global-controls" /></template>
    <template #variant-controls><slot name="variant-controls" /></template>
    <template #results><slot name="results" /></template>
    <template #config-actions>
      <div class="test-run-controls">
        <NButton type="primary" :loading="running" :disabled="running" data-testid="mobile-config-run-all" @click="$emit('run-all')">
          {{ t('test.layout.runAll') }}
        </NButton>
      </div>
    </template>
  </TestWorkspaceLayout>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import TestWorkspaceLayout from './TestWorkspaceLayout.vue'

type VariantId = 'a' | 'b' | 'c' | 'd'
const props = defineProps<{
  compact: boolean
  view: 'config' | 'results'
  variant: VariantId
  variants: { id: VariantId; sourceLabel: string; modelLabel: string; running: boolean; disabled?: boolean; promptContent?: string; hasPromptSnapshot?: boolean }[]
}>()
const emit = defineEmits<{
  'update:view': [value: 'config' | 'results']
  'update:variant': [value: VariantId]
  run: [value: VariantId]
  'run-all': []
  source: [value: VariantId]
  scroll: [event: Event]
  'config-scroll': [event: Event]
}>()
const { t } = useI18n()
const running = computed(() => props.variants.some(item => item.running))
watch(() => props.variants.map(item => item.id), ids => {
  if (!ids.includes(props.variant) && ids[0]) emit('update:variant', ids[0])
}, { immediate: true })
</script>
