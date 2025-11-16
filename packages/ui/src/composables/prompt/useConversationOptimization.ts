import { ref, computed, nextTick, watch, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getErrorMessage } from '../../utils/error'
import { v4 as uuidv4 } from 'uuid'
import type {
  IHistoryManager,
  IPromptService,
  ConversationMessage,
  PromptRecordChain,
  OptimizationMode,
  OptimizationRequest,
  MessageOptimizationRequest,
  Template
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

/**
 * 多轮对话消息优化 Composable 返回值接口
 */
export interface UseConversationOptimization {
  // 状态
  selectedMessageId: Ref<string>
  currentChainId: Ref<string>
  currentRecordId: Ref<string>
  currentVersions: Ref<PromptRecordChain['versions']>
  optimizedPrompt: Ref<string>
  isOptimizing: Ref<boolean>
  messageChainMap: Ref<Map<string, string>>

  // 方法
  selectMessage: (message: ConversationMessage) => Promise<void>
  optimizeMessage: () => Promise<void>
  iterateMessage: (payload: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => Promise<void>
  switchVersion: (version: PromptRecordChain['versions'][number]) => Promise<void>
  switchToV0: (version: PromptRecordChain['versions'][number]) => Promise<void>  // 🆕 V0 切换
  applyToConversation: (messageId: string, content: string) => void
  applyCurrentVersion: () => Promise<void>
  cleanupDeletedMessageMapping: (messageId: string, options?: { keepSelection?: boolean }) => void
}

/**
 * 多轮对话消息优化 Composable
 *
 * 提供消息级别的优化功能，支持：
 * - 选择任意 system/user 消息进行优化
 * - 版本管理和历史记录
 * - 自动应用优化结果
 * - 工作链智能复用
 *
 * @param services 服务实例引用
 * @param conversationMessages 对话消息列表
 * @param optimizationMode 优化模式（system/user）
 * @param selectedOptimizeModel 优化模型
 * @param selectedTemplate 优化模板
 * @param selectedIterateTemplate 迭代模板
 */
export function useConversationOptimization(
  services: Ref<AppServices | null>,
  conversationMessages: Ref<ConversationMessage[]>,
  optimizationMode: Ref<OptimizationMode>,
  selectedOptimizeModel: Ref<string>,
  selectedTemplate: Ref<Template | null>,
  selectedIterateTemplate: Ref<Template | null>
) {
  const toast = useToast()
  const { t } = useI18n()

  // 服务引用
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)

  // 核心映射表: (mode + messageId) → chainId，避免跨模式串链
  // 使用 Map 数据结构确保 O(1) 查找性能
  const messageChainMap = ref<Map<string, string>>(new Map())
  const buildMapKey = (messageId?: string) =>
    `${optimizationMode.value}:${messageId || ''}`
  const removeMessageMapping = (messageId?: string) => {
    if (!messageId) return false
    const suffix = `:${messageId}`
    let removed = false
    for (const key of messageChainMap.value.keys()) {
      if (key.endsWith(suffix)) {
        messageChainMap.value.delete(key)
        removed = true
      }
    }
    return removed
  }

  // 状态管理
  const selectedMessageId = ref<string>('')
  const currentChainId = ref<string>('')
  const currentRecordId = ref<string>('')
  const currentVersions = ref<PromptRecordChain['versions']>([])
  const optimizedPrompt = ref<string>('')
  const isOptimizing = ref<boolean>(false)

  /**
   * 🆕 辅助函数：从历史记录获取消息的当前应用版本号
   * @param messageId 消息 ID
   * @param chainId 优化链 ID
   * @param currentContent 当前消息内容
   * @param originalContent 原始消息内容
   * @returns 版本号 (0=v0, 1=v1, 2=v2...)
   */
  const getMessageAppliedVersion = async (
    messageId: string,
    chainId: string | undefined,
    currentContent: string,
    originalContent?: string
  ): Promise<number> => {
    try {
      // 0. 优先检查是否为原始内容 (V0)
      if (currentContent?.trim() === originalContent?.trim()) {
        return 0
      }

      if (!chainId) return 0

      const chain = await historyManager.value?.getChain(chainId)
      if (!chain) {
        return 0
      }

      // 精确匹配：遍历所有版本，找到内容匹配的版本
      for (let i = 0; i < chain.versions.length; i++) {
        if (chain.versions[i].optimizedPrompt?.trim() === currentContent?.trim()) {
          return chain.versions[i].version // Use persistent version number
        }
      }

      // 如果没有匹配且内容已修改，假设为最新版本
      const latest = chain.versions[chain.versions.length - 1]
      return latest ? latest.version : 0
    } catch (error) {
      console.warn(`[ConversationOptimization] 获取消息 ${messageId} 版本号失败:`, error)
      return 0 // 失败时默认 v0
    }
  }

  /**
   * 选择消息进行优化
   * @param message 要优化的消息
   */
  const selectMessage = async (message: ConversationMessage) => {
    // 验证消息角色：仅允许 user 和 system 消息优化
    if (message.role !== 'user' && message.role !== 'system') {
      toast.warning(t('toast.warning.cannotOptimizeRole', { role: message.role }))
      return
    }

    // 自动补充缺失的 ID / 原始内容（防御性策略）
    if (!message.id) {
      message.id = uuidv4()
    }
    if (message.originalContent === undefined) {
      message.originalContent = message.content
    }

    // 更新选中的消息 ID
    selectedMessageId.value = message.id || ''

    // 检查是否已有工作链映射
    const mapKey = message.id ? buildMapKey(message.id) : ''
    const existingChainId = message.id ? messageChainMap.value.get(mapKey) : undefined

    if (existingChainId) {
      // 加载现有工作链
      try {
        const history = historyManager.value
        if (!history) {
          toast.error(t('toast.error.historyUnavailable'))
          return
        }
        const chain = await history.getChain(existingChainId)
        currentChainId.value = chain.chainId
        currentVersions.value = chain.versions
        optimizedPrompt.value = chain.currentRecord.optimizedPrompt
        currentRecordId.value = chain.currentRecord.id
      } catch (error) {
        console.error('[ConversationOptimization] 加载工作链失败:', error)
        toast.error(t('toast.error.loadChainFailed'))
        // 重置为首次优化状态
        currentChainId.value = ''
        currentVersions.value = []
        currentRecordId.value = ''
        if (message.id) {
          removeMessageMapping(message.id)
        }
      }
    } else {
      // 🔧 没有映射关系，视为新消息，重置状态（工作链将在首次优化完成后创建）
      currentChainId.value = ''
      currentVersions.value = []
      optimizedPrompt.value = ''
      currentRecordId.value = ''
    }
  }

  /**
   * 优化选中的消息 (总是新建优化链)
   */
  const optimizeMessage = async () => {
    // 查找当前选中的消息
    const message = conversationMessages.value.find(m => m.id === selectedMessageId.value)
    if (!message || !selectedTemplate.value || !selectedOptimizeModel.value) {
      if (!message) {
        toast.warning(t('toast.warning.messageNotFound'))
      } else if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
      } else if (!selectedOptimizeModel.value) {
        toast.error(t('toast.error.noOptimizeModel'))
      }
      return
    }

    if (!promptService.value) {
      toast.error(t('toast.error.promptServiceUnavailable'))
      return
    }

    // 强制重置状态，开始新的优化链
    isOptimizing.value = true
    optimizedPrompt.value = ''
    currentChainId.value = ''
    currentVersions.value = []
    currentRecordId.value = ''

    await nextTick()

    const originalContentSnapshot = message.content || ''
    message.originalContent = originalContentSnapshot

    try {
      // 构建消息优化请求，使用专门的 MessageOptimizationRequest 接口
      const request: MessageOptimizationRequest = {
        selectedMessageId: selectedMessageId.value,
        messages: conversationMessages.value,
        modelKey: selectedOptimizeModel.value,
        templateId: selectedTemplate.value.id, // 使用用户选择的模板
        variables: {}, // 自定义变量（暂时为空）
      }

      // 调用流式消息优化 API（使用新的 optimizeMessageStream）
      await promptService.value!.optimizeMessageStream(
        request,
        {
          onToken: (token: string) => {
            optimizedPrompt.value += token
          },
          onReasoningToken: (reasoningToken: string) => {
            // 可选：处理推理内容
          },
          onComplete: async () => {
            try {
              // 判断是首次优化还是后续优化
              if (!historyManager.value) {
                throw new Error('History service unavailable')
              }

              // 🔧 先应用优化结果到会话，确保快照保存的是最新状态
              applyToConversation(message.id || '', optimizedPrompt.value)

              // 首次优化：创建新工作链
              // 🆕 为每条消息记录其优化链和版本号
              const conversationSnapshot = await Promise.all(
                  conversationMessages.value.map(async (msg) => {
                    const msgChainId = msg.id ? messageChainMap.value.get(buildMapKey(msg.id)) : undefined
                    let appliedVersion = 0

                    // 🔧 修复：首次优化时，当前消息没有 chainId，但已经应用了 v1
                    if (msg.id === message.id) {
                      // 当前正在优化的消息，首次优化必然是 V1
                      appliedVersion = 1
                    } else if (msgChainId && msg.id) {
                      // 其他已优化过的消息，使用辅助函数检测版本
                      appliedVersion = await getMessageAppliedVersion(
                        msg.id,
                        msgChainId,
                        msg.content,
                        msg.originalContent
                      )
                    }
                    
                    return {
                      id: msg.id,
                      role: msg.role,
                      // 🔧 确保使用最新的优化内容
                      content: (msg.id === message.id) ? optimizedPrompt.value : msg.content,
                      originalContent: msg.originalContent,
                      chainId: msgChainId,           // 🆕 记录优化链 ID
                      appliedVersion: appliedVersion // 🆕 记录应用的版本号
                    }
                  })
              )

              const recordData = {
                  id: uuidv4(),
                  originalPrompt: originalContentSnapshot,
                  optimizedPrompt: optimizedPrompt.value,
                  type: 'conversationMessageOptimize' as const,
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedTemplate.value!.id,
                  timestamp: Date.now(),
                  metadata: {
                    messageId: message.id,
                    messageRole: message.role,
                    optimizationMode: optimizationMode.value,
                    // 🆕 保存完整的会话快照（包含版本信息）
                    conversationSnapshot
                  }
              }

              const newChain = await historyManager.value.createNewChain(recordData)
              currentChainId.value = newChain.chainId
              currentVersions.value = newChain.versions
              currentRecordId.value = newChain.currentRecord.id

              // 建立消息 ID 到工作链 ID 的映射
              if (message.id) {
                  messageChainMap.value.set(buildMapKey(message.id), newChain.chainId)
              }

              // 触发全局历史记录刷新事件
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('prompt-optimizer:history-refresh'))
              }

              // 显示成功提示
              toast.success(t('toast.success.optimizeAndApply', { version: 'v1' }))
            } catch (error) {
              console.error('[ConversationOptimization] 保存历史记录失败:', error)
              toast.warning(t('toast.warning.saveHistoryFailed'))
              // 优化结果仍然可用，但未保存历史
            } finally {
              isOptimizing.value = false
            }
          },
          onError: (error: Error) => {
            console.error('[ConversationOptimization] 优化失败:', error)
            toast.error(error.message || t('toast.error.optimizeFailed'))
            isOptimizing.value = false
          }
        }
      )
    } catch (error) {
      console.error('[ConversationOptimization] 优化失败:', error)
      toast.error(getErrorMessage(error) || t('toast.error.optimizeFailed'))
      isOptimizing.value = false
    }
  }

  /**
   * 迭代优化当前选中的消息
   */
  const iterateMessage = async ({ originalPrompt, optimizedPrompt: lastOptimizedPrompt, iterateInput }: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => {
    if (!selectedMessageId.value || !currentChainId.value) {
      toast.warning(t('toast.warning.noVersionSelected'))
      return
    }
    if (!iterateInput) return
    
    // 查找当前选中的消息
    const message = conversationMessages.value.find(m => m.id === selectedMessageId.value)
    if (!message) {
        toast.warning(t('toast.warning.messageNotFound'))
        return
    }

    if (!promptService.value) {
      toast.error(t('toast.error.promptServiceUnavailable'))
      return
    }

    isOptimizing.value = true
    optimizedPrompt.value = ''  // 🔧 清空旧内容，避免累加
    await nextTick()

    try {
      // 🔧 使用迭代专用模板，如果没有选择迭代模板，回退到默认迭代模板
      const templateId = selectedIterateTemplate.value?.id || 'context-iterate'

      await promptService.value.iteratePromptStream(
        originalPrompt, // 原始提示词
        lastOptimizedPrompt, // 上一次优化结果
        iterateInput, // 迭代指令
        selectedOptimizeModel.value,
        {
          onToken: (token: string) => {
            optimizedPrompt.value += token
          },
          onReasoningToken: (reasoningToken: string) => {
             // 处理推理内容
          },
          onComplete: async () => {
             try {
                if (!historyManager.value) throw new Error('History service unavailable')

                // 应用结果
                applyToConversation(message.id || '', optimizedPrompt.value)
                
                // 🔧 关键修复：手动计算新版本号（与 addIteration 的逻辑保持一致）
                const newVersionNumber = (currentVersions.value[currentVersions.value.length - 1]?.version || 0) + 1

                // 构建快照（使用手动计算的版本号）
                const conversationSnapshot = await Promise.all(
                  conversationMessages.value.map(async (msg) => {
                    const msgChainId = msg.id ? messageChainMap.value.get(buildMapKey(msg.id)) : undefined
                    let appliedVersion = 0

                    // 🔧 修复：迭代优化时，优先判断是否为当前消息
                    if (msg.id === message.id) {
                      // 当前正在优化的消息，使用手动计算的新版本号
                      appliedVersion = newVersionNumber
                    } else if (msgChainId && msg.id) {
                      // 其他已优化过的消息，使用辅助函数检测版本
                      appliedVersion = await getMessageAppliedVersion(
                        msg.id,
                        msgChainId,
                        msg.content,
                        msg.originalContent
                      )
                    }

                    return {
                      id: msg.id,
                      role: msg.role,
                      content: msg.content,
                      originalContent: msg.originalContent,
                      chainId: msgChainId,
                      appliedVersion: appliedVersion // 🆕 记录应用的版本号
                    }
                  })
                )

                const iterationData = {
                  chainId: currentChainId.value,
                  originalPrompt: originalPrompt,
                  optimizedPrompt: optimizedPrompt.value,
                  iterationNote: iterateInput,
                  modelKey: selectedOptimizeModel.value,
                  templateId: templateId,
                  metadata: {
                    messageId: message.id,
                    messageRole: message.role,
                    optimizationMode: optimizationMode.value,
                    // 🆕 迭代时也更新会话快照（包含版本信息）
                    conversationSnapshot
                  }
                }

                const updatedChain = await historyManager.value.addIteration(iterationData)
                currentVersions.value = updatedChain.versions
                currentRecordId.value = updatedChain.currentRecord.id

                // 触发全局历史记录刷新事件
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new Event('prompt-optimizer:history-refresh'))
                }
                
                // 显示成功提示
                const versionNumber = currentVersions.value.length
                toast.success(t('toast.success.optimizeAndApply', { version: `v${versionNumber}` }))

             } catch (error) {
               console.error('[ConversationOptimization] 保存迭代历史失败:', error)
               toast.warning(t('toast.warning.saveHistoryFailed'))
             } finally {
               isOptimizing.value = false
             }
          },
          onError: (error: Error) => {
            console.error('[ConversationOptimization] 迭代失败:', error)
            toast.error(error.message || t('toast.error.iterateFailed'))
            isOptimizing.value = false
          }
        },
        templateId,
        // 🆕 传递上下文数据
        {
          messages: conversationMessages.value,
          selectedMessageId: selectedMessageId.value,
          variables: {}, // 暂无变量支持
          tools: [] // 暂无工具支持
        }
      )
    } catch (error) {
      console.error('[ConversationOptimization] 迭代失败:', error)
      toast.error(getErrorMessage(error) || t('toast.error.iterateFailed'))
      isOptimizing.value = false
    }
  }

  /**
   * 切换版本
   * @param version 要切换到的版本
   */
  const switchVersion = async (version: PromptRecordChain['versions'][number]) => {
    if (!version || !version.optimizedPrompt) {
      toast.error(t('toast.error.invalidVersion'))
      return
    }
    optimizedPrompt.value = version.optimizedPrompt
    currentRecordId.value = version.id
    // 等待一个微任务确保状态更新完成
    await nextTick()
  }

  /**
   * 🆕 切换到 V0（原始版本）
   * @param version 第一个版本对象（包含 originalPrompt）
   */
  const switchToV0 = async (version: PromptRecordChain['versions'][number]) => {
    if (!version || !version.originalPrompt) {
      toast.error(t('toast.error.invalidVersion'))
      return
    }
    // 使用 originalPrompt 作为显示内容
    optimizedPrompt.value = version.originalPrompt
    currentRecordId.value = version.id
    // 等待一个微任务确保状态更新完成
    await nextTick()
  }

  /**
   * 应用优化结果到会话
   * @param messageId 消息 ID
   * @param content 要应用的内容
   */
  const applyToConversation = (messageId: string, content: string) => {
    const message = conversationMessages.value.find(m => m.id === messageId)
    if (!message) {
      toast.warning(t('toast.warning.messageNotFound'))
      return
    }
    message.content = content
  }

  /**
   * 将当前版本应用到会话（用于手动回退）
   * 🆕 直接使用当前显示的 optimizedPrompt，支持 V0（原始内容）
   */
  const applyCurrentVersion = async () => {
    if (!selectedMessageId.value) {
      toast.warning(t('toast.warning.noVersionSelected'))
      return
    }

    // 🆕 直接使用当前显示的内容，无需从历史记录加载
    // 这样可以正确支持 V0（原始内容）的应用
    if (!optimizedPrompt.value) {
      toast.warning(t('toast.warning.noContentToApply'))
      return
    }

    applyToConversation(selectedMessageId.value, optimizedPrompt.value)
    toast.success(t('toast.success.versionApplied'))
  }

  /**
   * 清理已删除消息的映射
   * @param messageId 被删除的消息 ID
   */
  const cleanupDeletedMessageMapping = (messageId: string, options?: { keepSelection?: boolean }) => {
    if (!messageId) return

    const removed = removeMessageMapping(messageId)
    if (removed) {
      console.log('[ConversationOptimization] 已清理消息映射:', messageId)
    }

    if (selectedMessageId.value === messageId) {
      if (options?.keepSelection) {
        currentChainId.value = ''
        currentVersions.value = []
        optimizedPrompt.value = ''
        currentRecordId.value = ''
      } else {
        selectedMessageId.value = ''
        currentChainId.value = ''
        currentVersions.value = []
        optimizedPrompt.value = ''
        currentRecordId.value = ''
        console.log('[ConversationOptimization] 已清空当前选中状态')
      }
    }
  }

  // 模式切换时软重置，防止跨模式复用链与 V0/V1 混用
  watch(optimizationMode, () => {
    messageChainMap.value = new Map()
    selectedMessageId.value = ''
    currentChainId.value = ''
    currentRecordId.value = ''
    currentVersions.value = []
    optimizedPrompt.value = ''
  })

  return {
    // 状态
    selectedMessageId,
    currentChainId,
    currentRecordId,
    currentVersions,
    optimizedPrompt,
    isOptimizing,
    messageChainMap,

    // 方法
    selectMessage,
    optimizeMessage,
    iterateMessage,
    switchVersion,
    switchToV0,  // 🆕 V0 切换方法
    applyToConversation,
    applyCurrentVersion,
    cleanupDeletedMessageMapping
  }
}
