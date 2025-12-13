<template>
  <ToastUI>
    <NModal
      :show="show"
      preset="card"
      :style="{ width: '90vw', maxWidth: '1200px', maxHeight: '90vh' }"
      :title="t('modelManager.title')"
      size="large"
      :bordered="false"
      :segmented="true"
      @update:show="(value) => !value && close()"
    >
      <template #header-extra>
        <NButton
          v-if="activeTab === 'text'"
          type="primary"
          @click="openAddForActiveTab"
          ghost
        >
          <template #icon>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M3 15h6" />
              <path d="M6 12v6" />
            </svg>
          </template>
          {{ t('modelManager.addModel') }}
        </NButton>
        <NButton
          v-else-if="activeTab === 'image'"
          type="primary"
          @click="handleAddImageModel"
          ghost
        >
          <template #icon>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M3 15h6" />
              <path d="M6 12v6" />
            </svg>
          </template>
          {{ t('modelManager.addImageModel') }}
        </NButton>
      </template>

      <NScrollbar style="max-height: 75vh;">
        <NTabs v-model:value="activeTab" type="line" size="small" style="margin-bottom: 12px;">
          <NTabPane name="text" :tab="t('modelManager.textModels')">
            <TextModelManager ref="textManagerRef" @models-updated="handleTextModelsUpdated" />
          </NTabPane>
          <NTabPane name="image" :tab="t('modelManager.imageModels')">
            <ImageModelManager
              ref="imageListRef"
              @edit="handleEditImageModel"
              @add="handleAddImageModel"
            />
          </NTabPane>
          <NTabPane name="function" :tab="t('modelManager.functionModels')">
            <FunctionModelManager ref="functionManagerRef" />
          </NTabPane>
        </NTabs>
      </NScrollbar>
    </NModal>

    <ImageModelEditModal
      :show="showImageModelEdit"
      :config-id="editingImageModelId"
      @update:show="showImageModelEdit = $event"
      @saved="handleImageModelSaved"
    />
  </ToastUI>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted, provide, ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NModal, NScrollbar, NTabs, NTabPane } from 'naive-ui'
import ImageModelEditModal from './ImageModelEditModal.vue'
import ImageModelManager from './ImageModelManager.vue'
import TextModelManager from './TextModelManager.vue'
import FunctionModelManager from './FunctionModelManager.vue'
import ToastUI from './Toast.vue'
import type { AppServices } from '../types/services'

defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['modelsUpdated', 'close', 'select', 'update:show'])

const { t } = useI18n()

const activeTab = ref<'text' | 'image' | 'function'>('text')
const textManagerRef = ref<InstanceType<typeof TextModelManager> | null>(null)
const imageListRef = ref<InstanceType<typeof ImageModelManager> | null>(null)
const functionManagerRef = ref<InstanceType<typeof FunctionModelManager> | null>(null)
const showImageModelEdit = ref(false)
const editingImageModelId = ref<string | undefined>(undefined)

const services = inject<AppServices>('services')
if (!services) {
  throw new Error('Services not provided!')
}

provide('imageModelManager', services.value.imageModelManager)
provide('imageRegistry', services.value.imageAdapterRegistry)
provide('imageService', services.value.imageService)

const close = () => {
  emit('update:show', false)
  emit('close')
}

const openAddForActiveTab = () => {
  if (activeTab.value === 'text') {
    textManagerRef.value?.openAddModal()
  } else if (activeTab.value === 'image') {
    handleAddImageModel()
  }
}

const handleTextModelsUpdated = (id?: string) => {
  if (id) {
    emit('modelsUpdated', id)
  }
}

const handleAddImageModel = () => {
  editingImageModelId.value = undefined
  showImageModelEdit.value = true
}

const handleEditImageModel = (configId: string) => {
  editingImageModelId.value = configId
  showImageModelEdit.value = true
}

const handleImageModelSaved = () => {
  showImageModelEdit.value = false
  editingImageModelId.value = undefined
  try {
    imageListRef.value?.refresh?.()
  } catch {
      // 静默处理错误
    }
}

if (typeof window !== 'undefined') {
  const tabHandler = (e: Event) => {
    try {
      const tab = (e as CustomEvent).detail
      if (tab === 'text' || tab === 'image' || tab === 'function') activeTab.value = tab
    } catch {
      // 静默处理错误
    }
  }
  onMounted(() => window.addEventListener('model-manager:set-tab', tabHandler))
  onUnmounted(() => window.removeEventListener('model-manager:set-tab', tabHandler))
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
