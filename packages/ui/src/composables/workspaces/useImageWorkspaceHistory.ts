import type { Ref } from 'vue'
import type { IHistoryManager, PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'

type CommittedResult = { optimizedPrompt: string; reasoning: string; chainId: string; versionId: string }
type ImageRecordType = Extract<PromptRecord['type'], 'text2imageOptimize' | 'image2imageOptimize' | 'multiimageOptimize'>

interface ImageWorkspaceHistoryOptions {
  workspaceName: string
  historyManager: () => Pick<IHistoryManager, 'addIteration' | 'createNewChain'> | undefined
  currentChainId: Ref<string>
  currentVersions: Ref<PromptRecordChain['versions']>
  currentVersionId: Ref<string>
  session: {
    chainId: string
    updateOptimizedResult: (result: CommittedResult) => void
    saveSession: () => Promise<unknown>
  }
  recordType: ImageRecordType
  createRecordId: () => string
  getOptimizedPrompt: () => string
  getLocalEdit: () => {
    originalPrompt: string
    modelKey: string
    iterateTemplateId?: string
    optimizeTemplateId?: string
    metadata: PromptRecord['metadata']
  }
  notifyHistoryRefresh: () => void
  t: (key: string) => string
  toast: {
    success: (message: string) => unknown
    warning: (message: string) => unknown
    error: (message: string) => unknown
  }
}

/** Image history commits only. Requests, streaming and mode-specific metadata stay in the page. */
export function useImageWorkspaceHistory(options: ImageWorkspaceHistoryOptions) {
  const { session, currentChainId, currentVersions, currentVersionId, toast, t } = options

  // A committed history version remains usable even if the session checkpoint fails.
  // Do not rethrow into the streaming error handler, which would restore old text.
  const saveSessionAfterHistoryCommit = async (reason: string) => {
    try {
      await session.saveSession()
    } catch (error) {
      console.error(`[${options.workspaceName}] Failed to persist image session after ${reason}:`, error)
      toast.warning(t('toast.warning.saveHistoryFailed'))
    }
  }

  const applyCommittedChain = async (
    chain: PromptRecordChain,
    result: Pick<CommittedResult, 'optimizedPrompt' | 'reasoning'>,
    reason: string,
  ) => {
    currentVersions.value = chain.versions
    currentVersionId.value = chain.currentRecord.id
    session.updateOptimizedResult({ ...result, chainId: chain.chainId, versionId: chain.currentRecord.id })
    await saveSessionAfterHistoryCommit(reason)
  }

  const handleSaveLocalEdit = async (payload: { note?: string }) => {
    const historyManager = options.historyManager()
    if (!historyManager) {
      toast.error(t('toast.error.historyUnavailable'))
      return
    }

    const optimizedPrompt = options.getOptimizedPrompt()
    if (!optimizedPrompt.trim()) return

    try {
      const edit = options.getLocalEdit()
      const chainId = currentChainId.value || session.chainId || ''
      const currentRecord = currentVersions.value.find(version => version.id === currentVersionId.value)
      const modelKey = currentRecord?.modelKey || edit.modelKey || 'local-edit'
      const templateId = currentRecord?.templateId || edit.iterateTemplateId || edit.optimizeTemplateId || 'local-edit'
      const record = {
        originalPrompt: edit.originalPrompt,
        optimizedPrompt,
        modelKey,
        templateId,
        metadata: edit.metadata,
      }
      const chain = chainId
        ? await historyManager.addIteration({ ...record, chainId, iterationNote: payload.note })
        : await historyManager.createNewChain({
            ...record, id: options.createRecordId(), type: options.recordType, timestamp: Date.now(),
          })

      currentChainId.value = chain.chainId
      await applyCommittedChain(chain, { optimizedPrompt, reasoning: '' }, 'local edit commit')
      options.notifyHistoryRefresh()
      toast.success(t('toast.success.localEditSaved'))
    } catch (error) {
      console.error(`[${options.workspaceName}] Failed to save local edit:`, error)
      toast.warning(t('toast.warning.saveHistoryFailed'))
    }
  }

  return { handleSaveLocalEdit, applyCommittedChain }
}
