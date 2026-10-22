<template>
  <NModal
    :show="show"
    preset="card"
    :title="dialogTitle"
    :style="{ width: 'min(94vw, 1160px)' }"
    :mask-closable="true"
    content-style="padding: 0;"
    @update:show="handleShowUpdate"
  >
    <FavoritePanelShell surface="dialog" :mode="panelMode">
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
        v-else-if="mode === 'edit'"
        embedded
        mode="edit"
        :favorite="favorite || undefined"
        @cancel="close"
        @saved="handleSaved"
      />

      <FavoriteEditorForm
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
import { computed } from 'vue'
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

const close = () => {
  emit('update:show', false)
}

const handleShowUpdate = (value: boolean) => {
  emit('update:show', value)
}

const handleSaved = (favoriteId: string) => {
  emit('saved', favoriteId)
}

const handleImported = () => {
  emit('imported')
}
</script>
