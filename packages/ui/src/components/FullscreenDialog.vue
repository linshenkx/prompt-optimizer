<template>
  <NModal
    v-model:show="localVisible"
    preset="card"
    :title="title"
    size="huge"
    :segmented="{ content: true }"
    style="width: 90vw; height: 90vh; max-width: 90vw; max-height: 90vh;"
    :mask-closable="true"
    transform-origin="center"
    content-style="height: 100%; display: flex; flex-direction: column; min-height: 0;"
  >
    <NFlex vertical style="height: 100%; min-height: 0; overflow: auto;">
      <slot></slot>
    </NFlex>
  </NModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { NFlex } from 'naive-ui'
import NModal from './common/AdaptiveModal.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

// 双向绑定
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})
</script>
<style scoped>
/* Pure Naive UI implementation - no custom theme CSS needed */
</style>
