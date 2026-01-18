<template>
  <ToastUI>
    <NModal
      :show="show"
      preset="card"
      :style="{ width: '90vw', maxWidth: '1200px', maxHeight: '90vh' }"
      :title="t('favorites.manager.title')"
      size="large"
      :bordered="false"
      :segmented="true"
      @update:show="(value) => !value && close()"
    >
      <!-- 工具栏（固定） -->
      <div class="toolbar">
        <NSpace justify="space-between" align="center" :wrap="false">
          <!-- 左侧：搜索和筛选 -->
          <NSpace :size="12" align="center" :wrap="false" style="flex: 1; min-width: 0;">
            <NInput
              v-model:value="searchKeyword"
              :placeholder="t('favorites.manager.searchPlaceholder')"
              clearable
              style="min-width: 200px; max-width: 400px; flex: 1;"
              @update:value="handleSearch"
            >
              <template #prefix>
                <NIcon><Search /></NIcon>
              </template>
            </NInput>

            <CategoryTreeSelect
              v-model="selectedCategory"
              :placeholder="t('favorites.manager.allCategories')"
              show-all-option
              @change="handleFilterChange"
              @category-updated="handleCategoryUpdated"
            />

            <NSelect
              v-model:value="selectedTags"
              :options="tagOptions"
              :placeholder="t('favorites.manager.allTags')"
              multiple
              clearable
              filterable
              max-tag-count="responsive"
              style="min-width: 180px; max-width: 300px;"
              @update:value="handleFilterChange"
            />

            <NText depth="3" style="font-size: 14px; white-space: nowrap;">
              {{ t('favorites.manager.totalCount', { count: filteredFavorites.length }) }}
            </NText>
          </NSpace>

          <!-- 右侧：操作按钮 -->
          <NSpace :size="8" align="center" :wrap="false">
            <NDropdown
              :options="actionMenuOptions"
              @select="handleActionMenuSelect"
            >
              <NButton secondary data-testid="favorites-manager-actions">
                <template #icon>
                  <NIcon><DotsVertical /></NIcon>
                </template>
              </NButton>
            </NDropdown>

            <NButton @click="openImportDialog" secondary>
              <template #icon>
                <NIcon><Upload /></NIcon>
              </template>
              <span class="button-text">{{ t('favorites.manager.import') }}</span>
            </NButton>

            <NButton type="primary" @click="handleCreateFavorite">
              <template #icon>
                <NIcon><Plus /></NIcon>
              </template>
              <span class="button-text">{{ t('favorites.manager.add') }}</span>
            </NButton>
          </NSpace>
        </NSpace>
      </div>

      <!-- 收藏列表（固定区域，无滚动） -->
      <div class="content">
      <template v-if="filteredFavorites.length === 0">
        <n-empty
          :description="searchKeyword ? t('favorites.manager.emptySearchResult') : t('favorites.manager.emptyDescription')"
          size="large"
        >
          <template #extra>
            <n-button @click="$emit('optimize-prompt')">
              {{ t('favorites.manager.startOptimize') }}
            </n-button>
          </template>
        </n-empty>
      </template>

      <template v-else>
        <!-- 固定网格布局：使用 NGrid 确保卡片大小一致 -->
        <NGrid :x-gap="20" :y-gap="20" :cols="gridCols">
          <NGridItem v-for="favorite in paginatedFavorites" :key="favorite.id">
            <FavoriteCard
              :favorite="favorite"
              :category="getCategoryById(favorite.category)"
              :card-height="cardHeight"
              @select="handlePreviewFavorite"
              @copy="handleCopyFavorite"
              @use="handleUseFavorite"
              @delete="handleDeleteFavorite"
              @edit="handleEditFavorite"
              @share="handleShareFavorite"
              @toggle-category="handleToggleCategory"
            />
          </NGridItem>
        </NGrid>
      </template>
      </div>

      <!-- 分页（固定在底部，始终显示） -->
    <NSpace v-if="filteredFavorites.length > 0" justify="center" class="pagination">
      <NPagination
        v-model:page="currentPage"
        :page-size="pageSize"
        :item-count="filteredFavorites.length"
        show-quick-jumper
        :page-slot="7"
      >
        <template #prefix="{ itemCount }">
          <NText depth="3">共 {{ itemCount }} 项</NText>
        </template>
      </NPagination>
    </NSpace>

    <!-- 收藏预览 -->
    <OutputDisplayFullscreen
      v-if="previewFavorite"
      v-model="previewVisible"
      :title="previewDialogTitle"
      :content="previewFavorite.content"
      :original-content="previewOriginalContent"
      :reasoning="previewFavorite.metadata?.reasoning || ''"
      mode="readonly"
      :enabled-actions="['copy', 'diff']"
      @copy="handlePreviewCopy"
    />

    <!-- 收藏导入 -->
    <n-modal
      v-model:show="importState.visible"
      preset="card"
      :title="t('favorites.manager.importDialog.title')"
      :style="{ width: 'min(520px, 90vw)' }"
    >
      <n-form label-placement="top">
        <n-form-item :label="t('favorites.manager.importDialog.selectFile')">
          <n-upload
            :max="1"
            accept=".json,application/json"
            :default-upload="false"
            :file-list="importState.fileList"
            @change="handleImportFileChange"
          >
            <n-upload-dragger>
              <div style="padding: 16px; text-align: center;">
                <n-space vertical :size="8" align="center">
                  <n-icon size="32">
                    <Upload />
                  </n-icon>
                  <n-text depth="3">{{ t('favorites.manager.importDialog.uploadHint') }}</n-text>
                  <n-text depth="3" style="font-size: 12px;">{{ t('favorites.manager.importDialog.supportFormat') }}</n-text>
                </n-space>
              </div>
            </n-upload-dragger>
          </n-upload>
        </n-form-item>
        <n-form-item :label="t('favorites.manager.importDialog.orPasteJson')">
          <n-input
            v-model:value="importState.rawJson"
            type="textarea"
            :placeholder="t('favorites.manager.importDialog.pastePlaceholder')"
            :autosize="{ minRows: 4, maxRows: 10 }"
          />
        </n-form-item>
        <n-form-item :label="t('favorites.manager.importDialog.mergeStrategy')">
          <n-radio-group v-model:value="importState.mergeStrategy">
            <n-radio-button value="skip">{{ t('favorites.manager.importDialog.skipDuplicate') }}</n-radio-button>
            <n-radio-button value="overwrite">{{ t('favorites.manager.importDialog.overwriteDuplicate') }}</n-radio-button>
            <n-radio-button value="merge">{{ t('favorites.manager.importDialog.createCopy') }}</n-radio-button>
          </n-radio-group>
        </n-form-item>
      </n-form>
      <template #action>
        <n-space justify="end">
          <n-button @click="closeImportDialog" :disabled="importState.importing">{{ t('favorites.manager.importDialog.cancel') }}</n-button>
          <n-button type="primary" :loading="importState.importing" @click="handleImportConfirm">
            {{ t('favorites.manager.importDialog.import') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 收藏编辑对话框 -->
    <SaveFavoriteDialog
      :show="editState.visible"
      mode="edit"
      :favorite="editState.favorite"
      @update:show="editState.visible = $event"
      @saved="handleFavoriteSaved"
    />

    <!-- 分类管理 -->
    <n-modal
      :show="categoryManagerVisible"
      preset="card"
      :title="t('favorites.manager.categoryManager.title')"
      :mask-closable="true"
      :style="{ width: 'min(800px, 90vw)', height: 'min(600px, 80vh)' }"
      @update:show="categoryManagerVisible = $event"
    >
      <CategoryManager @category-updated="handleCategoryUpdated" />
    </n-modal>

    <!-- 标签管理 -->
    <TagManager
      :show="tagManagerVisible"
      @update:show="tagManagerVisible = $event"
      @updated="loadFavorites"
    />

    <!-- 新建/编辑收藏对话框 -->
    <SaveFavoriteDialog
      :show="createState.visible"
      mode="create"
      @update:show="createState.visible = $event"
      @saved="handleFavoriteSaved"
    />
  </NModal>
  </ToastUI>
</template>

<script setup lang="ts">
import { h, inject, onBeforeUnmount, onMounted, reactive, ref, watch, computed, type Ref } from 'vue'

import { useDebounceFn } from '@vueuse/core';
import {
  NButton,
  NIcon,
  NSelect,
  NInput,
  NDropdown,
  NSpace,
  NEmpty,
  NPagination,
  NText,
  NModal,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  NUpload,
  NUploadDragger,
  NGrid,
  NGridItem,
  type UploadFileInfo,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useToast } from '../composables/ui/useToast';
import { useFavoriteInitializer } from '../composables/storage/useFavoriteInitializer';
import ToastUI from './Toast.vue';

const { t } = useI18n();
import FavoriteCard from './FavoriteCard.vue';
import OutputDisplayFullscreen from './OutputDisplayFullscreen.vue';
import CategoryManager from './CategoryManager.vue';
import CategoryTreeSelect from './CategoryTreeSelect.vue';
import SaveFavoriteDialog from './SaveFavoriteDialog.vue';
import TagManager from './TagManager.vue';
import {
  Search,
  DotsVertical,
  Upload,
  Download,
  Trash,
  Plus,
  Tags,
  Folder
} from '@vicons/tabler';
import type { FavoritePrompt, FavoriteCategory } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits<{
  'optimize-prompt': [];
  'use-favorite': [favorite: FavoritePrompt];
  'update:show': [value: boolean];
  'close': [];
}>();

const close = () => {
  emit('update:show', false);
  emit('close');
};

const services = inject<Ref<AppServices | null> | null>('services', null);

const message = useToast();

// 初始化默认分类(仅在首次使用时创建)
const { ensureDefaultCategories } = services?.value?.favoriteManager
  ? useFavoriteInitializer(services.value.favoriteManager)
  : { ensureDefaultCategories: async () => {} };

// 响应式数据
const loading = ref(false);
const favorites = ref<FavoritePrompt[]>([]);
const categories = ref<FavoriteCategory[]>([]);
const currentPage = ref(1);
const searchKeyword = ref('');
const selectedCategory = ref<string>('');
const selectedTags = ref<string[]>([]);
const importState = reactive({
  visible: false,
  rawJson: '',
  mergeStrategy: 'skip' as 'skip' | 'overwrite' | 'merge',
  fileList: [] as UploadFileInfo[],
  importing: false
});
const editState = reactive({
  visible: false,
  favorite: undefined as FavoritePrompt | undefined
});
const createState = reactive({
  visible: false
});
const previewFavorite = ref<FavoritePrompt | null>(null);
const categoryManagerVisible = ref(false);
const tagManagerVisible = ref(false);

// 响应式的视口宽度
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);

// 计算属性
const filteredFavorites = computed(() => {
  let result = favorites.value;

  // 分类过滤（支持树状结构，选中父分类包含所有子分类）
  if (selectedCategory.value) {
    const categoryIds = getCategoryWithDescendants(selectedCategory.value);
    result = result.filter(f => !!f.category && categoryIds.includes(f.category));
  }

  // 标签过滤（需要包含所有选中的标签）
  if (selectedTags.value.length > 0) {
    result = result.filter(f =>
      selectedTags.value.every(tag => f.tags.includes(tag))
    );
  }

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(f =>
      f.title.toLowerCase().includes(keyword) ||
      f.content.toLowerCase().includes(keyword) ||
      f.description?.toLowerCase().includes(keyword)
    );
  }

  return result;
});

const paginatedFavorites = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredFavorites.value.slice(start, end);
});



// 获取分类及其所有子分类的ID列表
const getCategoryWithDescendants = (categoryId: string): string[] => {
  if (!categoryId) return [];

  const result: string[] = [categoryId];
  const findChildren = (parentId: string) => {
    const children = categories.value.filter(cat => cat.parentId === parentId);
    children.forEach(child => {
      result.push(child.id);
      findChildren(child.id);
    });
  };

  findChildren(categoryId);
  return result;
};

// 标签选项（从所有收藏中提取唯一标签）
const tagOptions = computed(() => {
  const allTags = new Set<string>();
  favorites.value.forEach(fav => {
    fav.tags.forEach(tag => allTags.add(tag));
  });
  return Array.from(allTags)
    .sort()
    .map(tag => ({
      label: tag,
      value: tag
    }));
});


const previewVisible = computed({
  get: () => previewFavorite.value !== null,
  set: (value: boolean) => {
    if (!value) {
      previewFavorite.value = null;
    }
  }
});

const previewOriginalContent = computed(() => {
  if (!previewFavorite.value) {
    return '';
  }

  const legacyOriginal = (previewFavorite.value as Record<string, unknown>).originalContent;
  if (typeof legacyOriginal === 'string' && legacyOriginal.trim().length > 0) {
    return legacyOriginal;
  }

  return previewFavorite.value.metadata?.originalContent ?? '';
});

// 网格布局配置：根据视口宽度自适应列数
// 移动端 (< 768px): 1 列
// 平板 (768-1023px): 2 列
// 桌面 (>= 1024px): 4 列
const gridCols = computed(() => {
  const width = viewportWidth.value;
  if (width < 768) return 1;
  if (width < 1024) return 2;
  return 4;
});

// 计算每个卡片的高度：根据列数动态计算
const cardHeight = computed(() => {
  const cols = gridCols.value;
  const rows = cols === 1 ? 4 : 2; // 1列显示4行，其他显示2行
  const gap = 20; // y-gap
  const contentPadding = 32; // content 的 padding
  const availableHeight = 540 - contentPadding; // 508px
  const totalGapHeight = gap * (rows - 1);
  const availableForCards = availableHeight - totalGapHeight;
  const height = Math.floor(availableForCards / rows);
  return height;
});

// 每页显示数量：根据列数和行数计算
const pageSize = computed(() => {
  const cols = gridCols.value;
  const rows = cols === 1 ? 4 : 2;
  return cols * rows;
});

const actionMenuOptions = computed(() => [
  {
    label: () =>
      h('span', { 'data-testid': 'favorites-manager-action-manage-tags' }, t('favorites.manager.actions.manageTags')),
    key: 'manageTags',
    icon: () => h(NIcon, null, { default: () => h(Tags) }),
  },
  {
    label: () =>
      h(
        'span',
        { 'data-testid': 'favorites-manager-action-manage-categories' },
        t('favorites.manager.actions.manageCategories'),
      ),
    key: 'manageCategories',
    icon: () => h(NIcon, null, { default: () => h(Folder) }),
  },
  {
    type: 'divider'
  },
  {
    label: () =>
      h('span', { 'data-testid': 'favorites-manager-action-export' }, t('favorites.manager.actions.export')),
    key: 'export',
    icon: () => h(NIcon, null, { default: () => h(Download) }),
  },
  {
    type: 'divider'
  },
  {
    label: () =>
      h('span', { 'data-testid': 'favorites-manager-action-clear' }, t('favorites.manager.actions.clear')),
    key: 'clear',
    icon: () => h(NIcon, null, { default: () => h(Trash) }),
  }
]);

const resetImportState = () => {
  importState.rawJson = '';
  importState.mergeStrategy = 'skip';
  importState.fileList = [];
  importState.importing = false;
};

const openImportDialog = () => {
  importState.visible = true;
};

const closeImportDialog = () => {
  importState.visible = false;
};

type UploadChangeParam = {
  file: UploadFileInfo | null
  fileList: UploadFileInfo[]
  event?: Event
}

const handleImportFileChange = (options: UploadChangeParam) => {
  importState.fileList = options.fileList.slice(0, 1);
};

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(t('favorites.manager.importDialog.readFileFailed')));
    reader.readAsText(file);
  });

const tryCopyToClipboard = async (text: string, successMessage: string) => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    message.success(successMessage);
    return true;
  } catch (error) {
    console.error('复制失败:', error);
    message.error(t('favorites.manager.actions.copyFailed'));
    return false;
  }
};


const handleCategoryUpdated = async () => {
  await loadCategories();
};

const handleCreateFavorite = () => {
  createState.visible = true;
};

// 收藏保存成功后的回调
const handleFavoriteSaved = async () => {
  await loadFavorites();
  createState.visible = false;
};


const handlePreviewFavorite = (favorite: FavoritePrompt) => {
  previewFavorite.value = favorite;
};

const handlePreviewCopy = (_content: string, type: 'content' | 'reasoning' | 'all') => {
  if (!previewFavorite.value) return;
  const successMessages = {
    content: t('favorites.manager.actions.copiedOptimized'),
    reasoning: t('favorites.manager.actions.copiedReasoning'),
    all: t('favorites.manager.actions.copiedAll')
  } as const;
  const messageKey = successMessages[type];
  if (messageKey) {
    message.success(messageKey);
  }
};

const handleImportConfirm = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    message.warning(t('favorites.manager.messages.unavailable'));
    return;
  }

  let payload = importState.rawJson.trim();
  if (!payload && importState.fileList.length > 0) {
    const file = importState.fileList[0].file;
    if (file) {
      try {
        payload = await readFileAsText(file);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        message.error(`${t('favorites.manager.importDialog.readFileFailed')}: ${errorMessage}`);
        return;
      }
    }
  }

  if (!payload) {
    message.warning(t('favorites.manager.importDialog.selectFileOrPaste'));
    return;
  }

  importState.importing = true;
  try {
    const result = await servicesValue.favoriteManager.importFavorites(payload, {
      mergeStrategy: importState.mergeStrategy
    });
    message.success(t('favorites.manager.importDialog.importSuccess', { imported: result.imported, skipped: result.skipped }));
    if (result.errors.length > 0) {
      message.warning(`${t('favorites.manager.importDialog.importPartialFailed')}：\n${result.errors.join('\n')}`);
    }
    await loadFavorites();
    closeImportDialog();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    message.error(`${t('favorites.manager.importDialog.importFailed')}: ${errorMessage}`);
  } finally {
    importState.importing = false;
  }
};

const handleEditFavorite = (favorite: FavoritePrompt) => {
  editState.favorite = favorite;
  editState.visible = true;
};

const handleShareFavorite = () => {
  message.info(t('favorites.manager.actions.shareComingSoon'));
};

const handleToggleCategory = () => {
  message.info(t('favorites.manager.actions.categoryManagementComingSoon'));
};

const bumpUseCountLocally = (id: string) => {
  const index = favorites.value.findIndex(f => f.id === id);
  if (index !== -1) {
    const updated = {
      ...favorites.value[index],
      useCount: favorites.value[index].useCount + 1,
      updatedAt: Date.now()
    };
    favorites.value.splice(index, 1, updated);
    if (previewFavorite.value?.id === id) {
      previewFavorite.value = { ...updated };
    }
  }
};

// 方法
const loadFavorites = async () => {
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn(t('favorites.manager.messages.managerNotInitialized'));
    return;
  }

  try {
    loading.value = true;
    const data = await servicesValue.favoriteManager.getFavorites();
    favorites.value = data;
    if (previewFavorite.value) {
      const updated = data.find(item => item.id === previewFavorite.value?.id);
      previewFavorite.value = updated ? { ...updated } : null;
    }
  } catch (error) {
    console.error('加载收藏失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    message.error(`${t('favorites.manager.messages.loadFailed')}: ${errorMessage}`);
  } finally {
    loading.value = false;
  }
};

const loadCategories = async () => {
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn(t('favorites.manager.messages.managerNotInitialized'));
    return;
  }

  try {
    categories.value = await servicesValue.favoriteManager.getCategories();
  } catch (error) {
    console.error('加载分类失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    message.error(`${t('favorites.manager.messages.loadCategoryFailed')}: ${errorMessage}`);
  }
};

const getCategoryById = (id?: string): FavoriteCategory | undefined => {
  if (!id) return undefined;
  return categories.value.find(c => c.id === id);
};

const handleFilterChange = () => {
  currentPage.value = 1;
};

const handleSearch = () => {
  currentPage.value = 1;
};

const handleCopyFavorite = async (favorite: FavoritePrompt) => {
  const copied = await tryCopyToClipboard(favorite.content, t('favorites.manager.actions.copySuccess'));
  if (!copied) return;

  const servicesValue = services?.value;
  if (servicesValue?.favoriteManager) {
    await servicesValue.favoriteManager.incrementUseCount(favorite.id);
  }
  bumpUseCountLocally(favorite.id);
};

const handleDeleteFavorite = (favorite: FavoritePrompt) => {
  const confirmed = typeof window === 'undefined'
    ? true
    : window.confirm(t('favorites.manager.actions.deleteConfirm', { title: favorite.title }));

  if (!confirmed) return;

  (async () => {
    try {
      const servicesValue = services?.value;
      if (servicesValue?.favoriteManager) {
        await servicesValue.favoriteManager.deleteFavorite(favorite.id);
        message.success(t('favorites.manager.actions.deleteSuccess'));
        await loadFavorites();
      } else {
        message.warning(t('favorites.manager.messages.unavailable'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`${t('favorites.manager.actions.deleteFailed')}: ${errorMessage}`);
    }
  })();
  if (previewFavorite.value?.id === favorite.id) {
    previewFavorite.value = null;
  }
};

const handleUseFavorite = (favorite: FavoritePrompt) => {
  emit('use-favorite', favorite);

  // 增加使用次数
  const servicesValue = services?.value;
  if (servicesValue?.favoriteManager) {
    servicesValue.favoriteManager.incrementUseCount(favorite.id).catch(console.error);
  }
  bumpUseCountLocally(favorite.id);
  if (previewFavorite.value?.id === favorite.id) {
    previewFavorite.value = null;
  }
};

const handleActionMenuSelect = (key: string) => {
  switch (key) {
    case 'manageTags':
      tagManagerVisible.value = true;
      break;
    case 'manageCategories':
      categoryManagerVisible.value = true;
      break;
    case 'export':
      handleExportFavorites();
      break;
    case 'clear': {
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(t('favorites.manager.actions.clearConfirm'));

      if (!confirmed) {
        break;
      }

      (async () => {
        try {
          const servicesValue = services?.value;
          if (servicesValue?.favoriteManager) {
            const allIds = favorites.value.map(f => f.id);
            await servicesValue.favoriteManager.deleteFavorites(allIds);
            message.success(t('favorites.manager.actions.clearSuccess'));
            await loadFavorites();
          } else {
            message.warning(t('favorites.manager.messages.unavailable'));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          message.error(`${t('favorites.manager.actions.clearFailed')}: ${errorMessage}`);
        }
      })();
      break;
    }
  }
};

const handleExportFavorites = async () => {
  try {
    const servicesValue = services?.value;
    if (servicesValue?.favoriteManager) {
      const exportData = await servicesValue.favoriteManager.exportFavorites();
      if (exportData) {
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `favorites_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        message.success(t('favorites.manager.actions.exportSuccess'));
      }
    } else {
      message.warning(t('favorites.manager.messages.unavailable'));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    message.error(`${t('favorites.manager.actions.exportFailed')}: ${errorMessage}`);
  }
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? t('favorites.manager.time.justNow') : t('favorites.manager.time.minutesAgo', { minutes });
    }
    return t('favorites.manager.time.hoursAgo', { hours });
  } else if (days === 1) {
    return t('favorites.manager.time.yesterday');
  } else if (days < 7) {
    return t('favorites.manager.time.daysAgo', { days });
  } else {
    return date.toLocaleDateString();
  }
};

const previewDialogTitle = computed(() => {
  if (!previewFavorite.value) {
    return t('favorites.manager.preview.title');
  }

  const title = previewFavorite.value.title?.trim();
  const categoryName = previewFavorite.value.category
    ? getCategoryById(previewFavorite.value.category)?.name?.trim()
    : '';
  const updatedLabel = t('favorites.manager.preview.updatedAt', { time: formatDate(previewFavorite.value.updatedAt) });

  const parts = [
    title && title.length > 0 ? title : t('favorites.manager.preview.title'),
    categoryName && categoryName.length > 0 ? categoryName : null,
    updatedLabel
  ].filter(Boolean) as string[];

  return parts.join(' · ');
});

// 监听服务初始化完成后再加载数据
watch(() => services?.value?.favoriteManager, (favoriteManager) => {
  if (favoriteManager) {
    loadFavorites();
    loadCategories();
  }
}, { immediate: true });

// 🆕 监听收藏夹对话框打开事件，自动刷新数据
watch(() => props.show, (newShow) => {
  if (newShow && services?.value?.favoriteManager) {
    loadFavorites();
    loadCategories();
  }
}, { immediate: false });

watch(() => importState.visible, (visible) => {
  if (!visible) {
    resetImportState();
  }
});

watch(() => editState.visible, (visible) => {
  if (!visible) {
    editState.favorite = undefined;
  }
});

// 窗口大小变化处理
const handleResize = () => {
  if (typeof window !== 'undefined') {
    viewportWidth.value = window.innerWidth;
  }
};
const debouncedResize = useDebounceFn(handleResize, 150);

// 生命周期
onMounted(async () => {
  if (services?.value?.favoriteManager) {
    // 确保默认分类存在(仅在首次使用时创建)
    await ensureDefaultCategories();
    loadFavorites();
    loadCategories();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', debouncedResize);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', debouncedResize);
  }
});

defineExpose({
  reloadCategories: loadCategories
});
</script>

<style scoped>
/* 固定工具栏 */
.toolbar {
  @apply p-4 border-b border-gray-200 dark:border-gray-700;
  background: var(--n-color);
}

.button-text {
  @apply ml-1;
}

/* 小屏幕优化：隐藏按钮文字 */
@media (max-width: 768px) {
  .button-text {
    @apply hidden;
  }
}

/* 固定内容区域 */
.content {
  @apply p-4;
  /* 固定内容区域高度，正好容纳网格 */
  height: 540px; /* 500px 网格 + 40px padding */
  overflow: hidden;
}

/* 分页固定在底部 */
.pagination {
  @apply p-4 border-t border-gray-200 dark:border-gray-700;
  background: var(--n-color);
  flex-shrink: 0;
}
</style>
