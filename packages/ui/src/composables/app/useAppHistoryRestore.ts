/**
 * App 级别历史记录恢复 Composable
 *
 * 负责从历史记录恢复时的智能模式切换和状态恢复逻辑。
 * 包括：
 * - 根据记录类型自动切换功能模式（basic/pro/image）
 * - 自动切换子模式（system/user）
 * - 恢复会话快照和消息级优化状态
 */

import { nextTick, type Ref, type ComputedRef } from 'vue'
import { useToast } from '../ui/useToast'
import type { ConversationMessage } from '../../types'
import type {
    BasicSubMode,
    ProSubMode,
    ContextMode,
    PromptRecord,
    PromptRecordChain,
    IHistoryManager,
    OptimizationMode,
} from '@prompt-optimizer/core'

/**
 * 历史记录上下文
 */
export interface HistoryContext {
    record: PromptRecord
    chainId: string
    rootPrompt: string
    chain: PromptRecordChain
}

/**
 * 工作区组件引用类型
 */
interface WorkspaceRef {
    restoreFromHistory?: (payload: any) => void
}

/**
 * useAppHistoryRestore 的配置选项
 */
export interface AppHistoryRestoreOptions {
    /** 服务实例 */
    services: Ref<{ historyManager: IHistoryManager } | null>
    /** 当前功能模式 */
    functionMode: Ref<'basic' | 'pro' | 'image'>
    /** 设置功能模式 */
    setFunctionMode: (mode: 'basic' | 'pro' | 'image') => Promise<void>
    /** 基础子模式 */
    basicSubMode: Ref<BasicSubMode>
    /** 设置基础子模式 */
    setBasicSubMode: (mode: BasicSubMode) => Promise<void>
    /** 专业子模式 */
    proSubMode: Ref<ProSubMode>
    /** 设置专业子模式 */
    setProSubMode: (mode: ProSubMode) => Promise<void>
    /** 处理上下文模式变更 */
    handleContextModeChange: (mode: ContextMode) => Promise<void>
    /** 处理历史记录选择 */
    handleSelectHistory: (context: HistoryContext) => Promise<void>
    /** 优化上下文（多消息） */
    optimizationContext: Ref<ConversationMessage[]>
    /** 系统工作区组件引用 */
    systemWorkspaceRef: Ref<WorkspaceRef | null>
    /** 用户工作区组件引用 */
    userWorkspaceRef: Ref<WorkspaceRef | null>
    /** i18n 翻译函数 */
    t: (key: string, params?: Record<string, any>) => string
}

/**
 * useAppHistoryRestore 的返回值
 */
export interface AppHistoryRestoreReturn {
    /** 处理历史记录恢复（带错误处理） */
    handleHistoryReuse: (context: HistoryContext) => Promise<void>
}

/**
 * App 级别历史记录恢复 Composable
 */
export function useAppHistoryRestore(options: AppHistoryRestoreOptions): AppHistoryRestoreReturn {
    const {
        services,
        functionMode,
        setFunctionMode,
        basicSubMode,
        setBasicSubMode,
        proSubMode,
        setProSubMode,
        handleContextModeChange,
        handleSelectHistory,
        optimizationContext,
        systemWorkspaceRef,
        userWorkspaceRef,
        t,
    } = options

    const toast = useToast()

    /**
     * 处理历史记录使用 - 智能模式切换（内部实现）
     */
    const handleHistoryReuseImpl = async (context: HistoryContext) => {
        const { record, chain } = context
        // rootRecord.type 可能包含旧版本类型名，显式转为 string 以兼容历史数据
        const rt = chain.rootRecord.type as unknown as string

        // 🆕 扩展模式切换逻辑 - 支持图像模式
        if (
            rt === 'imageOptimize' ||
            rt === 'contextImageOptimize' ||
            rt === 'imageIterate' ||
            rt === 'text2imageOptimize' ||
            rt === 'image2imageOptimize'
        ) {
            // 图像模式:只在不是图像模式时才切换
            const needsSwitch = functionMode.value !== 'image'
            if (needsSwitch) {
                await setFunctionMode('image')
                toast.info(t('toast.info.switchedToImageMode'))
            }

            // 🆕 图像模式专用数据回填逻辑
            // 等待模式切换完成后再回填数据
            await nextTick()

            // 根据记录类型设置正确的图像子模式
            const imageMode =
                rt === 'text2imageOptimize'
                    ? 'text2image'
                    : rt === 'image2imageOptimize'
                      ? 'image2image'
                      : 'text2image' // 默认为文生图模式

            // 通过全局事件或直接访问ImageWorkspace的数据来回填
            // 由于ImageWorkspace是独立组件，我们需要通过provide/inject或事件系统来传递数据
            const imageHistoryData = {
                originalPrompt: record.originalPrompt || chain.rootRecord.originalPrompt,
                optimizedPrompt: record.optimizedPrompt,
                metadata: record.metadata || chain.rootRecord.metadata,
                chainId: chain.chainId,
                versions: chain.versions,
                currentVersionId: record.id,
                imageMode: imageMode, // 添加图像模式信息
                templateId: record.templateId || chain.rootRecord.templateId, // 添加模板ID以便恢复模板选择
            }

            // 触发图像工作区数据恢复事件
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('image-workspace-restore', {
                        detail: imageHistoryData,
                    }),
                )
            }

            toast.success(t('toast.success.imageHistoryRestored'))
            return // 图像模式不需要调用原有的历史记录处理逻辑
        } else {
            // 根据链条的根记录类型确定应该切换到的优化模式
            let targetMode: OptimizationMode
            if (rt === 'optimize' || rt === 'conversationMessageOptimize') {
                targetMode = 'system'
            } else if (rt === 'userOptimize' || rt === 'contextUserOptimize') {
                targetMode = 'user'
            } else {
                // 兜底：从根记录的 metadata 中获取优化模式
                targetMode = chain.rootRecord.metadata?.optimizationMode || 'system'
            }

            // 根据根记录类型自动切换功能模式（支持新旧类型名）
            const isContext =
                rt === 'conversationMessageOptimize' ||
                rt === 'contextSystemOptimize' || // 旧类型名（向后兼容）
                rt === 'contextUserOptimize' ||
                rt === 'contextIterate'
            const targetFunctionMode: 'basic' | 'pro' = isContext ? 'pro' : 'basic'

            // 先切换功能模式,再设置子模式
            const needsFunctionModeSwitch = functionMode.value !== targetFunctionMode
            if (needsFunctionModeSwitch) {
                await setFunctionMode(targetFunctionMode)
                await nextTick() // 等待功能模式切换完成
            }

            // 获取目标功能模式的当前子模式
            const currentSubMode = (
                targetFunctionMode === 'pro' ? proSubMode.value : basicSubMode.value
            ) as OptimizationMode

            // 如果目标子模式与当前子模式不同,自动切换
            if (targetMode !== currentSubMode) {
                // 根据目标功能模式分别处理子模式的持久化
                if (targetFunctionMode === 'basic') {
                    await setBasicSubMode(targetMode as BasicSubMode)
                } else {
                    await setProSubMode(targetMode as ProSubMode)
                    await handleContextModeChange(targetMode as ContextMode)
                }

                toast.info(
                    t('toast.info.optimizationModeAutoSwitched', {
                        mode: targetMode === 'system' ? t('common.system') : t('common.user'),
                    }),
                )
            }

            // ❶ 调用原有的历史记录处理逻辑（更新全局 optimizer 状态）
            await handleSelectHistory(context)

            /**
             * ❷ Context User 专属：恢复组件内部状态
             */
            if (
                rt === 'contextUserOptimize' ||
                (targetFunctionMode === 'pro' && targetMode === 'user')
            ) {
                await nextTick()
                userWorkspaceRef.value?.restoreFromHistory?.({
                    record,
                    chain,
                    rootPrompt: context.rootPrompt,
                })
            }

            // 🆕 上下文-多消息模式专属：恢复消息级优化状态
            if (rt === 'conversationMessageOptimize' || rt === 'contextSystemOptimize') {
                await nextTick() // 等待基础状态恢复完成

                // 🆕 优先使用会话快照恢复完整会话（支持精确版本恢复）
                const conversationSnapshot = record.metadata?.conversationSnapshot
                if (conversationSnapshot && Array.isArray(conversationSnapshot)) {
                    console.log(
                        '[App] 从历史记录恢复会话快照，消息数:',
                        conversationSnapshot.length,
                    )

                    // 🆕 精确版本恢复：为每条消息加载其指定的版本
                    const restoredMessages = await Promise.all(
                        conversationSnapshot.map(async (snapshotMsg: any) => {
                            // 如果快照包含 chainId 和 appliedVersion，尝试精确恢复
                            if (
                                snapshotMsg.chainId &&
                                snapshotMsg.appliedVersion !== undefined &&
                                services.value?.historyManager
                            ) {
                                try {
                                    const msgChain = await services.value.historyManager.getChain(
                                        snapshotMsg.chainId,
                                    )

                                    // 1. V0 (Original) handling
                                    if (snapshotMsg.appliedVersion === 0) {
                                        const original =
                                            msgChain.versions[0]?.originalPrompt ||
                                            snapshotMsg.originalContent
                                        return {
                                            id: snapshotMsg.id,
                                            role: snapshotMsg.role,
                                            content: original,
                                            originalContent: original,
                                        }
                                    }

                                    // 2. V1+ (Optimized) handling
                                    // appliedVersion is persistent version number
                                    const targetVersion = msgChain.versions.find(
                                        (v: any) => v.version === snapshotMsg.appliedVersion,
                                    )

                                    if (targetVersion) {
                                        return {
                                            id: snapshotMsg.id,
                                            role: snapshotMsg.role,
                                            content: targetVersion.optimizedPrompt,
                                            originalContent:
                                                snapshotMsg.originalContent ||
                                                targetVersion.originalPrompt,
                                        }
                                    } else {
                                        console.warn(
                                            `[App] 消息 ${snapshotMsg.id} 版本 v${snapshotMsg.appliedVersion} 不存在，使用快照内容`,
                                        )
                                        console.warn(
                                            `[App] 可用版本:`,
                                            msgChain.versions.map((v: any) => v.version),
                                        )
                                    }
                                } catch (error) {
                                    console.warn(
                                        `[App] 消息 ${snapshotMsg.id} 版本加载失败，使用快照内容:`,
                                        error,
                                    )
                                }
                            }

                            // 回退策略：使用快照中保存的文本内容
                            return {
                                id: snapshotMsg.id,
                                role: snapshotMsg.role,
                                content: snapshotMsg.content,
                                originalContent: snapshotMsg.originalContent,
                            }
                        }),
                    )

                    optimizationContext.value = restoredMessages
                    await nextTick()
                }

                const messageId = record.metadata?.messageId
                const targetMessage = messageId
                    ? optimizationContext.value.find((msg) => msg.id === messageId)
                    : undefined

                await systemWorkspaceRef.value?.restoreFromHistory?.({
                    chain,
                    record,
                    conversationSnapshot,
                    message: targetMessage,
                })

                if (conversationSnapshot) {
                    if (targetMessage) {
                        toast.success(t('toast.success.conversationRestored'))
                    } else if (messageId) {
                        console.warn('[App] 会话快照中未找到被优化的消息 ID:', messageId)
                        toast.warning(t('toast.warning.messageNotFoundInSnapshot'))
                    }
                } else if (messageId) {
                    if (targetMessage) {
                        console.log(
                            '[App] 历史记录无会话快照，尝试在当前会话中查找消息（旧版本数据）',
                        )
                        toast.warning(t('toast.warning.restoredFromLegacyHistory'))
                    } else {
                        console.warn('[App] 旧版本历史记录中未找到消息 ID:', messageId)
                        toast.warning(t('toast.warning.messageNotFoundInSnapshot'))
                    }
                }
            }
        }
    }

    /**
     * 历史记录恢复的错误处理包装器
     */
    const handleHistoryReuse = async (context: HistoryContext) => {
        try {
            await handleHistoryReuseImpl(context)
        } catch (error) {
            // 捕获历史记录恢复过程中的所有错误
            console.error('[App] 历史记录恢复失败:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            toast.error(t('toast.error.historyRestoreFailed', { error: errorMessage }))
        }
    }

    return {
        handleHistoryReuse,
    }
}
