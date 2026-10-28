<!-- Existing Google mark from Tabler, MIT; see THIRD_PARTY_NOTICES.txt. -->
<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17.788 5.108A9 9 0 1 0 21 12h-8" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: '1em' })
</script>
