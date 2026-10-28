<!-- 简化的Icon组件，用于显示刷新图标 -->
<template>
  <UiRefreshCw v-if="name === 'refresh'" :class="size" />
  <span v-else>{{ name }}</span>
</template>

<script setup lang="ts">
import { RefreshCw as UiRefreshCw } from '@lucide/vue'
interface Props {
  name: string
  size?: string
}

withDefaults(defineProps<Props>(), {
  size: 'w-4 h-4'
})
</script>

<style scoped>
.w-4 {
  width: 1rem;
}
.h-4 {
  height: 1rem;
}
</style>