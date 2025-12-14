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
    /** 优化器提示词（用于设置收藏内容） */
    optimizerPrompt: Ref<string>
    /** i18n 翻译函数 */
    t: (key: string, params?: Record<string, any>) => string
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
        functionMode,
        setFunctionMode,
        basicSubMode,
        setBasicSubMode,
        proSubMode,
        setProSubMode,
        handleContextModeChange,
        optimizerPrompt,
        t,
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
     * 处理使用收藏 - 智能模式切换
     */
    const handleUseFavorite = async (favorite: FavoriteItem) => {
        const {
            functionMode: favFunctionMode,
            optimizationMode: favOptimizationMode,
            imageSubMode: favImageSubMode,
        } = favorite

        // 1. 切换功能模式
        if (favFunctionMode === 'image') {
            // 图像模式:只在不是图像模式时才切换
            const needsSwitch = functionMode.value !== 'image'
            if (needsSwitch) {
                await setFunctionMode('image')
                toast.info(t('toast.info.switchedToImageMode'))
            }

            // 图像模式的数据回填逻辑
            await nextTick()

            // 触发图像工作区数据回填事件
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
        } else {
            // 基础模式或上下文模式

            // 2. 确定目标功能模式并先切换
            // 'pro' 和 'context' 都映射到上下文模式（兼容历史数据）
            const targetFunctionMode = (favFunctionMode === 'context' || favFunctionMode === 'pro') ? 'pro' : 'basic'

            // 3. 先切换功能模式
            if (targetFunctionMode !== functionMode.value) {
                await setFunctionMode(targetFunctionMode)
                await nextTick() // 等待功能模式切换完成
                toast.info(
                    t('toast.info.switchedToFunctionMode', {
                        mode: targetFunctionMode === 'pro' ? t('common.context') : t('common.basic'),
                    }),
                )
            }

            // 4. 获取目标功能模式的当前子模式
            const currentSubMode = (
                targetFunctionMode === 'pro' ? proSubMode.value : basicSubMode.value
            ) as OptimizationMode

            // 5. 如果目标模式与目标功能模式的子模式不同，切换子模式
            if (favOptimizationMode && favOptimizationMode !== currentSubMode) {
                if (targetFunctionMode === 'basic') {
                    // 基础模式：持久化子模式选择
                    await setBasicSubMode(favOptimizationMode as BasicSubMode)
                } else {
                    // 上下文模式：持久化子模式并同步 contextMode
                    await setProSubMode(favOptimizationMode as ProSubMode)
                    await handleContextModeChange(favOptimizationMode as ContextMode)
                }

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
        }

        // 关闭收藏管理对话框
        showFavoriteManager.value = false

        // 显示成功提示
        toast.success(t('toast.success.favoriteLoaded'))
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
