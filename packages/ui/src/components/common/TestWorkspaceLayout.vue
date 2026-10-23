<template>
  <section ref="layoutRoot" :tabindex="compact ? 0 : undefined" class="test-workspace-layout" :class="{ 'test-workspace-layout--compact test-results-scroll': compact }"
    @scroll.passive="compact && emit('scroll', $event)">
      <div v-if="compact" class="test-plan-heading">
        <strong>{{ t('workspace.testPlan') }}</strong>
        <div class="test-plan-actions">
          <slot name="config-actions" />
          <button type="button" class="test-config-toggle" data-testid="test-config-toggle"
            :aria-expanded="configExpanded" @click="toggleConfig">
            {{ t(configExpanded ? 'workspace.collapseContent' : 'workspace.testSettings') }}
            <span aria-hidden="true">{{ configExpanded ? '⌃' : '⌄' }}</span>
          </button>
          <details class="test-plan-options">
            <summary :aria-label="t('workspace.moreSettings')">{{ t('workspace.moreOptions') }}</summary>
            <div class="test-plan-options-content"><slot name="global-controls" /></div>
          </details>
        </div>
      </div>
    <div ref="configRoot" v-show="!compact || configExpanded" class="test-config-scroll">
      <slot name="input" />
      <slot v-if="!compact" name="global-controls" />
      <slot v-if="!compact" name="groups" />
      <slot name="variant-controls" />
    </div>
    <div v-if="compact && !configExpanded && $slots['config-summary']" class="test-config-summary"><slot name="config-summary" /></div>
    <div ref="resultsRoot" :class="compact ? 'test-answer-content' : 'test-results-scroll'" @scroll.passive="!compact && emit('scroll', $event)">
      <slot name="results" />
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { WorkspaceScrollHandle } from '../../types/workspacePresentation'
const props = withDefaults(defineProps<{ compact: boolean; configExpanded: boolean; running?: boolean; hasResults?: boolean }>(), { running: false, hasResults: false })
const emit = defineEmits<{
  'update:configExpanded': [value: boolean]
  scroll: [event: Event]
}>()
// Keep editors mounted so drafts and selections survive folding.
const layoutRoot = ref<HTMLElement>()
const configRoot = ref<HTMLElement>()
const resultsRoot = ref<HTMLElement>()
const getScrollRoot = () => props.compact ? layoutRoot.value : resultsRoot.value
defineExpose<WorkspaceScrollHandle>({
  getScrollTop: () => getScrollRoot()?.scrollTop ?? 0,
  setScrollTop: top => { const root = getScrollRoot(); if (root) root.scrollTop = top },
})
const { height: availableHeight } = useElementSize(layoutRoot)
const { height: configHeight } = useElementSize(configRoot)
const measuredConfigHeight = ref(0)
const manuallyToggled = ref(false)
let requestedExpansion: boolean | undefined
const setConfigExpanded = (expanded: boolean) => {
  if (props.configExpanded === expanded) return
  requestedExpansion = expanded
  emit('update:configExpanded', expanded)
}
const toggleConfig = () => {
  manuallyToggled.value = true
  setConfigExpanded(!props.configExpanded)
}
watch(() => props.configExpanded, expanded => {
  // An update echoed by v-model is not a new manual override of auto sizing.
  if (requestedExpansion !== expanded) manuallyToggled.value = true
  requestedExpansion = undefined
})
watch(configHeight, height => {
  if (props.compact && height > 0) measuredConfigHeight.value = height
}, { immediate: true })
watch([availableHeight, measuredConfigHeight, () => props.compact, () => props.hasResults], () => {
  if (!props.compact || props.running || !props.hasResults || manuallyToggled.value || !measuredConfigHeight.value || !availableHeight.value) return
  // Opening a mobile select can raise the keyboard and shrink this region.
  // Folding its focused trigger would immediately blur it and close the menu.
  if (typeof document !== 'undefined' && configRoot.value?.contains(document.activeElement)) return
  // Restored answers need reading room too. Never fold a new, untested draft.
  const configBudget = Math.max(0, Math.min(availableHeight.value * 0.4, availableHeight.value - 260))
  setConfigExpanded(measuredConfigHeight.value <= configBudget)
})
watch(() => props.running, running => {
  if (props.compact && running) {
    manuallyToggled.value = false
    setConfigExpanded(false)
  }
}, { immediate: true })
const { t } = useI18n()
</script>
<style scoped>
.test-workspace-layout { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 12px; overflow: hidden; }
.test-config-scroll { display: contents; }
.test-results-scroll { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.test-workspace-layout--compact { color: var(--compact-ink); display: block; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; overflow-anchor: none; }
.test-workspace-layout--compact .test-config-scroll { display: flex; flex-direction: column; gap: 6px; }
.test-workspace-layout--compact .test-answer-content { margin-top: 10px; }
.test-plan-heading { display: flex; align-items: center; justify-content: space-between; min-height: 36px; gap: 8px; font-size: 14px; }
.test-plan-heading > strong { white-space: nowrap; }
.test-config-toggle { display: flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 6px; border: 0; border-radius: 8px; font: inherit; font-size: 12px; background: var(--compact-soft); color: var(--compact-ink); cursor: pointer; }
.test-config-toggle:focus-visible { outline: 2px solid #7295c3; outline-offset: 2px; }
.test-config-summary { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--compact-muted); background: var(--compact-soft); border-radius: 8px; padding: 6px 8px; margin-top: 4px; font-size: 12px; }
.test-plan-actions { display: flex; align-items: center; gap: 6px; min-width: 0; }
.test-plan-options { position: relative; font-size: 12px; font-weight: 400; color: var(--compact-muted); }
.test-plan-options summary { cursor: pointer; min-height: 36px; display: flex; align-items: center; padding: 0 6px; }
.test-plan-options-content { position: absolute; right: 0; top: 100%; width: min(300px, 80vw); z-index: 5; padding: 16px; border: 1px solid var(--compact-border); border-radius: 12px; background: var(--compact-paper); box-shadow: 0 8px 24px #10182818; }
</style>
