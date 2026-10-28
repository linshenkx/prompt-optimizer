<template>
  <n-list-item class="favorite-list-item">
    <template #prefix>
      <div class="item-checkbox">
        <n-checkbox
          :checked="isSelected"
          @update:checked="$emit('select', favorite, $event)"
        />
      </div>
    </template>

    <n-thing>
      <template #header>
        <div class="item-header">
          <div class="item-title">
            <span class="title-text">{{ favorite.title }}</span>
            <n-tag
              v-if="category"
              :color="{ color: category.color, textColor: 'white' }"
              size="small"
              style="margin-left: 8px"
            >
              {{ category.name }}
            </n-tag>
          </div>
          <div class="item-actions">
            <n-button-group size="small">
              <n-button
                quaternary
                @click="$emit('copy', favorite)"
                :title="t('favorites.library.card.copyContent')"
              >
                <template #icon>
                  <n-icon><Copy /></n-icon>
                </template>
              </n-button>
              <n-button
                quaternary
                @click="$emit('use', favorite)"
                :title="t('favorites.library.card.useNow')"
                type="primary"
              >
                <template #icon>
                  <n-icon><PlayerPlay /></n-icon>
                </template>
              </n-button>
            </n-button-group>
          </div>
        </div>
      </template>

      <template #description>
        <div class="item-description">
          <div class="content-preview">
            {{ favorite.content }}
          </div>
          <div v-if="favorite.description" class="description-text">
            {{ favorite.description }}
          </div>
        </div>
      </template>

      <template #footer>
        <div class="item-footer">
          <div class="footer-left">
            <!-- 标签 -->
            <div v-if="favorite.tags.length > 0" class="item-tags">
              <n-tag
                v-for="tag in favorite.tags"
                :key="tag"
                size="small"
                type="info"
                style="margin-right: 4px"
              >
                {{ tag }}
              </n-tag>
            </div>
          </div>
          <div class="footer-right">
            <n-space size="small">
              <n-text depth="3" style="font-size: 12px">
                {{ formatDate(favorite.updatedAt) }}
              </n-text>
              <n-text depth="3" style="font-size: 12px">
                <template #icon>
                  <n-icon><Eye /></n-icon>
                </template>
                {{ favorite.useCount }}
              </n-text>
              <n-dropdown
                :options="actionMenuOptions"
                @select="handleActionSelect"
              >
                <n-button quaternary size="small">
                  <template #icon>
                    <n-icon><DotsVertical /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </n-space>
          </div>
        </div>
      </template>
    </n-thing>
  </n-list-item>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  NListItem,
  NThing,
  NTag,
  NText,
  NIcon,
  NButton,
  NButtonGroup,
  NCheckbox,
  NSpace,
  NDropdown
} from 'naive-ui';
import { Copy, Play as PlayerPlay, Eye, EllipsisVertical as DotsVertical, SquarePen as Edit, Trash2 as Trash, Share, Tag } from '@lucide/vue'
import type { FavoritePrompt, FavoriteCategory } from '@prompt-optimizer/core';

interface Props {
  favorite: FavoritePrompt;
  category?: FavoriteCategory;
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false
});

const { t } = useI18n();

const emit = defineEmits<{
  'select': [favorite: FavoritePrompt, selected: boolean];
  'edit': [favorite: FavoritePrompt];
  'copy': [favorite: FavoritePrompt];
  'delete': [favorite: FavoritePrompt];
  'use': [favorite: FavoritePrompt];
  'toggle-category': [favorite: FavoritePrompt];
  'share': [favorite: FavoritePrompt];
}>();

const actionMenuOptions = computed(() => [
  {
    label: t('favorites.library.card.edit'),
    key: 'edit',
    icon: () => h(NIcon, null, { default: () => h(Edit) })
  },
  {
    label: t('favorites.library.card.copyContent'),
    key: 'copy',
    icon: () => h(NIcon, null, { default: () => h(Copy) })
  },
  {
    label: t('prompt.share'),
    key: 'share',
    icon: () => h(NIcon, null, { default: () => h(Share) })
  },
  {
    label: t('favorites.library.card.toggleCategory'),
    key: 'category',
    icon: () => h(NIcon, null, { default: () => h(Tag) })
  },
  {
    type: 'divider'
  },
  {
    label: t('favorites.library.card.delete'),
    key: 'delete',
    icon: () => h(NIcon, null, { default: () => h(Trash) })
  }
]);

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1
        ? t('favorites.library.time.justNow')
        : t('favorites.library.time.minutesAgo', { minutes });
    }
    return t('favorites.library.time.hoursAgo', { hours });
  } else if (days === 1) {
    return t('favorites.library.time.yesterday');
  } else if (days < 7) {
    return t('favorites.library.time.daysAgo', { days });
  } else {
    return date.toLocaleDateString();
  }
};

const handleActionSelect = (key: string) => {
  switch (key) {
    case 'edit':
      emit('edit', props.favorite);
      break;
    case 'copy':
      emit('copy', props.favorite);
      break;
    case 'share':
      emit('share', props.favorite);
      break;
    case 'category':
      emit('toggle-category', props.favorite);
      break;
    case 'delete':
      emit('delete', props.favorite);
      break;
  }
};
</script>

<style scoped>
@reference "../styles/index.css";

.favorite-list-item {
  @apply transition-colors duration-200;
}

.favorite-list-item:hover {
  background: var(--n-hover-color);
}

.item-checkbox {
  @apply mr-3;
}

.item-header {
  @apply flex justify-between items-center w-full;
}

.item-title {
  @apply flex items-center flex-1 min-w-0;
}

.title-text {
  @apply font-medium;
  color: var(--n-text-color);
}

.item-actions {
  @apply flex items-center ml-4;
}

.item-description {
  @apply mt-2;
}

.content-preview {
  @apply text-sm mb-1;
  color: var(--n-text-color-2);
  line-height: 1.5;
  max-height: 3em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.description-text {
  @apply text-xs;
  color: var(--n-text-color-3);
  max-height: 2em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.item-footer {
  @apply flex justify-between items-center mt-3 pt-3 border-t;
  border-color: var(--n-border-color);
}

.footer-left {
  @apply flex items-center flex-1 min-w-0;
}

.footer-right {
  @apply flex items-center;
}

.item-tags {
  @apply flex items-center flex-wrap gap-1;
}
</style>
