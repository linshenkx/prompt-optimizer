<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 space-y-2" style="z-index: 100;">
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-x-full opacity-0"
        enter-to-class="transform translate-x-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-x-0 opacity-100"
        leave-to-class="transform translate-x-full opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex items-center space-x-2 px-4 py-2 rounded-lg shadow-lg max-w-sm"
          :class="{
            'bg-green-50/95 dark:bg-green-900/95 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400': toast.type === 'success',
            'bg-red-50/95 dark:bg-red-900/95 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400': toast.type === 'error',
            'bg-blue-50/95 dark:bg-blue-900/95 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400': toast.type === 'info',
            'bg-yellow-50/95 dark:bg-yellow-900/95 border border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400': toast.type === 'warning'
          }"
        >
          <span class="text-sm">{{ toast.message }}</span>
          <button
            @click="remove(toast.id)"
            class="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast'

const { toasts, remove } = useToast()
</script>