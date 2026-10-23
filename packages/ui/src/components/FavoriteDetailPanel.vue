<template>
  <div
    class="favorite-detail-panel"
    :class="{
      'favorite-detail-panel--linked-dialog': isLinkedDialog,
      'favorite-detail-panel--compact': isCompact,
    }"
  >
    <div v-if="!favorite" class="favorite-detail-panel__empty">
      <NEmpty :description="t('favorites.manager.preview.selectFavorite')" />
    </div>

    <template v-else>
      <NSpace
        v-if="showActions"
        justify="space-between"
        align="center"
        class="favorite-detail-panel__action-bar"
      >
        <NButton
          v-if="showBack"
          quaternary
          @click="$emit('back')"
        >
          <template #icon>
            <NIcon><ArrowLeft /></NIcon>
          </template>
          {{ t('favorites.manager.preview.backToList') }}
        </NButton>
        <div v-else />

        <NSpace :size="8" align="center" wrap>
          <NButton
            data-testid="favorite-detail-use"
            type="primary"
            @click="$emit('use', favorite)"
          >
            <template #icon>
              <NIcon><PlayerPlay /></NIcon>
            </template>
            {{ t('favorites.manager.card.useNow') }}
          </NButton>
          <NDropdown v-if="isCompact" trigger="click" :options="mobileActionOptions" @select="handleMobileAction">
            <NButton secondary data-testid="favorite-detail-more" :aria-label="t('common.actions')">
              <template #icon><NIcon><DotsVertical /></NIcon></template>
            </NButton>
          </NDropdown>
          <NButton
            v-if="!isCompact"
            data-testid="favorite-detail-copy"
            secondary
            @click="$emit('copy', favorite)"
          >
            <template #icon>
              <NIcon><Copy /></NIcon>
            </template>
            {{ t('favorites.manager.card.copyContent') }}
          </NButton>
          <NButton
            v-if="!isCompact"
            data-testid="favorite-detail-share"
            secondary
            @click="$emit('share', favorite)"
          >
            <template #icon>
              <NIcon><Share /></NIcon>
            </template>
            {{ t('favorites.share.action') }}
          </NButton>
          <NButton
            v-if="!isCompact"
            data-testid="favorite-detail-edit"
            quaternary
            @click="$emit('edit', favorite)"
          >
            <template #icon>
              <NIcon><Edit /></NIcon>
            </template>
            {{ t('favorites.manager.card.edit') }}
          </NButton>
          <NButton
            v-if="!isCompact"
            data-testid="favorite-detail-delete"
            quaternary
            type="error"
            @click="$emit('delete', favorite)"
          >
            <template #icon>
              <NIcon><Trash /></NIcon>
            </template>
            {{ t('favorites.manager.card.delete') }}
          </NButton>
        </NSpace>
      </NSpace>

      <NScrollbar class="favorite-detail-panel__layout-scroll">
        <div
          class="favorite-detail-panel__layout"
          :class="detailVariant === 'image' ? 'favorite-detail-panel__layout--image' : 'favorite-detail-panel__layout--text'"
          data-testid="favorite-detail-panel"
          :data-variant="detailVariant"
        >
          <template v-if="detailVariant === 'image'">
            <div class="favorite-detail-panel__hero-layout">
              <FavoriteSurfaceSection
                variant="media"
                class="favorite-detail-panel__media-card"
              >
                <NSpace vertical :size="12">
                  <AppPreviewImageGroup v-if="activeImage">
                    <AppPreviewImage
                      data-testid="favorite-detail-media-hero"
                      :src="activeImage"
                      :alt="favorite.title"
                      :object-fit="isLinkedDialog ? 'contain' : 'cover'"
                      class="favorite-detail-panel__hero-image"
                    />
                  </AppPreviewImageGroup>

                  <div
                    v-if="displayImages.length > 1"
                    class="favorite-detail-panel__thumb-grid"
                  >
                    <button
                      v-for="(src, index) in displayImages"
                      :key="`${index}-${src.slice(0, 32)}`"
                      type="button"
                      class="favorite-detail-panel__thumb"
                      :class="{ 'is-active': index === activeImageIndex }"
                      @click="activeImageIndex = index"
                    >
                      <AppPreviewImage
                        :src="src"
                        :alt="t('favorites.manager.preview.media.imageAlt', { index: index + 1 })"
                        width="88"
                        object-fit="cover"
                        preview-disabled
                      />
                    </button>
                  </div>
                </NSpace>
              </FavoriteSurfaceSection>

              <div class="favorite-detail-panel__side-stack">
                <FavoriteSurfaceSection
                  variant="identity"
                  class="favorite-detail-panel__meta-card"
                >
                  <NSpace vertical :size="12">
                    <div class="favorite-detail-panel__title-block">
                      <NText strong class="favorite-detail-panel__title">
                        {{ favorite.title }}
                      </NText>
                      <NText v-if="!isCompact || metadataExpanded" depth="3">
                        {{ t('favorites.manager.preview.updatedAt', { time: formatDate(favorite.updatedAt) }) }}
                        ·
                        {{ t('favorites.manager.preview.useCountInline', { count: favorite.useCount }) }}
                      </NText>
                    </div>

                    <NButton
                      v-if="isCompact"
                      text
                      size="small"
                      :aria-expanded="metadataExpanded"
                      @click="metadataExpanded = !metadataExpanded"
                    >
                      {{ t('favorites.manager.preview.extraTitle') }} · {{ metadataExpanded ? t('common.collapse') : t('common.expand') }}
                    </NButton>
                    <NSpace v-if="!isCompact || metadataExpanded" :size="8" wrap>
                      <NTag
                        v-if="category"
                        :color="category.color ? { color: category.color, textColor: 'white' } : undefined"
                        :bordered="false"
                      >
                        {{ category.name }}
                      </NTag>
                      <NTag :bordered="false" :type="getFunctionModeTagType(getNormalizedFunctionMode(favorite))">
                        {{ getFunctionModeLabel(favorite) }}
                      </NTag>
                      <NTag
                        v-if="subModeLabel"
                        :bordered="false"
                        :type="getSubModeTagType(favorite)"
                      >
                        {{ subModeLabel }}
                      </NTag>
                      <NTag
                        v-for="tag in favorite.tags"
                        :key="tag"
                        :bordered="false"
                        type="info"
                      >
                        {{ tag }}
                      </NTag>
                      <NTag
                        v-if="currentPromptAssetVersion"
                        :bordered="false"
                        type="success"
                        data-testid="favorite-detail-current-version"
                      >
                        {{ t('favorites.version.itemLabel', { version: currentPromptAssetVersion.version }) }}
                      </NTag>
                    </NSpace>

                    <NText v-if="favorite.description && (!isCompact || metadataExpanded)" depth="3" class="favorite-detail-panel__description">
                      {{ favorite.description }}
                    </NText>

                    <NEllipsis
                      v-if="!isLinkedDialog && !isCompact"
                      :line-clamp="4"
                      :tooltip="false"
                    >
                      <NText depth="2">
                        {{ favorite.content }}
                      </NText>
                    </NEllipsis>
                  </NSpace>
                </FavoriteSurfaceSection>

                <FavoriteSurfaceSection
                  v-if="isLinkedDialog"
                  :title="t('favorites.manager.preview.contentTitle')"
                  variant="content"
                  class="favorite-detail-panel__content-card favorite-detail-panel__content-card--side"
                >
                  <div class="favorite-detail-panel__content-shell favorite-detail-panel__content-shell--side">
                    <OutputDisplayCore
                      :fit-content="isCompact"
                      :content="displayContent"
                      :original-content="originalContent"
                      mode="readonly"
                      :enabled-actions="contentEnabledActions"
                      height="100%"
                    />
                  </div>
                </FavoriteSurfaceSection>
              </div>
            </div>

            <FavoriteSurfaceSection
              v-if="!isLinkedDialog"
              :title="t('favorites.manager.preview.contentTitle')"
              variant="content"
              class="favorite-detail-panel__content-card"
            >
              <div class="favorite-detail-panel__content-shell favorite-detail-panel__content-shell--compact">
                <OutputDisplayCore
                  :fit-content="isCompact"
                  :content="displayContent"
                  :original-content="originalContent"
                  mode="readonly"
                  :enabled-actions="contentEnabledActions"
                  height="100%"
                />
              </div>
            </FavoriteSurfaceSection>

            <NCollapse :default-expanded-names="isCompact ? [] : imageExpandedSectionNames" class="favorite-detail-panel__sections">
              <NCollapseItem
                v-if="promptAsset"
                name="versions"
                :title="t('favorites.version.title')"
              >
                <FavoritePromptAssetVersionList
                  :prompt-asset="promptAsset"
                  @view-version="handleViewVersion"
                />
              </NCollapseItem>
              <NCollapseItem
                v-if="hasReproducibilityVariables"
                name="variables"
                :title="t('favorites.manager.preview.reproducibility.variables')"
              >
                <FavoriteReproducibilityDisplay
                  :reproducibility="reproducibility"
                  :example-previews="reproducibilityExamplePreviews"
                  :show-examples="false"
                  :show-section-headings="false"
                />
              </NCollapseItem>
              <NCollapseItem
                v-if="hasReproducibilityExamples"
                name="examples"
                :title="t('favorites.manager.preview.reproducibility.examples')"
              >
                <FavoriteReproducibilityDisplay
                  :reproducibility="reproducibility"
                  :example-previews="reproducibilityExamplePreviews"
                  :show-variables="false"
                  :show-section-headings="false"
                  :show-apply-example="showActions"
                  @apply-example="handleApplyExample"
                />
              </NCollapseItem>
              <NCollapseItem name="extra" :title="t('favorites.manager.preview.extraTitle')">
                <FavoritePreviewExtensionHost
                  :favorite="favorite"
                  :garden-snapshot-hidden-sections="promotedGardenSnapshotSections"
                  garden-snapshot-source-only
                  @favorite-updated="handleFavoriteUpdated"
                />
              </NCollapseItem>
            </NCollapse>
          </template>

          <template v-else>
            <FavoriteSurfaceSection
              variant="identity"
              class="favorite-detail-panel__meta-card"
            >
              <NSpace vertical :size="12">
                <div class="favorite-detail-panel__title-block">
                  <NText strong class="favorite-detail-panel__title">
                    {{ favorite.title }}
                  </NText>
                  <NText v-if="!isCompact || metadataExpanded" depth="3">
                    {{ t('favorites.manager.preview.updatedAt', { time: formatDate(favorite.updatedAt) }) }}
                    ·
                    {{ t('favorites.manager.preview.useCountInline', { count: favorite.useCount }) }}
                  </NText>
                </div>

                <NButton
                  v-if="isCompact"
                  text
                  size="small"
                  :aria-expanded="metadataExpanded"
                  @click="metadataExpanded = !metadataExpanded"
                >
                  {{ t('favorites.manager.preview.extraTitle') }} · {{ metadataExpanded ? t('common.collapse') : t('common.expand') }}
                </NButton>
                <NSpace v-if="!isCompact || metadataExpanded" :size="8" wrap>
                  <NTag
                    v-if="category"
                    :color="category.color ? { color: category.color, textColor: 'white' } : undefined"
                    :bordered="false"
                  >
                    {{ category.name }}
                  </NTag>
                  <NTag :bordered="false" :type="getFunctionModeTagType(getNormalizedFunctionMode(favorite))">
                    {{ getFunctionModeLabel(favorite) }}
                  </NTag>
                  <NTag
                    v-if="subModeLabel"
                    :bordered="false"
                    :type="getSubModeTagType(favorite)"
                  >
                    {{ subModeLabel }}
                  </NTag>
                  <NTag
                    v-for="tag in favorite.tags"
                    :key="tag"
                    :bordered="false"
                    type="info"
                  >
                    {{ tag }}
                  </NTag>
                  <NTag
                    v-if="currentPromptAssetVersion"
                    :bordered="false"
                    type="success"
                    data-testid="favorite-detail-current-version"
                  >
                    {{ t('favorites.version.itemLabel', { version: currentPromptAssetVersion.version }) }}
                  </NTag>
                </NSpace>

                <NText v-if="favorite.description && (!isCompact || metadataExpanded)" depth="3" class="favorite-detail-panel__description">
                  {{ favorite.description }}
                </NText>
              </NSpace>
            </FavoriteSurfaceSection>

            <FavoriteSurfaceSection
              :title="t('favorites.manager.preview.contentTitle')"
              variant="content"
              class="favorite-detail-panel__content-card"
            >
              <div class="favorite-detail-panel__content-shell">
                <OutputDisplayCore
                  :fit-content="isCompact"
                  :content="displayContent"
                  :original-content="originalContent"
                  mode="readonly"
                  :enabled-actions="contentEnabledActions"
                  height="100%"
                />
              </div>
            </FavoriteSurfaceSection>

            <NCollapse :default-expanded-names="isCompact ? [] : textExpandedSectionNames" class="favorite-detail-panel__sections">
              <NCollapseItem
                v-if="promptAsset"
                name="versions"
                :title="t('favorites.version.title')"
              >
                <FavoritePromptAssetVersionList
                  :prompt-asset="promptAsset"
                  @view-version="handleViewVersion"
                />
              </NCollapseItem>
              <NCollapseItem
                v-if="displayImages.length > 0"
                name="media"
                :title="t('favorites.manager.preview.media.title')"
              >
                <AppPreviewImageGroup>
                  <div class="favorite-detail-panel__attachment-grid">
                    <AppPreviewImage
                      v-for="(src, index) in displayImages"
                      :key="`${index}-${src.slice(0, 32)}`"
                      :src="src"
                      :alt="t('favorites.manager.preview.media.imageAlt', { index: index + 1 })"
                      width="120"
                      object-fit="cover"
                    />
                  </div>
                </AppPreviewImageGroup>
              </NCollapseItem>
              <NCollapseItem
                v-if="hasReproducibilityVariables"
                name="variables"
                :title="t('favorites.manager.preview.reproducibility.variables')"
              >
                <FavoriteReproducibilityDisplay
                  :reproducibility="reproducibility"
                  :example-previews="reproducibilityExamplePreviews"
                  :show-examples="false"
                  :show-section-headings="false"
                />
              </NCollapseItem>
              <NCollapseItem
                v-if="hasReproducibilityExamples"
                name="examples"
                :title="t('favorites.manager.preview.reproducibility.examples')"
              >
                <FavoriteReproducibilityDisplay
                  :reproducibility="reproducibility"
                  :example-previews="reproducibilityExamplePreviews"
                  :show-variables="false"
                  :show-section-headings="false"
                  :show-apply-example="showActions"
                  @apply-example="handleApplyExample"
                />
              </NCollapseItem>
              <NCollapseItem name="extra" :title="t('favorites.manager.preview.extraTitle')">
                <FavoritePreviewExtensionHost
                  :favorite="favorite"
                  :garden-snapshot-hidden-sections="promotedGardenSnapshotSections"
                  garden-snapshot-source-only
                  @favorite-updated="handleFavoriteUpdated"
                />
              </NCollapseItem>
            </NCollapse>
          </template>
        </div>
      </NScrollbar>

      <FavoritePromptAssetVersionPreviewModal
        v-model:show="showVersionPreview"
        :version="previewVersion"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from 'vue'

import {
  NButton,
  NCollapse,
  NCollapseItem,
  NEmpty,
  NDropdown,
  NEllipsis,
  NIcon,
  NScrollbar,
  NSpace,
  NTag,
  NText,
} from 'naive-ui'
import {
  ArrowLeft,
  DotsVertical,
  Copy,
  Edit,
  PlayerPlay,
  Share,
  Trash,
} from '@vicons/tabler'
import { useI18n } from 'vue-i18n'
import type { FavoriteCategory, FavoritePrompt, PromptContentVersion } from '@prompt-optimizer/core'

import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
import type { AppServices } from '../types/services'
import { parseFavoriteMediaMetadata } from '../utils/favorite-media'
import { normalizeFavoriteFunctionMode } from '../utils/favorite-mode'
import {
  getEmbeddedFavoritePromptAsset,
  promptContentToEditableText,
} from '../utils/favorite-prompt-versions'
import { parseFavoriteReproducibility } from '../utils/favorite-reproducibility'
import { resolveAssetIdToDataUrl } from '../utils/image-asset-storage'
import OutputDisplayCore from './OutputDisplayCore.vue'
import FavoritePreviewExtensionHost from './FavoritePreviewExtensionHost.vue'
import FavoriteReproducibilityDisplay from './FavoriteReproducibilityDisplay.vue'
import FavoritePromptAssetVersionList from './favorites/FavoritePromptAssetVersionList.vue'
import FavoritePromptAssetVersionPreviewModal from './favorites/FavoritePromptAssetVersionPreviewModal.vue'
import FavoriteSurfaceSection from './favorites/FavoriteSurfaceSection.vue'
import AppPreviewImage from './media/AppPreviewImage.vue'
import AppPreviewImageGroup from './media/AppPreviewImageGroup.vue'

const props = withDefaults(defineProps<{
  favorite: FavoritePrompt | null
  category?: FavoriteCategory
  showBack?: boolean
  showActions?: boolean
  presentation?: 'default' | 'linked-dialog'
}>(), {
  category: undefined,
  showBack: false,
  showActions: true,
  presentation: 'default',
})

const emit = defineEmits<{
  'back': []
  'use': [favorite: FavoritePrompt, options?: { applyExample?: boolean; exampleId?: string; exampleIndex?: number }]
  'copy': [favorite: FavoritePrompt]
  'share': [favorite: FavoritePrompt]
  'edit': [favorite: FavoritePrompt]
  'delete': [favorite: FavoritePrompt]
  'favorite-updated': [favoriteId: string]
}>()

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const metadataExpanded = ref(false)
const mobileActionOptions = computed(() => [
  { key: 'edit', label: t('favorites.manager.card.edit') },
  { key: 'copy', label: t('favorites.manager.card.copyContent') },
  { key: 'share', label: t('favorites.share.action') },
  { key: 'delete', label: t('favorites.manager.card.delete') },
])
const handleMobileAction = (key: string) => {
  if (!props.favorite) return
  if (key === 'copy') emit('copy', props.favorite)
  else if (key === 'share') emit('share', props.favorite)
  else if (key === 'edit') emit('edit', props.favorite)
  else if (key === 'delete') emit('delete', props.favorite)
}
watch(() => props.favorite?.id, () => { metadataExpanded.value = false })
const services = inject<Ref<AppServices | null> | null>('services', null)

const assetDataUrlCache = new Map<string, string>()
const displayImages = ref<string[]>([])
const promotedGardenSnapshotSections = ['metaInfo', 'cover', 'showcases', 'examples', 'variables']
const reproducibilityExamplePreviews = ref<Array<{
  images: Array<{ assetId: string; source: string }>
  inputImages: Array<{ assetId: string; source: string }>
}>>([])
const activeImageIndex = ref(0)
const showVersionPreview = ref(false)
const previewVersion = ref<PromptContentVersion | null>(null)
let resolveSequence = 0
let reproducibilityResolveSequence = 0

const detailVariant = computed(() => (displayImages.value.length > 0 ? 'image' : 'text'))
const isLinkedDialog = computed(() => props.presentation === 'linked-dialog')
const activeImage = computed(() => displayImages.value[activeImageIndex.value] || '')
const reproducibility = computed(() => parseFavoriteReproducibility(props.favorite))
const promptAsset = computed(() => getEmbeddedFavoritePromptAsset(props.favorite))
const currentPromptAssetVersion = computed(() =>
  promptAsset.value?.versions.find((version) => version.id === promptAsset.value?.currentVersionId) || null,
)
const displayContent = computed(() => {
  if (!props.favorite) return ''
  return currentPromptAssetVersion.value
    ? promptContentToEditableText(currentPromptAssetVersion.value.content)
    : props.favorite.content
})
const hasReproducibilityVariables = computed(() => reproducibility.value.variables.length > 0)
const hasReproducibilityExamples = computed(() => reproducibility.value.examples.length > 0)
const reproducibilityExpandedSectionNames = computed(() => [
  ...(hasReproducibilityVariables.value ? ['variables'] : []),
  ...(hasReproducibilityExamples.value ? ['examples'] : []),
])
const versionExpandedSectionNames = computed(() => (promptAsset.value ? ['versions'] : []))
const imageExpandedSectionNames = computed(() =>
  [...versionExpandedSectionNames.value, ...reproducibilityExpandedSectionNames.value, 'extra'],
)
const textExpandedSectionNames = computed(() => {
  const names: string[] = []
  names.push(...versionExpandedSectionNames.value)
  if (displayImages.value.length > 0) names.push('media')
  names.push(...reproducibilityExpandedSectionNames.value)
  names.push('extra')
  return names
})
const originalContent = computed(() => {
  if (!props.favorite) return ''

  const legacyOriginal = (props.favorite as unknown as Record<string, unknown>).originalContent
  if (typeof legacyOriginal === 'string' && legacyOriginal.trim().length > 0) {
    return legacyOriginal
  }

  return props.favorite.metadata?.originalContent ?? ''
})
const contentEnabledActions = computed(() =>
  originalContent.value.trim().length > 0 ? ['diff'] as ('diff')[] : []
)

const subModeLabel = computed(() => {
  if (!props.favorite) return ''

  if (props.favorite.optimizationMode) {
    const isContextMode = normalizeFavoriteFunctionMode(props.favorite.functionMode) === 'context'
    if (isContextMode) {
      return props.favorite.optimizationMode === 'system'
        ? t('contextMode.optimizationMode.message')
        : t('contextMode.optimizationMode.variable')
    }

    return t(`favorites.manager.card.optimizationMode.${props.favorite.optimizationMode}`)
  }

  if (props.favorite.imageSubMode) {
    return t(`favorites.manager.card.imageSubMode.${props.favorite.imageSubMode}`)
  }

  return ''
})

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

const resolveAssetIdsToDataUrls = async (assetIds: string[]): Promise<string[]> => {
  const storageCandidates = getReadStorageCandidates()
  if (storageCandidates.length === 0 || assetIds.length === 0) return []

  const resolved: string[] = []
  for (const assetId of assetIds) {
    if (!assetId) continue

    if (assetDataUrlCache.has(assetId)) {
      resolved.push(assetDataUrlCache.get(assetId) as string)
      continue
    }

    for (const storageService of storageCandidates) {
      try {
        const dataUrl = await resolveAssetIdToDataUrl(assetId, storageService)
        if (dataUrl) {
          assetDataUrlCache.set(assetId, dataUrl)
          resolved.push(dataUrl)
          break
        }
      } catch (error) {
        console.warn('[FavoriteDetailPanel] Failed to resolve asset id:', assetId, error)
      }
    }
  }

  return resolved
}

const refreshDisplayImages = async () => {
  const currentSequence = ++resolveSequence
  const favorite = props.favorite
  if (!favorite) {
    displayImages.value = []
    activeImageIndex.value = 0
    return
  }

  const media = parseFavoriteMediaMetadata(favorite)
  if (!media) {
    displayImages.value = []
    activeImageIndex.value = 0
    return
  }

  const images: string[] = []

  if (media.coverUrl) {
    images.push(media.coverUrl)
  }

  if (media.coverAssetId) {
    const resolvedCover = await resolveAssetIdsToDataUrls([media.coverAssetId])
    images.push(...resolvedCover)
  }

  const resolvedAssets = await resolveAssetIdsToDataUrls(media.assetIds)
  images.push(...resolvedAssets)
  images.push(...media.urls)

  if (currentSequence !== resolveSequence) return

  displayImages.value = Array.from(new Set(images.filter(Boolean)))
  activeImageIndex.value = 0
}

const refreshReproducibilityExamplePreviews = async () => {
  const currentSequence = ++reproducibilityResolveSequence
  const favorite = props.favorite
  if (!favorite) {
    reproducibilityExamplePreviews.value = []
    return
  }

  const parsed = parseFavoriteReproducibility(favorite)
  const resolveAssetPreviews = async (assetIds: string[]) => {
    const previewItems: Array<{ assetId: string; source: string }> = []
    for (const assetId of assetIds) {
      const source = (await resolveAssetIdsToDataUrls([assetId]))[0]
      if (currentSequence !== reproducibilityResolveSequence) return []
      if (source) {
        previewItems.push({ assetId, source })
      }
    }
    return previewItems
  }

  const previews: Array<{
    images: Array<{ assetId: string; source: string }>
    inputImages: Array<{ assetId: string; source: string }>
  }> = []
  for (const example of parsed.examples) {
    const images = await resolveAssetPreviews(example.imageAssetIds)
    if (currentSequence !== reproducibilityResolveSequence) return
    const inputImages = await resolveAssetPreviews(example.inputImageAssetIds)
    if (currentSequence !== reproducibilityResolveSequence) return
    previews.push({
      images,
      inputImages,
    })
  }

  if (currentSequence !== reproducibilityResolveSequence) return
  reproducibilityExamplePreviews.value = previews
}

watch(
  () => props.favorite,
  () => {
    void refreshDisplayImages()
    void refreshReproducibilityExamplePreviews()
  },
  { immediate: true },
)

watch(
  () => [services?.value?.favoriteImageStorageService, services?.value?.imageStorageService],
  () => {
    void refreshDisplayImages()
    void refreshReproducibilityExamplePreviews()
  },
)

const getFunctionModeTagType = (mode: string): 'default' | 'info' | 'success' => {
  const typeMap: Record<string, 'default' | 'info' | 'success'> = {
    basic: 'default',
    context: 'info',
    image: 'success',
  }
  return typeMap[mode] || 'default'
}

const getNormalizedFunctionMode = (favorite: FavoritePrompt) =>
  normalizeFavoriteFunctionMode(favorite.functionMode)

const getFunctionModeLabel = (favorite: FavoritePrompt) =>
  t(`favorites.manager.card.functionMode.${getNormalizedFunctionMode(favorite)}`)

const getSubModeTagType = (favorite: FavoritePrompt): 'default' | 'warning' | 'success' => {
  if (favorite.imageSubMode) return 'success'
  if (favorite.optimizationMode === 'user') return 'warning'
  return 'default'
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes <= 1 ? t('favorites.manager.time.justNow') : t('favorites.manager.time.minutesAgo', { minutes })
    }
    return t('favorites.manager.time.hoursAgo', { hours })
  }

  if (days === 1) return t('favorites.manager.time.yesterday')
  if (days < 7) return t('favorites.manager.time.daysAgo', { days })
  return date.toLocaleDateString()
}

const handleFavoriteUpdated = (favoriteId: string) => {
  emit('favorite-updated', favoriteId)
}

const handleViewVersion = (version: PromptContentVersion) => {
  previewVersion.value = version
  showVersionPreview.value = true
}

const handleApplyExample = (options: { exampleId?: string; exampleIndex: number }) => {
  if (!props.favorite) return
  emit('use', props.favorite, { ...options, applyExample: true })
}
</script>

<style scoped>
.favorite-detail-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
}

.favorite-detail-panel__empty {
  display: flex;
  flex: 1;
  min-height: 320px;
  align-items: center;
  justify-content: center;
}

.favorite-detail-panel__action-bar {
  flex: 0 0 auto;
  margin: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--n-border-color) 72%, transparent);
  background: color-mix(in srgb, var(--n-color) 92%, var(--n-primary-color) 8%);
  padding: 10px 12px;
  border-radius: 8px;
}

.favorite-detail-panel__layout-scroll {
  min-height: 0;
  flex: 1;
}

.favorite-detail-panel__layout {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  padding-right: 4px;
}

.favorite-detail-panel__hero-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
  gap: 16px;
}

.favorite-detail-panel--linked-dialog {
  height: auto;
}

.favorite-detail-panel--linked-dialog .favorite-detail-panel__layout {
  flex: none;
}

.favorite-detail-panel--linked-dialog .favorite-detail-panel__layout-scroll {
  flex: none;
}

.favorite-detail-panel--linked-dialog .favorite-detail-panel__hero-layout {
  grid-template-columns: minmax(420px, 0.95fr) minmax(360px, 1.05fr);
  align-items: start;
}

.favorite-detail-panel__side-stack {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
}

.favorite-detail-panel__media-card,
.favorite-detail-panel__meta-card,
.favorite-detail-panel__content-card {
  min-height: 0;
}

.favorite-detail-panel__meta-card,
.favorite-detail-panel__content-card {
  border-color: color-mix(in srgb, var(--n-border-color) 76%, transparent);
  box-shadow: none;
}

.favorite-detail-panel__meta-card {
  background: color-mix(in srgb, var(--n-color) 90%, var(--n-primary-color) 10%);
}

.favorite-detail-panel :deep(.n-card-header) {
  padding: 14px 16px 10px;
}

.favorite-detail-panel :deep(.n-card__content) {
  padding: 14px 16px;
}

.favorite-detail-panel :deep(.n-collapse) {
  border-radius: 8px;
}

.favorite-detail-panel__hero-image {
  display: block;
  width: 100%;
  min-height: 260px;
  max-height: 420px;
}

.favorite-detail-panel--linked-dialog .favorite-detail-panel__hero-image {
  min-height: 360px;
  max-height: min(58vh, 560px);
  background: var(--n-color-embedded);
}

.favorite-detail-panel__thumb-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.favorite-detail-panel__thumb {
  overflow: hidden;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  padding: 0;
}

.favorite-detail-panel__thumb.is-active {
  border-color: var(--n-primary-color);
}

.favorite-detail-panel__title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.favorite-detail-panel__title {
  font-size: 18px;
  line-height: 1.4;
}

.favorite-detail-panel__description {
  display: block;
}

.favorite-detail-panel__content-shell {
  overflow: hidden;
  min-height: 300px;
  border-radius: 8px;
}

.favorite-detail-panel__content-shell--compact {
  min-height: 280px;
}

.favorite-detail-panel__content-card--side {
  flex: 1;
}

.favorite-detail-panel__content-shell--side {
  height: min(36vh, 340px);
  min-height: 260px;
}

.favorite-detail-panel__attachment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.favorite-detail-panel__sections {
  min-height: 0;
  border: 1px solid color-mix(in srgb, var(--n-border-color) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--n-color) 96%, var(--n-primary-color) 4%);
  padding: 12px;
}

.favorite-detail-panel__sections :deep(.n-collapse-item:first-child) {
  margin-top: 0;
}

@media (max-width: 1023px) {
  .favorite-detail-panel__hero-layout {
    grid-template-columns: 1fr;
  }

  .favorite-detail-panel--linked-dialog .favorite-detail-panel__hero-layout {
    grid-template-columns: 1fr;
  }
}

.favorite-detail-panel--compact {
  gap: 8px;
}
.favorite-detail-panel--compact .favorite-detail-panel__action-bar {
  order: 1;
  padding: 8px 0 0;
  border-bottom: 0;
  border-top: 1px solid var(--n-border-color);
  background: transparent;
}
.favorite-detail-panel--compact .favorite-detail-panel__layout {
  gap: 10px;
  padding-right: 0;
}
.favorite-detail-panel--compact .favorite-detail-panel__hero-layout,
.favorite-detail-panel--compact .favorite-detail-panel__side-stack {
  gap: 10px;
}
.favorite-detail-panel--compact .favorite-detail-panel__title {
  font-size: 15px;
}
.favorite-detail-panel--compact .favorite-detail-panel__hero-image {
  min-height: 0;
  max-height: 38dvh;
}
.favorite-detail-panel--compact .favorite-detail-panel__content-shell {
  min-height: 0;
  height: auto;
}
.favorite-detail-panel--compact .favorite-detail-panel__sections {
  padding: 8px;
}
.favorite-detail-panel--compact :deep(.n-card-header) {
  min-height: 0;
  padding: 8px 10px;
  font-size: 13px;
}
.favorite-detail-panel--compact :deep(.n-card-content) {
  padding: 10px;
}
</style>
