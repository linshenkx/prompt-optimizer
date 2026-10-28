<template>
  <article
    class="favorite-workspace-list-item"
    :class="{
      'is-selected': isSelected,
      'favorite-workspace-list-item--with-actions': showQuickActions,
      'favorite-workspace-list-item--card': variant === 'card',
    }"
    data-testid="favorite-workspace-list-item"
    role="button"
    tabindex="0"
    @click="handleItemClick"
    @keydown.enter="handleItemKeydown"
    @keydown.space="handleItemKeydown"
  >
    <div class="favorite-workspace-list-item__media">
      <AppPreviewImage
        v-if="coverImageSrc"
        :src="coverImageSrc"
        :alt="favorite.title"
        object-fit="cover"
        preview-disabled
        class="favorite-workspace-list-item__image"
      />
      <div v-else class="favorite-workspace-list-item__placeholder">
        <NText depth="3">{{ modeLabel }}</NText>
      </div>
    </div>

    <div class="favorite-workspace-list-item__content">
      <div class="favorite-workspace-list-item__header">
        <NThing class="favorite-workspace-list-item__text">
          <template #header>
            <NEllipsis class="favorite-workspace-list-item__title">
              {{ favorite.title }}
            </NEllipsis>
          </template>
          <template #description>
            <NEllipsis
              :line-clamp="2"
              :tooltip="false"
              class="favorite-workspace-list-item__summary"
            >
              {{ summaryText }}
            </NEllipsis>
          </template>
        </NThing>

        <div class="favorite-workspace-list-item__header-actions">
          <NSpace
            v-if="showQuickActions"
            :size="6"
            align="center"
            wrap
            class="favorite-workspace-list-item__quick-actions"
          >
            <NButton
              size="small"
              secondary
              :circle="variant === 'card'"
              :title="t('favorites.manager.card.useNow')"
              @click.stop="$emit('use', favorite)"
            >
              <template #icon>
                <NIcon :size="16"><PlayerPlay /></NIcon>
              </template>
              <span v-if="variant !== 'card'">{{ t('favorites.manager.card.useNow') }}</span>
            </NButton>
            <NButton
              size="small"
              quaternary
              :circle="variant === 'card'"
              :title="t('favorites.manager.card.copyContent')"
              @click.stop="$emit('copy', favorite)"
            >
              <template #icon>
                <NIcon :size="16"><Copy /></NIcon>
              </template>
              <span v-if="variant !== 'card'">{{ t('favorites.manager.card.copyContent') }}</span>
            </NButton>
          </NSpace>

          <NDropdown trigger="click" :options="menuOptions" @select="handleMenuSelect">
            <NButton data-testid="favorite-workspace-item-menu" quaternary circle size="small" @click.stop>
              <template #icon>
                <NIcon :size="16"><DotsVertical /></NIcon>
              </template>
            </NButton>
          </NDropdown>
        </div>
      </div>

      <NSpace :size="6" align="center" wrap class="favorite-workspace-list-item__tags">
        <NTag
          v-if="category"
          size="small"
          :bordered="false"
          :color="category.color ? { color: category.color, textColor: 'white' } : undefined"
        >
          {{ category.name }}
        </NTag>
        <NTag size="small" :bordered="false" :type="getFunctionModeTagType(normalizedFunctionMode)">
          {{ modeLabel }}
        </NTag>
        <NTag v-if="subModeLabel" size="small" :bordered="false" :type="getSubModeTagType(favorite)">
          {{ subModeLabel }}
        </NTag>
        <NTag
          v-if="reproducibility.variableCount > 0"
          size="small"
          type="info"
          :bordered="false"
        >
          {{ t('favorites.manager.card.variableCount', { count: reproducibility.variableCount }) }}
        </NTag>
        <NTag
          v-if="reproducibility.exampleCount > 0"
          size="small"
          type="success"
          :bordered="false"
        >
          {{ t('favorites.manager.card.exampleCount', { count: reproducibility.exampleCount }) }}
        </NTag>
        <NTag
          v-for="tag in displayedTags"
          :key="tag"
          size="small"
          type="info"
          :bordered="false"
        >
          {{ tag }}
        </NTag>
      </NSpace>

      <NText depth="3" class="favorite-workspace-list-item__meta">
        {{ metaText }}
      </NText>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, h, inject, ref, watch, type Ref } from 'vue'

import {
  NButton,
  NDropdown,
  NEllipsis,
  NIcon,
  NSpace,
  NTag,
  NText,
  NThing,
} from 'naive-ui'
import { Copy, EllipsisVertical as DotsVertical, SquarePen as Edit, Play as PlayerPlay, Trash2 as Trash } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { FavoriteCategory, FavoritePrompt } from '@prompt-optimizer/core'

import type { AppServices } from '../types/services'
import { resolveAssetIdToDataUrl } from '../utils/image-asset-storage'
import { parseFavoriteMediaMetadata } from '../utils/favorite-media'
import { normalizeFavoriteFunctionMode } from '../utils/favorite-mode'
import { parseFavoriteReproducibility } from '../utils/favorite-reproducibility'
import AppPreviewImage from './media/AppPreviewImage.vue'

interface Props {
  favorite: FavoritePrompt
  category?: FavoriteCategory
  isSelected?: boolean
  showQuickActions?: boolean
  variant?: 'list' | 'card'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'list',
})

const emit = defineEmits<{
  'select': [favorite: FavoritePrompt]
  'edit': [favorite: FavoritePrompt]
  'delete': [favorite: FavoritePrompt]
  'copy': [favorite: FavoritePrompt]
  'use': [favorite: FavoritePrompt]
}>()

const { t } = useI18n()
const services = inject<Ref<AppServices | null> | null>('services', null)

const coverImageSrc = ref<string | null>(null)
let coverRequestId = 0
const displayedTags = computed(() => props.favorite.tags.slice(0, 2))
const reproducibility = computed(() => parseFavoriteReproducibility(props.favorite))

const normalizedFunctionMode = computed(() => normalizeFavoriteFunctionMode(props.favorite.functionMode))
const modeLabel = computed(() => t(`favorites.manager.card.functionMode.${normalizedFunctionMode.value}`))

const subModeLabel = computed(() => {
  if (props.favorite.optimizationMode) {
    const isContextMode = normalizedFunctionMode.value === 'context'
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

const summaryText = computed(() => {
  const text = [props.favorite.description, props.favorite.content]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text || props.favorite.title
})

const metaText = computed(() =>
  [
    t('favorites.manager.preview.updatedAt', { time: formatDate(props.favorite.updatedAt) }),
    t('favorites.manager.preview.useCountInline', { count: props.favorite.useCount }),
  ].join(' · '),
)

const menuOptions = computed(() => [
  {
    label: t('favorites.manager.card.edit'),
    key: 'edit',
    icon: () => h(NIcon, null, { default: () => h(Edit) }),
  },
  {
    label: t('favorites.manager.card.delete'),
    key: 'delete',
    icon: () => h(NIcon, null, { default: () => h(Trash) }),
  },
])

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

const mediaSignature = computed(() => {
  const media = props.favorite.metadata?.media
  if (!media || typeof media !== 'object' || Array.isArray(media)) return ''

  const rawMedia = media as Record<string, unknown>
  const stringArraySignature = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join('\u0000')
    : ''

  return JSON.stringify({
    coverAssetId: typeof rawMedia.coverAssetId === 'string' ? rawMedia.coverAssetId : '',
    coverUrl: typeof rawMedia.coverUrl === 'string' ? rawMedia.coverUrl : '',
    assetIds: stringArraySignature(rawMedia.assetIds),
    urls: stringArraySignature(rawMedia.urls),
  })
})

const refreshCoverImage = async () => {
  const requestId = ++coverRequestId
  const initialSignature = mediaSignature.value
  const setCoverImage = (value: string | null) => {
    if (requestId === coverRequestId && mediaSignature.value === initialSignature) {
      coverImageSrc.value = value
    }
  }

  setCoverImage(null)
  const media = parseFavoriteMediaMetadata(props.favorite)
  if (!media) return

  if (media.coverUrl) {
    setCoverImage(media.coverUrl)
    return
  }

  if (media.coverAssetId) {
    for (const storageService of getReadStorageCandidates()) {
      try {
        const dataUrl = await resolveAssetIdToDataUrl(media.coverAssetId, storageService)
        if (dataUrl) {
          setCoverImage(dataUrl)
          return
        }
      } catch (error) {
        console.warn('[FavoriteWorkspaceListItem] Failed to resolve cover asset id:', media.coverAssetId, error)
      }
    }
  }

  if (media.urls.length > 0) {
    setCoverImage(media.urls[0])
  }
}

watch(
  mediaSignature,
  () => {
    void refreshCoverImage()
  },
  { immediate: true },
)

const handleMenuSelect = (key: string) => {
  if (key === 'edit') {
    emit('edit', props.favorite)
    return
  }

  if (key === 'delete') {
    emit('delete', props.favorite)
  }
}

const isInteractiveChildTarget = (event: MouseEvent | KeyboardEvent) => {
  const target = event.target
  const currentTarget = event.currentTarget
  if (!(target instanceof HTMLElement) || !(currentTarget instanceof HTMLElement)) {
    return false
  }

  if (target === currentTarget) {
    return false
  }

  const interactiveTarget = target.closest('button, a, input, textarea, select, [role="button"]')
  return interactiveTarget !== null && interactiveTarget !== currentTarget
}

const handleItemClick = (event: MouseEvent) => {
  if (isInteractiveChildTarget(event)) {
    return
  }

  emit('select', props.favorite)
}

const handleItemKeydown = (event: KeyboardEvent) => {
  if (isInteractiveChildTarget(event)) {
    return
  }

  event.preventDefault()
  emit('select', props.favorite)
}

const getFunctionModeTagType = (mode: string): 'default' | 'info' | 'success' => {
  const typeMap: Record<string, 'default' | 'info' | 'success'> = {
    basic: 'default',
    context: 'info',
    image: 'success',
  }
  return typeMap[mode] || 'default'
}

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

  if (days === 1) {
    return t('favorites.manager.time.yesterday')
  }

  if (days < 7) {
    return t('favorites.manager.time.daysAgo', { days })
  }

  return date.toLocaleDateString()
}
</script>

<style scoped>
.favorite-workspace-list-item {
  display: grid;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  background: var(--n-card-color);
  padding: 10px;
  text-align: left;
  transition: border-color 0.2s ease, background-color 0.2s ease;
  cursor: pointer;
  overflow: hidden;
}

.favorite-workspace-list-item:hover,
.favorite-workspace-list-item.is-selected {
  border-color: var(--n-primary-color);
  background: var(--n-action-color);
}

.favorite-workspace-list-item__media {
  overflow: hidden;
  border-radius: 8px;
  background: var(--n-color-embedded);
}

.favorite-workspace-list-item__image,
.favorite-workspace-list-item__placeholder {
  display: flex;
  width: 72px;
  height: 72px;
  align-items: center;
  justify-content: center;
}

.favorite-workspace-list-item__content {
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.favorite-workspace-list-item__header {
  display: flex;
  min-width: 0;
  max-width: 100%;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  overflow: hidden;
}

.favorite-workspace-list-item__header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: flex-start;
}

.favorite-workspace-list-item__text {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.favorite-workspace-list-item__text :deep(.n-thing-main),
.favorite-workspace-list-item__text :deep(.n-thing-main__content),
.favorite-workspace-list-item__text :deep(.n-thing-main__description),
.favorite-workspace-list-item__text :deep(.n-thing-avatar-header-wrapper),
.favorite-workspace-list-item__text :deep(.n-thing-header),
.favorite-workspace-list-item__text :deep(.n-thing-header-wrapper),
.favorite-workspace-list-item__text :deep(.n-thing-header__title) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.favorite-workspace-list-item__title,
.favorite-workspace-list-item__text :deep(.favorite-workspace-list-item__title) {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.favorite-workspace-list-item__summary,
.favorite-workspace-list-item__text :deep(.favorite-workspace-list-item__summary) {
  display: -webkit-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.favorite-workspace-list-item__tags {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.favorite-workspace-list-item__tags :deep(.n-space-item) {
  max-width: 100%;
}

.favorite-workspace-list-item__tags :deep(.n-tag) {
  max-width: 100%;
}

.favorite-workspace-list-item__tags :deep(.n-tag__content) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-workspace-list-item__meta {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-workspace-list-item__quick-actions {
  flex-shrink: 0;
}

.favorite-workspace-list-item--card {
  height: 100%;
  min-height: 0;
  max-height: none;
  align-content: flex-start;
  border-radius: 8px;
  padding: 12px;
}

.favorite-workspace-list-item--card .favorite-workspace-list-item__header {
  min-height: 42px;
}

.favorite-workspace-list-item--card .favorite-workspace-list-item__media {
  border-radius: 7px;
}

.favorite-workspace-list-item--card .favorite-workspace-list-item__content {
  gap: 7px;
}

.favorite-workspace-list-item--card .favorite-workspace-list-item__header {
  gap: 6px;
}

.favorite-workspace-list-item--card .favorite-workspace-list-item__header-actions {
  gap: 4px;
}

.favorite-workspace-list-item--card .favorite-workspace-list-item__tags {
  max-height: 50px;
}

@media (max-width: 767px) {
  .favorite-workspace-list-item {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
  }

  .favorite-workspace-list-item__image,
  .favorite-workspace-list-item__placeholder {
    width: 64px;
    height: 64px;
  }

  .favorite-workspace-list-item__header-actions {
    flex-direction: column-reverse;
    align-items: flex-end;
  }
}
</style>
