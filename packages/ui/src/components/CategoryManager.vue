<template>
  <div class="category-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <n-space>
        <n-button type="primary" @click="handleAddRootCategory">
          <template #icon>
            <n-icon><FolderPlus /></n-icon>
          </template>
          {{ t('favorites.categoryManager.addRootCategory') }}
        </n-button>
        <n-button @click="handleExpandAll">
          <template #icon>
            <n-icon><ArrowsMaximize /></n-icon>
          </template>
          {{ t('favorites.categoryManager.expandAll') }}
        </n-button>
        <n-button @click="handleCollapseAll">
          <template #icon>
            <n-icon><ArrowsMinimize /></n-icon>
          </template>
          {{ t('favorites.categoryManager.collapseAll') }}
        </n-button>
      </n-space>
    </div>

    <!-- 分类树 -->
    <div class="tree-container">
      <n-tree
        ref="treeRef"
        block-line
        :data="treeData"
        :expanded-keys="expandedKeys"
        :selectable="false"
        :render-label="renderLabel"
        :render-prefix="renderPrefix"
        :render-suffix="renderSuffix"
        @update:expanded-keys="handleUpdateExpandedKeys"
      />
    </div>

    <!-- 编辑分类对话框 -->
    <n-modal
      v-model:show="editDialogVisible"
      preset="card"
      :title="editingCategory ? t('favorites.categoryManager.editCategory') : t('favorites.categoryManager.addCategory')"
      :mask-closable="false"
      :style="{ width: 'min(520px, 90vw)' }"
    >
      <n-form
        ref="formRef"
        :model="categoryForm"
        :rules="formRules"
        label-placement="left"
        label-width="80"
      >
        <n-form-item :label="t('favorites.categoryManager.categoryName')" path="name">
          <n-input
            v-model:value="categoryForm.name"
            :placeholder="t('favorites.categoryManager.categoryNamePlaceholder')"
            maxlength="50"
            show-count
          />
        </n-form-item>

        <n-form-item :label="t('favorites.categoryManager.categoryDescription')" path="description">
          <n-input
            v-model:value="categoryForm.description"
            type="textarea"
            :placeholder="t('favorites.categoryManager.categoryDescriptionPlaceholder')"
            :rows="3"
            maxlength="200"
            show-count
          />
        </n-form-item>

        <n-form-item :label="t('favorites.categoryManager.parentCategory')" path="parentId">
          <n-tree-select
            v-model:value="categoryForm.parentId"
            :options="parentCategoryOptions"
            :placeholder="t('favorites.categoryManager.parentCategoryPlaceholder')"
            clearable
            filterable
          />
        </n-form-item>

        <n-form-item :label="t('favorites.categoryManager.categoryColor')" path="color">
          <n-color-picker
            v-model:value="categoryForm.color"
            :modes="['hex']"
            :show-alpha="false"
          />
        </n-form-item>
      </n-form>

      <template #action>
        <n-space justify="end">
          <n-button @click="editDialogVisible = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="saving" @click="handleSaveCategory">
            {{ t('common.save') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 删除确认对话框 -->
    <n-modal
      v-model:show="deleteDialogVisible"
      preset="dialog"
      :title="t('favorites.categoryManager.confirmDelete')"
      :positive-text="t('common.confirm')"
      :negative-text="t('common.cancel')"
      :mask-closable="false"
      @positive-click="handleConfirmDelete"
    >
      <i18n-t tag="p" keypath="favorites.categoryManager.deleteWarning" scope="global">
        <template #name>
          <strong>{{ deletingCategory?.name }}</strong>
        </template>
      </i18n-t>
      <p v-if="deletingCategoryHasChildren" style="color: var(--n-color-error)">
        {{ t('favorites.categoryManager.deleteChildrenWarning', { count: deletingCategoryChildCount }) }}
      </p>
      <p v-if="deletingCategoryUsageCount > 0" style="color: var(--n-color-warning)">
        {{ t('favorites.categoryManager.deleteUsageWarning', { count: deletingCategoryUsageCount }) }}
      </p>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, inject, onMounted, watch, type Ref, type VNodeChild } from 'vue'

import {
  NButton,
  NIcon,
  NSpace,
  NTree,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NTreeSelect,
  NColorPicker,
  NDropdown,
  type TreeOption,
  type FormInst,
  type FormRules
} from 'naive-ui';
import {
  FolderPlus,
  ArrowsMaximize,
  ArrowsMinimize,
  Edit,
  Trash,
  Plus,
  Folder
} from '@vicons/tabler';
import { useToast } from '../composables/ui/useToast';
import { useI18n } from 'vue-i18n';
import { getI18nErrorMessage } from '../utils/error';
import type { FavoriteCategory } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

const services = inject<Ref<AppServices | null> | null>('services', null);
const message = useToast();
const { t } = useI18n();
const emit = defineEmits<{
  'category-updated': [];
}>();

// 状态
const categories = ref<FavoriteCategory[]>([]);
const expandedKeys = ref<string[]>([]);
const treeRef = ref();
const formRef = ref<FormInst | null>(null);

// 编辑对话框
const editDialogVisible = ref(false);
const editingCategory = ref<FavoriteCategory | null>(null);
const categoryForm = ref({
  name: '',
  description: '',
  parentId: undefined as string | undefined,
  color: '#409EFF'
});
const saving = ref(false);

// 删除对话框
const deleteDialogVisible = ref(false);
const deletingCategory = ref<FavoriteCategory | null>(null);
const deletingCategoryUsageCount = ref(0);

// 表单验证规则
const formRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('favorites.categoryManager.validation.nameRequired'), trigger: ['input', 'blur'] },
    { min: 1, max: 50, message: t('favorites.categoryManager.validation.nameLength'), trigger: ['input', 'blur'] }
  ]
}));

// 将扁平分类列表转换为树形结构
const buildCategoryTree = (categories: FavoriteCategory[], parentId?: string): TreeOption[] => {
  return categories
    .filter(cat => cat.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(cat => ({
      key: cat.id,
      label: cat.name,
      category: cat,
      children: buildCategoryTree(categories, cat.id)
    }));
};

// 树形数据
const treeData = computed(() => buildCategoryTree(categories.value));

// 父分类选项（用于编辑时选择父分类）
const parentCategoryOptions = computed(() => {
  const buildOptions = (cats: FavoriteCategory[], parentId?: string, level = 0): TreeOption[] => {
    return cats
      .filter(cat => {
        // 排除当前正在编辑的分类及其子分类
        if (editingCategory.value && cat.id === editingCategory.value.id) {
          return false;
        }
        return cat.parentId === parentId;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(cat => ({
        key: cat.id,
        label: cat.name,
        disabled: false,
        children: buildOptions(cats, cat.id, level + 1)
      }));
  };
  return buildOptions(categories.value);
});

// 计算删除分类的子分类数量
const deletingCategoryHasChildren = computed(() => {
  if (!deletingCategory.value) return false;
  return categories.value.some(cat => cat.parentId === deletingCategory.value!.id);
});

const deletingCategoryChildCount = computed(() => {
  if (!deletingCategory.value) return 0;
  const countChildren = (parentId: string): number => {
    const children = categories.value.filter(cat => cat.parentId === parentId);
    return children.length + children.reduce((sum, child) => sum + countChildren(child.id), 0);
  };
  return countChildren(deletingCategory.value.id);
});

// 渲染树节点标签
const renderLabel = ({ option }: { option: TreeOption }): VNodeChild => {
  const cat = option.category as FavoriteCategory;
  return h('span', { class: 'tree-label' }, cat.name);
};

// 渲染树节点前缀图标
const renderPrefix = ({ option }: { option: TreeOption }): VNodeChild => {
  const cat = option.category as FavoriteCategory;

  return h(
    NIcon,
    { size: 18, color: cat.color || '#409EFF' },
    {
      default: () => h(Folder)
    }
  );
};

// 渲染树节点后缀操作按钮
const renderSuffix = ({ option }: { option: TreeOption }): VNodeChild => {
  const cat = option.category as FavoriteCategory;

  const dropdownOptions = [
    {
      label: t('favorites.categoryManager.addSubCategory'),
      key: 'add',
      icon: () => h(NIcon, null, { default: () => h(Plus) })
    },
    {
      label: t('favorites.categoryManager.edit'),
      key: 'edit',
      icon: () => h(NIcon, null, { default: () => h(Edit) })
    },
    {
      label: t('favorites.categoryManager.delete'),
      key: 'delete',
      icon: () => h(NIcon, null, { default: () => h(Trash) }),
      props: {
        style: { color: 'var(--n-color-error)' }
      }
    }
  ];

  return h(
    'div',
    { class: 'tree-suffix', onClick: (e: Event) => e.stopPropagation() },
    [
      h(
        NDropdown,
        {
          options: dropdownOptions,
          onSelect: (key: string) => handleNodeAction(key, cat)
        },
        {
          default: () => h(
            NButton,
            { text: true, size: 'small' },
            { icon: () => h(NIcon, { size: 16 }, { default: () => h(Edit) }) }
          )
        }
      )
    ]
  );
};

// 处理节点操作
const handleNodeAction = (action: string, category: FavoriteCategory) => {
  switch (action) {
    case 'add':
      handleAddSubCategory(category);
      break;
    case 'edit':
      handleEditCategory(category);
      break;
    case 'delete':
      handleDeleteCategory(category);
      break;
  }
};

// 添加根分类
const handleAddRootCategory = () => {
  editingCategory.value = null;
  categoryForm.value = {
    name: '',
    description: '',
    parentId: undefined,
    color: '#409EFF'
  };
  editDialogVisible.value = true;
};

// 添加子分类
const handleAddSubCategory = (parent: FavoriteCategory) => {
  editingCategory.value = null;
  categoryForm.value = {
    name: '',
    description: '',
    parentId: parent.id,
    color: parent.color || '#409EFF'
  };
  editDialogVisible.value = true;
};

// 编辑分类
const handleEditCategory = (category: FavoriteCategory) => {
  editingCategory.value = category;
  categoryForm.value = {
    name: category.name,
    description: category.description || '',
    parentId: category.parentId,
    color: category.color || '#409EFF'
  };
  editDialogVisible.value = true;
};

// 删除分类
const handleDeleteCategory = async (category: FavoriteCategory) => {
  deletingCategory.value = category;

  // 获取该分类的使用统计
  const servicesValue = services?.value;
  if (servicesValue?.favoriteManager) {
    try {
      deletingCategoryUsageCount.value = await servicesValue.favoriteManager.getCategoryUsage(category.id);
    } catch (error) {
      console.error('Failed to fetch category usage count:', error);
      deletingCategoryUsageCount.value = 0;
    }
  }

  deleteDialogVisible.value = true;
};

// 确认删除
const handleConfirmDelete = async () => {
  if (!deletingCategory.value) return;

  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    message.warning(t('favorites.manager.messages.unavailable'));
    return;
  }

  try {
    // 递归删除所有子分类
    const deleteWithChildren = async (categoryId: string) => {
      const children = categories.value.filter(cat => cat.parentId === categoryId);
      for (const child of children) {
        await deleteWithChildren(child.id);
      }
      await servicesValue.favoriteManager!.deleteCategory(categoryId);
    };

    await deleteWithChildren(deletingCategory.value.id);
    message.success(t('favorites.categoryManager.deleteSuccess'));
    await loadCategories();
    emit('category-updated');
  } catch (error) {
    console.error('Failed to delete category:', error);
    message.error(getI18nErrorMessage(error, t('favorites.categoryManager.deleteFailed')));
  } finally {
    deleteDialogVisible.value = false;
    deletingCategory.value = null;
  }
};

// 保存分类
const handleSaveCategory = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    message.warning(t('favorites.manager.messages.unavailable'));
    return;
  }

  saving.value = true;
  try {
    if (editingCategory.value) {
      // 更新分类
      await servicesValue.favoriteManager.updateCategory(editingCategory.value.id, {
        name: categoryForm.value.name,
        description: categoryForm.value.description,
        parentId: categoryForm.value.parentId,
        color: categoryForm.value.color
      });
      message.success(t('favorites.categoryManager.updateSuccess'));
    } else {
      // 添加分类
      await servicesValue.favoriteManager.addCategory({
        name: categoryForm.value.name,
        description: categoryForm.value.description,
        parentId: categoryForm.value.parentId,
        color: categoryForm.value.color,
        sortOrder: Date.now()
      });
      message.success(t('favorites.categoryManager.addSuccess'));
    }

    editDialogVisible.value = false;
    await loadCategories();
    emit('category-updated');
  } catch (error) {
    console.error('Failed to save category:', error);
    message.error(getI18nErrorMessage(error, t('favorites.categoryManager.saveFailed')));
  } finally {
    saving.value = false;
  }
};

// 全部展开
const handleExpandAll = () => {
  const getAllKeys = (nodes: TreeOption[]): string[] => {
    const keys: string[] = [];
    nodes.forEach(node => {
      keys.push(node.key as string);
      if (node.children) {
        keys.push(...getAllKeys(node.children));
      }
    });
    return keys;
  };
  expandedKeys.value = getAllKeys(treeData.value);
};

// 全部折叠
const handleCollapseAll = () => {
  expandedKeys.value = [];
};

// 更新展开的节点
const handleUpdateExpandedKeys = (keys: string[]) => {
  expandedKeys.value = keys;
};

// 加载分类列表
const loadCategories = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    console.warn('Favorite manager is not initialized.');
    return;
  }

  try {
    categories.value = await servicesValue.favoriteManager.getCategories();
  } catch (error) {
    console.error('Failed to load categories:', error);
    message.error(getI18nErrorMessage(error, t('favorites.categoryManager.loadFailed')));
  }
};

onMounted(() => {
  loadCategories();
});

// 监听服务初始化
watch(() => services?.value?.favoriteManager, (favoriteManager) => {
  if (favoriteManager) {
    loadCategories();
  }
}, { immediate: true });
</script>

<style scoped>
@reference "../styles/index.css";

.category-manager {
  @apply flex flex-col h-full;
}

.toolbar {
  @apply p-4;
  border-bottom: 1px solid var(--n-border-color);
}

.tree-container {
  @apply flex-1 p-4 overflow-y-auto;
}

.tree-label {
  @apply font-medium;
}

.tree-suffix {
  @apply flex items-center gap-2;
}

:deep(.n-tree-node-content) {
  @apply py-1;
}

:deep(.n-tree-node-content:hover) {
  background: var(--n-hover-color);
}
</style>
