<template>
  <section ref="layoutRoot" :tabindex="compact ? 0 : undefined" class="optimize-workspace-layout" :class="{ 'optimize-workspace-layout--compact': compact }"
    @scroll.passive="emit('scroll', $event)">
    <div ref="originalSection" class="optimize-original-scroll"><slot name="original" /></div>
    <div ref="workspaceSection" class="optimize-workspace-scroll"><slot name="workspace" /></div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { OptimizeWorkspaceHandle } from '../../types/workspacePresentation'

defineProps<{ compact: boolean }>()
const emit = defineEmits<{
  scroll: [event: Event]
}>()
const layoutRoot = ref<HTMLElement>()
const originalSection = ref<HTMLElement>()
const workspaceSection = ref<HTMLElement>()
defineExpose<OptimizeWorkspaceHandle>({
  getScrollTop: () => layoutRoot.value?.scrollTop ?? 0,
  setScrollTop: top => { if (layoutRoot.value) layoutRoot.value.scrollTop = top },
  scrollToSection: (section, anchor = 'section') => {
    const container = section === 'original' ? originalSection.value : workspaceSection.value
    const target = anchor === 'content' ? container?.firstElementChild : container
    target?.scrollIntoView({ block: 'start' })
  },
})
</script>

<style scoped>
.optimize-workspace-layout { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: auto; gap: 12px; }
.optimize-original-scroll, .optimize-workspace-scroll { display: contents; }
.optimize-workspace-layout--compact { overflow-y: auto; overflow-x: hidden; gap: 12px; overscroll-behavior: contain; overflow-anchor: none; }
.optimize-workspace-layout--compact .optimize-original-scroll,
.optimize-workspace-layout--compact .optimize-workspace-scroll {
  display: flex; flex-direction: column; flex: 0 0 auto; min-height: 0; overflow: visible;
}
.optimize-workspace-layout--compact .optimize-workspace-scroll { border-top: 1px solid var(--compact-border); padding-top: 8px; }
</style>
