<template>
  <NModal
    v-model:show="isVisible"
    :mask-closable="maskClosable"
    :closable="closable"
    :auto-focus="autoFocus"
    :trap-focus="trapFocus"
    preset="card"
    :style="modalStyle"
    :class="modalClass"
    @after-leave="handleAfterLeave"
  >
    <template #header>
      <slot name="title">{{ title || t('common.title') }}</slot>
    </template>
    
    <template #default>
      <div class="modal-content">
        <slot></slot>
      </div>
    </template>
    
    <template #footer>
      <div class="modal-footer">
        <slot name="footer">
          <div class="flex justify-end gap-3">
            <NButton
              type="tertiary"
              @click="handleCancel"
            >
              {{ t('common.cancel') }}
            </NButton>
            <NButton
              type="primary"
              @click="handleConfirm"
            >
              {{ t('common.confirm') }}
            </NButton>
          </div>
        </slot>
      </div>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import NModal from "./common/AdaptiveModal.vue"
import { computed, ref, watch } from 'vue'

import { useI18n } from 'vue-i18n'
import {  NButton } from 'naive-ui'

const { t } = useI18n()

interface Props {
  modelValue: boolean
  title?: string
  maskClosable?: boolean
  closable?: boolean
  autoFocus?: boolean
  trapFocus?: boolean
  width?: number | string
  maxWidth?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  maskClosable: true,
  closable: true,
  autoFocus: true,
  trapFocus: true,
  width: '90vw',
  maxWidth: '600px'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
  'after-leave': []
}>()

// 内部显示状态
const isVisible = ref(props.modelValue)

// 监听外部变化
watch(() => props.modelValue, (newVal) => {
  isVisible.value = newVal
})

// 监听内部变化，同步到外部
watch(isVisible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 模态框样式
const modalStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth
}))

const modalClass = computed(() => [
  'modern-modal'
])

// 事件处理
const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  isVisible.value = false
  emit('cancel')
}

const handleAfterLeave = () => {
  emit('after-leave')
}
</script>

<style scoped>
.modern-modal {
  /* 自定义模态框样式 */
}

.modal-content {
  min-height: 100px;
  padding: 4px 0;
}

.modal-footer {
  padding-top: 16px;
  border-top: 1px solid var(--n-divider-color);
}
</style> 