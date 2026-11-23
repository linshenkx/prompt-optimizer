<template>
  <template v-if="variantIds.length >= 2">
    <ThemedTooltip :label="saveAllLabel">
      <NButton
        size="small"
        secondary
        :aria-label="saveAllLabel"
        :disabled="disabled"
        :loading="isPreparing"
        :data-testid="testId"
        @click="handleOpenSelection"
      >
        <template #icon>
          <NIcon :size="16">
            <Star />
          </NIcon>
        </template>
      </NButton>
    </ThemedTooltip>

    <AdaptiveModal
      v-model:show="showSelection"
      preset="dialog"
      :title="t('favorites.dialog.reproducibility.selectTestResultExamplesTitle')"
      style="width: min(640px, calc(100vw - 24px))"
      :mask-closable="!saving"
      :close-on-esc="!saving"
      :closable="!saving"
      :positive-text="t('favorites.dialog.reproducibility.saveSelectedTestResultExamples', { count: selectedGroups.length })"
      :negative-text="t('common.cancel')"
      :positive-button-props="{ disabled: selectedGroups.length === 0, loading: saving }"
      :negative-button-props="{ disabled: saving }"
      @after-leave="resetSelection"
      @positive-click="handleConfirmSelection"
    >
      <NScrollbar style="max-height: min(420px, 60vh)">
        <div class="batch-example-list">
          <section v-for="group in groups" :key="group.content" class="batch-example-group">
            <NText tag="p" strong class="batch-example-prompt">{{ group.content }}</NText>
            <div
              v-for="entry in group.entries"
              :key="entry.variantId"
              class="batch-example-item"
              :data-testid="testId ? `${testId}-item-${entry.variantId}` : undefined"
            >
              <NCheckbox
                :checked="selectedVariantIds.includes(entry.variantId)"
                :disabled="saving"
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
          </section>
        </div>
      </NScrollbar>
      <NText depth="3" class="batch-example-count">
        {{ t('favorites.dialog.reproducibility.selectedTestResultCount', { selected: selectedVariantIds.length, total: entries.length }) }}
      </NText>
    </AdaptiveModal>
  </template>
</template>

<script setup lang="ts">
import { computed, inject, ref, shallowRef, type Ref } from 'vue'
import { NButton, NCheckbox, NIcon, NScrollbar, NText } from 'naive-ui'
import { Star } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

import AdaptiveModal from './common/AdaptiveModal.vue'
import ThemedTooltip from './common/ThemedTooltip.vue'
import { useToast } from '../composables/ui/useToast'
import { useSessionManager, type SubModeKey } from '../stores/session/useSessionManager'
import type { AppServices } from '../types/services'
import type { SaveFavoritePayload } from '../types/workspace'
import { getI18nErrorMessage } from '../utils/error'
import { persistFavoriteExampleImages } from '../utils/favorite-example-images'
import { applyFavoriteReproducibilityToMetadata, assignSequentialFavoriteExampleIds } from '../utils/favorite-reproducibility'
import { resolveSourceAssetRef } from '../utils/source-asset'
import {
  buildTestResultExampleDraft,
  buildTestResultExampleEntries,
  groupTestResultExamples,
  type TestResultExampleEntry,
} from '../utils/test-result-example-draft'

const PREVIEW_MAX_LENGTH = 160

const props = withDefaults(defineProps<{
  subModeKey: SubModeKey
  /** 可保存的测试列，少于 2 列时不显示批量入口。 */
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
const saveAllLabel = computed(() => t('favorites.dialog.reproducibility.saveTestResultExamplesBatch'))
const toast = useToast()
const sessionManager = useSessionManager()
const services = inject<Ref<AppServices | null> | null>('services', null)
const appHandleSaveFavorite = inject<((data: SaveFavoritePayload) => void) | null>('handleSaveFavorite', null)

const isPreparing = ref(false)
const showSelection = ref(false)
const saving = ref(false)
const entries = shallowRef<TestResultExampleEntry[]>([])
const selectedVariantIds = ref<string[]>([])
const groups = computed(() => groupTestResultExamples(entries.value, ''))
const selectedGroups = computed(() => groupTestResultExamples(
  entries.value.filter((entry) => selectedVariantIds.value.includes(entry.variantId)), '',
))

const disabled = computed(() => props.disabled || isPreparing.value || saving.value)

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
  entries.value = []
  selectedVariantIds.value = []
}

const handleOpenSelection = async () => {
  if (disabled.value) return

  isPreparing.value = true
  try {
    const session = await sessionManager.getHydratedPromptSession(props.subModeKey)
    const nextEntries = buildTestResultExampleEntries(session, props.variantIds)
      .map((entry) => ({ ...entry, promptText: entry.promptText ?? props.content }))
      .filter((entry) => entry.promptText.trim())
    if (nextEntries.length === 0) {
      toast.warning(t('favorites.dialog.reproducibility.noTestResultToSave'))
      return
    }

    const nextGroups = groupTestResultExamples(nextEntries, '')
    if (nextGroups.length === 1) {
      if (!appHandleSaveFavorite) {
        toast.error(t('toast.error.favoriteNotInitialized'))
        return
      }
      const { content } = nextGroups[0]
      appHandleSaveFavorite({
        content,
        originalContent: props.originalContent,
        candidateSource: resolveSourceAssetRef(session.origin, session.assetBinding),
        prefill: {
          functionMode: props.functionMode,
          optimizationMode: props.optimizationMode,
          imageSubMode: props.imageSubMode,
          reproducibilityDraft: buildTestResultExampleDraft(nextEntries),
          updateIntent: 'examples',
        },
      })
      return
    }

    entries.value = nextEntries
    selectedVariantIds.value = nextEntries.map((entry) => entry.variantId)
    showSelection.value = true
  } finally {
    isPreparing.value = false
  }
}

const handleConfirmSelection = async () => {
  const pendingGroups = selectedGroups.value
  if (saving.value || pendingGroups.length === 0) return false
  const appServices = services?.value
  if (!appServices?.favoriteManager) {
    toast.warning(t('favorites.dialog.messages.unavailable'))
    return false
  }

  saving.value = true
  try {
    for (const group of pendingGroups) {
      const draft = await persistFavoriteExampleImages(
        buildTestResultExampleDraft(group.entries, group.content),
        appServices.favoriteImageStorageService,
        appServices.imageStorageService,
      )
      await appServices.favoriteManager.addFavorite({
        title: group.content.replace(/\r?\n/g, ' ').trim().slice(0, 30),
        content: group.content,
        tags: [],
        functionMode: props.functionMode,
        optimizationMode: props.optimizationMode,
        imageSubMode: props.imageSubMode,
        metadata: applyFavoriteReproducibilityToMetadata(
          props.originalContent ? { originalContent: props.originalContent } : {},
          { ...draft, examples: assignSequentialFavoriteExampleIds([], draft.examples) },
        ),
      })
      const savedIds = new Set(group.entries.map((entry) => entry.variantId))
      entries.value = entries.value.filter((entry) => !savedIds.has(entry.variantId))
      selectedVariantIds.value = selectedVariantIds.value.filter((id) => !savedIds.has(id))
    }
    toast.success(t('favorites.dialog.reproducibility.batchSaveSuccess', { count: pendingGroups.length }))
    return true
  } catch (error) {
    const detail = getI18nErrorMessage(error, t('common.error'))
    toast.error(`${t('favorites.dialog.messages.saveFailed')}: ${detail}`)
    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.batch-example-list { display: flex; flex-direction: column; gap: 16px; padding-inline-end: 8px; }
.batch-example-group { display: grid; gap: 8px; min-width: 0; }
.batch-example-group + .batch-example-group { border-block-start: 1px solid var(--n-divider-color); padding-block-start: 12px; }
.batch-example-prompt { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 4.5em; overflow: auto; }
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
