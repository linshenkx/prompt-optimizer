<template>
  <nav class="workspace-subview-switch" :aria-label="label">
    <button v-for="option in options" :key="option.value" type="button"
      :aria-pressed="modelValue === option.value" :data-testid="`workspace-view-${option.value}`"
      @click="emit('update:modelValue', option.value)">
      {{ option.label }}
    </button>
  </nav>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{ modelValue: T; options: readonly { value: T; label: string }[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<style scoped>
.workspace-subview-switch { display: flex; gap: 24px; flex-shrink: 0; padding: 0 4px; border-bottom: 1px solid var(--compact-border); }
button { position: relative; min-width: 0; min-height: 44px; padding: 8px 0 12px; border: 0; background: transparent; color: var(--compact-muted); font: inherit; font-size: 14px; cursor: pointer; touch-action: manipulation; }
button[aria-pressed="true"] { color: var(--compact-ink); font-weight: 650; }
button[aria-pressed="true"]::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 3px; border-radius: 3px; background: var(--compact-accent, var(--compact-ink)); }
button:focus-visible { outline: 2px solid #7295c3; outline-offset: 1px; }
</style>
