<template>
  <div
    class="test-image-attachment-control"
    :class="{ 'test-image-attachment-control--selected': hasImage }"
    :title="t('test.image.visionHint')"
    data-testid="basic-system-test-image-control"
  >
    <template v-if="hasImage">
      <AppPreviewImage
        class="test-image-attachment-control__preview"
        :src="previewSrc"
        :alt="t('test.image.previewAlt')"
        :width="28"
        :height="28"
        object-fit="cover"
        preview-disabled
        data-testid="basic-system-test-image-preview"
      />

      <NUpload
        accept="image/png,image/jpeg"
        :default-upload="false"
        :show-file-list="false"
        :disabled="disabled"
        @before-upload="handleBeforeUpload"
        data-testid="basic-system-test-image-replace-upload"
      >
        <NButton
          quaternary
          circle
          size="tiny"
          :disabled="disabled"
          :title="t('test.image.replace')"
          :aria-label="t('test.image.replace')"
          data-testid="basic-system-test-image-replace"
        >
          <template #icon>
            <NIcon :size="16">
              <UiRefreshCw />
            </NIcon>
          </template>
        </NButton>
      </NUpload>

      <NButton
        quaternary
        circle
        size="tiny"
        :disabled="disabled"
        :title="t('test.image.remove')"
        :aria-label="t('test.image.remove')"
        data-testid="basic-system-test-image-remove"
        @click="removeImage"
      >
        <template #icon>
          <NIcon :size="16">
            <UiX />
          </NIcon>
        </template>
      </NButton>
    </template>

    <NUpload
      v-else
      accept="image/png,image/jpeg"
      :default-upload="false"
      :show-file-list="false"
      :disabled="disabled"
      @before-upload="handleBeforeUpload"
      data-testid="basic-system-test-image-upload"
    >
      <NButton
        quaternary
        circle
        size="tiny"
        :disabled="disabled"
        :title="`${t('test.image.attach')} · ${t('test.image.visionHint')}`"
        :aria-label="t('test.image.attach')"
        data-testid="basic-system-test-image-add"
      >
        <template #icon>
          <NIcon :size="16">
            <UiImage />
          </NIcon>
        </template>
      </NButton>
    </NUpload>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw as UiRefreshCw, X as UiX, Image as UiImage } from '@lucide/vue'
import { computed } from 'vue'
import { NButton, NIcon, NUpload, type UploadFileInfo } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { ImageInputRef } from '@prompt-optimizer/core'

import { useToast } from '../composables/ui/useToast'
import AppPreviewImage from './media/AppPreviewImage.vue'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg'])

const props = withDefaults(defineProps<{
  modelValue?: ImageInputRef | null
  disabled?: boolean
}>(), {
  modelValue: null,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: ImageInputRef | null]
}>()

const { t } = useI18n()
const toast = useToast()
let readSequence = 0

const hasImage = computed(() => Boolean(props.modelValue?.b64))
const previewSrc = computed(() => {
  const image = props.modelValue
  if (!image?.b64) return ''
  const b64 = image.b64.trim()
  return b64.startsWith('data:')
    ? b64
    : `data:${image.mimeType || 'image/png'};base64,${b64}`
})

const readBlobAsBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('image-read-failed'))
  reader.onload = () => {
    const dataUrl = String(reader.result || '')
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex < 0 || !dataUrl.slice(commaIndex + 1)) {
      reject(new Error('image-read-failed'))
      return
    }
    resolve(dataUrl.slice(commaIndex + 1))
  }
  reader.readAsDataURL(blob)
})

const handleBeforeUpload = async (options: { file: UploadFileInfo }) => {
  if (props.disabled) return false

  const raw = (options.file as unknown as { file?: File | Blob | null }).file
  if (!raw) return false

  if (!SUPPORTED_IMAGE_TYPES.has(raw.type)) {
    toast.error(t('test.image.unsupportedFormat'))
    return false
  }

  if (raw.size > MAX_IMAGE_BYTES) {
    toast.error(t('test.image.tooLarge'))
    return false
  }

  const requestId = ++readSequence
  try {
    const b64 = await readBlobAsBase64(raw)
    if (requestId === readSequence && !props.disabled) {
      emit('update:modelValue', { b64, mimeType: raw.type })
    }
  } catch {
    if (requestId === readSequence) {
      toast.error(t('test.image.readFailed'))
    }
  }

  return false
}

const removeImage = () => {
  if (props.disabled) return
  readSequence += 1
  emit('update:modelValue', null)
}
</script>

<style scoped>
.test-image-attachment-control {
  display: inline-flex;
  height: 28px;
  min-width: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.test-image-attachment-control--selected {
  max-width: 84px;
}

.test-image-attachment-control__preview {
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 4px;
}
</style>
