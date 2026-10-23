<template>
  <NModal
    :show="show"
    preset="card"
    compact-class="favorite-asset-panel--compact"
    :title="dialogTitle"
    :style="{ width: 'min(94vw, 1160px)' }"
    :mask-closable="true"
    content-style="padding: 0;"
    @update:show="handleShowUpdate"
  >
    <FavoritePanelShell surface="dialog" :mode="panelMode" class="favorite-asset-panel__shell">
      <FavoriteDetailPanel
        v-if="mode === 'detail'"
        :favorite="favorite"
        :category="category"
        @copy="$emit('copy', $event)"
        @use="(target, options) => $emit('use', target, options)"
        @share="$emit('share', $event)"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @favorite-updated="$emit('favorite-updated', $event)"
      />

      <FavoriteEditorForm
        ref="editor"
        v-else-if="mode === 'edit'"
        embedded
        mode="edit"
        :favorite="favorite || undefined"
        @cancel="close"
        @saved="handleSaved"
      />

      <FavoriteEditorForm
        ref="editor"
        v-else-if="mode === 'create'"
        embedded
        mode="create"
        @cancel="close"
        @saved="handleSaved"
      />

      <FavoriteImportPanel
        v-else
        @cancel="close"
        @imported="handleImported"
      />
    </FavoritePanelShell>
  </NModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'
import NModal from '../common/AdaptiveModal.vue'
import { useI18n } from 'vue-i18n'
import type { FavoriteCategory, FavoritePrompt } from '@prompt-optimizer/core'

import FavoriteDetailPanel from '../FavoriteDetailPanel.vue'
import FavoriteEditorForm from '../FavoriteEditorForm.vue'
import FavoriteImportPanel from '../FavoriteImportPanel.vue'
import FavoritePanelShell from './FavoritePanelShell.vue'

type AssetPanelMode = 'detail' | 'edit' | 'create' | 'import'

const props = withDefaults(defineProps<{
  show: boolean
  mode: AssetPanelMode
  favorite?: FavoritePrompt | null
  category?: FavoriteCategory
}>(), {
  favorite: null,
  category: undefined,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  'copy': [favorite: FavoritePrompt]
  'use': [favorite: FavoritePrompt, options?: { applyExample?: boolean; exampleId?: string; exampleIndex?: number }]
  'share': [favorite: FavoritePrompt]
  'edit': [favorite: FavoritePrompt]
  'delete': [favorite: FavoritePrompt]
  'favorite-updated': [favoriteId: string]
  'saved': [favoriteId: string]
  'imported': []
}>()

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const confirmDialog = useConfirmDialog()
const editor = ref<InstanceType<typeof FavoriteEditorForm> | null>(null)
let confirmingClose = false

const panelMode = computed(() => {
  if (props.mode === 'edit') return 'edit'
  if (props.mode === 'create' || props.mode === 'import') return 'create'
  return 'detail'
})

const dialogTitle = computed(() => {
  if (props.mode === 'edit') return t('favorites.dialog.editTitle')
  if (props.mode === 'create') return t('favorites.dialog.createTitle')
  if (props.mode === 'import') return t('favorites.manager.importDialog.title')
  return t('favorites.manager.preview.title')
})

const close = async () => {
  if (isCompact.value && editor.value) {
    if (editor.value.saving || confirmingClose) return
    if (editor.value.hasUnsavedChanges) {
      confirmingClose = true
      try {
        const discard = await confirmDialog.warning({
          title: t('common.confirm'), content: t('workspace.unsavedForm'),
          positiveText: t('common.confirm'), negativeText: t('common.cancel'),
        })
        if (!discard) return
      } finally {
        confirmingClose = false
      }
    }
  }
  emit('update:show', false)
}

const handleShowUpdate = (value: boolean) => {
  if (value) emit('update:show', true)
  else void close()
}

const handleSaved = (favoriteId: string) => {
  emit('saved', favoriteId)
}

const handleImported = () => {
  emit('imported')
}
</script>

<style scoped>
:global(.workspace-compact .favorite-asset-panel--compact.adaptive-modal-page > .n-card-content) {
  padding: 0 !important;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@media (max-width: 1023px) {
  .favorite-asset-panel__shell {
    height: 100%;
    min-height: 0;
    flex: 1;
  }
  .favorite-asset-panel__shell :deep(.favorite-panel-shell__body) {
    padding: 10px;
  }
  .favorite-asset-panel__shell.favorite-panel-shell--edit :deep(.favorite-panel-shell__body),
  .favorite-asset-panel__shell.favorite-panel-shell--create :deep(.favorite-panel-shell__body) {
    padding: 0;
  }
}

:global(.workspace-compact .favorite-asset-panel--compact.adaptive-modal-page > .n-card-header) {
  padding: 8px 12px;
}
:global(.workspace-compact .favorite-asset-panel--compact.adaptive-modal-page > .n-card-header > .n-base-close) {
  width: 36px;
  height: 36px;
}
</style>
