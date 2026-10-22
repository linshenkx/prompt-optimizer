<template>
  <TestWorkspaceLayout ref="layoutRef" :compact="compact" :config-expanded="configExpanded" :running="running" :has-results="variants.some(item => item.hasPromptSnapshot)" @update:config-expanded="$emit('update:configExpanded', $event)"
    @scroll="$emit('scroll', $event)">
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
import { computed, ref } from 'vue'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import TestWorkspaceLayout from './TestWorkspaceLayout.vue'
import type { WorkspaceScrollHandle } from '../../types/workspacePresentation'

const props = defineProps<{
  compact: boolean
  configExpanded: boolean
  variants: { running: boolean; hasPromptSnapshot?: boolean }[]
}>()
defineEmits<{
  'update:configExpanded': [value: boolean]
  'run-all': []
  scroll: [event: Event]
}>()
const { t } = useI18n()
const running = computed(() => props.variants.some(item => item.running))
const layoutRef = ref<WorkspaceScrollHandle | null>(null)
defineExpose<WorkspaceScrollHandle>({
  getScrollTop: () => layoutRef.value?.getScrollTop() ?? 0,
  setScrollTop: top => { layoutRef.value?.setScrollTop(top) },
})
</script>
