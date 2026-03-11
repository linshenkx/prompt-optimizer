<template>
  <ToastUI>
    <NModal
      :show="show"
      preset="card"
      :style="{ width: '90vw', maxWidth: '1200px', maxHeight: '90vh' }"
      content-style="padding: 0; display: flex; flex-direction: column; height: min(75vh, 800px); overflow: hidden;"
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

      <div class="model-manager-content">
        <NTabs v-model:value="activeTab" type="segment" size="small" animated class="model-manager-tabs">
          <NTabPane name="text" :tab="t('modelManager.textModels')" />
          <NTabPane name="image" :tab="t('modelManager.imageModels')" />
          <NTabPane name="function" :tab="t('modelManager.functionModels')" />
        </NTabs>

        <div class="model-manager-panel">
          <NCard
            embedded
            size="small"
            :bordered="false"
            class="model-manager-shell"
            content-style="padding: 16px; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0;"
          >
            <div class="model-manager-scroll-area">
              <TextModelManager
                v-show="activeTab === 'text'"
                ref="textManagerRef"
                @models-updated="handleTextModelsUpdated"
              />
              <ImageModelManager
                v-show="activeTab === 'image'"
                ref="imageListRef"
                @edit="handleEditImageModel"
                @clone="handleCloneImageModel"
                @add="handleAddImageModel"
              />
              <FunctionModelManager
                v-show="activeTab === 'function'"
                ref="functionManagerRef"
              />
            </div>
          </NCard>
        </div>
      </div>
    </NModal>

    <ImageModelEditModal
      :show="showImageModelEdit"
      :config-id="editingImageModelId"
      :initial-config="draftImageModelConfig"
      @update:show="updateImageEditModalVisibility"
      @saved="handleImageModelSaved"
    />
  </ToastUI>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted, provide, ref, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NCard, NModal, NTabs, NTabPane } from 'naive-ui'
import type { ImageModelConfig } from '@prompt-optimizer/core'
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
const draftImageModelConfig = ref<ImageModelConfig | undefined>(undefined)

const services = inject<Ref<AppServices | null>>('services')
if (!services?.value) {
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
  draftImageModelConfig.value = undefined
  showImageModelEdit.value = true
}

const handleEditImageModel = (configId: string) => {
  editingImageModelId.value = configId
  draftImageModelConfig.value = undefined
  showImageModelEdit.value = true
}

const handleCloneImageModel = (draft: ImageModelConfig) => {
  editingImageModelId.value = undefined
  draftImageModelConfig.value = draft
  showImageModelEdit.value = true
}

const updateImageEditModalVisibility = (value: boolean) => {
  showImageModelEdit.value = value
  if (!value) {
    editingImageModelId.value = undefined
    draftImageModelConfig.value = undefined
  }
}

const handleImageModelSaved = () => {
  showImageModelEdit.value = false
  editingImageModelId.value = undefined
  draftImageModelConfig.value = undefined
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
.model-manager-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.model-manager-tabs {
  flex: 0 0 auto;
}

.model-manager-tabs :deep(.n-tabs-nav) {
  margin-bottom: 0;
}

.model-manager-tabs :deep(.n-tabs-nav-scroll-wrapper) {
  padding: 2px;
}

.model-manager-tabs :deep(.n-tabs-content) {
  display: none;
}

.model-manager-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.model-manager-shell {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 16px;
}

.model-manager-shell :deep(.n-card__content) {
  min-height: 0;
}

.model-manager-scroll-area {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

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
