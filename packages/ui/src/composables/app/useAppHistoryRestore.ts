/**
 * App 级别历史记录恢复 Composable
 *
 * 负责从历史记录恢复时的智能模式切换和状态恢复逻辑。
 * 包括：
 * - 根据记录类型自动切换功能模式（basic/pro/image）
 * - 自动切换子模式（system/user）
 * - 恢复会话快照和消息级优化状态
 */

import { nextTick, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import type { ConversationMessage } from '../../types'
import type { ProMultiMessageSessionApi } from '../../stores/session/useProMultiMessageSession'
import type {
    PromptAssetBinding,
    ContextMode,
    PromptRecord,
    PromptRecordChain,
    IHistoryManager,
    OptimizationMode,
    PromptSessionOrigin,
} from '@prompt-optimizer/core'
import { extractHistorySourceBinding } from '../../utils/history-source-binding'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object'

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
    restoreFromHistory?: (payload: unknown) => void | Promise<void>
}

/**
 * useAppHistoryRestore 的配置选项
 */
export interface AppHistoryRestoreOptions {
    /** 服务实例 */
    services: Ref<{ historyManager: IHistoryManager } | null>
    /** 🔧 Step D: 路由导航函数（替代 setFunctionMode/set*SubMode） */
    beforeApplyToWorkspace?: (targetKey: string) => Promise<boolean>
    navigateToSubModeKey: (toKey: string, opts?: { replace?: boolean }) => boolean | void | Promise<boolean | void>
    /** 处理上下文模式变更 */
    handleContextModeChange: (mode: ContextMode) => Promise<void>
    /** 处理历史记录选择 */
    handleSelectHistory: (context: HistoryContext) => Promise<void>
    /** Pro-multi 会话（多消息会话：消息列表在此持久化，避免写入 optimizationContext） */
    proMultiMessageSession: ProMultiMessageSessionApi
    /** 系统工作区组件引用 */
    systemWorkspaceRef: Ref<WorkspaceRef | null>
    /** 用户工作区组件引用 */
    userWorkspaceRef: Ref<WorkspaceRef | null>
    /** i18n 翻译函数 */
    t: (key: string, params?: Record<string, unknown>) => string
    /** 外部数据加载中标志（防止模式切换的自动 restore 覆盖外部数据） */
    isLoadingExternalData: Ref<boolean>
    /** 将历史记录中的来源资产坐标恢复到目标工作区 session */
    restoreSourceBindingForTargetKey?: (
        targetKey: string,
        state: { assetBinding?: PromptAssetBinding; origin?: PromptSessionOrigin },
    ) => void
    /** Persist the target workspace session after a history restore writes its session pointers. */
    saveSessionForTargetKey?: (targetKey: string) => void | Promise<void>
}

type ConversationSnapshotMessage = {
    id: string
    role: ConversationMessage['role']
    content: string
    originalContent?: string
    chainId?: string
    appliedVersion?: number
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
        navigateToSubModeKey,
        beforeApplyToWorkspace,
        handleContextModeChange,
        handleSelectHistory,
        proMultiMessageSession,
        systemWorkspaceRef,
        userWorkspaceRef,
        t,
        isLoadingExternalData,
        restoreSourceBindingForTargetKey,
        saveSessionForTargetKey,
    } = options

    const toast = useToast()

    const persistRestoredSession = async (targetKey: string) => {
        if (!saveSessionForTargetKey) return

        try {
            await saveSessionForTargetKey(targetKey)
        } catch (error) {
            console.error(`[App] Failed to save restored history session for ${targetKey}:`, error)
            toast.warning(t('toast.warning.saveHistoryFailed'))
        }
    }

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
            rt === 'image2imageOptimize' ||
            rt === 'multiimageOptimize'
        ) {
            // 图像模式：使用 navigateToSubModeKey 导航
            // 根据记录类型设置正确的图像子模式
            const meta = (isRecord(record.metadata) ? record.metadata : null) ??
                (isRecord(chain.rootRecord.metadata) ? chain.rootRecord.metadata : null)
            const hasInputImage = isRecord(meta) && meta.hasInputImage === true
            const imageMode =
                rt === 'text2imageOptimize'
                    ? 'text2image'
                    : rt === 'image2imageOptimize'
                      ? 'image2image'
                      : rt === 'multiimageOptimize'
                        ? 'multiimage'
                      : hasInputImage
                        ? 'image2image'
                        : 'text2image' // 默认为文生图模式

            // 🔧 Step D: 使用 navigateToSubModeKey 替代 setImageSubMode
            const targetKey = `image-${imageMode}`
            if (beforeApplyToWorkspace && !(await beforeApplyToWorkspace(targetKey))) return
            const didNavigate = await navigateToSubModeKey(targetKey)
            if (didNavigate === false) {
                throw new Error(`Invalid image workspace target: ${targetKey}`)
            }
            toast.info(t('toast.info.switchedToImageMode'))

            // 🆕 图像模式专用数据回填逻辑
            // 等待路由切换完成后再回填数据
            await nextTick()
            restoreSourceBindingForTargetKey?.(
                targetKey,
                extractHistorySourceBinding(record, chain),
            )

            // 🆕 图像模式专用数据回填逻辑
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

            await persistRestoredSession(targetKey)
            toast.success(t('toast.success.imageHistoryRestored'))
            return // 图像模式不需要调用原有的历史记录处理逻辑
        } else {
            // 根据链条的根记录类型自动切换功能模式（支持新旧类型名）
            const isContext =
                rt === 'conversationMessageOptimize' ||
                rt === 'contextSystemOptimize' || // 旧类型名（向后兼容）
                rt === 'contextUserOptimize' ||
                rt === 'contextIterate'
            const targetFunctionMode: 'basic' | 'pro' = isContext ? 'pro' : 'basic'

            // 根据根记录类型确定应该切换到的优化模式
            let targetMode: OptimizationMode
            if (rt === 'optimize' || rt === 'conversationMessageOptimize') {
                targetMode = 'system'
            } else if (rt === 'userOptimize' || rt === 'contextUserOptimize') {
                targetMode = 'user'
            } else {
                // 兜底：从根记录的 metadata 中获取优化模式
                targetMode = chain.rootRecord.metadata?.optimizationMode || 'system'
            }

            // 🔧 Step D: 使用 navigateToSubModeKey 一次性导航到目标路由
            // 不再分两步（先切 functionMode 再切 subMode）
            const targetKey =
                targetFunctionMode === 'pro'
                    ? `pro-${targetMode === 'system' ? 'multi' : 'variable'}`
                    : `basic-${targetMode}`
            if (beforeApplyToWorkspace && !(await beforeApplyToWorkspace(targetKey))) return
            const didNavigate = await navigateToSubModeKey(targetKey)
            if (didNavigate === false) {
                throw new Error(`Invalid workspace target: ${targetKey}`)
            }

            // 等待路由切换完成
            await nextTick()
            restoreSourceBindingForTargetKey?.(
                targetKey,
                extractHistorySourceBinding(record, chain),
            )

            // 更新 toast 提示（如果需要）
            toast.info(
                t('toast.info.optimizationModeAutoSwitched', {
                    mode: targetMode === 'system' ? t('common.system') : t('common.user'),
                }),
            )

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
                await userWorkspaceRef.value?.restoreFromHistory?.({
                    record,
                    chain,
                    rootPrompt: context.rootPrompt,
                })
            }

            // 🆕 上下文-多消息模式专属：恢复消息级优化状态
            if (rt === 'conversationMessageOptimize' || rt === 'contextSystemOptimize') {
                await nextTick() // 等待基础状态恢复完成

                // 🆕 优先使用会话快照恢复完整会话（支持精确版本恢复）
                let conversationSnapshot:
                    | ConversationSnapshotMessage[]
                    | undefined
                const conversationSnapshotRaw: unknown =
                    record.metadata?.conversationSnapshot
                if (conversationSnapshotRaw && Array.isArray(conversationSnapshotRaw)) {
                    conversationSnapshot =
                        conversationSnapshotRaw as ConversationSnapshotMessage[]
                    console.log(
                        '[App] Restoring conversation snapshot from history. Message count:',
                        conversationSnapshot.length,
                    )

                    // 🆕 精确版本恢复：为每条消息加载其指定的版本
                const restoredMessages = await Promise.all(
                        conversationSnapshot.map(async (snapshotMsg) => {
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
                                            msgChain.versions[0]?.originalPrompt ??
                                            snapshotMsg.originalContent ??
                                            snapshotMsg.content ??
                                            ''
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
                                        (v) => v.version === snapshotMsg.appliedVersion,
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
                                            `[App] Message ${snapshotMsg.id} version v${snapshotMsg.appliedVersion} was not found. Falling back to snapshot content.`,
                                        )
                                        console.warn(
                                            '[App] Available versions:',
                                            msgChain.versions.map((v) => v.version),
                                        )
                                    }
                                } catch (error) {
                                    console.warn(
                                        `[App] Failed to load version for message ${snapshotMsg.id}. Falling back to snapshot content:`,
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

                    // Pro-multi: session-owned messages
                    proMultiMessageSession.updateConversationMessages(restoredMessages)

                    // Persist message→chain mapping for Pro-multi (so refresh / mode-switch keeps links).
                    const mapRecord: Record<string, string> = {}
                    for (const msg of conversationSnapshot) {
                        if (msg.id && msg.chainId) {
                            mapRecord[msg.id] = msg.chainId
                        }
                    }
                    if (Object.keys(mapRecord).length > 0) {
                        proMultiMessageSession.setMessageChainMap(mapRecord)
                    }
                    await nextTick()
                }

                const messageId = record.metadata?.messageId
                const targetMessage = messageId
                    ? (proMultiMessageSession.conversationMessagesSnapshot || []).find((msg) => msg.id === messageId)
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
                        console.warn('[App] Optimized message ID was not found in the conversation snapshot:', messageId)
                        toast.warning(t('toast.warning.messageNotFoundInSnapshot'))
                    }
                } else if (messageId) {
                    if (targetMessage) {
                        console.log(
                            '[App] No conversation snapshot found in history. Trying to locate the message in the current session (legacy data).',
                        )
                        toast.warning(t('toast.warning.restoredFromLegacyHistory'))
                    } else {
                        console.warn('[App] Message ID was not found in legacy history data:', messageId)
                        toast.warning(t('toast.warning.messageNotFoundInSnapshot'))
                    }
                }
            }

            await persistRestoredSession(targetKey)
        }
    }

    /**
     * 历史记录恢复的错误处理包装器
     */
    const handleHistoryReuse = async (context: HistoryContext) => {
        try {
            // 🔧 设置外部数据加载标志，防止模式切换的自动 restore 覆盖外部数据
            isLoadingExternalData.value = true

            await handleHistoryReuseImpl(context)
        } catch (error) {
            // 捕获历史记录恢复过程中的所有错误
            console.error('[App] Failed to restore history:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            toast.error(t('toast.error.historyRestoreFailed', { error: errorMessage }))
        } finally {
            // 🔧 恢复完成，重置标志，允许正常的模式切换 restore
            isLoadingExternalData.value = false
        }
    }

    return {
        handleHistoryReuse,
    }
}
