<template>
  <UiExternalLink :width="size" :height="size" />
</template>

<script setup lang="ts">
import { ExternalLink as UiExternalLink } from '@lucide/vue'
withDefaults(
  defineProps<{
    size?: number | string
  }>(),
  {
    size: 14
  }
)
</script>
