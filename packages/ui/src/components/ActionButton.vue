<template>
  <button
    class="theme-icon-button flex items-center gap-1 px-1.5 py-1"
    @click="$emit('click')"
    :disabled="loading"
  >
    <span class="text-base sm:text-lg">{{ loading ? '⏳' : icon }}</span>
    <span class="text-sm max-sm:hidden">{{ loading ? loadingText || '加载中...' : text }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  text: string
  loading?: boolean
  loadingText?: string
}>()

defineEmits<{
  (e: 'click'): void
}>()
</script>