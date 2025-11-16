import { computed, type Ref, type ComputedRef } from 'vue'
import type { ConversationMessage, PromptRecord } from '@prompt-optimizer/core'
import type { UseConversationOptimization } from './useConversationOptimization'

/**
 * 提示词显示适配器选项
 */
export interface PromptDisplayAdapterOptions {
  // 启用消息优化模式
  enableMessageOptimization: Ref<boolean>

  // 上下文消息列表
  optimizationContext: Ref<ConversationMessage[]>

  // 全局优化链（用于历史记录查看）
  globalVersions: Ref<PromptRecord[]>
  globalCurrentVersionId: Ref<string | undefined>
  globalIsOptimizing: Ref<boolean>
}

/**
 * 提示词显示适配器返回值
 */
export interface UsePromptDisplayAdapter {
  // 模式标识
  isInMessageOptimizationMode: ComputedRef<boolean>

  // 显示数据（自动根据模式切换数据源）
  displayedOriginalPrompt: ComputedRef<string>
  displayedOptimizedPrompt: ComputedRef<string>
  displayedVersions: ComputedRef<PromptRecord[]>
  displayedCurrentVersionId: ComputedRef<string | null>
  displayedIsOptimizing: ComputedRef<boolean>
}

/**
 * 提示词显示适配器 Composable
 *
 * 功能：
 * - 根据"消息优化模式 vs 历史记录查看模式"自动切换数据源
 * - 为 PromptPanel 提供统一的数据接口
 * - 解决消息级优化和全局优化的数据隔离问题
 *
 * 使用场景：
 * - ContextSystemWorkspace: 需要在消息优化和历史记录查看之间切换
 * - 其他需要类似适配逻辑的组件
 *
 * @param conversationOptimization - 会话优化 composable 实例
 * @param options - 适配器配置选项
 * @returns 显示层数据和模式标识
 *
 * @example
 * ```ts
 * const displayAdapter = usePromptDisplayAdapter(
 *   conversationOptimization,
 *   {
 *     enableMessageOptimization: computed(() => props.enableMessageOptimization),
 *     optimizationContext: computed(() => props.optimizationContext),
 *     globalVersions: computed(() => props.versions || []),
 *     globalCurrentVersionId: computed(() => props.currentVersionId),
 *     globalIsOptimizing: computed(() => props.isOptimizing),
 *   }
 * )
 * ```
 */
export function usePromptDisplayAdapter(
  conversationOptimization: UseConversationOptimization,
  options: PromptDisplayAdapterOptions
): UsePromptDisplayAdapter {
  const selectedMessageId = conversationOptimization.selectedMessageId

  /**
   * 消息优化模式判定
   * 只有在启用消息优化 且 有选中消息时，才进入消息优化模式
   */
  const isInMessageOptimizationMode = computed(() => {
    return options.enableMessageOptimization.value && !!selectedMessageId.value
  })

  /**
   * 显示的原始提示词
   * - 消息优化模式: 当前选中消息的原始内容
   * - 历史记录模式: 空字符串（不显示）
   */
  const displayedOriginalPrompt = computed(() => {
    if (!isInMessageOptimizationMode.value) return ''

    const message = options.optimizationContext.value?.find(
      m => m.id === selectedMessageId.value
    )
    return message?.originalContent || message?.content || ''
  })

  /**
   * 显示的优化结果
   * - 消息优化模式: 消息级优化结果
   * - 历史记录模式: 空字符串（不显示）
   */
  const displayedOptimizedPrompt = computed(() => {
    return isInMessageOptimizationMode.value
      ? conversationOptimization.optimizedPrompt.value
      : ''
  })

  /**
   * 显示的版本列表
   * - 消息优化模式: 消息级优化版本链
   * - 历史记录模式: 全局优化版本链
   */
  const displayedVersions = computed(() => {
    if (isInMessageOptimizationMode.value) {
      return conversationOptimization.currentVersions.value || []
    }
    return options.globalVersions.value || []
  })

  /**
   * 显示的当前版本 ID
   * - 消息优化模式: 消息级当前版本 ID
   * - 历史记录模式: 全局当前版本 ID
   */
  const displayedCurrentVersionId = computed(() => {
    if (isInMessageOptimizationMode.value) {
      return conversationOptimization.currentRecordId.value || null
    }
    return options.globalCurrentVersionId.value || null
  })

  /**
   * 显示的优化中状态
   * - 消息优化模式: 消息级优化状态
   * - 历史记录模式: 全局优化状态
   */
  const displayedIsOptimizing = computed(() => {
    return isInMessageOptimizationMode.value
      ? conversationOptimization.isOptimizing.value
      : options.globalIsOptimizing.value
  })

  return {
    isInMessageOptimizationMode,
    displayedOriginalPrompt,
    displayedOptimizedPrompt,
    displayedVersions,
    displayedCurrentVersionId,
    displayedIsOptimizing,
  }
}
