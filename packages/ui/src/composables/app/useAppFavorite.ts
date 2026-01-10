/**
 * App 级别收藏管理 Composable
 *
 * 负责收藏相关的业务逻辑，包括：
 * - 保存收藏
 * - 使用收藏（智能模式切换）
 * - 收藏对话框管理
 */

import { ref, nextTick, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import type { BasicSubMode, ProSubMode, ContextMode, OptimizationMode } from '@prompt-optimizer/core'

/**
 * 保存收藏的数据结构
 */
export interface SaveFavoriteData {
    content: string
    originalContent?: string
}

/**
 * 收藏项数据结构
 */
export interface FavoriteItem {
    content: string
    functionMode?: 'basic' | 'pro' | 'image' | 'context'
    optimizationMode?: OptimizationMode
    imageSubMode?: 'text2image' | 'image2image'
    metadata?: Record<string, any>
}

/**
 * useAppFavorite 的配置选项
 */
export interface AppFavoriteOptions {
    /** 🔧 Step D: 路由导航函数（替代 setFunctionMode/set*SubMode） */
    navigateToSubModeKey: (toKey: string, opts?: { replace?: boolean }) => void
    /** 处理上下文模式变更 */
    handleContextModeChange: (mode: ContextMode) => Promise<void>
    /** 优化器提示词（用于设置收藏内容） */
    optimizerPrompt: Ref<string>
    /** i18n 翻译函数 */
    t: (key: string, params?: Record<string, any>) => string
    /** 外部数据加载中标志（防止模式切换的自动 restore 覆盖外部数据） */
    isLoadingExternalData: Ref<boolean>
}

/**
 * useAppFavorite 的返回值
 */
export interface AppFavoriteReturn {
    /** 显示收藏管理对话框 */
    showFavoriteManager: Ref<boolean>
    /** 显示保存收藏对话框 */
    showSaveFavoriteDialog: Ref<boolean>
    /** 保存收藏数据 */
    saveFavoriteData: Ref<SaveFavoriteData | null>
    /** 处理保存收藏请求 */
    handleSaveFavorite: (data: SaveFavoriteData) => void
    /** 处理保存完成 */
    handleSaveFavoriteComplete: () => void
    /** 处理收藏优化提示词 */
    handleFavoriteOptimizePrompt: () => void
    /** 处理使用收藏 */
    handleUseFavorite: (favorite: FavoriteItem) => Promise<void>
}

/**
 * App 级别收藏管理 Composable
 */
export function useAppFavorite(options: AppFavoriteOptions): AppFavoriteReturn {
    const {
        navigateToSubModeKey,
        handleContextModeChange,
        optimizerPrompt,
        t,
        isLoadingExternalData,
    } = options

    const toast = useToast()

    // 状态
    const showFavoriteManager = ref(false)
    const showSaveFavoriteDialog = ref(false)
    const saveFavoriteData = ref<SaveFavoriteData | null>(null)

    /**
     * 处理保存收藏请求
     */
    const handleSaveFavorite = (data: SaveFavoriteData) => {
        // 保存数据用于对话框预填充
        saveFavoriteData.value = data

        // 打开保存对话框
        showSaveFavoriteDialog.value = true
    }

    /**
     * 处理保存完成
     */
    const handleSaveFavoriteComplete = () => {
        // 关闭对话框已由组件内部处理
        // 可选:刷新收藏列表或显示额外提示
    }

    /**
     * 处理收藏优化提示词
     */
    const handleFavoriteOptimizePrompt = () => {
        // 关闭收藏管理对话框
        showFavoriteManager.value = false
        // 滚动到优化区域
        nextTick(() => {
            const inputPanel = document.querySelector('[data-input-panel]')
            if (inputPanel) {
                inputPanel.scrollIntoView({ behavior: 'smooth' })
            }
        })
    }

    /**
     * 处理使用收藏 - 智能模式切换（内部实现）
     */
    const handleUseFavoriteImpl = async (favorite: FavoriteItem) => {
        const {
            functionMode: favFunctionMode,
            optimizationMode: favOptimizationMode,
            imageSubMode: favImageSubMode,
        } = favorite

        // 🔧 Step D: 使用 navigateToSubModeKey 一次性导航到目标路由
        // 不再分两步（先切 functionMode 再切 subMode）

        if (favFunctionMode === 'image') {
            // 图像模式：根据 favImageSubMode 确定目标子模式（默认 text2image）
            const targetSubMode = favImageSubMode || 'text2image'
            const targetKey = `image-${targetSubMode}`

            navigateToSubModeKey(targetKey)
            toast.info(t('toast.info.switchedToImageMode'))

            await nextTick()

            // 图像模式的数据回填逻辑
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('image-workspace-restore-favorite', {
                        detail: {
                            content: favorite.content,
                            imageSubMode: favImageSubMode || 'text2image',
                            metadata: favorite.metadata,
                        },
                    }),
                )
            }

            toast.success(t('toast.success.imageFavoriteLoaded'))
        } else if (favFunctionMode === 'basic' || favFunctionMode === 'context' || favFunctionMode === 'pro') {
            // 基础模式或上下文模式

            // 1. 确定目标功能模式
            // 'pro' 和 'context' 都映射到 pro（兼容历史数据）
            const targetFunctionMode = (favFunctionMode === 'context' || favFunctionMode === 'pro') ? 'pro' : 'basic'

            // 2. 确定目标子模式（如果收藏指定了优化模式）
            // - basic: system/user
            // - pro: multi/variable（兼容旧 optimizationMode: system->multi, user->variable）
            let targetSubMode: BasicSubMode | ProSubMode
            if (targetFunctionMode === 'pro') {
                const mode = favOptimizationMode ?? 'user'
                targetSubMode = mode === 'system' ? 'multi' : 'variable'
            } else {
                targetSubMode = (favOptimizationMode ?? 'system') as BasicSubMode
            }

            // 3. 一次性导航到目标路由
            const targetKey = `${targetFunctionMode}-${targetSubMode}`
            navigateToSubModeKey(targetKey)

            await nextTick()

            // 4. 如果是 pro 模式，需要同步 contextMode（兼容旧逻辑）
            if (targetFunctionMode === 'pro' && favOptimizationMode) {
                await handleContextModeChange(favOptimizationMode as ContextMode)
            }

            toast.info(
                t('toast.info.switchedToFunctionMode', {
                    mode: targetFunctionMode === 'pro' ? t('common.context') : t('common.basic'),
                }),
            )

            if (favOptimizationMode) {
                toast.info(
                    t('toast.info.optimizationModeAutoSwitched', {
                        mode:
                            favOptimizationMode === 'system'
                                ? t('common.system')
                                : t('common.user'),
                    }),
                )
            }

            // 5. 将收藏的提示词内容设置到输入框
            optimizerPrompt.value = favorite.content
        } else {
            // 其他情况：直接设置内容，不切换模式
            optimizerPrompt.value = favorite.content
        }

        // 关闭收藏管理对话框
        showFavoriteManager.value = false

        // 显示成功提示
        toast.success(t('toast.success.favoriteLoaded'))
    }

    /**
     * 收藏加载的错误处理包装器
     */
    const handleUseFavorite = async (favorite: FavoriteItem) => {
        try {
            // 🔧 设置外部数据加载标志，防止模式切换的自动 restore 覆盖外部数据
            isLoadingExternalData.value = true

            await handleUseFavoriteImpl(favorite)
        } catch (error) {
            // 捕获收藏加载过程中的所有错误
            console.error('[App] 收藏加载失败:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            toast.error(t('toast.error.favoriteLoadFailed', { error: errorMessage }))
        } finally {
            // 🔧 恢复完成，重置标志，允许正常的模式切换 restore
            isLoadingExternalData.value = false
        }
    }

    return {
        showFavoriteManager,
        showSaveFavoriteDialog,
        saveFavoriteData,
        handleSaveFavorite,
        handleSaveFavoriteComplete,
        handleFavoriteOptimizePrompt,
        handleUseFavorite,
    }
}
