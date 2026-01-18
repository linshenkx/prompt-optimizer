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
                title="复制"
              >
                <template #icon>
                  <n-icon><Copy /></n-icon>
                </template>
              </n-button>
              <n-button
                quaternary
                @click="$emit('use', favorite)"
                title="使用"
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
import { h } from 'vue'

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
import {
  Copy,
  PlayerPlay,
  Eye,
  DotsVertical,
  Edit,
  Trash,
  Share,
  Tag
} from '@vicons/tabler';
import type { FavoritePrompt, FavoriteCategory } from '@prompt-optimizer/core';

interface Props {
  favorite: FavoritePrompt;
  category?: FavoriteCategory;
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false
});

const emit = defineEmits<{
  'select': [favorite: FavoritePrompt, selected: boolean];
  'edit': [favorite: FavoritePrompt];
  'copy': [favorite: FavoritePrompt];
  'delete': [favorite: FavoritePrompt];
  'use': [favorite: FavoritePrompt];
  'toggle-category': [favorite: FavoritePrompt];
  'share': [favorite: FavoritePrompt];
}>();

const actionMenuOptions = [
  {
    label: '编辑',
    key: 'edit',
    icon: () => h(NIcon, null, { default: () => h(Edit) })
  },
  {
    label: '复制',
    key: 'copy',
    icon: () => h(NIcon, null, { default: () => h(Copy) })
  },
  {
    label: '分享',
    key: 'share',
    icon: () => h(NIcon, null, { default: () => h(Share) })
  },
  {
    label: '切换分类',
    key: 'category',
    icon: () => h(NIcon, null, { default: () => h(Tag) })
  },
  {
    type: 'divider'
  },
  {
    label: '删除',
    key: 'delete',
    icon: () => h(NIcon, null, { default: () => h(Trash) })
  }
];

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? '刚刚' : `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
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
.favorite-list-item {
  @apply transition-colors duration-200;
  @apply hover:bg-gray-50 dark:hover:bg-gray-800;
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
  @apply font-medium text-gray-900 dark:text-gray-100;
}

.item-actions {
  @apply flex items-center ml-4;
}

.item-description {
  @apply mt-2;
}

.content-preview {
  @apply text-sm text-gray-700 dark:text-gray-300 mb-1;
  line-height: 1.5;
  max-height: 3em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.description-text {
  @apply text-xs text-gray-500 dark:text-gray-400;
  max-height: 2em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.item-footer {
  @apply flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-800;
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
