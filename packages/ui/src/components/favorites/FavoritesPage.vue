<template>
  <section class="favorites-page" data-testid="favorites-page">
    <h1 v-if="!isCompact" class="favorites-page-heading">{{ t('favorites.page.title') }}</h1>

    <FavoriteLibraryWorkspace
      layout="page"
      :active="true"
      :initial-mode-filter="initialModeFilter"
      :use-favorite="handleUseFavorite"
    >
      <template v-if="!isCompact" #toolbar-leading>
        <NButton
          secondary
          class="favorites-page-return"
          :title="t('favorites.page.closeTitle')"
          data-testid="favorites-page-return"
          @click="handleReturnToWorkspace"
        >
          <template #icon>
            <NIcon><ArrowBackUp /></NIcon>
          </template>
          {{ t('favorites.page.returnToWorkspace') }}
        </NButton>
      </template>
    </FavoriteLibraryWorkspace>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon } from 'naive-ui'
import { ArrowBackUp } from '@vicons/tabler'
import type { FavoritePrompt } from '@prompt-optimizer/core'

import FavoriteLibraryWorkspace from '../FavoriteLibraryWorkspace.vue'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'
import { router as routerInstance } from '../../router'
import {
  DEFAULT_WORKSPACE_PATH,
  normalizeWorkspacePath,
  parseWorkspaceRoutePath,
} from '../../router/workspaceRoutes'
import { favoritesPageActionsKey } from './favorites-page-context'

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const actions = inject(favoritesPageActionsKey, null)

type FavoriteInitialModeFilter =
  | 'all'
  | 'basic-system'
  | 'basic-user'
  | 'context-system'
  | 'context-user'
  | 'image-text2image'
  | 'image-image2image'
  | 'image-multiimage'

const resolveInitialModeFilter = (workspacePath: string | null): FavoriteInitialModeFilter => {
  if (!workspacePath) return 'all'

  const workspace = parseWorkspaceRoutePath(workspacePath)
  if (!workspace) return 'all'

  if (workspace.mode === 'pro') {
    return workspace.subMode === 'multi' ? 'context-system' : 'context-user'
  }

  if (workspace.mode === 'basic') {
    return workspace.subMode === 'user' ? 'basic-user' : 'basic-system'
  }

  if (workspace.subMode === 'image2image') return 'image-image2image'
  if (workspace.subMode === 'multiimage') return 'image-multiimage'
  return 'image-text2image'
}

const initialModeFilter = computed(() =>
  resolveInitialModeFilter(normalizeWorkspacePath(routerInstance.currentRoute.value.query.from)),
)

const nestedEscapeTargetSelector = [
  '.n-modal',
  '.n-popover',
  '.n-dropdown-menu',
  '.n-base-select-menu',
  '.n-select-menu',
  '.n-dialog',
  '.n-drawer',
  '.n-drawer-container',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
].join(', ')

const hasActiveNestedEscapeSurface = () => {
  if (typeof document === 'undefined') return false

  return document.querySelector([
    '.n-modal',
    '.n-popover',
    '.n-dropdown-menu',
    '.n-base-select-menu',
    '.n-select-menu',
    '.n-dialog',
    '.n-drawer',
    '.n-drawer-container',
  ].join(', ')) !== null
}

const shouldKeepEscapeInsidePage = (event: KeyboardEvent) => {
  const target = event.target
  if (typeof Element !== 'undefined' && target instanceof Element && target.closest(nestedEscapeTargetSelector)) {
    return true
  }

  return hasActiveNestedEscapeSurface()
}

const handleReturnToWorkspace = () => {
  if (actions) {
    actions.returnToWorkspace()
    return
  }

  void routerInstance.push(DEFAULT_WORKSPACE_PATH)
}

const handleUseFavorite = async (
  favorite: FavoritePrompt,
  options?: { applyExample?: boolean; exampleId?: string; exampleIndex?: number },
): Promise<boolean> => {
  if (actions) {
    return await actions.useFavorite(favorite, options)
  }

  return false
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.key !== 'Escape') return
  if (shouldKeepEscapeInsidePage(event)) return

  handleReturnToWorkspace()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<style scoped>
.favorites-page {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.favorites-page-heading {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.favorites-page-return {
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .favorites-page {
    overflow: visible;
  }

  .favorites-page-return {
    width: 100%;
  }
}
</style>
