<template>
  <NModal
    :show="show"
    preset="dialog"
    :title="title || t('common.promptGarden.importTitle')"
    :positive-text="positiveText || t('common.import')"
    :negative-text="t('common.cancel')"
    :positive-button-props="{ disabled: !normalizedImportCode }"
    :show-icon="false"
    :mask-closable="true"
    :close-on-esc="true"
    :on-positive-click="handleConfirm"
    @update:show="emit('update:show', $event)"
    @after-leave="reset"
  >
    <div class="prompt-garden-import-dialog">
      <p class="prompt-garden-import-hint">
        {{ hint || t('common.promptGarden.importHint') }}
      </p>
      <NInput
        v-model:value="inputValue"
        :placeholder="t('common.promptGarden.importPlaceholder')"
        clearable
        autofocus
        data-testid="workspace-prompt-garden-import-code"
        @keyup.enter="handleConfirm"
      />
    </div>
  </NModal>
</template>

<script setup lang="ts">
import NModal from "./AdaptiveModal.vue"
import { computed, ref } from 'vue'
import { NInput, } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  parsePromptGardenImportInput,
  type PromptGardenImportRequest,
} from '../../utils/prompt-garden-import'

defineProps<{
  show: boolean
  title?: string
  hint?: string
  positiveText?: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [request: PromptGardenImportRequest]
}>()

const { t } = useI18n()
const inputValue = ref('')

const normalizedImportRequest = computed(() => parsePromptGardenImportInput(inputValue.value))
const normalizedImportCode = computed(() => normalizedImportRequest.value.importCode)

const reset = () => {
  inputValue.value = ''
}

const handleConfirm = () => {
  const request = normalizedImportRequest.value
  if (!request.importCode) return false

  emit('confirm', request)
  emit('update:show', false)
  return true
}
</script>

<style scoped>
.prompt-garden-import-dialog {
  display: grid;
  gap: 12px;
  max-width: 360px;
}

.prompt-garden-import-hint {
  margin: 0;
  color: var(--n-text-color-2);
  line-height: 1.5;
}
</style>
