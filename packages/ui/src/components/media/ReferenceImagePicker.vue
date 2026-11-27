<template>
  <div
    class="reference-image-picker"
    :class="{
      'reference-image-picker--disabled': disabled,
      'reference-image-picker--with-extra': hasCardExtra,
    }"
    :data-testid="uploadTestId"
  >
    <div v-if="label || $slots['header-extra']" class="reference-image-picker__header">
      <NText v-if="label" :depth="2" class="reference-image-picker__title">
        {{ label }}
      </NText>
      <slot name="header-extra" />
    </div>

    <input
      ref="fileInputRef"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled || loading"
      class="hidden-input"
      @change="handleFileInputChange"
    />

    <div
      class="reference-image-picker__surface"
      @dragenter="handleSurfaceDragEnter"
      @dragover="handleSurfaceDragOver"
      @dragleave="handleSurfaceDragLeave"
      @drop="handleSurfaceDrop"
    >
      <div class="image-card-list" :data-testid="listTestId">
        <div
          v-for="(item, index) in items"
          :key="item.key ?? item.id"
          :data-image-id="item.id"
          class="image-card"
          :class="{
            'image-card--dragging': draggingImageIndex === index,
            'image-card--drop-target': dragOverImageIndex === index,
          }"
          :data-testid="cardTestIdPrefix ? `${cardTestIdPrefix}-${index + 1}` : undefined"
          @dragover="handleCardDragOver(index, $event)"
          @dragleave="handleCardDragLeave(index)"
          @drop="handleCardDrop(index, $event)"
        >
          <div class="image-card__preview-wrap">
            <NButton
              class="image-card__remove"
              quaternary
              circle
              size="small"
              type="error"
              :disabled="disabled || loading"
              :aria-label="item.removeAriaLabel || t('imageWorkspace.input.removeImageAriaLabel', { index: index + 1 })"
              :title="item.removeAriaLabel || t('imageWorkspace.input.removeImageAriaLabel', { index: index + 1 })"
              @mousedown.stop
              @click.stop="emit('remove', index, item)"
            >
              <template #icon>
                <NIcon class="image-card__remove-icon" :size="16">
                  <UiX />
                </NIcon>
              </template>
            </NButton>
            <AppPreviewImage
              v-if="item.src"
              class="image-card__preview"
              :data-testid="previewTestId || undefined"
              :src="item.src"
              :alt="item.alt || item.label"
              :download-filename="item.downloadFilename"
              :object-fit="previewFit"
            />
          </div>

          <div
            class="image-card__footer"
            :class="{ 'image-card__footer--draggable': canDragReorder }"
            :draggable="canDragReorder"
            :title="canDragReorder ? t('imageWorkspace.input.reorderImageAriaLabel', { index: index + 1 }) : (item.title || item.label)"
            :aria-label="canDragReorder ? t('imageWorkspace.input.reorderImageAriaLabel', { index: index + 1 }) : undefined"
            @click.stop
            @mousedown.stop
            @dragstart="handleImageDragStart(index, $event)"
            @dragend="handleImageDragEnd"
          >
            <NText strong class="image-card__label" :title="item.title || item.label">{{ item.label }}</NText>
            <span v-if="canDragReorder" class="image-card__drag-handle" aria-hidden="true">⋮⋮</span>
            <div v-else-if="reorderable && compact && items.length > 1" class="image-card__reorder">
              <NButton
                quaternary
                size="tiny"
                :disabled="disabled || loading || index === 0"
                :aria-label="t('workspace.moveImageEarlier', { index: index + 1 })"
                @click.stop="emitReorder(index, index - 1)"
              >‹</NButton>
              <NButton
                quaternary
                size="tiny"
                :disabled="disabled || loading || index === items.length - 1"
                :aria-label="t('workspace.moveImageLater', { index: index + 1 })"
                @click.stop="emitReorder(index, index + 1)"
              >›</NButton>
            </div>
            <NButton
              v-else-if="replaceable"
              class="image-card__replace"
              text
              size="tiny"
              type="primary"
              :disabled="disabled || loading"
              :aria-label="t('imageWorkspace.input.replaceImageAriaLabel')"
              :data-testid="replaceTestId || undefined"
              @click.stop="triggerUpload"
            >
              {{ t('imageWorkspace.input.replaceImage') }}
            </NButton>
          </div>

          <div v-if="hasCardExtra" class="image-card__extra" @click.stop @mousedown.stop>
            <slot name="card-extra" :item="item" :index="index" />
          </div>
        </div>

        <button
          v-if="canAddMore"
          type="button"
          class="image-upload-card"
          :class="{
            'image-upload-card--empty': items.length === 0,
            'image-upload-card--drop-target': dragOverUploadCard,
          }"
          :disabled="disabled || loading"
          :data-testid="uploadCardTestId"
          @click="triggerUpload"
          @dragover="handleUploadCardDragOver($event)"
          @dragleave="handleUploadCardDragLeave"
          @drop="handleUploadCardDrop($event)"
        >
          <NSpin v-if="loading" size="small" />
          <UiImagePlus v-else class="image-upload-card__icon" :size="22" aria-hidden="true" />
          <span class="image-upload-card__text">
            {{ uploadText || t('imageWorkspace.upload.dragText') }}
          </span>
        </button>
      </div>

      <div v-if="externalDragOver" class="reference-image-picker__drop-overlay" role="status">
        <UiImagePlus :size="24" aria-hidden="true" />
        <span>{{ t('imageWorkspace.upload.dropToUpload') }}</span>
      </div>
    </div>

    <NText v-if="hint" depth="3" class="reference-image-picker__hint">
      {{ hint }}
    </NText>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { NButton, NIcon, NSpin, NText } from 'naive-ui'
import { ImagePlus as UiImagePlus, X as UiX } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import AppPreviewImage from './AppPreviewImage.vue'

export interface ReferenceImageItem {
  id: string
  key?: string
  src: string
  label: string
  alt?: string
  title?: string
  downloadFilename?: string
  removeAriaLabel?: string
}

const props = withDefaults(defineProps<{
  items: ReferenceImageItem[]
  label?: string
  hint?: string
  uploadText?: string
  accept?: string
  multiple?: boolean
  max?: number
  reorderable?: boolean
  replaceable?: boolean
  compact?: boolean
  disabled?: boolean
  loading?: boolean
  uploadTestId?: string
  listTestId?: string
  cardTestIdPrefix?: string
  uploadCardTestId?: string
  previewFit?: 'cover' | 'contain'
  previewTestId?: string
  replaceTestId?: string
}>(), {
  label: '',
  hint: '',
  uploadText: '',
  accept: 'image/png,image/jpeg',
  multiple: true,
  max: undefined,
  reorderable: false,
  replaceable: false,
  compact: false,
  disabled: false,
  loading: false,
  uploadTestId: undefined,
  listTestId: undefined,
  cardTestIdPrefix: undefined,
  uploadCardTestId: undefined,
  previewFit: 'cover',
  previewTestId: undefined,
  replaceTestId: undefined,
})

const emit = defineEmits<{
  'select-files': [files: File[]]
  'remove': [index: number, item: ReferenceImageItem]
  'reorder': [fromIndex: number, toIndex: number]
}>()

const { t } = useI18n()
const slots = useSlots()
const fileInputRef = ref<HTMLInputElement | null>(null)
const draggingImageIndex = ref<number | null>(null)
const dragOverImageIndex = ref<number | null>(null)
const dragOverUploadCard = ref(false)
const fileDragDepth = ref(0)

const hasCardExtra = computed(() => Boolean(slots['card-extra']))
const canAddMore = computed(() => props.max === undefined || props.items.length < props.max)
const canDragReorder = computed(() => props.reorderable && !props.compact && !props.disabled && !props.loading && props.items.length > 1)
const externalDragOver = computed(() =>
  fileDragDepth.value > 0 && draggingImageIndex.value === null && !props.disabled && !props.loading,
)

const triggerUpload = () => {
  if (props.disabled || props.loading) return
  fileInputRef.value?.click()
}

const emitFiles = (rawFiles: File[]) => {
  if (props.disabled || props.loading || rawFiles.length === 0) return
  emit('select-files', props.multiple ? rawFiles : [rawFiles[0]])
}

const handleFileInputChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  emitFiles(files)
}

const hasDraggedFiles = (event: DragEvent): boolean => {
  const transfer = event.dataTransfer
  if (!transfer) return false
  if (transfer.files && transfer.files.length > 0) return true
  return Array.from(transfer.types || []).includes('Files')
}

const resetReorderState = () => {
  draggingImageIndex.value = null
  dragOverImageIndex.value = null
  dragOverUploadCard.value = false
}

const handleSurfaceDragEnter = (event: DragEvent) => {
  if (draggingImageIndex.value !== null || !hasDraggedFiles(event)) return
  event.preventDefault()
  fileDragDepth.value += 1
}

const handleSurfaceDragOver = (event: DragEvent) => {
  if (draggingImageIndex.value !== null || !hasDraggedFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = props.disabled || props.loading ? 'none' : 'copy'
  }
}

const handleSurfaceDragLeave = (event: DragEvent) => {
  if (draggingImageIndex.value !== null || !hasDraggedFiles(event)) return
  fileDragDepth.value = Math.max(0, fileDragDepth.value - 1)
}

const handleSurfaceDrop = (event: DragEvent) => {
  if (draggingImageIndex.value !== null || !hasDraggedFiles(event)) return
  event.preventDefault()
  fileDragDepth.value = 0
  resetReorderState()
  const files = Array.from(event.dataTransfer?.files || [])
  emitFiles(files)
}

const emitReorder = (fromIndex: number, toIndex: number) => {
  if (props.disabled || props.loading) return
  if (fromIndex === toIndex) return
  if (fromIndex < 0 || toIndex < 0) return
  if (fromIndex >= props.items.length || toIndex >= props.items.length) return
  emit('reorder', fromIndex, toIndex)
}

const handleImageDragStart = (index: number, event: DragEvent) => {
  if (!canDragReorder.value) {
    event.preventDefault()
    return
  }
  fileDragDepth.value = 0
  draggingImageIndex.value = index
  dragOverImageIndex.value = index
  dragOverUploadCard.value = false
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleImageDragEnd = () => {
  resetReorderState()
  fileDragDepth.value = 0
}

const handleCardDragOver = (index: number, event: DragEvent) => {
  if (draggingImageIndex.value === null) return
  event.preventDefault()
  dragOverImageIndex.value = index
  dragOverUploadCard.value = false
}

const handleCardDragLeave = (index: number) => {
  if (dragOverImageIndex.value === index) {
    dragOverImageIndex.value = null
  }
}

const handleCardDrop = (index: number, event: DragEvent) => {
  const fromIndex = draggingImageIndex.value
  if (fromIndex === null) return
  event.preventDefault()
  event.stopPropagation()
  resetReorderState()
  emitReorder(fromIndex, index)
}

const handleUploadCardDragOver = (event: DragEvent) => {
  if (draggingImageIndex.value === null) return
  event.preventDefault()
  dragOverImageIndex.value = null
  dragOverUploadCard.value = true
}

const handleUploadCardDragLeave = () => {
  dragOverUploadCard.value = false
}

const handleUploadCardDrop = (event: DragEvent) => {
  const fromIndex = draggingImageIndex.value
  if (fromIndex === null) return
  event.preventDefault()
  event.stopPropagation()
  const lastIndex = props.items.length - 1
  resetReorderState()
  if (lastIndex >= 0) emitReorder(fromIndex, lastIndex)
}

defineExpose({ triggerUpload })
</script>

<style scoped>
.reference-image-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reference-image-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.reference-image-picker__title {
  font-size: 14px;
  font-weight: 500;
}
.reference-image-picker__hint {
  font-size: 12px;
  line-height: 1.45;
}
.hidden-input {
  display: none;
}
.reference-image-picker__surface {
  position: relative;
  border-radius: 14px;
}
.reference-image-picker__drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed var(--n-primary-color);
  border-radius: inherit;
  background: var(--n-color);
  color: var(--n-primary-color);
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
}
.image-card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: stretch;
  overscroll-behavior-x: contain;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
}
.image-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 116px;
  padding: 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 14px;
  background: var(--n-color);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}
.reference-image-picker--with-extra .image-card,
.reference-image-picker--with-extra .image-upload-card:not(.image-upload-card--empty) {
  width: 124px;
}
.image-card:hover {
  border-color: var(--n-border-color-hover);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}
.image-card--dragging {
  opacity: 0.68;
  transform: scale(0.98);
}
.image-card--drop-target {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
}
.image-card__preview-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--n-color-embedded);
}
.image-card__preview {
  width: 100%;
  height: 100%;
  display: block;
}
.image-card__preview :deep(img) {
  width: 100%;
  height: 100%;
  display: block;
  -webkit-user-drag: none;
  user-select: none;
}
.image-card__remove {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  width: 28px;
  min-width: 28px;
  height: 28px;
  border-radius: 999px;
  color: #fff;
  background: rgba(17, 24, 39, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.34);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.image-card__remove:hover,
.image-card__remove:focus-visible {
  color: #fff;
  background: rgba(220, 38, 38, 0.92);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 18px rgba(127, 29, 29, 0.36);
  transform: scale(1.05);
}
.image-card__remove-icon {
  width: 14px;
  height: 14px;
}
.image-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 26px;
  padding: 0 2px;
  user-select: none;
  -webkit-user-select: none;
}
.image-card__footer--draggable {
  cursor: grab;
}
.image-card__footer--draggable:active {
  cursor: grabbing;
}
.image-card__drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 22px;
  color: var(--n-text-color-2);
  line-height: 1;
  font-size: 14px;
  letter-spacing: -1px;
}
.image-card__label {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.image-card__reorder {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.image-card__replace {
  flex-shrink: 0;
  font-size: 12px;
}
.image-card__extra {
  width: 100%;
  min-width: 0;
}
.image-upload-card {
  width: 116px;
  min-height: 132px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border: 1px dashed var(--n-border-color);
  border-radius: 14px;
  background: var(--n-color-embedded);
  color: var(--n-text-color-2);
  cursor: pointer;
  appearance: none;
  font: inherit;
  text-align: center;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}
.image-upload-card--empty {
  width: 100%;
  min-height: 60px;
  flex-direction: row;
  padding: 12px 16px;
}
.image-upload-card:hover:not(:disabled) {
  border-color: var(--n-border-color-hover);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}
.image-upload-card:focus-visible {
  outline: none;
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
}
.image-upload-card:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.image-upload-card--drop-target {
  border-color: var(--n-primary-color);
  background: color-mix(in srgb, var(--n-primary-color, #18a058) 8%, var(--n-color-embedded));
  box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
  color: var(--n-primary-color);
}
.image-upload-card__icon {
  flex-shrink: 0;
}
.image-upload-card__text {
  font-size: 13px;
  line-height: 1.4;
}

@media (max-width: 900px) {
  .image-card-list {
    gap: 10px;
  }
  .image-card,
  .reference-image-picker--with-extra .image-card,
  .image-upload-card:not(.image-upload-card--empty),
  .reference-image-picker--with-extra .image-upload-card:not(.image-upload-card--empty) {
    width: calc(50% - 5px);
    min-width: 132px;
  }
}
</style>
