/**
 * 评估上下文 - 使用 provide/inject 模式共享评估状态
 *
 * 解决评估相关 props 在多层组件间重复传递的问题
 */

import { provide, inject, type InjectionKey } from 'vue'
import type { UseEvaluationReturn } from './useEvaluation'

/**
 * 评估上下文的 InjectionKey，保证类型安全
 */
export const EvaluationKey: InjectionKey<UseEvaluationReturn> = Symbol('evaluation')

/**
 * 提供评估上下文
 *
 * 在应用顶层组件（如 PromptOptimizerApp.vue）调用
 *
 * @param evaluation - useEvaluation 的返回值
 *
 * @example
 * ```typescript
 * const evaluation = useEvaluation({ ... })
 * provideEvaluation(evaluation)
 * ```
 */
export function provideEvaluation(evaluation: UseEvaluationReturn): void {
  provide(EvaluationKey, evaluation)
}

/**
 * 注入评估上下文
 *
 * 在需要评估功能的子组件中调用
 *
 * @returns 评估上下文，包含所有评估状态和方法
 * @throws 如果在未提供评估上下文的组件中调用，将抛出错误
 *
 * @example
 * ```typescript
 * const evaluation = useEvaluationContext()
 * // 访问状态
 * evaluation.promptOnlyScore.value
 * evaluation.isEvaluatingPromptOnly.value
 * // 调用方法
 * evaluation.evaluatePromptOnly({ ... })
 * evaluation.showDetail('prompt-only')
 * ```
 */
export function useEvaluationContext(): UseEvaluationReturn {
  const evaluation = inject(EvaluationKey)
  if (!evaluation) {
    throw new Error(
      '[useEvaluationContext] 必须在提供了评估上下文的组件树中使用。' +
      '请确保父组件调用了 provideEvaluation()。'
    )
  }
  return evaluation
}

/**
 * 尝试注入评估上下文（可选）
 *
 * 如果未提供评估上下文，返回 null 而不是抛出错误
 * 适用于可选使用评估功能的组件
 *
 * @returns 评估上下文或 null
 */
export function useEvaluationContextOptional(): UseEvaluationReturn | null {
  return inject(EvaluationKey, null)
}
