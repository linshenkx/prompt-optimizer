<template>
  <n-button
    :type="isFavorited ? 'primary' : 'default'"
    :size="size"
    :disabled="loading"
    @click="handleToggleFavorite"
    :title="isFavorited ? t('favorites.button.removeTitle') : t('favorites.button.addTitle')"
    class="favorite-button"
  >
      <template #icon>
      <n-icon>
        <Stars v-if="isFavorited" />
        <Star v-else />
      </n-icon>
    </template>
    {{ isFavorited ? t('favorites.button.favorited') : t('favorites.button.favorite') }}
  </n-button>

  <!-- 收藏对话框 -->
  <n-modal v-model:show="showFavoriteModal">
    <n-card
      style="max-width: 500px"
      :title="t('favorites.dialog.saveTitle')"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <n-form
        ref="formRef"
        :model="favoriteForm"
        :rules="formRules"
        label-placement="top"
      >
        <n-form-item :label="t('favorites.dialog.titleLabel')" path="title">
          <n-input
            v-model:value="favoriteForm.title"
            :placeholder="t('favorites.dialog.titlePlaceholder')"
            maxlength="100"
            show-count
          />
        </n-form-item>

        <n-form-item :label="t('favorites.dialog.descriptionLabel')" path="description">
          <n-input
            v-model:value="favoriteForm.description"
            type="textarea"
            :placeholder="t('favorites.dialog.descriptionPlaceholder')"
            :rows="3"
            maxlength="300"
            show-count
          />
        </n-form-item>

        <n-form-item :label="t('favorites.dialog.categoryLabel')" path="category">
          <n-select
            v-model:value="favoriteForm.category"
            :options="categoryOptions"
            :placeholder="t('favorites.dialog.categoryPlaceholder')"
            clearable
          />
        </n-form-item>

        <n-form-item :label="t('favorites.dialog.tagsLabel')" path="tags">
          <n-dynamic-tags
            v-model:value="favoriteForm.tags"
            :max="10"
            :placeholder="t('favorites.dialog.tagsPlaceholder')"
          />
        </n-form-item>

      </n-form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <n-button @click="showFavoriteModal = false">
            {{ t('favorites.dialog.cancel') }}
          </n-button>
          <n-button
            type="primary"
            :loading="loading"
            @click="handleSaveFavorite"
          >
            {{ t('favorites.dialog.save') }}
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject, watch, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NButton,
  NIcon,
  NModal,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDynamicTags,
  type FormInst,
  type FormRules
} from 'naive-ui';
import { useToast } from '../composables/ui/useToast';
import { getI18nErrorMessage } from '../utils/error';
import { Star, Sparkles as Stars } from '@lucide/vue'
import type { FavoriteCategory } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

interface Props {
  /** 提示词内容 */
  content: string;
  /** 原始提示词内容 */
  originalContent?: string;
  /** 按钮大小 */
  size?: 'tiny' | 'small' | 'medium' | 'large';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
});

const emit = defineEmits<{
  'favorited': [id: string];
  'unfavorited': [];
}>();

const services = inject<Ref<AppServices | null> | null>('services', null);

const message = useToast();
const { t } = useI18n();

// 表单相关
const formRef = ref<FormInst | null>(null);
const showFavoriteModal = ref(false);
const loading = ref(false);
const categories = ref<FavoriteCategory[]>([]);

// 收藏状态
const isFavorited = ref(false);
const favoriteId = ref<string | null>(null);

// 表单数据
const favoriteForm = ref({
  title: '',
  description: '',
  category: '',
  tags: [] as string[]
});

// 表单验证规则
const formRules: FormRules = {
  title: [
    {
      required: true,
      message: t('favorites.dialog.validation.titleRequired'),
      trigger: ['input', 'blur']
    }
  ]
};

// 分类选项
const categoryOptions = computed(() => {
  return categories.value.map(cat => ({
    label: cat.name,
    value: cat.id,
    color: cat.color
  }));
});

// 检查是否已收藏
const checkFavoriteStatus = async () => {
  if (!services?.value || !props.content) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized. Skipping favorite status check.');
    return;
  }

  try {
    const favorites = await servicesValue.favoriteManager.getFavorites();
    const existing = favorites.find(f => f.content === props.content);

    if (existing) {
      isFavorited.value = true;
      favoriteId.value = existing.id;
    } else {
      isFavorited.value = false;
      favoriteId.value = null;
    }
  } catch (error) {
    console.error('Failed to check favorite status:', error);
  }
};

// 加载分类列表
const loadCategories = async () => {
  if (!services?.value) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized. Skipping category loading.');
    return;
  }

  try {
    categories.value = await servicesValue.favoriteManager.getCategories();
  } catch (error) {
    console.error('Failed to load categories:', error);
    message.error(getI18nErrorMessage(error, t('favorites.manager.messages.loadCategoryFailed')));
  }
};

// 切换收藏状态
const handleToggleFavorite = () => {
  if (isFavorited.value) {
    handleRemoveFavorite();
  } else {
    showFavoriteModal.value = true;
    initFavoriteForm();
  }
};

// 初始化收藏表单
const initFavoriteForm = () => {
  // 自动生成标题
  let title = props.content.slice(0, 50);
  if (props.content.length > 50) {
    title += '...';
  }

  favoriteForm.value = {
    title,
    description: '',
    category: '',
    tags: []
  };
};

// 保存收藏
const handleSaveFavorite = async () => {
  if (!services?.value) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized. Cannot save favorite.');
    message.warning(t('favorites.dialog.messages.unavailable'));
    return;
  }

  try {
    await formRef.value?.validate();
    loading.value = true;

    const favoriteData = {
      title: favoriteForm.value.title,
      content: props.content,
      description: favoriteForm.value.description,
      category: favoriteForm.value.category,
      tags: favoriteForm.value.tags,
      functionMode: 'basic' as const,  // 默认为基础模式
      optimizationMode: 'system' as const,  // 默认为系统优化模式
      metadata: {
        originalContent: props.originalContent,  // 移到 metadata 中
        hasOriginalContent: !!props.originalContent
      }
    };

    const id = await servicesValue.favoriteManager.addFavorite(favoriteData);

    isFavorited.value = true;
    favoriteId.value = id;
    showFavoriteModal.value = false;

    message.success(t('favorites.dialog.messages.saveSuccess'));
    emit('favorited', id);
  } catch (error) {
    console.error('Failed to save favorite:', error);
    message.error(getI18nErrorMessage(error, t('favorites.dialog.messages.saveFailed')));
  } finally {
    loading.value = false;
  }
};

// 移除收藏
const handleRemoveFavorite = async () => {
  const servicesValue = services?.value;
  if (!servicesValue || !favoriteId.value) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized. Cannot remove favorite.');
    message.warning(t('favorites.dialog.messages.unavailable'));
    return;
  }

  try {
    await servicesValue.favoriteManager.deleteFavorite(favoriteId.value);

    isFavorited.value = false;
    favoriteId.value = null;

    message.success(t('favorites.button.removeSuccess'));
    emit('unfavorited');
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    message.error(getI18nErrorMessage(error, t('favorites.manager.actions.deleteFailed')));
  }
};

// 监听服务初始化完成后再执行相关操作
watch(() => services?.value?.favoriteManager, (favoriteManager) => {
  if (favoriteManager) {
    loadCategories();
    if (props.content) {
      checkFavoriteStatus();
    }
  }
}, { immediate: true });

onMounted(() => {
  loadCategories();
  checkFavoriteStatus();
});

// 监听内容变化，重新检查收藏状态
watch(() => props.content, () => {
  checkFavoriteStatus();
});
</script>

<style scoped>
.favorite-button {
  transition: all 0.2s ease;
}

.favorite-button:hover {
  transform: scale(1.05);
}
</style>
