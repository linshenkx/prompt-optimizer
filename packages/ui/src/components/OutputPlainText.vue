<template>
  <pre v-if="small" class="output-plain-text">{{ content }}</pre>
  <OutputSourceView v-else :content="content" :fit-content="true" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import OutputSourceView from './OutputSourceView.vue'
const props = defineProps<{ content: string }>()
const small = computed(() => props.content.length <= 8192 && props.content.split('\n', 201).length <= 200)
</script>
<style scoped>
.output-plain-text { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; }
</style>
