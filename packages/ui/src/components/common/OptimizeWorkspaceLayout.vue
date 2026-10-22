<template>
  <section :tabindex="compact ? 0 : undefined" class="optimize-workspace-layout" :class="{ 'optimize-workspace-layout--compact': compact }"
    @scroll.passive="emit('scroll', 'desktop', $event)">
    <div class="optimize-original-scroll"
      @scroll.passive="emit('scroll', 'original', $event)"><slot name="original" /></div>
    <div class="optimize-workspace-scroll"
      @scroll.passive="emit('scroll', 'workspace', $event)"><slot name="workspace" /></div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ compact: boolean; view: 'original' | 'workspace' }>()
const emit = defineEmits<{
  'update:view': [value: 'original' | 'workspace']
  scroll: [pane: 'original' | 'workspace' | 'desktop', event: Event]
}>()
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
