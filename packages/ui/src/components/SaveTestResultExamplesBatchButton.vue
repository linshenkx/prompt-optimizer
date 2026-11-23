<template>
  <template v-if="variantIds.length >= 2">
    <NButton
      size="small"
      :disabled="disabled"
      :loading="isPreparing"
      :data-testid="testId"
      @click="handleOpenSelection"
    >
      <template #icon>
        <NIcon :size="14">
          <Star />
        </NIcon>
      </template>
      {{ t('favorites.dialog.reproducibility.saveTestResultExamplesBatch') }}
    </NButton>

    <AdaptiveModal
      v-model:show="showSelection"
      preset="dialog"
      :title="t('favorites.dialog.reproducibility.selectTestResultExamplesTitle')"
      style="width: min(640px, calc(100vw - 24px))"
      :positive-text="t('favorites.dialog.reproducibility.saveSelectedTestResultExamples', { count: selectedVariantIds.length })"
      :negative-text="t('common.cancel')"
      :positive-button-props="{ disabled: selectedVariantIds.length === 0 }"
      @positive-click="handleConfirmSelection"
      @negative-click="handleCancelSelection"
    >
      <NScrollbar style="max-height: min(420px, 60vh)">
        <div class="batch-example-list">
          <div
            v-for="entry in entries"
            :key="entry.variantId"
            class="batch-example-item"
            :data-testid="testId ? `${testId}-item-${entry.variantId}` : undefined"
          >
            <NCheckbox
              :checked="selectedVariantIds.includes(entry.variantId)"
              @update:checked="(checked: boolean) => toggleSelection(entry.variantId, checked)"
            >
              <NText strong>
                {{ t('favorites.dialog.reproducibility.testResultColumn', { label: entry.variantId.toUpperCase() }) }}
              </NText>
              <NText v-if="getModelLabel(entry)" depth="3" class="batch-example-model">
                {{ getModelLabel(entry) }}
              </NText>
            </NCheckbox>
            <NText depth="3" class="batch-example-preview">{{ getPreview(entry) }}</NText>
          </div>
        </div>
      </NScrollbar>
      <NText depth="3" class="batch-example-count">
        {{ t('favorites.dialog.reproducibility.selectedTestResultCount', { selected: selectedVariantIds.length, total: entries.length }) }}
      </NText>
    </AdaptiveModal>
  </template>
</template>

<script setup lang="ts">
import { computed, inject, ref, shallowRef } from 'vue'
import { NButton, NCheckbox, NIcon, NScrollbar, NText } from 'naive-ui'
import { Star } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { PromptSession } from '@prompt-optimizer/core'

import AdaptiveModal from './common/AdaptiveModal.vue'
import { useToast } from '../composables/ui/useToast'
import { useSessionManager, type SubModeKey } from '../stores/session/useSessionManager'
import type { SaveFavoritePayload } from '../types/workspace'
import { resolveSourceAssetRef } from '../utils/source-asset'
import {
  buildTestResultExampleDraft,
  buildTestResultExampleEntries,
  type TestResultExampleEntry,
} from '../utils/test-result-example-draft'

const PREVIEW_MAX_LENGTH = 160

const props = withDefaults(defineProps<{
  subModeKey: SubModeKey
  /** 可保存的测试列（已完成、非运行中、未过期），少于 2 列时不显示批量入口 */
  variantIds: readonly string[]
  content: string
  originalContent?: string
  functionMode: 'basic' | 'context' | 'image'
  optimizationMode?: 'system' | 'user'
  imageSubMode?: 'text2image' | 'image2image' | 'multiimage'
  disabled?: boolean
  testId?: string
}>(), {
  originalContent: undefined,
  optimizationMode: undefined,
  imageSubMode: undefined,
  disabled: false,
  testId: undefined,
})

const { t } = useI18n()
const toast = useToast()
const sessionManager = useSessionManager()
const appHandleSaveFavorite = inject<((data: SaveFavoritePayload) => void) | null>('handleSaveFavorite', null)

const isPreparing = ref(false)
const showSelection = ref(false)
const pendingSession = shallowRef<PromptSession | null>(null)
const entries = shallowRef<TestResultExampleEntry[]>([])
const selectedVariantIds = ref<string[]>([])

const disabled = computed(() => props.disabled || isPreparing.value || !props.content.trim())

const getModelLabel = (entry: TestResultExampleEntry): string => {
  const metadata = entry.example.metadata || {}
  const modelName = metadata.modelName
  if (typeof modelName === 'string' && modelName.trim()) return modelName.trim()
  const modelKey = metadata.modelKey
  return typeof modelKey === 'string' ? modelKey.trim() : ''
}

const getPreview = (entry: TestResultExampleEntry): string => {
  const outputText = entry.example.outputText?.trim()
  if (outputText) {
    return outputText.length > PREVIEW_MAX_LENGTH
      ? `${outputText.slice(0, PREVIEW_MAX_LENGTH)}…`
      : outputText
  }
  const imageCount = entry.example.images.length + entry.example.imageAssetIds.length
  return imageCount > 0
    ? t('favorites.dialog.reproducibility.outputImageCount', { count: imageCount })
    : ''
}

const toggleSelection = (variantId: string, checked: boolean) => {
  if (checked) {
    if (!selectedVariantIds.value.includes(variantId)) {
      selectedVariantIds.value = [...selectedVariantIds.value, variantId]
    }
    return
  }
  selectedVariantIds.value = selectedVariantIds.value.filter((id) => id !== variantId)
}

const resetSelection = () => {
  pendingSession.value = null
  entries.value = []
  selectedVariantIds.value = []
}

const handleOpenSelection = async () => {
  if (disabled.value) return

  isPreparing.value = true
  try {
    const session = await sessionManager.getHydratedPromptSession(props.subModeKey)
    const nextEntries = buildTestResultExampleEntries(session, props.variantIds)
    if (nextEntries.length === 0) {
      toast.warning(t('favorites.dialog.reproducibility.noTestResultToSave'))
      return
    }

    pendingSession.value = session
    entries.value = nextEntries
    selectedVariantIds.value = nextEntries.map((entry) => entry.variantId)
    showSelection.value = true
  } finally {
    isPreparing.value = false
  }
}

const handleCancelSelection = () => {
  showSelection.value = false
  resetSelection()
}

const handleConfirmSelection = () => {
  const session = pendingSession.value
  const selected = entries.value.filter((entry) => selectedVariantIds.value.includes(entry.variantId))
  showSelection.value = false
  resetSelection()

  if (!session || selected.length === 0) return

  if (!appHandleSaveFavorite) {
    toast.error(t('toast.error.favoriteNotInitialized'))
    return
  }

  appHandleSaveFavorite({
    content: props.content,
    originalContent: props.originalContent,
    candidateSource: resolveSourceAssetRef(session.origin, session.assetBinding),
    prefill: {
      functionMode: props.functionMode,
      optimizationMode: props.optimizationMode,
      imageSubMode: props.imageSubMode,
      reproducibilityDraft: buildTestResultExampleDraft(selected),
      updateIntent: 'examples',
    },
  })
}
</script>

<style scoped>
.batch-example-list { display: flex; flex-direction: column; gap: 10px; padding-inline-end: 8px; }
.batch-example-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.batch-example-model { margin-inline-start: 8px; font-size: 12px; }
.batch-example-preview {
  padding-inline-start: 24px;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.batch-example-count { display: block; margin-top: 12px; font-size: 12px; }
</style>
