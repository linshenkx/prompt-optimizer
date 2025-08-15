<template>
  <Teleport to="body">
    <!-- 背景遮罩 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-show="modelValue" class="fixed inset-0 z-30 overflow-y-auto" @click="handleBackdropClick">
        <div class="flex min-h-full items-center justify-center p-4">
          <!-- 背景遮罩 -->
          <div class="fixed inset-0 theme-mask"></div>
          
          <!-- 弹窗内容 -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <div class="relative theme-modal w-full max-w-lg transform transition-all z-10">
              <!-- 标题栏 -->
              <div class="theme-modal-header flex items-center justify-between">
                <h3 class="text-lg font-semibold theme-text">
                  <slot name="title">{{ t('common.title') }}</slot>
                </h3>
                <button
                  @click="$emit('update:modelValue', false)"
                  class="hover:theme-text transition-colors"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <!-- 内容区域 -->
              <div class="theme-modal-content">
                <slot></slot>
              </div>
              
              <!-- 按钮区域 -->
              <div class="theme-modal-footer">
                <slot name="footer">
                  <button
                    @click="$emit('update:modelValue', false)"
                    class="theme-button-secondary"
                  >
                    {{ t('common.cancel') }}
                  </button>
                  <button
                    @click="$emit('confirm')"
                    class="theme-button-primary"
                  >
                    {{ t('common.confirm') }}
                  </button>
                </slot>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VNode } from 'vue'

const { t } = useI18n()

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// 为了TypeScript兼容性，暂时不使用defineSlots
// 这是Vue 3.3+的功能，在某些环境下可能不可用

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
}>()

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    event.stopPropagation()
    event.preventDefault()
    emit('update:modelValue', false)
  }
}
</script> 