/**
 * App 级别收藏管理 Composable
 *
 * 负责收藏相关的业务逻辑，包括：
 * - 保存收藏
 * - 使用收藏（智能模式切换）
 * - 收藏对话框管理
 */

import { isRef, ref, nextTick, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import type {
    BasicSubMode,
    ConversationMessage,
    ProSubMode,
    ContextMode,
    IFavoriteManager,
    IImageStorageService,
    OptimizationMode,
    PromptAssetBinding,
    PromptRecordChain,
    PromptSessionOrigin,
} from '@prompt-optimizer/core'
import { isValidVariableName, VARIABLE_VALIDATION } from '../../types/variable'
import {
    applyFavoriteReproducibilityToMetadata,
    assignSequentialFavoriteExampleIds,
    type FavoriteReproducibilityDraft,
    type FavoriteReproducibilityVariable,
    type FavoriteReproducibilityExample,
} from '../../utils/favorite-reproducibility'
import {
    createFavoriteWorkspaceApplyDraft,
    type FavoriteWorkspaceApplyDraft,
} from '../../utils/favorite-workspace-apply'
import {
    normalizeImageSourceToPayload,
    resolveAssetIdToDataUrl,
    type ImagePayload,
} from '../../utils/image-asset-storage'
import {
    applyWorkspaceTemporaryVariables,
    buildWorkspaceConversationFromPromptText,
    clearWorkspaceContentForExternalApply,
} from '../../utils/workspace-external-apply'
import {
    buildFavoriteSessionBinding,
    resolveSourceAssetRef,
    type SourceAssetRef,
} from '../../utils/source-asset'

/**
 * 保存收藏的数据结构
 */
export interface SaveFavoriteData {
    content: string
    originalContent?: string
    candidateSource?: SourceAssetRef | null
    prefill?: {
        title?: string
        description?: string
        category?: string
        tags?: string[]
        functionMode?: 'basic' | 'context' | 'image'
        optimizationMode?: OptimizationMode
        imageSubMode?: 'text2image' | 'image2image' | 'multiimage'
        metadata?: Record<string, unknown>
        reproducibilityDraft?: FavoriteReproducibilityDraft
        updateIntent?: 'content' | 'examples'
    }
}

/**
 * 收藏项数据结构
 */
export interface FavoriteItem {
    id?: string
    title?: string
    content: string
    functionMode?: 'basic' | 'pro' | 'image' | 'context'
    optimizationMode?: OptimizationMode
    imageSubMode?: 'text2image' | 'image2image' | 'multiimage'
    metadata?: Record<string, unknown>
}

export interface UseFavoriteOptions {
    applyExample?: boolean
    exampleId?: string
    exampleIndex?: number
}

type TemporaryVariablesSessionApi = {
    getTemporaryVariable: (name: string) => string | undefined
    setTemporaryVariable: (name: string, value: string) => void
    clearTemporaryVariables: () => void
    clearContent?: (options?: { persist?: boolean }) => void
    updatePrompt?: (prompt: string) => void
    updateTestContent?: (content: string) => void
    updateAssetBinding?: (binding: PromptAssetBinding | undefined, origin?: PromptSessionOrigin) => void
    clearAssetBinding?: () => void
    assetBinding?: PromptAssetBinding
    origin?: PromptSessionOrigin
    temporaryVariables?: Record<string, string> | { value?: Record<string, string> }
}

type ProMultiMessageSessionApi = TemporaryVariablesSessionApi & {
    updateConversationMessages?: (messages: ConversationMessage[]) => void
    selectMessage?: (messageId: string) => void
    setMessageChainMap?: (map: Record<string, string>) => void
}

type AssetBindingSessionApi = {
    clearContent?: (options?: { persist?: boolean }) => void
    updatePrompt?: (prompt: string) => void
    updateAssetBinding?: (binding: PromptAssetBinding | undefined, origin?: PromptSessionOrigin) => void
    clearAssetBinding?: () => void
    assetBinding?: PromptAssetBinding
    origin?: PromptSessionOrigin
    updateTestContent?: (content: string) => void
    updateTestImage?: (b64: string | null, mimeType?: string, assetId?: string | null) => void
}

type Image2ImageExampleSessionApi = TemporaryVariablesSessionApi & {
    updateInputImage: (b64: string | null, mimeType?: string) => void
}

type MultiImageExampleSessionApi = TemporaryVariablesSessionApi & {
    replaceInputImages: (images: ImagePayload[]) => void
    inputImages?: Array<Record<string, unknown>> | { value?: Array<Record<string, unknown>> }
}

/**
 * useAppFavorite 的配置选项
 */
export interface AppFavoriteOptions {
    /** 🔧 Step D: 路由导航函数（替代 setFunctionMode/set*SubMode） */
    navigateToSubModeKey: (toKey: string, opts?: { replace?: boolean }) => boolean | void | Promise<boolean | void>
    /** 处理上下文模式变更 */
    handleContextModeChange: (mode: ContextMode) => Promise<void>
    /** 优化器提示词（用于设置收藏内容） */
    optimizerPrompt: Ref<string>
    /** i18n 翻译函数 */
    t: (key: string, params?: Record<string, unknown>) => string
    /** 外部数据加载中标志（防止模式切换的自动 restore 覆盖外部数据） */
    isLoadingExternalData: Ref<boolean>
    /** 高级/图像模式临时变量会话，用于应用收藏示例参数 */
    basicSystemSession?: AssetBindingSessionApi
    basicUserSession?: AssetBindingSessionApi
    proMultiMessageSession?: ProMultiMessageSessionApi
    proVariableSession?: TemporaryVariablesSessionApi
    imageText2ImageSession?: TemporaryVariablesSessionApi
    imageImage2ImageSession?: Image2ImageExampleSessionApi
    imageMultiImageSession?: MultiImageExampleSessionApi
    optimizerCurrentVersions?: Ref<PromptRecordChain['versions']>
    getFavoriteImageStorageService?: () => IImageStorageService | null
    getFavoriteManager?: () => IFavoriteManager | null
    getCurrentFunctionMode?: () => 'basic' | 'pro' | 'context' | 'image'
    getCurrentOptimizationMode?: () => OptimizationMode
    getCurrentImageSubMode?: () => 'text2image' | 'image2image' | 'multiimage'
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
    handleSaveFavoriteComplete: (favoriteId?: string) => Promise<void>
    /** 处理收藏优化提示词 */
    handleFavoriteOptimizePrompt: () => void
    /** 处理使用收藏 */
    handleUseFavorite: (favorite: FavoriteItem, options?: UseFavoriteOptions) => Promise<boolean>
}

const readMaybeRef = <T>(value: T | { value?: T } | undefined): T | undefined => {
    if (isRef(value)) {
        return value.value as T | undefined
    }
    return value as T | undefined
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const hasCallerReproducibilityMetadata = (metadata: Record<string, unknown>): boolean =>
    isPlainObject(metadata.gardenSnapshot) ||
    isPlainObject(metadata.reproducibility) ||
    isPlainObject(metadata.variables) ||
    Array.isArray(metadata.variables) ||
    Array.isArray(metadata.examples)

const readTemporaryVariableNames = (session?: TemporaryVariablesSessionApi): string[] => {
    const raw = readMaybeRef(session?.temporaryVariables)
    if (!isPlainObject(raw)) return []

    const names: string[] = []
    for (const [name, value] of Object.entries(raw)) {
        if (isValidVariableName(name) && typeof value === 'string') {
            names.push(name)
        }
    }
    return names
}

const extractVariableNames = (...texts: Array<string | undefined>): string[] => {
    const names: string[] = []
    const seen = new Set<string>()

    for (const text of texts) {
        if (!text) continue
        const regex = new RegExp(VARIABLE_VALIDATION.VARIABLE_SCAN_PATTERN.source, 'gu')
        let match: RegExpExecArray | null
        while ((match = regex.exec(text)) !== null) {
            const name = match[1]?.trim()
            if (!name || seen.has(name) || !isValidVariableName(name)) continue
            seen.add(name)
            names.push(name)
        }
    }

    return names
}

const buildVariables = (
    content: string,
    temporaryVariableNames: string[],
): FavoriteReproducibilityVariable[] => {
    const names = new Set([
        ...extractVariableNames(content),
        ...temporaryVariableNames.filter(isValidVariableName),
    ])

    return Array.from(names).map((name) => ({
        name,
        required: false,
        options: [],
        source: 'workspace',
    }))
}

const mergeReproducibilityVariables = (
    baseVariables: FavoriteReproducibilityVariable[],
    draftVariables: FavoriteReproducibilityVariable[] | undefined,
): FavoriteReproducibilityVariable[] => {
    const variablesByName = new Map<string, FavoriteReproducibilityVariable>()

    for (const variable of baseVariables) {
        variablesByName.set(variable.name, variable)
    }

    for (const variable of draftVariables || []) {
        const name = typeof variable.name === 'string' ? variable.name.trim() : ''
        if (!name || !isValidVariableName(name)) continue
        variablesByName.set(name, {
            ...variable,
            name,
            options: [...(variable.options || [])],
        })
    }

    return Array.from(variablesByName.values())
}

const hasReproducibilityDraftData = (draft: FavoriteReproducibilityDraft | undefined): draft is FavoriteReproducibilityDraft =>
    Boolean(draft && (draft.variables.length > 0 || draft.examples.length > 0))

const buildSaveFavoriteReproducibilityPrefill = (
    baseMetadata: Record<string, unknown>,
    workspaceVariables: FavoriteReproducibilityVariable[],
    explicitDraft?: FavoriteReproducibilityDraft,
): {
    metadata: Record<string, unknown>
    reproducibilityDraft?: FavoriteReproducibilityDraft
} => {
    const metadata = hasCallerReproducibilityMetadata(baseMetadata)
        ? baseMetadata
        : applyFavoriteReproducibilityToMetadata(baseMetadata, {
            variables: workspaceVariables,
            examples: [],
        })

    if (!hasReproducibilityDraftData(explicitDraft)) {
        return { metadata }
    }

    const normalizedDraft = {
        variables: explicitDraft.variables,
        examples: assignSequentialFavoriteExampleIds([], explicitDraft.examples),
    }

    return {
        metadata: applyFavoriteReproducibilityToMetadata(metadata, {
            variables: mergeReproducibilityVariables(workspaceVariables, normalizedDraft.variables),
            examples: normalizedDraft.examples,
        }),
        reproducibilityDraft: normalizedDraft,
    }
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
        basicSystemSession,
        basicUserSession,
        proMultiMessageSession,
        proVariableSession,
        imageText2ImageSession,
        imageImage2ImageSession,
        imageMultiImageSession,
        optimizerCurrentVersions,
        getFavoriteImageStorageService,
        getFavoriteManager,
        getCurrentFunctionMode,
        getCurrentOptimizationMode,
        getCurrentImageSubMode,
    } = options

    const toast = useToast()

    // 状态
    const showFavoriteManager = ref(false)
    const showSaveFavoriteDialog = ref(false)
    const saveFavoriteData = ref<SaveFavoriteData | null>(null)

    /**
     * 处理保存收藏请求
     */
    const getSessionForCurrentMode = (
        functionMode: 'basic' | 'pro' | 'context' | 'image',
        optimizationMode: OptimizationMode,
        imageSubMode?: 'text2image' | 'image2image' | 'multiimage',
    ): TemporaryVariablesSessionApi | null => {
        if (functionMode === 'pro' || functionMode === 'context') {
            return optimizationMode === 'system' ? proMultiMessageSession || null : proVariableSession || null
        }

        if (functionMode === 'image') {
            if (imageSubMode === 'image2image') return imageImage2ImageSession || null
            if (imageSubMode === 'multiimage') return imageMultiImageSession || null
            return imageText2ImageSession || null
        }

        return null
    }

    const getAssetBindingSessionForMode = (
        functionMode: 'basic' | 'pro' | 'context' | 'image',
        optimizationMode: OptimizationMode,
        imageSubMode?: 'text2image' | 'image2image' | 'multiimage',
    ): AssetBindingSessionApi | null => {
        if (functionMode === 'basic') {
            return optimizationMode === 'system'
                ? basicSystemSession || null
                : basicUserSession || null
        }

        return getSessionForCurrentMode(functionMode, optimizationMode, imageSubMode) as AssetBindingSessionApi | null
    }

    const buildSaveFavoriteData = (data: SaveFavoriteData): SaveFavoriteData => {
        const currentFunctionMode = getCurrentFunctionMode?.() || 'basic'
        const currentOptimizationMode = getCurrentOptimizationMode?.() || 'system'
        const currentImageSubMode = getCurrentImageSubMode?.() || 'text2image'
        const favoriteFunctionMode = data.prefill?.functionMode || (currentFunctionMode === 'image' ? 'image' : currentFunctionMode === 'pro' || currentFunctionMode === 'context' ? 'context' : 'basic')
        const favoriteOptimizationMode = favoriteFunctionMode === 'image'
            ? undefined
            : data.prefill?.optimizationMode || currentOptimizationMode
        const favoriteImageSubMode = favoriteFunctionMode === 'image'
            ? data.prefill?.imageSubMode || currentImageSubMode
            : undefined
        const session = getSessionForCurrentMode(currentFunctionMode, currentOptimizationMode, currentImageSubMode)
        const assetBindingSession = getAssetBindingSessionForMode(
            currentFunctionMode,
            currentOptimizationMode,
            currentImageSubMode,
        )
        const candidateSource = data.candidateSource ?? resolveSourceAssetRef(
            assetBindingSession?.origin,
            assetBindingSession?.assetBinding,
        )
        const variables = buildVariables(data.content, readTemporaryVariableNames(session || undefined))
        const baseMetadata = isPlainObject(data.prefill?.metadata)
            ? data.prefill.metadata
            : {}
        const {
            metadata: finalMetadata,
            reproducibilityDraft: normalizedExplicitDraft,
        } = buildSaveFavoriteReproducibilityPrefill(
            baseMetadata,
            variables,
            data.prefill?.reproducibilityDraft,
        )

        return {
            ...data,
            candidateSource,
            prefill: {
                ...data.prefill,
                functionMode: favoriteFunctionMode,
                optimizationMode: favoriteOptimizationMode,
                imageSubMode: favoriteImageSubMode,
                metadata: finalMetadata,
                reproducibilityDraft: normalizedExplicitDraft,
            },
        }
    }

    const handleSaveFavorite = (data: SaveFavoriteData) => {
        // 保存数据用于对话框预填充
        saveFavoriteData.value = buildSaveFavoriteData(data)

        // 打开保存对话框
        showSaveFavoriteDialog.value = true
    }

    /**
     * 处理保存完成
     */
    const handleSaveFavoriteComplete = async (favoriteId?: string) => {
        if (!favoriteId) return
        const favoriteManager = getFavoriteManager?.() || null
        if (!favoriteManager) return

        try {
            const favorites = await favoriteManager.getFavorites()
            const favorite = favorites.find((item) => item.id === favoriteId)
            if (!favorite) return

            const currentFunctionMode = getCurrentFunctionMode?.() || 'basic'
            const currentOptimizationMode = getCurrentOptimizationMode?.() || 'system'
            const currentImageSubMode = getCurrentImageSubMode?.() || 'text2image'
            const session = getAssetBindingSessionForMode(currentFunctionMode, currentOptimizationMode, currentImageSubMode)
            if (!session?.updateAssetBinding) return

            const { binding, origin } = buildFavoriteSessionBinding(favorite)
            session.updateAssetBinding(binding, origin)
        } catch (error) {
            console.warn('[App] Failed to bind saved favorite to current session:', error)
        }
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
    const getTemporaryVariablesSession = (targetKey: string | null): TemporaryVariablesSessionApi | null => {
        switch (targetKey) {
            case 'pro-multi':
                return proMultiMessageSession || null
            case 'pro-variable':
                return proVariableSession || null
            case 'image-text2image':
                return imageText2ImageSession || null
            case 'image-image2image':
                return imageImage2ImageSession || null
            case 'image-multiimage':
                return imageMultiImageSession || null
            default:
                return null
        }
    }

    const getAssetBindingSession = (targetKey: string | null): AssetBindingSessionApi | null => {
        switch (targetKey) {
            case 'basic-system':
                return basicSystemSession || null
            case 'basic-user':
                return basicUserSession || null
            default:
                return getTemporaryVariablesSession(targetKey)
        }
    }

    const getExampleTextSession = (
        targetKey: string | null,
    ): { updateTestContent?: (content: string) => void } | null => {
        switch (targetKey) {
            case 'basic-system':
                return basicSystemSession || null
            case 'basic-user':
                return basicUserSession || null
            case 'pro-variable':
                return proVariableSession || null
            default:
                return null
        }
    }

    const withMetadataValue = (
        metadata: Record<string, unknown>,
        key: string,
        value: unknown,
    ) => {
        if (value === undefined || value === null || value === '') return
        metadata[key] = value
    }

    const buildFavoriteSessionOrigin = (
        favorite: FavoriteItem,
        draft: FavoriteWorkspaceApplyDraft,
        targetKey: string | null,
    ): PromptSessionOrigin => {
        const metadata: Record<string, unknown> = {}
        withMetadataValue(metadata, 'targetKey', targetKey)
        withMetadataValue(metadata, 'title', favorite.title)
        withMetadataValue(metadata, 'functionMode', favorite.functionMode)
        withMetadataValue(metadata, 'optimizationMode', favorite.optimizationMode)
        withMetadataValue(metadata, 'imageSubMode', favorite.imageSubMode)
        withMetadataValue(metadata, 'assetId', draft.promptAsset?.id)
        withMetadataValue(metadata, 'versionId', draft.promptAsset?.currentVersionId)

        return {
            kind: 'favorite',
            ...(favorite.id?.trim() ? { id: favorite.id.trim() } : {}),
            ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        }
    }

    const buildFavoriteAssetBinding = (
        draft: FavoriteWorkspaceApplyDraft,
    ): PromptAssetBinding | undefined => {
        const asset = draft.promptAsset
        if (!asset?.id?.trim()) return undefined
        const versionId = asset.currentVersionId?.trim()
        return {
            assetId: asset.id.trim(),
            ...(versionId ? { versionId } : {}),
            status: 'linked',
        }
    }

    const applyFavoriteSessionBinding = (
        favorite: FavoriteItem,
        draft: FavoriteWorkspaceApplyDraft,
        targetKey: string | null = draft.targetKey,
    ) => {
        const session = getAssetBindingSession(targetKey)
        if (!session?.updateAssetBinding) return

        session.updateAssetBinding(
            buildFavoriteAssetBinding(draft),
            buildFavoriteSessionOrigin(favorite, draft, targetKey),
        )
    }

    const cloneConversationMessages = (
        messages: ConversationMessage[],
    ): ConversationMessage[] => messages.map((message) => ({
        ...message,
        ...(message.tool_calls
            ? {
                tool_calls: message.tool_calls.map((toolCall) => ({
                    ...toolCall,
                    function: { ...toolCall.function },
                })),
            }
            : {}),
    }))

    const applyProMultiConversationMessages = (
        draft: FavoriteWorkspaceApplyDraft,
        targetKey: string | null,
    ) => {
        if (targetKey !== 'pro-multi') return
        if (!proMultiMessageSession?.updateConversationMessages) return

        const messages = draft.conversationMessages && draft.conversationMessages.length > 0
            ? draft.conversationMessages
            : buildWorkspaceConversationFromPromptText(draft.content, 'favorite')
        if (messages.length === 0) return

        proMultiMessageSession.updateConversationMessages(
            cloneConversationMessages(messages),
        )
        proMultiMessageSession.setMessageChainMap?.({})
        proMultiMessageSession.selectMessage?.('')
    }

    const getWorkspaceApplySessions = () => ({
        basicSystemSession,
        basicUserSession,
        proMultiMessageSession,
        proVariableSession,
        imageText2ImageSession,
        imageImage2ImageSession,
        imageMultiImageSession,
        optimizerCurrentVersions,
    })

    const clearFavoriteWorkspaceBeforeApply = (targetKey: string | null | undefined) => {
        clearWorkspaceContentForExternalApply(targetKey, getWorkspaceApplySessions())
    }

    const applyFavoriteVariables = (draft: FavoriteWorkspaceApplyDraft) => {
        applyWorkspaceTemporaryVariables(
            draft.targetKey,
            getWorkspaceApplySessions(),
            {
                variables: draft.reproducibility.variables,
                parameters: draft.selectedExample?.parameters,
                preserveExistingValues: false,
                restrictParametersToDefinitions: true,
            },
        )
    }

    const resolveExampleInputImages = async (example: FavoriteReproducibilityExample): Promise<ImagePayload[]> => {
        const storageService = getFavoriteImageStorageService?.() || null
        const sources = [...example.inputImages]

        if (storageService) {
            for (const assetId of example.inputImageAssetIds) {
                try {
                    const dataUrl = await resolveAssetIdToDataUrl(assetId, storageService)
                    if (dataUrl) sources.push(dataUrl)
                } catch (error) {
                    console.warn('[App] Failed to resolve favorite example input image:', error)
                }
            }
        }

        const images: ImagePayload[] = []
        for (const source of sources) {
            try {
                const payload = await normalizeImageSourceToPayload(source)
                if (payload) images.push(payload)
            } catch (error) {
                console.warn('[App] Failed to load favorite example input image:', error)
            }
        }

        return images
    }

    const applyFavoriteExample = async (
        draft: FavoriteWorkspaceApplyDraft,
    ) => {
        const { selectedExample: example, targetKey } = draft
        if (!example) return

        if (draft.selectedExampleText) {
            getExampleTextSession(targetKey)?.updateTestContent?.(draft.selectedExampleText)
        }

        if (targetKey === 'basic-system' && basicSystemSession?.updateTestImage) {
            const [firstImage] = await resolveExampleInputImages(example)
            if (firstImage) {
                basicSystemSession.updateTestImage(firstImage.b64, firstImage.mimeType)
            }
        }

        if (targetKey === 'image-image2image' && imageImage2ImageSession) {
            const [firstImage] = await resolveExampleInputImages(example)
            if (firstImage) {
                imageImage2ImageSession.updateInputImage(firstImage.b64, firstImage.mimeType)
            }
        }

        if (targetKey === 'image-multiimage' && imageMultiImageSession) {
            const images = await resolveExampleInputImages(example)
            if (images.length > 0) {
                imageMultiImageSession.replaceInputImages(images)
            }
        }
    }

    const handleUseFavoriteImpl = async (favorite: FavoriteItem, useOptions: UseFavoriteOptions = {}): Promise<boolean> => {
        const draft = createFavoriteWorkspaceApplyDraft(favorite, useOptions)
        const favoriteMode = draft.favoriteMode
        const targetKey = draft.targetKey

        // 🔧 Step D: 使用 navigateToSubModeKey 一次性导航到目标路由
        // 不再分两步（先切 functionMode 再切 subMode）

        if (favoriteMode?.functionMode === 'image' && targetKey?.startsWith('image-')) {
            // 图像模式：根据 favImageSubMode 确定目标子模式（默认 text2image）
            const targetSubMode = favoriteMode.imageSubMode || 'text2image'

            const didNavigate = await navigateToSubModeKey(targetKey)
            if (didNavigate === false) return false
            toast.info(t('toast.info.switchedToImageMode'))

            await nextTick()

            clearFavoriteWorkspaceBeforeApply(targetKey)

            // 图像模式的数据回填逻辑
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('image-workspace-restore-favorite', {
                        detail: {
                            content: draft.content,
                            imageSubMode: targetSubMode,
                            metadata: draft.metadata,
                        },
                    }),
                )
            }

            applyFavoriteVariables(draft)
            await applyFavoriteExample(draft)
            applyFavoriteSessionBinding(favorite, draft, targetKey)

            toast.success(t('toast.success.imageFavoriteLoaded'))
        } else if (
            favoriteMode?.functionMode === 'basic' ||
            favoriteMode?.functionMode === 'context'
        ) {
            // 基础模式或上下文模式

            // 1. 确定目标功能模式
            // 'pro' 和 'context' 都映射到 pro（兼容历史数据）
            const targetFunctionMode = favoriteMode.functionMode === 'context' ? 'pro' : 'basic'

            // 2. 确定目标子模式（如果收藏指定了优化模式）
            // - basic: system/user
            // - pro: multi/variable（兼容旧 optimizationMode: system->multi, user->variable）
            let targetSubMode: BasicSubMode | ProSubMode
            if (targetFunctionMode === 'pro') {
                const mode = favoriteMode.optimizationMode ?? 'user'
                targetSubMode = mode === 'system' ? 'multi' : 'variable'
            } else {
                targetSubMode = (favoriteMode.optimizationMode ?? 'system') as BasicSubMode
            }

            // 3. 一次性导航到目标路由
            const resolvedTargetKey = targetKey || `${targetFunctionMode}-${targetSubMode}`
            const didNavigate = await navigateToSubModeKey(resolvedTargetKey)
            if (didNavigate === false) return false

            await nextTick()

            // 4. 如果是 pro 模式，需要同步 contextMode（兼容旧逻辑）
            if (targetFunctionMode === 'pro' && favoriteMode.optimizationMode) {
                await handleContextModeChange(favoriteMode.optimizationMode as ContextMode)
            }

            toast.info(
                t('toast.info.switchedToFunctionMode', {
                    mode: targetFunctionMode === 'pro' ? t('common.context') : t('common.basic'),
                }),
            )

            if (favoriteMode.optimizationMode) {
                toast.info(
                    t('toast.info.optimizationModeAutoSwitched', {
                        mode:
                            favoriteMode.optimizationMode === 'system'
                                ? t('common.system')
                                : t('common.user'),
                    }),
                )
            }

            // 5. 将收藏的提示词内容设置到输入框
            clearFavoriteWorkspaceBeforeApply(resolvedTargetKey)
            optimizerPrompt.value = draft.content
            if (resolvedTargetKey === 'basic-system') {
                basicSystemSession?.updatePrompt?.(draft.content)
            }
            if (resolvedTargetKey === 'basic-user') {
                basicUserSession?.updatePrompt?.(draft.content)
            }
            if (resolvedTargetKey === 'pro-variable') {
                proVariableSession?.updatePrompt?.(draft.content)
            }
            applyProMultiConversationMessages(draft, resolvedTargetKey)
            applyFavoriteVariables(draft)
            await applyFavoriteExample(draft)
            applyFavoriteSessionBinding(favorite, draft, resolvedTargetKey)
        } else {
            // 其他情况：直接设置内容，不切换模式
            clearFavoriteWorkspaceBeforeApply(targetKey)
            optimizerPrompt.value = draft.content
            // 未知模式无法可靠定位目标 session，仅保留正文应用行为。
            applyFavoriteVariables(draft)
            await applyFavoriteExample(draft)
            applyFavoriteSessionBinding(favorite, draft, targetKey)
        }

        // 关闭收藏管理对话框
        showFavoriteManager.value = false

        // 显示成功提示
        toast.success(t('toast.success.favoriteLoaded'))

        return true
    }

    /**
     * 收藏加载的错误处理包装器
     */
    const handleUseFavorite = async (favorite: FavoriteItem, useOptions: UseFavoriteOptions = {}): Promise<boolean> => {
        try {
            // 🔧 设置外部数据加载标志，防止模式切换的自动 restore 覆盖外部数据
            isLoadingExternalData.value = true

            return await handleUseFavoriteImpl(favorite, useOptions)
        } catch (error) {
            // 捕获收藏加载过程中的所有错误
            console.error('[App] Failed to load favorite:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            toast.error(t('toast.error.favoriteLoadFailed', { error: errorMessage }))
            return false
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
