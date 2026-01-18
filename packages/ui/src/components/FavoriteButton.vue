<template>
  <n-button
    :type="isFavorited ? 'primary' : 'default'"
    :size="size"
    :disabled="loading"
    @click="handleToggleFavorite"
    :title="isFavorited ? '取消收藏' : '添加到收藏'"
    class="favorite-button"
  >
      <template #icon>
      <n-icon>
        <Stars v-if="isFavorited" />
        <Star v-else />
      </n-icon>
    </template>
    {{ isFavorited ? '已收藏' : '收藏' }}
  </n-button>

  <!-- 收藏对话框 -->
  <n-modal v-model:show="showFavoriteModal">
    <n-card
      style="max-width: 500px"
      title="添加到收藏"
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
        <n-form-item label="标题" path="title">
          <n-input
            v-model:value="favoriteForm.title"
            placeholder="为这个提示词起个名字"
            maxlength="100"
            show-count
          />
        </n-form-item>

        <n-form-item label="描述" path="description">
          <n-input
            v-model:value="favoriteForm.description"
            type="textarea"
            placeholder="描述这个提示词的用途和特点"
            :rows="3"
            maxlength="300"
            show-count
          />
        </n-form-item>

        <n-form-item label="分类" path="category">
          <n-select
            v-model:value="favoriteForm.category"
            :options="categoryOptions"
            placeholder="选择分类"
            clearable
          />
        </n-form-item>

        <n-form-item label="标签" path="tags">
          <n-dynamic-tags
            v-model:value="favoriteForm.tags"
            :max="10"
            placeholder="输入标签后按回车添加"
          />
        </n-form-item>

      </n-form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <n-button @click="showFavoriteModal = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="loading"
            @click="handleSaveFavorite"
          >
            保存
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject, watch, type Ref } from 'vue'

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
import { Star, Stars } from '@vicons/tabler';
import type { FavoriteCategory } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

interface Props {
  /** 提示词内容 */
  content: string;
  /** 原始提示词内容 */
  originalContent?: string;
  /** 按钮大小 */
  size?: 'tiny' | 'small' | 'medium' | 'large';
  /** 是否显示加载状态 */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  loading: false
});

const emit = defineEmits<{
  'favorited': [id: string];
  'unfavorited': [];
}>();

const services = inject<Ref<AppServices | null> | null>('services', null);

const message = useToast();

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
      message: '请输入标题',
      trigger: ['input', 'blur']
    }
  ],
  category: [
    {
      required: false,
      message: '请选择分类',
      trigger: ['change', 'blur']
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
    console.warn('收藏管理器未初始化，跳过收藏状态检查');
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
    console.error('检查收藏状态失败:', error);
  }
};

// 加载分类列表
const loadCategories = async () => {
  if (!services?.value) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('收藏管理器未初始化，跳过分类加载');
    return;
  }

  try {
    categories.value = await servicesValue.favoriteManager.getCategories();
  } catch (error) {
    console.error('加载分类失败:', error);
    message.error('加载分类失败');
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

  // 根据内容智能分类
  let defaultCategory = '';
  if (props.originalContent) {
    // 如果有原始内容，说明是优化后的提示词
    defaultCategory = categories.value.find(c => c.name === '系统提示词')?.id || '';
  }

  favoriteForm.value = {
    title,
    description: '',
    category: defaultCategory,
    tags: []
  };
};

// 保存收藏
const handleSaveFavorite = async () => {
  if (!services?.value) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('收藏管理器未初始化，无法执行收藏操作');
    message.warning('收藏功能暂不可用，请稍后再试');
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

    message.success('添加到收藏成功');
    emit('favorited', id);
  } catch (error) {
    console.error('添加收藏失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    message.error(`添加收藏失败: ${errorMessage}`);
  } finally {
    loading.value = false;
  }
};

// 移除收藏
const handleRemoveFavorite = async () => {
  const servicesValue = services?.value;
  if (!servicesValue || !favoriteId.value) return;
  if (!servicesValue.favoriteManager) {
    console.warn('收藏管理器未初始化，无法执行取消收藏操作');
    message.warning('收藏功能暂不可用，请稍后再试');
    return;
  }

  try {
    await servicesValue.favoriteManager.deleteFavorite(favoriteId.value);

    isFavorited.value = false;
    favoriteId.value = null;

    message.success('取消收藏成功');
    emit('unfavorited');
  } catch (error) {
    console.error('取消收藏失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    message.error(`取消收藏失败: ${errorMessage}`);
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
