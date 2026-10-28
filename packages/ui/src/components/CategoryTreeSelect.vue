<template>
  <NTreeSelect
    v-model:value="internalValue"
    :options="treeOptions"
    :placeholder="placeholder || t('favorites.dialog.categoryPlaceholder')"
    :clearable="clearable"
    :consistent-menu-width="consistentMenuWidth"
    :style="computedStyle"
    @update:value="handleValueChange"
  >
    <template v-if="showManageButton" #action>
      <NButton
        text
        block
        @click="handleOpenManager"
        style="justify-content: flex-start; padding: 8px 12px;"
      >
        <template #icon>
          <NIcon :size="16"><Folder /></NIcon>
        </template>
        {{ t('favorites.manager.categoryManager.title') }}
      </NButton>
    </template>
  </NTreeSelect>

  <!-- 分类管理对话框 -->
  <NModal
    v-if="showManageButton"
    v-model:show="managerVisible"
    preset="card"
    :title="t('favorites.manager.categoryManager.title')"
    :mask-closable="true"
    :style="{ width: 'min(800px, 90vw)', height: 'min(600px, 80vh)' }"
  >
    <CategoryManager @category-updated="handleCategoryUpdated" />
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, type Ref } from 'vue'

import { NTreeSelect, NButton, NIcon, NModal, type TreeSelectOption } from 'naive-ui';
import { Folder } from '@lucide/vue'
import { useI18n } from 'vue-i18n';
import CategoryManager from './CategoryManager.vue';
import type { FavoriteCategory } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

const { t } = useI18n();

interface Props {
  /** 当前选中的分类ID */
  modelValue?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否可清除 */
  clearable?: boolean;
  /** 是否显示"全部分类"选项(用于筛选场景) */
  showAllOption?: boolean;
  /** 是否显示管理按钮 */
  showManageButton?: boolean;
  /** 自定义样式 */
  style?: string;
  /** 是否保持菜单宽度一致 */
  consistentMenuWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  clearable: true,
  showAllOption: false,
  showManageButton: true,
  style: 'min-width: 180px; max-width: 250px;',
  consistentMenuWidth: true
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'change': [value: string];
  'category-updated': [];
}>();

const services = inject<Ref<AppServices | null> | null>('services', null);

// 内部状态
const internalValue = ref(props.modelValue);
const categories = ref<FavoriteCategory[]>([]);
const managerVisible = ref(false);

// 计算树状分类选项
const treeOptions = computed<TreeSelectOption[]>(() => {
  const buildTree = (parentId?: string): TreeSelectOption[] => {
    return categories.value
      .filter(cat => cat.parentId === parentId)
      .map(cat => ({
        label: cat.name,
        key: cat.id,
        children: buildTree(cat.id)
      }));
  };

  const tree = buildTree(undefined);

  // 如果是筛选模式,添加"全部分类"选项
  if (props.showAllOption) {
    return [
      { label: t('favorites.manager.allCategories'), key: '' },
      ...tree
    ];
  }

  return tree;
});

// 计算样式
const computedStyle = computed(() => props.style);

// 加载分类数据
const loadCategories = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    console.warn('Favorite manager is not initialized; skipping category loading.');
    return;
  }

  try {
    categories.value = await servicesValue.favoriteManager.getCategories();
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
};

// 处理值变化
const handleValueChange = (value: string) => {
  internalValue.value = value;
  emit('update:modelValue', value);
  emit('change', value);
};

// 打开分类管理器
const handleOpenManager = () => {
  managerVisible.value = true;
};

// 分类更新后刷新数据
const handleCategoryUpdated = async () => {
  await loadCategories();
  emit('category-updated');
};

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  if (newValue !== internalValue.value) {
    internalValue.value = newValue;
  }
});

// 监听服务初始化
watch(() => services?.value?.favoriteManager, (favoriteManager) => {
  if (favoriteManager) {
    loadCategories();
  }
}, { immediate: true });

// 暴露方法
defineExpose({
  reloadCategories: loadCategories
});
</script>
