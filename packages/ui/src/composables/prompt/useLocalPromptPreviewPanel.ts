import { ref, type ComputedRef, type Ref } from 'vue'

import type { ContextMode } from '@prompt-optimizer/core'

import { usePromptPreview } from './usePromptPreview'

export type PromptPreviewRenderPhase = 'optimize' | 'test'

export interface LocalPromptPreviewPanel {
  show: Ref<boolean>
  renderPhase: Ref<PromptPreviewRenderPhase>
  previewContent: ComputedRef<string>
  missingVariables: ComputedRef<string[]>
  hasMissingVariables: ComputedRef<boolean>
  variableStats: ComputedRef<{
    total: number
    builtin: number
    custom: number
    missing: number
    provided: number
  }>
  open: (content: string, opts?: { renderPhase?: PromptPreviewRenderPhase }) => void
}

/**
 * LocalPromptPreviewPanel
 *
 * Sub-mode local wrapper around usePromptPreview + PromptPreviewPanel.
 * Keeps preview logic inside a workspace (no dependency on PromptOptimizerApp state).
 */
export function useLocalPromptPreviewPanel(
  variables: Ref<Record<string, string>>,
  contextMode: Ref<ContextMode>,
): LocalPromptPreviewPanel {
  const show = ref(false)
  const renderPhase = ref<PromptPreviewRenderPhase>('optimize')
  const content = ref('')

  const preview = usePromptPreview(content, variables, contextMode)

  const open = (nextContent: string, opts?: { renderPhase?: PromptPreviewRenderPhase }) => {
    content.value = nextContent || ''
    renderPhase.value = opts?.renderPhase ?? 'optimize'
    show.value = true
  }

  return {
    show,
    renderPhase,
    previewContent: preview.previewContent,
    missingVariables: preview.missingVariables,
    hasMissingVariables: preview.hasMissingVariables,
    variableStats: preview.variableStats,
    open,
  }
}
