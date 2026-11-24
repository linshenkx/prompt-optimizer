<template>
  <ThemedTooltip :label="t('favorites.dialog.reproducibility.saveTestResultExample')">
    <NButton
      size="small"
      quaternary
      circle
      :disabled="disabled"
      :data-testid="testId"
      @click="handleSaveExample"
    >
      <template #icon>
        <NIcon :size="16">
          <Star />
        </NIcon>
      </template>
    </NButton>
  </ThemedTooltip>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { Star } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { PromptSession } from '@prompt-optimizer/core'

import { useToast } from '../composables/ui/useToast'
import ThemedTooltip from './common/ThemedTooltip.vue'
import { useSessionManager, type SubModeKey } from '../stores/session/useSessionManager'
import type { SaveFavoritePayload } from '../types/workspace'
import type { FavoriteReproducibilityDraft } from '../utils/favorite-reproducibility'
import { resolveSourceAssetRef } from '../utils/source-asset'
import {
  buildTestResultExampleDraft,
  buildTestResultExampleEntries,
} from '../utils/test-result-example-draft'

const props = withDefaults(defineProps<{
  subModeKey: SubModeKey
  variantId: string
  content: string
  originalContent?: string
  functionMode: 'basic' | 'context' | 'image'
  optimizationMode?: 'system' | 'user'
  imageSubMode?: 'text2image' | 'image2image' | 'multiimage'
  disabled?: boolean
  testId?: string
}>(), {
  originalContent: undefined,
  optimizationMode: undefined,
  imageSubMode: undefined,
  disabled: false,
  testId: undefined,
})

const { t } = useI18n()
const toast = useToast()
const sessionManager = useSessionManager()
const appHandleSaveFavorite = inject<((data: SaveFavoritePayload) => void) | null>('handleSaveFavorite', null)
const isSavingExample = ref(false)

const disabled = computed(() => props.disabled || isSavingExample.value || !props.content.trim())

const openSaveFavoriteDialog = (
  session: PromptSession,
  content: string,
  reproducibilityDraft: FavoriteReproducibilityDraft,
) => {
  if (!appHandleSaveFavorite) {
    toast.error(t('toast.error.favoriteNotInitialized'))
    return
  }

  appHandleSaveFavorite({
    content,
    originalContent: props.originalContent,
    candidateSource: resolveSourceAssetRef(session.origin, session.assetBinding),
    prefill: {
      functionMode: props.functionMode,
      optimizationMode: props.optimizationMode,
      imageSubMode: props.imageSubMode,
      reproducibilityDraft,
      updateIntent: 'examples',
    },
  })
}

const handleSaveExample = async () => {
  if (disabled.value) return

  isSavingExample.value = true
  try {
    const session = await sessionManager.getHydratedPromptSession(props.subModeKey)
    const entries = buildTestResultExampleEntries(session, [props.variantId])
    if (entries.length === 0) {
      toast.warning(t('favorites.dialog.reproducibility.noTestResultToSave'))
      return
    }

    const reproducibilityDraft = buildTestResultExampleDraft(entries)

    openSaveFavoriteDialog(session, entries[0]?.promptText ?? props.content, reproducibilityDraft)
  } finally {
    isSavingExample.value = false
  }
}
</script>
