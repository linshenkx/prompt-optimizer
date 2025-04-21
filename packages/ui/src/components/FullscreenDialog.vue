<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 theme-mask z-[60] flex items-center justify-center overflow-y-auto">
      <div class="relative theme-manager-container min-h-[50vh] max-h-[90vh] w-[90vw] m-4 flex flex-col">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between p-4 border-b theme-manager-border">
          <h3 class="text-lg font-semibold theme-manager-text">{{ title }}</h3>
          <button
            @click="$emit('update:modelValue', false)"
            class="theme-manager-text-secondary hover:theme-manager-text transition-colors text-xl"
          >
            ×
          </button>
        </div>
        
        <!-- 内容区域 -->
        <div class="flex-1 p-4 overflow-auto">
          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: ''
  }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.overflow-auto {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.overflow-auto::-webkit-scrollbar {
  display: none;
}
</style>