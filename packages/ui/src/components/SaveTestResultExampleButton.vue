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
import {
  promptExampleFromTestRun,
  type PromptSession,
  type PromptTestRun,
} from '@prompt-optimizer/core'

import { useToast } from '../composables/ui/useToast'
import ThemedTooltip from './common/ThemedTooltip.vue'
import { useSessionManager, type SubModeKey } from '../stores/session/useSessionManager'
import type { SaveFavoritePayload } from '../types/workspace'
import {
  favoriteReproducibilityExampleFromPromptExample,
  type FavoriteReproducibilityDraft,
  type FavoriteReproducibilityVariable,
} from '../utils/favorite-reproducibility'
import { isValidVariableName } from '../types/variable'
import { resolveSourceAssetRef } from '../utils/source-asset'

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

const findTestRun = (session: PromptSession): PromptTestRun | null => {
  for (const runSet of session.testRuns) {
    const found = runSet.runs.find((run) =>
      run.metadata?.legacyVariantId === props.variantId ||
      run.id.endsWith(`:test:${props.variantId}`),
    )
    if (found) return found
  }
  return null
}

const resolveExampleBasedOnVersionId = (
  session: PromptSession,
  run: PromptTestRun,
): string => {
  if (run.revision.kind === 'record') {
    return run.revision.recordId
  }

  if (run.revision.kind === 'root') {
    return session.optimization.root.id
  }

  if (run.revision.kind === 'asset-version') {
    return run.revision.versionId
  }

  return `${session.id}:draft`
}

const buildVariableDraft = (parameters: Record<string, string> | undefined): FavoriteReproducibilityVariable[] => {
  if (!parameters) return []

  return Object.keys(parameters)
    .filter((name) => isValidVariableName(name))
    .map((name) => ({
      name,
      required: false,
      options: [],
      source: 'test-run',
    }))
}

const openSaveFavoriteDialog = (
  session: PromptSession,
  reproducibilityDraft: FavoriteReproducibilityDraft,
) => {
  if (!appHandleSaveFavorite) {
    toast.error(t('toast.error.favoriteNotInitialized'))
    return
  }

  appHandleSaveFavorite({
    content: props.content,
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
    const run = findTestRun(session)
    if (!run) {
      toast.warning(t('favorites.dialog.reproducibility.noTestResultToSave'))
      return
    }

    const example = promptExampleFromTestRun(run, {
      basedOnVersionId: resolveExampleBasedOnVersionId(session, run),
    })
    const favoriteExample = example
      ? favoriteReproducibilityExampleFromPromptExample(example)
      : null

    if (!favoriteExample) {
      toast.warning(t('favorites.dialog.reproducibility.noTestResultToSave'))
      return
    }

    const reproducibilityDraft = {
      variables: buildVariableDraft(favoriteExample.parameters),
      examples: [favoriteExample],
    }

    openSaveFavoriteDialog(session, reproducibilityDraft)
  } finally {
    isSavingExample.value = false
  }
}
</script>
