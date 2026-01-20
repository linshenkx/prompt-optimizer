import type { EvaluationResponse, EvaluationType } from '@prompt-optimizer/core'

/**
 * Persisted evaluation results for a single workspace/submode.
 *
 * Note:
 * - We persist only stable data (results) for restart restore.
 * - We do NOT persist transient UI state (panel open, streaming, isEvaluating).
 */
export type PersistedEvaluationResults = Record<
  EvaluationType,
  EvaluationResponse | null
>

export const createDefaultEvaluationResults = (): PersistedEvaluationResults => ({
  original: null,
  optimized: null,
  compare: null,
  'prompt-only': null,
  'prompt-iterate': null,
})

export const EVALUATION_TYPES: EvaluationType[] = [
  'original',
  'optimized',
  'compare',
  'prompt-only',
  'prompt-iterate',
]
