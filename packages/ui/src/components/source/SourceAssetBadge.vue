<template>
  <span class="source-asset-badge">
    <ThemedTooltip :label="t('favorites.sourceAsset.tooltip')" placement="left">
      <NButton
        :class="buttonClass"
        :size="buttonSize"
        :quaternary="buttonVariant === 'quaternary'"
        :secondary="buttonVariant === 'secondary'"
        circle
        :aria-label="t('favorites.sourceAsset.tooltip')"
        @click.stop="openDialog"
      >
        <template #icon>
          <NIcon :size="16">
            <GitMerge />
          </NIcon>
        </template>
      </NButton>
    </ThemedTooltip>

    <NModal
      v-model:show="showDialog"
      preset="card"
      :title="t('favorites.sourceAsset.title')"
      :style="{ width: 'min(94vw, 1160px)' }"
      content-style="padding: 0;"
      :mask-closable="true"
    >
      <FavoritePanelShell surface="dialog" mode="detail">
        <NAlert v-if="!favorite" type="warning" :show-icon="false">
          {{ t('favorites.sourceAsset.unavailableDescription') }}
        </NAlert>
        <FavoriteDetailPanel
          v-else
          :favorite="favorite"
          :show-actions="false"
        />
      </FavoritePanelShell>
    </NModal>
  </span>
</template>

<script setup lang="ts">
import { inject, ref, type Ref } from 'vue'
import { NAlert, NButton, NIcon, NModal } from 'naive-ui'
import { GitMerge } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { FavoritePrompt } from '@prompt-optimizer/core'

import type { AppServices } from '../../types/services'
import ThemedTooltip from '../common/ThemedTooltip.vue'
import FavoritePanelShell from '../favorites/FavoritePanelShell.vue'
import FavoriteDetailPanel from '../FavoriteDetailPanel.vue'
import {
  findFavoriteBySourceAssetRef,
  type SourceAssetRef,
} from '../../utils/source-asset'

const props = withDefaults(defineProps<{
  source: SourceAssetRef
  buttonSize?: 'tiny' | 'small'
  buttonVariant?: 'quaternary' | 'secondary'
  buttonClass?: string
}>(), {
  buttonSize: 'tiny',
  buttonVariant: 'quaternary',
  buttonClass: undefined,
})

const { t } = useI18n()
const services = inject<Ref<AppServices | null> | null>('services', null)
const showDialog = ref(false)
const favorite = ref<FavoritePrompt | null>(null)

const openDialog = async () => {
  showDialog.value = true
  const favoriteManager = services?.value?.favoriteManager
  if (!favoriteManager) {
    favorite.value = null
    return
  }
  try {
    const favorites = await favoriteManager.getFavorites()
    favorite.value = findFavoriteBySourceAssetRef(favorites, props.source)
  } catch (error) {
    console.warn('[SourceAssetBadge] Failed to load source favorite:', error)
    favorite.value = null
  }
}
</script>

<style scoped>
.source-asset-badge {
  display: inline-flex;
  align-items: center;
}

.source-asset-badge :deep(.favorite-detail-panel__empty),
.source-asset-badge :deep(.favorite-detail-panel) {
  min-height: 0;
}
</style>
