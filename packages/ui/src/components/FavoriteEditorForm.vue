<template>
  <div class="favorite-editor-form" :class="{ 'favorite-editor-form--embedded': embedded, 'favorite-editor-form--compact': isCompact }">
    <NScrollbar class="favorite-editor-form__scroll">
      <div class="favorite-editor-form__content">
        <NSpace vertical :size="isCompact ? 10 : 16">
          <NAlert
            v-if="pendingChangeMessages.length > 0"
            type="info"
            :show-icon="false"
            class="favorite-editor-form__pending-summary"
          >
            <NSpace :size="[8, 8]" align="center" wrap>
              <NText strong>{{ t('favorites.dialog.pendingChanges.title') }}</NText>
              <NTag
                v-for="message in pendingChangeMessages"
                :key="message"
                size="small"
                type="warning"
                :bordered="false"
              >
                {{ message }}
              </NTag>
            </NSpace>
          </NAlert>

          <FavoriteSurfaceSection
            :title="t('favorites.dialog.basicInfo')"
            variant="identity"
            :changed="isBasicInfoChanged"
          >
            <template #headerExtra>
              <NButton v-if="isCompact" text size="small" :aria-expanded="metadataExpanded" @click="metadataExpanded = !metadataExpanded">
                {{ t('favorites.manager.preview.extraTitle') }}
              </NButton>
              <NTag v-if="isBasicInfoChanged" size="small" type="warning" :bordered="false">
                {{ t('favorites.dialog.changed') }}
              </NTag>
            </template>
            <NForm label-placement="top">
              <NGrid :cols="2" :x-gap="isCompact ? 8 : 16">
                <NGridItem :span="isCompact ? 2 : 1">
                  <NFormItem :show-feedback="!isCompact" :label="t('favorites.dialog.titleLabel')" required>
                    <NInput
                      data-testid="favorite-editor-title"
                      v-model:value="formData.title"
                      :placeholder="t('favorites.dialog.titlePlaceholder')"
                      maxlength="100"
                      show-count
                    />
                  </NFormItem>
                </NGridItem>

                <NGridItem v-show="!isCompact || metadataExpanded" :span="isCompact ? 2 : 1">
                  <NFormItem :show-feedback="!isCompact" :label="t('favorites.dialog.categoryLabel')">
                    <CategoryTreeSelect
                      v-model="formData.category"
                      :placeholder="t('favorites.dialog.categoryPlaceholder')"
                      :show-all-option="false"
                    />
                  </NFormItem>
                </NGridItem>

                <NGridItem>
                  <NFormItem :show-feedback="!isCompact" :label="t('favorites.dialog.functionModeLabel')" required>
                    <NSelect
                      v-model:value="formData.functionMode"
                      :options="functionModeOptions"
                      :disabled="props.mode === 'save' && !!props.originalContent"
                      @update:value="handleFunctionModeChange"
                    />
                  </NFormItem>
                </NGridItem>

                <NGridItem>
                  <NFormItem :show-feedback="!isCompact"
                    v-if="formData.functionMode === 'basic' || formData.functionMode === 'context'"
                    :label="t('favorites.dialog.optimizationModeLabel')"
                  >
                    <NSelect
                      v-model:value="formData.optimizationMode"
                      :options="optimizationModeOptions"
                      :placeholder="t('favorites.dialog.optimizationModePlaceholder')"
                      :disabled="props.mode === 'save' && !!props.originalContent"
                    />
                  </NFormItem>

                  <NFormItem :show-feedback="!isCompact"
                    v-else
                    :label="t('favorites.dialog.imageModeLabel')"
                  >
                    <NSelect
                      v-model:value="formData.imageSubMode"
                      :options="imageSubModeOptions"
                      :placeholder="t('favorites.dialog.imageModePlaceholder')"
                      :disabled="props.mode === 'save' && !!props.originalContent"
                    />
                  </NFormItem>
                </NGridItem>
              </NGrid>

              <NFormItem :show-feedback="!isCompact" v-show="!isCompact || metadataExpanded" :label="t('favorites.dialog.descriptionLabel')">
                <NInput
                  data-testid="favorite-editor-description"
                  v-model:value="formData.description"
                  type="textarea"
                  :placeholder="t('favorites.dialog.descriptionPlaceholder')"
                  :autosize="{ minRows: 3, maxRows: 5 }"
                  maxlength="300"
                  show-count
                />
              </NFormItem>

              <NFormItem :show-feedback="!isCompact" v-show="!isCompact || metadataExpanded" :label="t('favorites.dialog.tagsLabel')">
                <div class="favorite-editor-form__tag-field">
                  <NSpace v-if="formData.tags.length > 0" :size="[8, 8]" class="favorite-editor-form__tag-list">
                    <NTag
                      v-for="(tag, index) in formData.tags"
                      :key="tag"
                      closable
                      type="info"
                      @close="handleRemoveTag(index)"
                    >
                      {{ tag }}
                    </NTag>
                  </NSpace>

                  <NAutoComplete
                    v-model:value="tagInputValue"
                    :options="tagSuggestions"
                    :placeholder="t('favorites.dialog.tagsPlaceholder')"
                    :get-show="() => tagInputValue.length > 0 || tagSuggestions.length > 0"
                    clearable
                    @select="handleSelectTag"
                    @keydown.enter="handleAddTag"
                  />
                </div>
              </NFormItem>
            </NForm>
          </FavoriteSurfaceSection>

          <FavoriteSurfaceSection
            :title="t('favorites.dialog.imagesLabel')"
            :collapsible="isCompact"
            variant="media"
            :changed="isMediaChanged"
          >
            <template #headerExtra>
              <NTag v-if="isMediaChanged" size="small" type="warning" :bordered="false">
                {{ t('favorites.dialog.changed') }}
              </NTag>
            </template>
            <NSpace vertical :size="12">
              <template v-if="mediaDraft.sources.length === 0">
                <div class="favorite-editor-form__upload-compact">
                  <div class="favorite-editor-form__upload-copy">
                    <NText>{{ t('favorites.dialog.imagesUploadHint') }}</NText>
                    <NText depth="3">{{ t('favorites.dialog.imagesUploadSupport') }}</NText>
                  </div>
                  <NUpload
                    data-testid="favorite-editor-image-upload-empty"
                    accept="image/*"
                    multiple
                    :default-upload="false"
                    :show-file-list="false"
                    :disabled="saving"
                    @before-upload="handleBeforeImageUpload"
                  >
                    <NButton secondary size="small" data-testid="favorite-editor-add-images-empty">
                      {{ t('favorites.dialog.addImages') }}
                    </NButton>
                  </NUpload>
                </div>
              </template>

              <template v-else>
                <NSpace justify="space-between" align="center" wrap>
                  <NUpload
                    data-testid="favorite-editor-image-upload"
                    accept="image/*"
                    multiple
                    :default-upload="false"
                    :show-file-list="false"
                    :disabled="saving"
                    @before-upload="handleBeforeImageUpload"
                  >
                    <NButton secondary data-testid="favorite-editor-add-images">
                      {{ t('favorites.dialog.addImages') }}
                    </NButton>
                  </NUpload>

                  <NButton
                    data-testid="favorite-editor-clear-images"
                    quaternary
                    type="error"
                    size="small"
                    @click="handleClearImages"
                  >
                    {{ t('favorites.dialog.clearImages') }}
                  </NButton>
                </NSpace>

                <div class="favorite-editor-form__media-grid">
                  <NCard
                    v-for="(source, index) in mediaDraft.sources"
                    :key="`${index}-${source.slice(0, 32)}`"
                    size="small"
                    class="favorite-editor-form__media-card"
                    :segmented="{ content: true, footer: 'soft' }"
                  >
                    <AppPreviewImageGroup>
                      <AppPreviewImage
                        :src="source"
                        :alt="t('favorites.dialog.imageAlt', { index: index + 1 })"
                        object-fit="cover"
                        class="favorite-editor-form__media-image"
                      />
                    </AppPreviewImageGroup>

                    <template #footer>
                      <NSpace justify="space-between" align="center" :wrap="false" class="favorite-editor-form__media-actions">
                        <NTag
                          v-if="mediaDraft.coverIndex === index"
                          size="small"
                          type="success"
                          :bordered="false"
                        >
                          {{ t('favorites.dialog.coverTag') }}
                        </NTag>
                        <NButton
                          data-testid="favorite-editor-set-cover"
                          v-else
                          quaternary
                          size="tiny"
                          @click="handleSetCover(index)"
                        >
                          {{ t('favorites.dialog.setAsCover') }}
                        </NButton>

                        <NButton
                          data-testid="favorite-editor-remove-image"
                          quaternary
                          type="error"
                          size="tiny"
                          @click="handleRemoveImage(index)"
                        >
                          {{ t('favorites.dialog.removeImage') }}
                        </NButton>
                      </NSpace>
                    </template>
                  </NCard>
                </div>
              </template>
            </NSpace>
          </FavoriteSurfaceSection>

          <FavoriteSurfaceSection
            :title="t('favorites.dialog.contentTitle')"
            variant="content"
            :changed="isContentChanged"
          >
            <template #headerExtra>
              <NTag v-if="isContentChanged" size="small" type="warning" :bordered="false">
                {{ t('favorites.dialog.changed') }}
              </NTag>
            </template>
            <NInput
              data-testid="favorite-editor-content"
              v-model:value="formData.content"
              type="textarea"
              :placeholder="t('favorites.dialog.contentPlaceholder')"
              :autosize="{ minRows: embedded ? 8 : isMobile ? 8 : 12, maxRows: 24 }"
            />
          </FavoriteSurfaceSection>

          <FavoriteSurfaceSection
            v-if="promptAsset"
            :title="t('favorites.version.title')"
            :collapsible="isCompact"
          >
            <template #headerExtra>
              <NSpace :size="6" align="center" wrap>
                <NTag
                  v-if="currentPromptAssetVersion"
                  size="small"
                  type="success"
                  :bordered="false"
                  data-testid="favorite-editor-current-version"
                >
                  {{ t('favorites.version.currentVersion', { version: currentPromptAssetVersion.version }) }}
                </NTag>
              </NSpace>
            </template>
            <FavoritePromptAssetVersionList
              :prompt-asset="promptAsset"
              show-set-current-actions
              show-delete-actions
              :busy-version-id="busyVersionId"
              @view-version="handleViewVersion"
              @set-current-version="handleSetCurrentVersion"
              @delete-version="handleDeleteVersion"
            />
          </FavoriteSurfaceSection>

          <FavoriteSurfaceSection
            :title="t('favorites.dialog.reproducibility.variables')"
            :collapsible="isCompact"
            :changed="isReproducibilityVariablesChanged"
          >
            <template #headerExtra>
              <NTag
                v-if="isReproducibilityVariablesChanged"
                size="small"
                type="warning"
                :bordered="false"
              >
                {{ t('favorites.dialog.changed') }}
              </NTag>
            </template>
            <FavoriteReproducibilityEditor
              v-model:variables="reproducibilityVariables"
              v-model:examples="reproducibilityExamples"
              :example-previews="reproducibilityExamplePreviews"
              :panel-mode="reproducibilityPanelMode"
              :added-example-ids="reviewAddedExampleIds"
              :show-examples="false"
              :show-section-headings="false"
              embedded
            />
          </FavoriteSurfaceSection>

          <FavoriteSurfaceSection
            :title="t('favorites.dialog.reproducibility.examples')"
            :collapsible="isCompact"
            :changed="isReproducibilityExamplesChanged || hasAddedReviewExamples"
          >
            <template #headerExtra>
              <NTag
                v-if="isReproducibilityExamplesChanged || hasAddedReviewExamples"
                size="small"
                type="warning"
                :bordered="false"
              >
                {{ t('favorites.dialog.changed') }}
              </NTag>
            </template>
            <FavoriteReproducibilityEditor
              v-model:variables="reproducibilityVariables"
              v-model:examples="reproducibilityExamples"
              :example-previews="reproducibilityExamplePreviews"
              :panel-mode="reproducibilityPanelMode"
              :added-example-ids="reviewAddedExampleIds"
              :show-variables="false"
              :show-hint="false"
              :show-section-headings="false"
              embedded
              @add-image-to-media="handleAddExampleImageToMedia"
            />
          </FavoriteSurfaceSection>
        </NSpace>
      </div>
    </NScrollbar>

    <div class="favorite-editor-form__actions" :class="{ 'favorite-editor-form__actions--embedded': embedded }">
      <NSpace justify="end">
        <NButton data-testid="favorite-editor-cancel" :disabled="saving" @click="$emit('cancel')">
          {{ t('favorites.dialog.cancel') }}
        </NButton>
        <NButton data-testid="favorite-editor-save" type="primary" :loading="saving" @click="handleSave">
          {{ t('favorites.dialog.save') }}
        </NButton>
      </NSpace>
    </div>

    <FavoritePromptAssetVersionPreviewModal
      v-model:show="showVersionPreview"
      :version="previewVersion"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch, type Ref } from 'vue'

import {
  NAutoComplete,
  NAlert,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NScrollbar,
  NSelect,
  NSpace,
  NTag,
  NText,
  NUpload,
  type UploadFileInfo,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { FavoritePrompt, PromptContentVersion } from '@prompt-optimizer/core'

import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
import { useToast } from '../composables/ui/useToast'
import { useTagSuggestions } from '../composables/ui/useTagSuggestions'
import type { AppServices } from '../types/services'
import { getI18nErrorMessage } from '../utils/error'
import { buildFavoriteMediaMetadata, parseFavoriteMediaMetadata } from '../utils/favorite-media'
import { normalizeFavoriteFunctionMode } from '../utils/favorite-mode'
import {
  deriveFavoriteCategoryPathFromGardenMeta,
  ensureFavoriteCategoryPath,
  loadFavoriteCategoryPathLeafId,
} from '../utils/favorite-category-path'
import {
  getEmbeddedFavoritePromptAsset,
  promptContentToEditableText,
} from '../utils/favorite-prompt-versions'
import {
  applyFavoriteReproducibilityToMetadata,
  appendFavoriteReproducibilityDraftToMetadata,
  assignSequentialFavoriteExampleIds,
  parseFavoriteReproducibility,
  parseFavoriteReproducibilityFromMetadata,
  type FavoriteReproducibilityDraft,
  type FavoriteReproducibilityExample,
  type FavoriteReproducibilityVariable,
} from '../utils/favorite-reproducibility'
import {
  persistImageSourceAsAssetId,
  resolveAssetIdToDataUrl,
} from '../utils/image-asset-storage'
import CategoryTreeSelect from './CategoryTreeSelect.vue'
import FavoritePromptAssetVersionList from './favorites/FavoritePromptAssetVersionList.vue'
import FavoritePromptAssetVersionPreviewModal from './favorites/FavoritePromptAssetVersionPreviewModal.vue'
import FavoriteReproducibilityEditor from './FavoriteReproducibilityEditor.vue'
import FavoriteSurfaceSection from './favorites/FavoriteSurfaceSection.vue'
import AppPreviewImage from './media/AppPreviewImage.vue'
import AppPreviewImageGroup from './media/AppPreviewImageGroup.vue'

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const metadataExpanded = ref(false)
const { filterTags, loadTags } = useTagSuggestions()

interface Props {
  mode?: 'create' | 'save' | 'edit'
  content?: string
  originalContent?: string
  currentFunctionMode?: 'basic' | 'context' | 'pro' | 'image'
  currentOptimizationMode?: 'system' | 'user'
  prefill?: {
    title?: string
    description?: string
    category?: string
    tags?: string[]
    functionMode?: 'basic' | 'context' | 'image'
    optimizationMode?: 'system' | 'user'
    imageSubMode?: 'text2image' | 'image2image' | 'multiimage'
    metadata?: Record<string, unknown>
    reproducibilityDraft?: FavoriteReproducibilityDraft
    updateIntent?: 'content' | 'examples'
  }
  favorite?: FavoritePrompt
  embedded?: boolean
  applyIncomingContentOnEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'save',
  content: '',
  originalContent: undefined,
  currentFunctionMode: 'basic',
  currentOptimizationMode: 'system',
  prefill: undefined,
  favorite: undefined,
  embedded: false,
  applyIncomingContentOnEdit: false,
})

const emit = defineEmits<{
  'cancel': []
  'saved': [favoriteId: string]
}>()

type FavoriteReproducibilityExamplePreviews = {
  images: Array<{ assetId: string; source: string }>
  inputImages: Array<{ assetId: string; source: string }>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const services = inject<Ref<AppServices | null>>('services')
const message = useToast()

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const saving = ref(false)
const busyVersionId = ref('')
const showVersionPreview = ref(false)
const previewVersion = ref<PromptContentVersion | null>(null)
const mediaTouched = ref(false)
const tagInputValue = ref('')
const reproducibilityVariables = ref<FavoriteReproducibilityVariable[]>([])
const reproducibilityExamples = ref<FavoriteReproducibilityExample[]>([])
const reproducibilityExamplePreviews = ref<FavoriteReproducibilityExamplePreviews[]>([])
const reviewAddedExampleIds = ref<string[]>([])

const isMobile = computed(() => viewportWidth.value < 768)
const isEditingFavorite = computed(() => props.mode === 'edit' && Boolean(props.favorite))
const promptAsset = computed(() =>
  props.mode === 'edit' ? getEmbeddedFavoritePromptAsset(props.favorite) : null,
)
const currentPromptAssetVersion = computed(() =>
  promptAsset.value?.versions.find((version) => version.id === promptAsset.value?.currentVersionId) || null,
)

const formData = reactive({
  title: '',
  description: '',
  content: '',
  category: '',
  tags: [] as string[],
  functionMode: 'basic' as 'basic' | 'context' | 'image',
  optimizationMode: 'system' as 'system' | 'user' | undefined,
  imageSubMode: undefined as 'text2image' | 'image2image' | 'multiimage' | undefined,
})

const mediaDraft = reactive({
  sources: [] as string[],
  coverIndex: -1,
})
let hydrateRequestId = 0

type ExampleImageToMediaPayload = {
  source: string
}

const normalizeComparableString = (value: unknown) => String(value ?? '').trim()
const normalizeComparableTags = (tags: unknown) =>
  Array.isArray(tags) ? tags.map((tag) => String(tag)).sort() : []
const stringifyComparable = (value: unknown) => JSON.stringify(value ?? null)

const isBasicInfoChanged = computed(() => {
  if (!isEditingFavorite.value || !props.favorite) return false
  return (
    normalizeComparableString(formData.title) !== normalizeComparableString(props.favorite.title) ||
    normalizeComparableString(formData.description) !== normalizeComparableString(props.favorite.description) ||
    normalizeComparableString(formData.category) !== normalizeComparableString(props.favorite.category) ||
    stringifyComparable(normalizeComparableTags(formData.tags)) !== stringifyComparable(normalizeComparableTags(props.favorite.tags)) ||
    normalizeComparableString(formData.functionMode) !== normalizeComparableString(normalizeFavoriteFunctionMode(props.favorite.functionMode)) ||
    normalizeComparableString(formData.optimizationMode) !== normalizeComparableString(props.favorite.optimizationMode) ||
    normalizeComparableString(formData.imageSubMode) !== normalizeComparableString(props.favorite.imageSubMode)
  )
})

const isContentChanged = computed(() => {
  if (!isEditingFavorite.value || !props.favorite) return false
  return normalizeComparableString(formData.content) !== normalizeComparableString(props.favorite.content)
})

const isMediaChanged = computed(() => isEditingFavorite.value && mediaTouched.value)

const favoriteReproducibilityBaseline = computed(() =>
  props.favorite ? parseFavoriteReproducibility(props.favorite) : null,
)

const isReproducibilityVariablesChanged = computed(() => {
  if (!isEditingFavorite.value || !props.favorite) return false
  return stringifyComparable(reproducibilityVariables.value) !== stringifyComparable(favoriteReproducibilityBaseline.value?.variables || [])
})

const isReproducibilityExamplesChanged = computed(() => {
  if (!isEditingFavorite.value || !props.favorite) return false
  return stringifyComparable(reproducibilityExamples.value) !== stringifyComparable(favoriteReproducibilityBaseline.value?.examples || [])
})

const isReproducibilityChanged = computed(() =>
  isReproducibilityVariablesChanged.value || isReproducibilityExamplesChanged.value,
)

const hasAddedReviewExamples = computed(() => reviewAddedExampleIds.value.length > 0)
const reproducibilityPanelMode = computed<'review' | 'edit'>(() =>
  props.mode === 'create' ? 'edit' : 'review',
)
const pendingChangeMessages = computed(() => {
  const messages: string[] = []
  if (isBasicInfoChanged.value) messages.push(t('favorites.dialog.pendingChanges.basicInfo'))
  if (isMediaChanged.value) messages.push(t('favorites.dialog.pendingChanges.images'))
  if (isContentChanged.value) messages.push(t('favorites.dialog.pendingChanges.content'))
  if (hasAddedReviewExamples.value) {
    messages.push(t('favorites.dialog.pendingChanges.examplesAdded', {
      count: reviewAddedExampleIds.value.length,
    }))
  } else if (isReproducibilityChanged.value) {
    messages.push(t('favorites.dialog.pendingChanges.reproducibility'))
  }
  return messages
})

// Read by the hosting mobile dialog; desktop close semantics stay with its host.
const hasUnsavedChanges = computed(() => {
  if (props.mode === 'edit') {
    return isBasicInfoChanged.value || isContentChanged.value || isMediaChanged.value || isReproducibilityChanged.value
  }
  return Boolean(
    formData.title || formData.content || formData.description || formData.category ||
    formData.tags.length || mediaDraft.sources.length ||
    reproducibilityVariables.value.length || reproducibilityExamples.value.length ||
    formData.functionMode !== 'basic' || formData.optimizationMode !== 'system' ||
    formData.imageSubMode !== undefined,
  )
})
defineExpose({ hasUnsavedChanges, saving })

const tagSuggestions = computed(() => {
  const suggestions = filterTags(tagInputValue.value, formData.tags)
  return suggestions.map((suggestion) => ({
    label: suggestion.label,
    value: suggestion.value,
  }))
})

const dedupeStrings = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const getPreferredStorageService = () => {
  return services?.value?.favoriteImageStorageService || services?.value?.imageStorageService || null
}

const getReadStorageCandidates = () => {
  const favoriteStorage = services?.value?.favoriteImageStorageService || null
  const legacyStorage = services?.value?.imageStorageService || null

  if (favoriteStorage && legacyStorage && favoriteStorage !== legacyStorage) {
    return [favoriteStorage, legacyStorage]
  }

  if (favoriteStorage) return [favoriteStorage]
  if (legacyStorage) return [legacyStorage]
  return []
}

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })

const resolveAssetIdsToDataUrls = async (assetIds: string[]): Promise<string[]> => {
  const storageCandidates = getReadStorageCandidates()
  if (storageCandidates.length === 0 || assetIds.length === 0) return []

  const resolved: string[] = []
  for (const assetId of dedupeStrings(assetIds)) {
    for (const storageService of storageCandidates) {
      try {
        const dataUrl = await resolveAssetIdToDataUrl(assetId, storageService)
        if (dataUrl) {
          resolved.push(dataUrl)
          break
        }
      } catch (error) {
        console.warn('[FavoriteEditorForm] Failed to resolve asset id:', assetId, error)
      }
    }
  }

  return resolved
}

const resetMediaDraft = () => {
  mediaDraft.sources = []
  mediaDraft.coverIndex = -1
}

const cloneReproducibilityVariables = (
  variables: FavoriteReproducibilityVariable[],
): FavoriteReproducibilityVariable[] =>
  variables.map((variable) => ({
    ...variable,
    options: [...variable.options],
  }))

const cloneReproducibilityExamples = (
  examples: FavoriteReproducibilityExample[],
): FavoriteReproducibilityExample[] =>
  examples.map((example) => ({
    ...example,
    messages: example.messages?.map((message) => ({ ...message })) || [],
    parameters: { ...example.parameters },
    outputText: example.outputText,
    images: [...example.images],
    imageAssetIds: [...example.imageAssetIds],
    inputImages: [...example.inputImages],
    inputImageAssetIds: [...example.inputImageAssetIds],
    metadata: example.metadata ? { ...example.metadata } : undefined,
  }))

const resetReproducibilityDraft = () => {
  reproducibilityVariables.value = []
  reproducibilityExamples.value = []
  reproducibilityExamplePreviews.value = []
}

const hydrateReproducibilityDraft = (
  metadata?: Record<string, unknown>,
  favorite?: FavoritePrompt,
) => {
  const reproducibility = favorite
    ? parseFavoriteReproducibility(favorite)
    : parseFavoriteReproducibilityFromMetadata(metadata)

  reproducibilityVariables.value = cloneReproducibilityVariables(reproducibility.variables)
  reproducibilityExamples.value = cloneReproducibilityExamples(reproducibility.examples)
  reproducibilityExamplePreviews.value = reproducibility.examples.map(() => ({
    images: [],
    inputImages: [],
  }))
}

const normalizeIncomingReproducibilityDraft = (
  favorite: FavoritePrompt,
  draft: FavoriteReproducibilityDraft,
): FavoriteReproducibilityDraft => {
  const current = parseFavoriteReproducibility(favorite)
  const examples = assignSequentialFavoriteExampleIds(current.examples, draft.examples || [])
  reviewAddedExampleIds.value = examples
    .map((example) => example.id)
    .filter((id): id is string => Boolean(id))
  return {
    variables: draft.variables || [],
    examples,
  }
}

const hydrateReproducibilityExamplePreviews = async (
  metadata?: Record<string, unknown>,
  favorite?: FavoritePrompt,
  isStale: () => boolean = () => false,
) => {
  const reproducibility = favorite
    ? parseFavoriteReproducibility(favorite)
    : parseFavoriteReproducibilityFromMetadata(metadata)

  const previews: FavoriteReproducibilityExamplePreviews[] = []
  const resolveAssetPreviews = async (assetIds: string[]) => {
    const previewItems: Array<{ assetId: string; source: string }> = []
    for (const assetId of assetIds) {
      if (isStale()) return []
      const source = (await resolveAssetIdsToDataUrls([assetId]))[0]
      if (isStale()) return []
      if (source) {
        previewItems.push({ assetId, source })
      }
    }
    return previewItems
  }

  for (const example of reproducibility.examples) {
    if (isStale()) return
    const images = await resolveAssetPreviews(example.imageAssetIds)
    if (isStale()) return
    const inputImages = await resolveAssetPreviews(example.inputImageAssetIds)
    if (isStale()) return
    previews.push({
      images,
      inputImages,
    })
  }

  if (isStale()) return
  reproducibilityExamplePreviews.value = previews
}

const hydrateMediaDraft = async (
  metadata?: Record<string, unknown>,
  favorite?: FavoritePrompt,
  isStale: () => boolean = () => false,
) => {
  if (isStale()) return
  resetMediaDraft()
  const media = favorite
    ? parseFavoriteMediaMetadata(favorite)
    : metadata
      ? parseFavoriteMediaMetadata({ metadata } as FavoritePrompt)
      : null
  if (!media) return

  const resolvedCover = media.coverAssetId
    ? (await resolveAssetIdsToDataUrls([media.coverAssetId]))[0]
    : undefined
  if (isStale()) return
  const resolvedAssets = await resolveAssetIdsToDataUrls(media.assetIds)
  if (isStale()) return

  const sources = dedupeStrings([
    resolvedCover || media.coverUrl || '',
    ...resolvedAssets,
    ...media.urls,
  ])

  mediaDraft.sources = sources
  if (sources.length === 0) {
    mediaDraft.coverIndex = -1
    return
  }

  const coverSource = resolvedCover || media.coverUrl || ''
  mediaDraft.coverIndex = coverSource ? Math.max(0, sources.indexOf(coverSource)) : 0
}

const extractGardenCategoryPathFromMetadata = (metadata: unknown): string[] => {
  if (!isRecord(metadata)) return []
  const gardenSnapshot = isRecord(metadata.gardenSnapshot) ? metadata.gardenSnapshot : null
  if (!gardenSnapshot) return []
  return deriveFavoriteCategoryPathFromGardenMeta(gardenSnapshot.meta)
}

const resolvePrefillCategoryId = async (
  candidate?: string,
  metadata?: Record<string, unknown>,
): Promise<string> => {
  const servicesValue = services?.value
  if (!servicesValue?.favoriteManager) return ''

  try {
    const categoryPath = extractGardenCategoryPathFromMetadata(metadata)
    if (categoryPath.length > 0) {
      const resolvedFromPath = await loadFavoriteCategoryPathLeafId(
        servicesValue.favoriteManager,
        categoryPath,
      )
      if (resolvedFromPath) {
        return resolvedFromPath
      }
    }

    const normalized = String(candidate || '').trim()
    if (!normalized) return ''

    const categories = await servicesValue.favoriteManager.getCategories()
    if (categories.some((category) => category.id === normalized)) {
      return normalized
    }

    const lowered = normalized.toLowerCase()
    const matched = categories.find(
      (category) => String(category.name || '').trim().toLowerCase() === lowered,
    )
    return matched?.id || ''
  } catch (error) {
    console.warn('[FavoriteEditorForm] Failed to resolve prefill category:', error)
    return ''
  }
}

const ensureSaveModeCategoryId = async (
  metadata?: Record<string, unknown>,
): Promise<string> => {
  const servicesValue = services?.value
  if (!servicesValue?.favoriteManager) return ''

  const categoryPath = extractGardenCategoryPathFromMetadata(metadata)
  if (categoryPath.length === 0) return ''

  try {
    return await ensureFavoriteCategoryPath(servicesValue.favoriteManager, categoryPath) || ''
  } catch (error) {
    console.warn('[FavoriteEditorForm] Failed to ensure category path from Garden metadata:', error)
    return ''
  }
}

const buildMediaMetadataForSave = async () => {
  const normalizedSources = dedupeStrings(
    mediaDraft.sources.map((item) => String(item || '').trim()).filter(Boolean),
  )

  if (normalizedSources.length === 0) return null

  const preferredStorage = getPreferredStorageService()
  const assetIds: string[] = []
  const fallbackUrls: string[] = []
  const sourceToAssetId = new Map<string, string>()

  for (const source of normalizedSources) {
    if (!preferredStorage) {
      fallbackUrls.push(source)
      continue
    }

    try {
      const assetId = await persistImageSourceAsAssetId({
        source,
        storageService: preferredStorage,
        sourceType: 'uploaded',
      })

      if (assetId) {
        assetIds.push(assetId)
        sourceToAssetId.set(source, assetId)
      } else {
        fallbackUrls.push(source)
      }
    } catch (error) {
      console.warn('[FavoriteEditorForm] Failed to persist media source:', error)
      fallbackUrls.push(source)
    }
  }

  const coverSource =
    mediaDraft.coverIndex >= 0 && mediaDraft.coverIndex < normalizedSources.length
      ? normalizedSources[mediaDraft.coverIndex]
      : normalizedSources[0]

  const coverAssetId = coverSource ? sourceToAssetId.get(coverSource) : undefined
  const coverUrl = coverSource && !coverAssetId ? coverSource : undefined

  return buildFavoriteMediaMetadata({
    coverAssetId,
    coverUrl,
    assetIds,
    urls: fallbackUrls,
  })
}

const persistSourcesForFavoriteAssets = async (sources: string[]) => {
  const normalizedSources = dedupeStrings(
    sources.map((item) => String(item || '').trim()).filter(Boolean),
  )
  const preferredStorage = getPreferredStorageService()
  const assetIds: string[] = []
  const fallbackSources: string[] = []

  for (const source of normalizedSources) {
    if (!preferredStorage) {
      fallbackSources.push(source)
      continue
    }

    try {
      const assetId = await persistImageSourceAsAssetId({
        source,
        storageService: preferredStorage,
        sourceType: 'uploaded',
      })

      if (assetId) {
        assetIds.push(assetId)
      } else {
        fallbackSources.push(source)
      }
    } catch (error) {
      console.warn('[FavoriteEditorForm] Failed to persist example image source:', error)
      fallbackSources.push(source)
    }
  }

  return {
    assetIds: dedupeStrings(assetIds),
    fallbackSources: dedupeStrings(fallbackSources),
  }
}

const buildReproducibilityDraftForSave = async () => {
  const examples: FavoriteReproducibilityExample[] = []

  for (const example of toRaw(reproducibilityExamples.value)) {
    const exampleImages = await persistSourcesForFavoriteAssets(example.images || [])
    const inputImages = await persistSourcesForFavoriteAssets(example.inputImages || [])

    examples.push({
      ...example,
      messages: example.messages?.map((message) => ({ ...message })) || [],
      parameters: { ...example.parameters },
      outputText: example.outputText,
      images: exampleImages.fallbackSources,
      imageAssetIds: dedupeStrings([
        ...(example.imageAssetIds || []),
        ...exampleImages.assetIds,
      ]),
      inputImages: inputImages.fallbackSources,
      inputImageAssetIds: dedupeStrings([
        ...(example.inputImageAssetIds || []),
        ...inputImages.assetIds,
      ]),
      metadata: example.metadata ? { ...example.metadata } : undefined,
    })
  }

  return {
    variables: toRaw(reproducibilityVariables.value).map((variable) => ({
      ...variable,
      options: [...variable.options],
    })),
    examples,
  }
}

const handleBeforeImageUpload = async (options: { file: UploadFileInfo }) => {
  const raw = (options.file as unknown as { file?: Blob | null }).file
  if (!raw) return false

  const requestId = hydrateRequestId
  try {
    const dataUrl = await readBlobAsDataUrl(raw)
    if (requestId !== hydrateRequestId) {
      return false
    }

    if (dataUrl) {
      mediaDraft.sources = dedupeStrings([...mediaDraft.sources, dataUrl])
      mediaTouched.value = true
      if (mediaDraft.coverIndex < 0) {
        mediaDraft.coverIndex = 0
      }
    }
  } catch (error) {
    console.error('[FavoriteEditorForm] Failed to read selected image:', error)
    message.error(t('favorites.dialog.messages.imageReadFailed'))
  }

  return false
}

const handleAddExampleImageToMedia = (payload: ExampleImageToMediaPayload) => {
  const source = String(payload.source || '').trim()
  if (!source) return

  const nextSources = dedupeStrings([...mediaDraft.sources, source])
  if (nextSources.length === mediaDraft.sources.length) return

  mediaDraft.sources = nextSources
  mediaTouched.value = true
  if (mediaDraft.coverIndex < 0) {
    mediaDraft.coverIndex = 0
  }
}

const handleSetCover = (index: number) => {
  if (index < 0 || index >= mediaDraft.sources.length) return
  mediaTouched.value = true
  mediaDraft.coverIndex = index
}

const handleRemoveImage = (index: number) => {
  if (index < 0 || index >= mediaDraft.sources.length) return

  mediaTouched.value = true
  mediaDraft.sources.splice(index, 1)

  if (mediaDraft.sources.length === 0) {
    mediaDraft.coverIndex = -1
    return
  }

  if (mediaDraft.coverIndex === index) {
    mediaDraft.coverIndex = 0
  } else if (mediaDraft.coverIndex > index) {
    mediaDraft.coverIndex -= 1
  }
}

const handleClearImages = () => {
  mediaTouched.value = true
  resetMediaDraft()
}

const functionModeOptions = computed(() => [
  { label: t('favorites.dialog.functionModes.basic'), value: 'basic' },
  { label: t('favorites.dialog.functionModes.context'), value: 'context' },
  { label: t('favorites.dialog.functionModes.image'), value: 'image' },
])

const optimizationModeOptions = computed(() => {
  const isContextMode = formData.functionMode === 'context'

  return [
    {
      label: isContextMode
        ? t('contextMode.optimizationMode.message')
        : t('favorites.dialog.optimizationModes.system'),
      value: 'system',
    },
    {
      label: isContextMode
        ? t('contextMode.optimizationMode.variable')
        : t('favorites.dialog.optimizationModes.user'),
      value: 'user',
    },
  ]
})

const imageSubModeOptions = computed(() => [
  { label: t('favorites.dialog.imageModes.text2image'), value: 'text2image' },
  { label: t('favorites.dialog.imageModes.image2image'), value: 'image2image' },
  { label: t('imageMode.multiimage'), value: 'multiimage' },
])

const handleFunctionModeChange = (mode: 'basic' | 'context' | 'image') => {
  formData.functionMode = mode

  if (mode === 'basic' || mode === 'context') {
    formData.optimizationMode = formData.optimizationMode || 'system'
    formData.imageSubMode = undefined
  } else {
    formData.imageSubMode = formData.imageSubMode || 'text2image'
    formData.optimizationMode = undefined
  }
}

const handleRemoveTag = (index: number) => {
  formData.tags.splice(index, 1)
}

const handleSelectTag = (value: string) => {
  if (value && !formData.tags.includes(value) && formData.tags.length < 10) {
    formData.tags.push(value)
    tagInputValue.value = ''
  }
}

const handleAddTag = (event: KeyboardEvent) => {
  event.preventDefault()
  const trimmedValue = tagInputValue.value.trim()
  if (trimmedValue && !formData.tags.includes(trimmedValue) && formData.tags.length < 10) {
    formData.tags.push(trimmedValue)
    tagInputValue.value = ''
  }
}

const handleViewVersion = (version: PromptContentVersion) => {
  previewVersion.value = version
  showVersionPreview.value = true
}

const handleSetCurrentVersion = async (version: PromptContentVersion) => {
  const servicesValue = services?.value
  if (!servicesValue?.favoriteManager || !props.favorite) {
    message.warning(t('favorites.dialog.messages.unavailable'))
    return
  }

  busyVersionId.value = version.id
  try {
    await servicesValue.favoriteManager.setFavoritePromptAssetCurrentVersion(props.favorite.id, version.id)
    formData.content = promptContentToEditableText(version.content)
    message.success(t('favorites.version.messages.setCurrentSuccess'))
    emit('saved', props.favorite.id)
  } catch (error) {
    const errorMessage = getI18nErrorMessage(error, t('common.error'))
    message.error(`${t('favorites.version.messages.setCurrentFailed')}: ${errorMessage}`)
  } finally {
    busyVersionId.value = ''
  }
}

const handleDeleteVersion = async (version: PromptContentVersion) => {
  const servicesValue = services?.value
  if (!servicesValue?.favoriteManager || !props.favorite) {
    message.warning(t('favorites.dialog.messages.unavailable'))
    return
  }

  busyVersionId.value = version.id
  try {
    await servicesValue.favoriteManager.deleteFavoritePromptAssetVersion(props.favorite.id, version.id)
    if (previewVersion.value?.id === version.id) {
      showVersionPreview.value = false
      previewVersion.value = null
    }
    message.success(t('favorites.version.messages.deleteSuccess'))
    emit('saved', props.favorite.id)
  } catch (error) {
    const errorMessage = getI18nErrorMessage(error, t('common.error'))
    message.error(`${t('favorites.version.messages.deleteFailed')}: ${errorMessage}`)
  } finally {
    busyVersionId.value = ''
  }
}

const handleSave = async () => {
  const servicesValue = services?.value
  if (!servicesValue?.favoriteManager) {
    message.warning(t('favorites.dialog.messages.unavailable'))
    return
  }

  if (!formData.title.trim()) {
    message.warning(t('favorites.dialog.validation.titleRequired'))
    return
  }

  if (!formData.content.trim()) {
    message.warning(t('favorites.dialog.validation.contentRequired'))
    return
  }

  saving.value = true
  try {
    const existingTags = new Set<string>(
      (await servicesValue.favoriteManager.getAllTags()).map((tagStat) => tagStat.tag),
    )

    for (const tag of formData.tags) {
      if (existingTags.has(tag)) {
        continue
      }

      try {
        await servicesValue.favoriteManager.addTag(tag)
        existingTags.add(tag)
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code !== 'TAG_ALREADY_EXISTS') {
          console.error('Failed to add tag to the dedicated library:', error)
          throw error
        }
      }
    }

    const sanitizedTags = Array.from(toRaw(formData.tags || [])).map((tag) => String(tag))

    const prefillMetadata =
      props.mode === 'save' && props.prefill?.metadata && typeof props.prefill.metadata === 'object'
        ? (props.prefill.metadata as Record<string, unknown>)
        : undefined

    const resolvedCategoryId = formData.category || await ensureSaveModeCategoryId(prefillMetadata)
    if (resolvedCategoryId && resolvedCategoryId !== formData.category) {
      formData.category = resolvedCategoryId
    }

    const basePayload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      content: formData.content.trim(),
      category: resolvedCategoryId,
      tags: sanitizedTags,
      functionMode: formData.functionMode,
      optimizationMode: formData.optimizationMode,
      imageSubMode: formData.imageSubMode,
    }

    let existingMetadata =
      props.mode === 'edit' && props.favorite?.metadata && typeof props.favorite.metadata === 'object'
        ? { ...props.favorite.metadata }
        : props.mode === 'save' && props.prefill?.metadata && typeof props.prefill.metadata === 'object'
          ? { ...props.prefill.metadata }
          : {}

    const isExamplesOnlyUpdate = props.mode === 'edit' && props.prefill?.updateIntent === 'examples'
    const shouldPreserveUntouchedEditMedia = isExamplesOnlyUpdate && !mediaTouched.value
    const mediaMetadata = shouldPreserveUntouchedEditMedia
      ? null
      : await buildMediaMetadataForSave()
    const prefillMedia =
      props.mode === 'save' && props.prefill?.metadata && typeof props.prefill.metadata === 'object'
        ? (props.prefill.metadata as Record<string, unknown>).media
        : undefined

    if (!shouldPreserveUntouchedEditMedia) {
      if (mediaMetadata) {
        existingMetadata.media = mediaMetadata
      } else if (
        props.mode === 'save'
        && !mediaTouched.value
        && prefillMedia
        && typeof prefillMedia === 'object'
      ) {
        existingMetadata.media = { ...(prefillMedia as Record<string, unknown>) }
      } else {
        delete existingMetadata.media
      }
    }

    if (props.originalContent && (!isExamplesOnlyUpdate || isContentChanged.value)) {
      existingMetadata.originalContent = props.originalContent
    }

    const currentReproducibility =
      props.mode === 'edit' && props.favorite
        ? parseFavoriteReproducibility(props.favorite)
        : parseFavoriteReproducibilityFromMetadata(existingMetadata)
    const reproducibilityDraft = await buildReproducibilityDraftForSave()
    const hasReproducibilityDraft =
      reproducibilityDraft.variables.length > 0 || reproducibilityDraft.examples.length > 0
    if (currentReproducibility.hasData || hasReproducibilityDraft) {
      existingMetadata = applyFavoriteReproducibilityToMetadata(
        existingMetadata,
        reproducibilityDraft,
        { preserveEmpty: currentReproducibility.hasData && !hasReproducibilityDraft },
      )
    }

    const metadata = Object.keys(existingMetadata).length > 0 ? existingMetadata : undefined

    let favoriteId = props.favorite?.id || ''
    if (props.mode === 'edit' && props.favorite) {
      await servicesValue.favoriteManager.updateFavorite(props.favorite.id, {
        ...basePayload,
        metadata,
      })
      favoriteId = props.favorite.id
      message.success(t('favorites.dialog.messages.editSuccess'))
    } else {
      favoriteId = await servicesValue.favoriteManager.addFavorite({
        ...basePayload,
        metadata,
      })
      message.success(t('favorites.dialog.messages.saveSuccess'))
    }

    emit('saved', favoriteId)
  } catch (error) {
    const failedKey = props.mode === 'edit' ? 'favorites.dialog.messages.editFailed' : 'favorites.dialog.messages.saveFailed'
    const errorMessage = getI18nErrorMessage(error, t('common.error'))
    message.error(`${t(failedKey)}: ${errorMessage}`)
  } finally {
    saving.value = false
  }
}

watch(() => [
  props.mode,
  props.content,
  props.originalContent,
  props.currentFunctionMode,
  props.currentOptimizationMode,
  props.prefill,
  props.favorite,
], async (_value, _oldValue, onCleanup) => {
  const requestId = ++hydrateRequestId
  let cancelled = false
  const isStale = () => cancelled || requestId !== hydrateRequestId
  onCleanup(() => {
    cancelled = true
  })

  mediaTouched.value = false
  reviewAddedExampleIds.value = []
  await loadTags()
  if (isStale()) return

  if (props.mode === 'create') {
    formData.title = ''
    formData.description = ''
    formData.content = ''
    formData.category = ''
    formData.tags = []
    formData.functionMode = 'basic'
    formData.optimizationMode = 'system'
    formData.imageSubMode = undefined
    resetMediaDraft()
    resetReproducibilityDraft()
    reviewAddedExampleIds.value = []
    return
  }

  if (props.mode === 'edit' && props.favorite) {
    const prefill = props.prefill
    const shouldApplyIncomingContent = props.applyIncomingContentOnEdit && prefill?.updateIntent !== 'examples'
    formData.title = props.favorite.title
    formData.description = props.favorite.description || ''
    formData.content = shouldApplyIncomingContent
      ? (props.content || props.favorite.content)
      : props.favorite.content
    formData.category = props.favorite.category || ''
    formData.tags = [...(props.favorite.tags || [])]
    formData.functionMode = shouldApplyIncomingContent && prefill?.functionMode
      ? normalizeFavoriteFunctionMode(prefill.functionMode)
      : normalizeFavoriteFunctionMode(props.favorite.functionMode)
    formData.optimizationMode = shouldApplyIncomingContent && prefill?.optimizationMode
      ? prefill.optimizationMode
      : props.favorite.optimizationMode
    formData.imageSubMode = shouldApplyIncomingContent && prefill?.imageSubMode
      ? prefill.imageSubMode
      : props.favorite.imageSubMode
    await hydrateMediaDraft(undefined, props.favorite, isStale)
    if (isStale()) return
    const draft = props.applyIncomingContentOnEdit ? props.prefill?.reproducibilityDraft : undefined
    if (draft && (draft.variables.length > 0 || draft.examples.length > 0)) {
      const normalizedDraft = normalizeIncomingReproducibilityDraft(props.favorite, draft)
      const metadata = appendFavoriteReproducibilityDraftToMetadata(props.favorite, normalizedDraft)
      hydrateReproducibilityDraft(metadata)
      await hydrateReproducibilityExamplePreviews(metadata, undefined, isStale)
    } else {
      hydrateReproducibilityDraft(undefined, props.favorite)
      await hydrateReproducibilityExamplePreviews(undefined, props.favorite, isStale)
    }
    return
  }

  const prefill = props.prefill
  const prefillMetadata =
    prefill?.metadata && typeof prefill.metadata === 'object'
      ? (prefill.metadata as Record<string, unknown>)
      : undefined
  const resolvedCategory = await resolvePrefillCategoryId(
    typeof prefill?.category === 'string' ? prefill.category : '',
    prefillMetadata,
  )
  if (isStale()) return

  const titleSource = (typeof prefill?.title === 'string' && prefill.title.trim()
    ? prefill.title
    : props.originalContent || props.content || '')
  formData.title = titleSource.replace(/\r?\n/g, ' ').substring(0, 30).trim()
  formData.content = props.content || ''
  formData.description = typeof prefill?.description === 'string' ? prefill.description : ''
  formData.category = resolvedCategory
  formData.tags = Array.isArray(prefill?.tags)
    ? dedupeStrings(prefill.tags.map((tag) => String(tag || '').trim()).filter(Boolean))
    : []

  const prefillFunctionMode = typeof prefill?.functionMode === 'string'
    ? normalizeFavoriteFunctionMode(prefill.functionMode)
    : null

  if (prefillFunctionMode === 'image') {
    formData.functionMode = 'image'
    formData.imageSubMode =
      prefill?.imageSubMode === 'image2image'
        ? 'image2image'
        : prefill?.imageSubMode === 'multiimage'
          ? 'multiimage'
          : 'text2image'
    formData.optimizationMode = undefined
  } else if (prefillFunctionMode === 'context' || prefillFunctionMode === 'basic') {
    formData.functionMode = prefillFunctionMode
    formData.optimizationMode = prefill?.optimizationMode === 'user' ? 'user' : 'system'
    formData.imageSubMode = undefined
  } else if (props.currentFunctionMode === 'image') {
    formData.functionMode = 'image'
    formData.imageSubMode = 'text2image'
    formData.optimizationMode = undefined
  } else if (props.currentFunctionMode === 'context' || props.currentFunctionMode === 'pro') {
    formData.functionMode = 'context'
    formData.optimizationMode = props.currentOptimizationMode
    formData.imageSubMode = undefined
  } else {
    formData.functionMode = 'basic'
    formData.optimizationMode = props.currentOptimizationMode
    formData.imageSubMode = undefined
  }

  // Save prefill is normalized by useAppFavorite so create/save and edit hydrate the same metadata source.
  if (prefill?.reproducibilityDraft && prefill.reproducibilityDraft.examples.length > 0) {
    reviewAddedExampleIds.value = prefill.reproducibilityDraft.examples
      .map((example) => example.id)
      .filter((id): id is string => Boolean(id))
  }
  await hydrateMediaDraft(prefillMetadata, undefined, isStale)
  if (isStale()) return
  hydrateReproducibilityDraft(prefillMetadata)
  await hydrateReproducibilityExamplePreviews(prefillMetadata, undefined, isStale)
}, { immediate: true, deep: true })

const updateViewportWidth = () => {
  if (typeof window !== 'undefined') {
    viewportWidth.value = window.innerWidth
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateViewportWidth)
  }
})

onBeforeUnmount(() => {
  hydrateRequestId += 1
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewportWidth)
  }
})
</script>

<style scoped>
.favorite-editor-form {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.favorite-editor-form__scroll {
  min-height: 0;
  flex: 1;
}

.favorite-editor-form__content {
  padding: 18px;
}

.favorite-editor-form--embedded .favorite-editor-form__content {
  padding: 18px 18px 96px;
}

.favorite-editor-form :deep(.n-card) {
  overflow: hidden;
  border-color: color-mix(in srgb, var(--n-border-color) 76%, transparent);
  border-radius: 8px;
  box-shadow: none;
}

.favorite-editor-form :deep(.n-card-header) {
  min-height: 44px;
  padding: 12px 16px 8px;
}

.favorite-editor-form :deep(.n-card__content) {
  padding: 14px 16px 16px;
}

.favorite-editor-form :deep(.n-form-item-label) {
  font-size: 12px;
  color: var(--n-text-color-2);
}

.favorite-editor-form :deep(.n-input),
.favorite-editor-form :deep(.n-base-selection) {
  border-radius: 7px;
}

.favorite-editor-form__pending-summary {
  border-radius: 8px;
}

.favorite-editor-form__tag-field {
  width: 100%;
}

.favorite-editor-form__tag-list {
  margin-bottom: 8px;
}

.favorite-editor-form__upload-compact {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px dashed var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color-embedded);
}

.favorite-editor-form__upload-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.favorite-editor-form__upload-copy :deep(.n-text) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-editor-form__media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 12px;
}

.favorite-editor-form__media-card {
  overflow: hidden;
}

.favorite-editor-form__media-image {
  display: block;
  width: 100%;
  height: 120px;
}

.favorite-editor-form__media-actions {
  width: 100%;
}

.favorite-editor-form__actions {
  flex: 0 0 auto;
  border-top: 1px solid var(--n-divider-color);
  background: var(--n-card-color);
  padding: 16px 20px;
}

.favorite-editor-form__actions--embedded {
  position: sticky;
  bottom: 0;
  z-index: 2;
}

@media (max-width: 767px) {
  .favorite-editor-form__content {
    padding: 16px;
  }

  .favorite-editor-form--embedded .favorite-editor-form__content {
    padding: 16px 16px 88px;
  }

  .favorite-editor-form__media-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .favorite-editor-form__upload-compact {
    align-items: stretch;
  }

  .favorite-editor-form__actions {
    padding: 14px 16px;
  }
}

.favorite-editor-form--compact .favorite-editor-form__content,
.favorite-editor-form--compact.favorite-editor-form--embedded .favorite-editor-form__content {
  padding: 10px;
}
.favorite-editor-form--compact .favorite-editor-form__actions {
  padding: 8px 10px;
}
.favorite-editor-form--compact :deep(.favorite-surface-section > .n-card-header) {
  min-height: 0;
  padding: 8px 10px;
  font-size: 13px;
}
.favorite-editor-form--compact :deep(.n-card-content) {
  padding: 10px;
}
.favorite-editor-form--compact :deep(.n-form-item) {
  --n-blank-height: 34px;
}
.favorite-editor-form--compact .favorite-editor-form__media-grid {
  gap: 8px;
}
</style>
