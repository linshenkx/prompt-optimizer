<template>
  <n-modal
    :show="show"
    preset="card"
    :title="t('favorites.manager.tagManager.title')"
    :style="{ width: 'min(90vw, 900px)', height: 'min(80vh, 700px)' }"
    :mask-closable="true"
    @update:show="$emit('update:show', $event)"
  >
    <n-space vertical :size="16" style="height: 100%;">
      <!-- 搜索栏和统计 -->
      <n-space justify="space-between" align="center">
        <n-input
          v-model:value="searchQuery"
          :placeholder="t('favorites.manager.tagManager.searchPlaceholder')"
          clearable
          style="flex: 1; max-width: 300px;"
        >
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
        </n-input>
        <n-space align="center" :size="12">
          <n-text depth="3">
            {{ t('favorites.manager.tagManager.totalTags', { count: filteredTags.length }) }}
          </n-text>
          <n-button type="primary" size="small" @click="handleAdd">
            {{ t('favorites.manager.tagManager.add') }}
          </n-button>
        </n-space>
      </n-space>

      <!-- 标签表格 -->
      <n-data-table
        :columns="columns"
        :data="filteredTags"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        :max-height="450"
        striped
      />
    </n-space>

    <!-- 新增标签对话框 -->
    <n-modal
      v-model:show="showAddDialog"
      preset="dialog"
      :title="t('favorites.manager.tagManager.addDialog.title')"
      :positive-text="t('favorites.manager.tagManager.addDialog.confirm')"
      :negative-text="t('favorites.manager.tagManager.addDialog.cancel')"
      @positive-click="handleAddConfirm"
    >
      <n-space vertical :size="12">
        <n-input
          v-model:value="newTagName"
          :placeholder="t('favorites.manager.tagManager.addDialog.tagNamePlaceholder')"
          @keydown.enter="handleAddConfirm"
        />
      </n-space>
    </n-modal>

    <!-- 重命名对话框 -->
    <n-modal
      v-model:show="showRenameDialog"
      preset="dialog"
      :title="t('favorites.manager.tagManager.renameDialog.title')"
      :positive-text="t('favorites.manager.tagManager.renameDialog.confirm')"
      :negative-text="t('favorites.manager.tagManager.renameDialog.cancel')"
      @positive-click="handleRenameConfirm"
    >
      <n-space vertical :size="12">
        <n-text>{{ t('favorites.manager.tagManager.renameDialog.currentName', { name: currentTag?.name }) }}</n-text>
        <n-input
          v-model:value="newTagName"
          :placeholder="t('favorites.manager.tagManager.renameDialog.newNamePlaceholder')"
          @keydown.enter="handleRenameConfirm"
        />
      </n-space>
    </n-modal>

    <!-- 合并对话框 -->
    <n-modal
      v-model:show="showMergeDialog"
      preset="dialog"
      :title="t('favorites.manager.tagManager.mergeDialog.title')"
      :positive-text="t('favorites.manager.tagManager.mergeDialog.confirm')"
      :negative-text="t('favorites.manager.tagManager.mergeDialog.cancel')"
      @positive-click="handleMergeConfirm"
    >
      <n-space vertical :size="12">
        <n-text>{{ t('favorites.manager.tagManager.mergeDialog.sourceTag', { name: currentTag?.name }) }}</n-text>
        <n-select
          v-model:value="mergeTargetTag"
          :options="mergeTargetOptions"
          :placeholder="t('favorites.manager.tagManager.mergeDialog.targetPlaceholder')"
          filterable
        />
      </n-space>
    </n-modal>

    <template #action>
      <n-button @click="$emit('update:show', false)">
        {{ t('favorites.manager.tagManager.close') }}
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, h, type Ref } from 'vue'

import {
  NModal,
  NSpace,
  NInput,
  NButton,
  NDataTable,
  NTag,
  NIcon,
  NText,
  NPopconfirm,
  NSelect,
  NTooltip,
  type DataTableColumns
} from 'naive-ui';
import { Search, Edit, Trash, GitMerge } from '@vicons/tabler';
import { useI18n } from 'vue-i18n';
import { useToast } from '../composables/ui/useToast';
import type { AppServices } from '../types/services';
import { TagTypeConverter, type TagStatistics } from '@prompt-optimizer/core';

const { t } = useI18n();

interface Props {
  show: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  'updated': [];
}>();

const services = inject<Ref<AppServices | null>>('services');
const message = useToast();

const loading = ref(false);
const allTags = ref<TagStatistics[]>([]);
const searchQuery = ref('');

// 新增相关
const showAddDialog = ref(false);

// 重命名相关
const showRenameDialog = ref(false);
const currentTag = ref<TagStatistics | null>(null);
const newTagName = ref('');

// 合并相关
const showMergeDialog = ref(false);
const mergeTargetTag = ref<string>('');

// 分页配置
const pagination = {
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100]
};

// 过滤后的标签
const filteredTags = computed(() => {
  if (!searchQuery.value) {
    return allTags.value;
  }
  const query = searchQuery.value.toLowerCase();
  return allTags.value.filter(tag => tag.name.toLowerCase().includes(query));
});

// 合并目标选项(排除当前标签)
const mergeTargetOptions = computed(() => {
  return allTags.value
    .filter(tag => tag.name !== currentTag.value?.name)
    .map(tag => ({
      label: `${tag.name} (${tag.count})`,
      value: tag.name
    }));
});

// 表格列定义
const columns = computed<DataTableColumns<TagStatistics>>(() => [
  {
    title: t('favorites.manager.tagManager.tagName'),
    key: 'name',
    width: 250,
    ellipsis: {
      tooltip: true
    },
    render: (row) => {
      return h(NTag, { type: 'info' }, { default: () => row.name });
    }
  },
  {
    title: t('favorites.manager.tagManager.useCount'),
    key: 'count',
    width: 150,
    align: 'center' as const,
    sorter: (a, b) => a.count - b.count
  },
  {
    title: t('favorites.manager.tagManager.actions'),
    key: 'actions',
    width: 250,
    align: 'center' as const,
    render: (row) => {
      return h(NSpace, { size: 4, justify: 'center' }, {
        default: () => [
          h(
            NButton,
            {
              size: 'small',
              quaternary: true,
              onClick: () => handleRename(row)
            },
            {
              icon: () => h(NIcon, null, { default: () => h(Edit) }),
              default: () => t('favorites.manager.tagManager.rename')
            }
          ),
          h(
            NTooltip,
            {},
            {
              trigger: () => h(
                NButton,
                {
                  size: 'small',
                  quaternary: true,
                  onClick: () => handleMerge(row)
                },
                {
                  icon: () => h(NIcon, null, { default: () => h(GitMerge) }),
                  default: () => t('favorites.manager.tagManager.merge')
                }
              ),
              default: () => t('favorites.manager.tagManager.mergeTooltip')
            }
          ),
          h(
            NPopconfirm,
            {
              onPositiveClick: () => handleDelete(row),
              positiveText: t('favorites.manager.tagManager.renameDialog.confirm'),
              negativeText: t('favorites.manager.tagManager.renameDialog.cancel')
            },
            {
              trigger: () => h(
                NButton,
                {
                  size: 'small',
                  quaternary: true,
                  type: 'error'
                },
                {
                  icon: () => h(NIcon, null, { default: () => h(Trash) }),
                  default: () => t('favorites.manager.tagManager.delete')
                }
              ),
              default: () => t('favorites.manager.tagManager.deleteConfirm', { name: row.name, count: row.count })
            }
          )
        ]
      });
    }
  }
]);

// 加载标签数据
const loadTags = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    return;
  }

  loading.value = true;
  try {
    const tags = await servicesValue.favoriteManager.getAllTags();
    // 使用统一的类型转换器转换数据格式
    allTags.value = TagTypeConverter.toTagStatistics(tags);
  } catch (error: unknown) {
    message.error(t('favorites.manager.tagManager.messages.loadFailed') + `: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

// 新增标签
const handleAdd = () => {
  newTagName.value = '';
  showAddDialog.value = true;
};

const handleAddConfirm = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    return;
  }

  const trimmedName = newTagName.value.trim();
  if (!trimmedName) {
    message.warning(t('favorites.manager.tagManager.addDialog.emptyWarning'));
    return false;
  }

  // 检查标签是否已存在
  if (allTags.value.some(tag => tag.name === trimmedName)) {
    message.warning(t('favorites.manager.tagManager.addDialog.existWarning'));
    return false;
  }

  try {
    // 调用 addTag API 持久化标签
    await servicesValue.favoriteManager.addTag(trimmedName);

    // 重新加载标签列表
    await loadTags();

    message.success(t('favorites.manager.tagManager.messages.addSuccess'));
    showAddDialog.value = false;
    return true;
  } catch (error: unknown) {
    message.error(t('favorites.manager.tagManager.messages.addFailed') + `: ${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
};

// 重命名标签
const handleRename = (tag: TagStatistics) => {
  currentTag.value = tag;
  newTagName.value = tag.name;
  showRenameDialog.value = true;
};

const handleRenameConfirm = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager || !currentTag.value) {
    return;
  }

  const trimmedName = newTagName.value.trim();
  if (!trimmedName) {
    message.warning(t('favorites.manager.tagManager.renameDialog.emptyWarning'));
    return false;
  }

  if (trimmedName === currentTag.value.name) {
    showRenameDialog.value = false;
    return true;
  }

  try {
    await servicesValue.favoriteManager.renameTag(currentTag.value.name, trimmedName);
    message.success(t('favorites.manager.tagManager.messages.renameSuccess'));
    await loadTags();
    emit('updated');
    showRenameDialog.value = false;
    return true;
  } catch (error: unknown) {
    message.error(t('favorites.manager.tagManager.messages.renameFailed') + `: ${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
};

// 合并标签
const handleMerge = (tag: TagStatistics) => {
  currentTag.value = tag;
  mergeTargetTag.value = '';
  showMergeDialog.value = true;
};

const handleMergeConfirm = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager || !currentTag.value || !mergeTargetTag.value) {
    message.warning(t('favorites.manager.tagManager.mergeDialog.selectTargetWarning'));
    return false;
  }

  try {
    await servicesValue.favoriteManager.mergeTags([currentTag.value.name], mergeTargetTag.value);
    message.success(t('favorites.manager.tagManager.messages.mergeSuccess'));
    await loadTags();
    emit('updated');
    showMergeDialog.value = false;
    return true;
  } catch (error: unknown) {
    message.error(t('favorites.manager.tagManager.messages.mergeFailed') + `: ${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
};

// 删除标签
const handleDelete = async (tag: TagStatistics) => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    return;
  }

  try {
    await servicesValue.favoriteManager.deleteTag(tag.name);
    message.success(t('favorites.manager.tagManager.messages.deleteSuccess'));
    await loadTags();
    emit('updated');
  } catch (error: unknown) {
    message.error(t('favorites.manager.tagManager.messages.deleteFailed') + `: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 监听对话框显示状态,打开时加载数据
watch(() => props.show, (newShow) => {
  if (newShow) {
    loadTags();
  }
}, { immediate: true });
</script>
