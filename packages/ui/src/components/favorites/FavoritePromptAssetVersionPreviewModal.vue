<template>
  <NModal
    :show="show"
    @update:show="$emit('update:show', $event)"
  >
    <NCard
      class="favorite-prompt-asset-version-preview-modal"
      :title="modalTitle"
      :bordered="false"
      size="small"
      role="dialog"
      aria-modal="true"
    >
      <NInput
        data-testid="favorite-prompt-asset-version-modal-content"
        :value="previewText"
        type="textarea"
        readonly
        :autosize="{ minRows: 12, maxRows: 24 }"
      />

      <template #footer>
        <div class="favorite-prompt-asset-version-preview-modal__footer">
          <NButton @click="$emit('update:show', false)">
            {{ t('favorites.version.closePreview') }}
          </NButton>
        </div>
      </template>
    </NCard>
  </NModal>
</template>

<script setup lang="ts">
import NModal from '../common/AdaptiveModal.vue'
import { computed } from 'vue'
import { NButton, NCard, NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { PromptContentVersion } from '@prompt-optimizer/core'

import { promptContentToEditableText } from '../../utils/favorite-prompt-versions'

const props = defineProps<{
  show: boolean
  version: PromptContentVersion | null
}>()

defineEmits<{
  'update:show': [show: boolean]
}>()

const { t } = useI18n()

const modalTitle = computed(() =>
  props.version
    ? t('favorites.version.previewTitle', { version: props.version.version })
    : t('favorites.version.title'),
)

const previewText = computed(() =>
  props.version
    ? promptContentToEditableText(props.version.content)
    : '',
)
</script>

<style scoped>
.favorite-prompt-asset-version-preview-modal {
  width: min(760px, calc(100vw - 32px));
}

.favorite-prompt-asset-version-preview-modal__footer {
  display: flex;
  justify-content: flex-end;
}
</style>
