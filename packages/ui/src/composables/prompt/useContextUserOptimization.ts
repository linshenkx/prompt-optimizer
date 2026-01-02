import { ref, nextTick, computed, reactive, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getErrorMessage } from '../../utils/error'
import { v4 as uuidv4 } from 'uuid'
import type {
  Template,
  PromptRecord,
  PromptRecordChain,
  OptimizationRequest
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

type PromptChain = PromptRecordChain

export interface ContextUserOptimizationBindings {
  prompt?: Ref<string>
  optimizedPrompt?: Ref<string>
  optimizedReasoning?: Ref<string>
  currentChainId?: Ref<string>
  currentVersionId?: Ref<string>
}

/**
 * ContextUser 模式提示词优化器接口
 */
export interface UseContextUserOptimization {
  // 状态
  prompt: string
  optimizedPrompt: string
  optimizedReasoning: string
  isOptimizing: boolean
  isIterating: boolean
  selectedTemplate: Template | null
  selectedIterateTemplate: Template | null
  currentChainId: string
  currentVersions: PromptChain['versions']
  currentVersionId: string

  // 方法
  optimize: () => Promise<void>
  iterate: (payload: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => Promise<void>
  switchVersion: (version: PromptChain['versions'][number]) => Promise<void>
  switchToV0: (version: PromptChain['versions'][number]) => Promise<void>  // 🆕 V0 切换
  loadFromHistory: (payload: { rootPrompt: string, chain: PromptChain, record: PromptRecord }) => void
  saveLocalEdit: (payload: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => Promise<void>
  handleAnalyze: () => void  // 🆕 分析功能
}

/**
 * ContextUser 模式提示词优化器 Composable
 *
 * 专门用于 ContextUserWorkspace 的优化逻辑，特点：
 * - 只处理单条用户消息优化
 * - 独立的状态管理
 * - 支持版本历史和迭代
 * - 与 ContextSystem 的 useConversationOptimization 对称
 *
 * @param services 服务实例引用
 * @param selectedOptimizeModel 优化模型选择
 * @param selectedTemplate 优化模板（用户模式）
 * @param selectedIterateTemplate 迭代模板
 * @returns ContextUser 优化器接口
 *
 * @example
 * ```ts
 * const contextUserOptimization = useContextUserOptimization(
 *   services,
 *   computed(() => props.selectedOptimizeModel),
 *   computed(() => props.selectedTemplate),
 *   computed(() => props.selectedIterateTemplate)
 * )
 *
 * // 执行优化
 * await contextUserOptimization.optimize()
 * ```
 */
export function useContextUserOptimization(
  services: Ref<AppServices | null>,
  selectedOptimizeModel: Ref<string>,
  selectedTemplate: Ref<Template | null>,
  selectedIterateTemplate: Ref<Template | null>,
  bindings?: ContextUserOptimizationBindings
): UseContextUserOptimization {
  const toast = useToast()
  const { t } = useI18n()

  // 服务引用
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)

  const boundPrompt = bindings?.prompt ?? ref('')
  const boundOptimizedPrompt = bindings?.optimizedPrompt ?? ref('')
  const boundOptimizedReasoning = bindings?.optimizedReasoning ?? ref('')
  const boundCurrentChainId = bindings?.currentChainId ?? ref('')
  const boundCurrentVersionId = bindings?.currentVersionId ?? ref('')

  // 使用 reactive 创建响应式状态对象
  const state = reactive<any>({
    // 状态
    prompt: boundPrompt,
    optimizedPrompt: boundOptimizedPrompt,
    optimizedReasoning: boundOptimizedReasoning,
    isOptimizing: false,
    isIterating: false,
    selectedTemplate: null,
    selectedIterateTemplate: null,
    currentChainId: boundCurrentChainId,
    currentVersions: [],
    currentVersionId: boundCurrentVersionId,

    // 方法
    optimize: async () => {
      if (!state.prompt.trim() || state.isOptimizing) return

      if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
        return
      }

      if (!selectedOptimizeModel.value) {
        toast.error(t('toast.error.noOptimizeModel'))
        return
      }

      // 在开始优化前立即清空状态
      state.isOptimizing = true
      state.optimizedPrompt = ''
      state.optimizedReasoning = ''

      // 等待一个微任务确保状态更新完成
      await nextTick()

      try {
        // 构建优化请求
        const request: OptimizationRequest = {
          optimizationMode: 'user',  // ContextUser 固定为 user 模式
          targetPrompt: state.prompt,
          templateId: selectedTemplate.value.id,
          modelKey: selectedOptimizeModel.value
        }

        // 使用流式优化 API
        await promptService.value!.optimizePromptStream(
          request,
          {
            onToken: (token: string) => {
              state.optimizedPrompt += token
            },
            onReasoningToken: (reasoningToken: string) => {
              state.optimizedReasoning += reasoningToken
            },
            onComplete: async () => {
              if (!selectedTemplate.value) return

              try {
                // 创建历史记录
                const recordData = {
                  id: uuidv4(),
                  originalPrompt: state.prompt,
                  optimizedPrompt: state.optimizedPrompt,
                  type: 'contextUserOptimize' as const,  // ContextUser 专用类型
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedTemplate.value.id,
                  timestamp: Date.now(),
                  metadata: {
                    optimizationMode: 'user' as const,
                    functionMode: 'pro' as const  // ContextUser 属于 pro 模式
                  }
                }

                const newRecord = await historyManager.value!.createNewChain(recordData)

                state.currentChainId = newRecord.chainId
                state.currentVersions = newRecord.versions
                state.currentVersionId = newRecord.currentRecord.id

                toast.success(t('toast.success.optimizeSuccess'))
              } catch (error: unknown) {
                console.error('创建历史记录失败:', error)
                toast.error('创建历史记录失败: ' + getErrorMessage(error))
              } finally {
                state.isOptimizing = false
              }
            },
            onError: (error: Error) => {
              console.error(t('toast.error.optimizeProcessFailed'), error)
              toast.error(error.message || t('toast.error.optimizeFailed'))
              state.isOptimizing = false
            }
          }
        )
      } catch (error: unknown) {
        console.error(t('toast.error.optimizeFailed'), error)
        toast.error(getErrorMessage(error) || t('toast.error.optimizeFailed'))
      } finally {
        state.isOptimizing = false
      }
    },

    // 迭代优化
    iterate: async (
      {
        originalPrompt,
        optimizedPrompt: lastOptimizedPrompt,
        iterateInput,
      }: {
        originalPrompt: string,
        optimizedPrompt: string,
        iterateInput: string,
      },
    ) => {
      // 🔧 修复：迭代模板实际上不需要 originalPrompt，只需要 lastOptimizedPrompt 和 iterateInput
      // 移除 !originalPrompt 检查，允许用户直接在工作区编辑后迭代
      if (!lastOptimizedPrompt || state.isIterating) return
      if (!iterateInput) return

      if (!selectedIterateTemplate.value) {
        toast.error(t('toast.error.noIterateTemplate'))
        return
      }

      // 在开始迭代前立即清空状态
      state.isIterating = true
      state.optimizedPrompt = ''
      state.optimizedReasoning = ''

      // 等待一个微任务确保状态更新完成
      await nextTick()

      try {
        await promptService.value!.iteratePromptStream(
          originalPrompt,
          lastOptimizedPrompt,
          iterateInput,
          selectedOptimizeModel.value,
          {
            onToken: (token: string) => {
              state.optimizedPrompt += token
            },
            onReasoningToken: (reasoningToken: string) => {
              state.optimizedReasoning += reasoningToken
            },
            onComplete: async () => {
              if (!selectedIterateTemplate.value) {
                state.isIterating = false
                return
              }

              try {
                // 保存迭代历史
                const iterationData = {
                  chainId: state.currentChainId,
                  originalPrompt: originalPrompt,
                  optimizedPrompt: state.optimizedPrompt,
                  iterationNote: iterateInput,
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedIterateTemplate.value.id
                }

                const updatedChain = await historyManager.value!.addIteration(iterationData)

                state.currentVersions = updatedChain.versions
                state.currentVersionId = updatedChain.currentRecord.id

                toast.success(t('toast.success.iterateComplete'))
              } catch (error: unknown) {
                console.error('[History] 迭代记录失败:', error)
                toast.warning(t('toast.warning.historyFailed'))
              } finally {
                state.isIterating = false
              }
            },
            onError: (error: Error) => {
              console.error('[Iterate] 迭代失败:', error)
              toast.error(t('toast.error.iterateFailed'))
              state.isIterating = false
            }
          },
          selectedIterateTemplate.value.id,
        )
      } catch (error: unknown) {
        console.error('[Iterate] 迭代失败:', error)
        toast.error(t('toast.error.iterateFailed'))
        state.isIterating = false
      }
    },

    /**
     * 切换到指定优化版本
     *
     * 📌 设计说明：
     * - state.prompt 使用 fallback (version.originalPrompt || state.prompt)
     * - 目的：兼容早期版本的历史记录，这些记录可能只保存了优化结果而缺失 originalPrompt
     * - 效果：切换时保持当前输入不变，避免意外清空用户内容
     */
    switchVersion: async (version: PromptChain['versions'][number]) => {
      // 强制更新内容，确保UI同步
      state.optimizedPrompt = version.optimizedPrompt
      // 🔧 兼容旧版本链：早期记录可能缺失 originalPrompt，使用 fallback 避免清空当前输入
      state.prompt = version.originalPrompt || state.prompt
      state.currentVersionId = version.id

      // 等待一个微任务确保状态更新完成
      await nextTick()
    },

    /**
     * 切换到 V0 版本（未优化的原始提示词）
     *
     * 📌 设计说明：
     * - 与 switchVersion 不同，此方法要求 originalPrompt 必填（前置检查）
     * - 语义：V0 表示"查看未优化的原始版本"，必须有原始输入才能回退
     * - 因此可以安全地直接赋值，无需 fallback 保护
     */
    switchToV0: async (version: PromptChain['versions'][number]) => {
      // ✅ V0 切换要求必须有原始输入，否则无法回退到"未优化"状态
      if (!version || !version.originalPrompt) {
        toast.error(t('toast.error.invalidVersion'))
        return
      }
      // V0 状态：优化结果显示原始输入（表示"未优化"）
      state.optimizedPrompt = version.originalPrompt
      state.prompt = version.originalPrompt
      state.currentVersionId = version.id

      // 等待一个微任务确保状态更新完成
      await nextTick()
    },

    /**
     * 从历史记录恢复完整状态
     *
     * 📌 调用时机：
     * - 用户在历史面板点击 Context User 模式的历史记录时触发
     * - 由父组件 (App.vue) 调用，在 handleSelectHistory 更新全局状态后执行
     *
     * 📌 状态分离设计：
     * - handleSelectHistory 更新的是全局 optimizer 状态（App.vue 级别）
     * - loadFromHistory 更新的是 ContextUserWorkspace 内部的独立状态
     * - 两者操作不同的状态树，无竞态风险
     *
     * @param payload - 包含历史记录数据的负载对象
     * @param payload.rootPrompt - 根提示词（优先使用）
     * @param payload.chain - 提示链数据（包含所有版本）
     * @param payload.record - 当前选中的提示记录
     */
    loadFromHistory: ({
      rootPrompt,
      chain,
      record
    }: {
      rootPrompt?: string
      chain: { chainId: string; versions: Array<{ id: string; modelKey?: string; templateId?: string }> }
      record: { id: string; originalPrompt?: string; optimizedPrompt?: string }
    }) => {
      state.prompt = rootPrompt || record.originalPrompt || ''
      state.optimizedPrompt = record.optimizedPrompt || ''
      state.optimizedReasoning = ''
      state.currentChainId = chain.chainId
      state.currentVersions = chain.versions
      state.currentVersionId = record.id
    },

    /**
     * 保存本地修改为一个新版本（不触发 LLM）
     * - 用于"直接修复"与手动编辑后的显式保存
     */
    saveLocalEdit: async ({ optimizedPrompt, note, source }: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => {
      try {
        if (!historyManager.value) throw new Error('History service unavailable')
        if (!optimizedPrompt) return

        const currentRecord = state.currentVersions.find((v: { id: string; modelKey?: string; templateId?: string }) => v.id === state.currentVersionId)
        const modelKey = currentRecord?.modelKey || selectedOptimizeModel.value || 'local-edit'
        const templateId =
          currentRecord?.templateId ||
          selectedIterateTemplate.value?.id ||
          selectedTemplate.value?.id ||
          'local-edit'

        // 若当前没有链（极少数场景），创建新链以便后续版本管理
        if (!state.currentChainId) {
          const recordData = {
            id: uuidv4(),
            originalPrompt: state.prompt,
            optimizedPrompt,
            type: 'contextUserOptimize' as const,
            modelKey,
            templateId,
            timestamp: Date.now(),
            metadata: {
              optimizationMode: 'user' as const,
              functionMode: 'pro' as const,
              localEdit: true,
              localEditSource: source || 'manual',
            }
          }
          const newRecord = await historyManager.value.createNewChain(recordData)
          state.currentChainId = newRecord.chainId
          state.currentVersions = newRecord.versions
          state.currentVersionId = newRecord.currentRecord.id
          return
        }

        const updatedChain = await historyManager.value.addIteration({
          chainId: state.currentChainId,
          originalPrompt: state.prompt,
          optimizedPrompt,
          modelKey,
          templateId,
          iterationNote: note || (source === 'patch' ? 'Direct fix' : 'Manual edit'),
          metadata: {
            optimizationMode: 'user' as const,
            functionMode: 'pro' as const,
            localEdit: true,
            localEditSource: source || 'manual',
          }
        })

        state.currentVersions = updatedChain.versions
        state.currentVersionId = updatedChain.currentRecord.id
      } catch (error: unknown) {
        console.error('[useContextUserOptimization] 保存本地修改失败:', error)
        toast.warning(t('toast.warning.saveHistoryFailed'))
      }
    },

    /**
     * 分析功能：清空版本链，创建 V0（原始版本）
     * - 不写入历史记录
     * - 只创建内存中的虚拟 V0 版本
     */
    handleAnalyze: () => {
      if (!state.prompt.trim()) return

      // 生成虚拟的 V0 版本记录（不写入历史）
      const virtualV0Id = uuidv4()
      const virtualV0: PromptChain['versions'][number] = {
        id: virtualV0Id,
        chainId: '', // 虚拟链，不关联真实历史
        version: 0,
        originalPrompt: state.prompt,
        optimizedPrompt: state.prompt, // V0 的优化内容就是原始内容
        type: 'userOptimize',
        timestamp: Date.now(),
        modelKey: '',
        templateId: '',
      }

      // 清空旧链条，设置新的 V0
      state.currentChainId = ''
      state.currentVersions = [virtualV0]
      state.currentVersionId = virtualV0Id
      state.optimizedPrompt = state.prompt
    }
  })

  // 同步 selectedTemplate 和 selectedIterateTemplate
  // 这样外部可以通过 props 控制，内部也能访问
  const syncTemplates = () => {
    state.selectedTemplate = selectedTemplate.value
    state.selectedIterateTemplate = selectedIterateTemplate.value
  }

  // 初始同步
  syncTemplates()

  // 监听变化并同步（使用 Vue 的响应式系统自动处理）
  const unwatchTemplate = () => {
    state.selectedTemplate = selectedTemplate.value
  }
  const unwatchIterateTemplate = () => {
    state.selectedIterateTemplate = selectedIterateTemplate.value
  }

  // 返回 reactive 对象
  return state
}
