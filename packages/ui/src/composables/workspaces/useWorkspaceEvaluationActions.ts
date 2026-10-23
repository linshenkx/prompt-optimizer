import type { EvaluationType } from '@prompt-optimizer/core'
import type { EvaluationDetailTarget } from '../prompt/useEvaluation'
import type { UseEvaluationHandlerReturn } from '../prompt/useEvaluationHandler'

interface WorkspaceEvaluationActionsOptions {
  handler: Pick<UseEvaluationHandlerReturn,
    'handleEvaluate' | 'handleEvaluateWithFeedback' | 'handleReEvaluate' | 'handleEvaluateActiveWithFeedback'>
  getActiveDetail: () => EvaluationDetailTarget | null
  ensureResultReady: (variantId?: string) => boolean
  ensureCompareReady: () => boolean
  onResultEvaluated: (variantId: string) => void
  onCompareEvaluated: () => void
  /** Image evaluation refreshes active-detail fingerprints; text workspaces do not. */
  onActiveEvaluated?: (target: EvaluationDetailTarget) => void
}

/** Routes workspace actions only. Eligibility, evidence and fingerprint policy stay with the caller. */
export function useWorkspaceEvaluationActions(options: WorkspaceEvaluationActionsOptions) {
  const { handler } = options

  const handleEvaluateResult = async (variantId: string) => {
    if (!options.ensureResultReady(variantId)) return
    await handler.handleEvaluate('result', { variantId })
    options.onResultEvaluated(variantId)
  }

  const handleResultEvaluateWithFeedbackEvent = async (
    variantId: string,
    payload: { feedback: string },
  ) => {
    if (!options.ensureResultReady(variantId)) return
    await handler.handleEvaluateWithFeedback('result', payload.feedback, { variantId })
    options.onResultEvaluated(variantId)
  }

  const handleEvaluate = async (type: 'compare' = 'compare') => {
    if (!options.ensureCompareReady()) return
    await handler.handleEvaluate(type)
    options.onCompareEvaluated()
  }

  const handleEvaluateWithFeedback = async (payload: { type: EvaluationType; feedback: string }) => {
    if (payload.type === 'compare' && !options.ensureCompareReady()) return
    await handler.handleEvaluateWithFeedback(payload.type, payload.feedback)
    if (payload.type === 'compare') options.onCompareEvaluated()
  }

  const canEvaluateActive = (active: EvaluationDetailTarget) => {
    if (active.type === 'compare') return options.ensureCompareReady()
    if (active.type === 'result') return options.ensureResultReady(active.variantId)
    return true
  }

  const handleReEvaluateActive = async () => {
    const active = options.getActiveDetail()
    if (!active || !canEvaluateActive(active)) return
    await handler.handleReEvaluate()
    options.onActiveEvaluated?.(active)
  }

  const handleEvaluateActiveWithFeedback = async (payload: { feedback: string }) => {
    const active = options.getActiveDetail()
    if (!active || !canEvaluateActive(active)) return
    await handler.handleEvaluateActiveWithFeedback(payload.feedback)
    options.onActiveEvaluated?.(active)
  }

  return {
    handleEvaluateResult,
    handleResultEvaluateWithFeedbackEvent,
    handleEvaluate,
    handleEvaluateWithFeedback,
    handleReEvaluateActive,
    handleEvaluateActiveWithFeedback,
  }
}
