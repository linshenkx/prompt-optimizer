<template>
  <n-modal
    :show="show"
    preset="card"
    compact-class="tag-manager--compact"
    :title="t('favorites.manager.tagManager.title')"
    :style="{ width: 'min(90vw, 900px)', height: 'min(80vh, 700px)' }"
    :mask-closable="true"
    :auto-focus="isCompact ? false : undefined"
    @update:show="$emit('update:show', $event)"
  >
    <n-space vertical :size="isCompact ? 10 : 16" style="height: 100%;" :class="{ 'tag-manager__body--compact': isCompact }">
      <!-- 搜索栏和统计 -->
      <n-space justify="space-between" align="center" item-class="tag-manager__toolbar-item" :class="{ 'tag-manager__toolbar--compact': isCompact }">
        <n-input
          class="tag-manager__search"
          v-model:value="searchQuery"
          :placeholder="t('favorites.manager.tagManager.searchPlaceholder')"
          clearable
          style="flex: 1; max-width: 300px;"
        >
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
        </n-input>
        <n-space class="tag-manager__summary" align="center" :size="12">
          <n-text depth="3">
            {{ t('favorites.manager.tagManager.totalTags', { count: filteredTags.length }) }}
          </n-text>
          <n-button type="primary" size="small" @click="handleAdd">
            {{ t('favorites.manager.tagManager.add') }}
          </n-button>
        </n-space>
      </n-space>

      <!-- Both presentations use the same loaded rows and CRUD handlers. -->
      <div v-if="isCompact" class="tag-manager__mobile-list" :aria-busy="loading">
        <n-spin :show="loading">
          <n-empty v-if="!loading && !filteredTags.length" :description="t('common.noContent')" />
          <article v-for="tag in mobileTags" :key="tag.name" class="tag-manager__row">
            <button
              type="button"
              class="tag-manager__row-main"
              :aria-label="`${t('favorites.manager.tagManager.rename')}: ${tag.name}`"
              @click="handleRename(tag)"
            >
              <span class="tag-manager__name">{{ tag.name }}</span>
              <n-text depth="3" class="tag-manager__count">
                {{ t('favorites.manager.tagManager.useCount') }} · {{ tag.count }}
              </n-text>
            </button>
            <n-dropdown trigger="click" :options="mobileActions" @select="handleMobileAction($event, tag)">
              <n-button quaternary :aria-label="`${t('favorites.manager.tagManager.actions')}: ${tag.name}`">
                <template #icon><n-icon><DotsVertical /></n-icon></template>
              </n-button>
            </n-dropdown>
          </article>
        </n-spin>
        <n-pagination
          v-if="filteredTags.length > mobilePageSize"
          v-model:page="mobilePage"
          :page-size="mobilePageSize"
          :item-count="filteredTags.length"
          simple
          class="tag-manager__pagination"
        />
      </div>

      <!-- 标签表格 -->
      <n-data-table
        v-show="!isCompact"
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

    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      :title="t('favorites.manager.tagManager.delete')"
      :positive-text="t('favorites.manager.tagManager.renameDialog.confirm')"
      :negative-text="t('favorites.manager.tagManager.renameDialog.cancel')"
      @positive-click="handleMobileDeleteConfirm"
    >
      {{ t('favorites.manager.tagManager.deleteConfirm', { name: pendingDeleteTag?.name, count: pendingDeleteTag?.count }) }}
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
  NSpace,
  NInput,
  NButton,
  NDataTable,
  NTag,
  NIcon,
  NText,
  NPopconfirm,
  NSelect,
  NDropdown,
  NEmpty,
  NSpin,
  NPagination,
  type DataTableColumns
} from 'naive-ui';
import { Search, Edit, Trash, GitMerge, DotsVertical } from '@vicons/tabler';
import { useI18n } from 'vue-i18n';
import { useToast } from '../composables/ui/useToast';
import type { AppServices } from '../types/services';
import { TagTypeConverter, type TagStatistics } from '@prompt-optimizer/core';
import { getI18nErrorMessage } from '../utils/error';
import ThemedTooltip from './common/ThemedTooltip.vue';
import NModal from './common/AdaptiveModal.vue';
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout';

const { t } = useI18n();
const { isCompact } = useWorkspaceLayout();

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
const getLocalizedErrorDetail = (error: unknown) => getI18nErrorMessage(error, t('common.error'));

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
const showDeleteDialog = ref(false);
const pendingDeleteTag = ref<TagStatistics | null>(null);

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

const mobilePageSize = 20;
const requestedMobilePage = ref(1);
const mobilePage = computed({
  get: () => Math.min(requestedMobilePage.value, Math.max(1, Math.ceil(filteredTags.value.length / mobilePageSize))),
  set: (page: number) => { requestedMobilePage.value = page; },
});
const mobileTags = computed(() => filteredTags.value.slice((mobilePage.value - 1) * mobilePageSize, mobilePage.value * mobilePageSize));
watch(searchQuery, () => { requestedMobilePage.value = 1; });
const mobileActions = computed(() => [
  { key: 'rename', label: t('favorites.manager.tagManager.rename') },
  { key: 'merge', label: t('favorites.manager.tagManager.merge') },
  { key: 'delete', label: t('favorites.manager.tagManager.delete') },
]);
const handleMobileAction = (action: string | number, tag: TagStatistics) => {
  if (action === 'rename') handleRename(tag);
  else if (action === 'merge') handleMerge(tag);
  else if (action === 'delete') {
    pendingDeleteTag.value = tag;
    showDeleteDialog.value = true;
  }
};
const handleMobileDeleteConfirm = async () => {
  if (pendingDeleteTag.value) await handleDelete(pendingDeleteTag.value);
  showDeleteDialog.value = false;
};

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
            ThemedTooltip,
            {
              label: t('favorites.manager.tagManager.mergeTooltip')
            },
            {
              default: () => h(
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
              )
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
    message.error(`${t('favorites.manager.tagManager.messages.loadFailed')}: ${getLocalizedErrorDetail(error)}`);
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
    message.error(`${t('favorites.manager.tagManager.messages.addFailed')}: ${getLocalizedErrorDetail(error)}`);
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
    message.error(`${t('favorites.manager.tagManager.messages.renameFailed')}: ${getLocalizedErrorDetail(error)}`);
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
    message.error(`${t('favorites.manager.tagManager.messages.mergeFailed')}: ${getLocalizedErrorDetail(error)}`);
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
    message.error(`${t('favorites.manager.tagManager.messages.deleteFailed')}: ${getLocalizedErrorDetail(error)}`);
  }
};

// 监听对话框显示状态,打开时加载数据
watch(() => props.show, (newShow) => {
  if (newShow) {
    loadTags();
  }
}, { immediate: true });
</script>

<style scoped>
.tag-manager__toolbar--compact {
  gap: 8px !important;
}

.tag-manager__toolbar--compact :deep(.tag-manager__toolbar-item) {
  flex: 1 1 100%;
  width: 100%;
  min-width: 0;
}

.tag-manager__toolbar--compact .tag-manager__search {
  max-width: none !important;
}

.tag-manager__toolbar--compact .tag-manager__summary {
  width: 100%;
  justify-content: space-between !important;
}

.tag-manager__mobile-list {
  min-width: 0;
}

.tag-manager__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--n-border-color);
}

.tag-manager__row-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tag-manager__name {
  overflow-wrap: anywhere;
  font-weight: 500;
}

.tag-manager__count {
  font-size: 12px;
}

.tag-manager__pagination {
  justify-content: center;
  padding: 16px 0 4px;
}
</style>
