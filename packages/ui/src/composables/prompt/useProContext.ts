/**
 * Pro 模式上下文 - 使用 provide/inject 模式共享 proContext
 *
 * 解决 Pro 模式下 proContext 在多层组件间传递的问题
 * 用于评估时提供多消息上下文理解（特别是 Pro-System 场景）
 */

import { provide, inject, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import type { ProEvaluationContext } from '@prompt-optimizer/core'

/**
 * ProContext 的 InjectionKey，保证类型安全
 */
export const ProContextKey: InjectionKey<Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>> = Symbol('proContext')

/**
 * 提供 Pro 模式上下文
 *
 * 在 Pro 模式的 Workspace 组件（如 ContextSystemWorkspace, ContextUserWorkspace）中调用
 *
 * @param proContext - Pro 模式上下文的响应式引用
 *
 * @example
 * ```typescript
 * const proContext = computed(() => ({
 *   targetMessage: { role: 'system', content: '...' },
 *   conversationMessages: [...]
 * }))
 * provideProContext(proContext)
 * ```
 */
export function provideProContext(proContext: Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>): void {
  provide(ProContextKey, proContext)
}

/**
 * 注入 Pro 模式上下文（可选）
 *
 * 如果未提供 proContext，返回 undefined 而不是抛出错误
 * 适用于在 Basic 模式和 Pro 模式下都可能使用的组件
 *
 * @returns Pro 模式上下文的响应式引用，如果不在 Pro 模式下则为 undefined
 *
 * @example
 * ```typescript
 * const proContext = useProContextOptional()
 * // 在评估时使用
 * evaluation.evaluatePromptOnly({
 *   originalPrompt,
 *   optimizedPrompt,
 *   proContext: proContext?.value,
 * })
 * ```
 */
export function useProContextOptional(): Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined> | undefined {
  return inject(ProContextKey, undefined)
}
