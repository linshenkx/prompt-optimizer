<template>
    <!--
        基础模式工作区

        职责:
        - 左侧: 提示词输入 + 优化结果显示
        - 右侧: 测试区域 (变量输入 + 测试执行 + 评估)

        与上下文模式的区别:
        - 状态由父组件管理（通过 props/emits 传递）
        - 不使用内部 composables 管理优化/测试状态
        - 更简单的布局配置
    -->
    <NFlex
        justify="space-between"
        :style="{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            maxHeight: '100%',
            gap: '16px',
        }"
    >
        <!-- 左侧：优化区域 -->
        <NFlex
            vertical
            :style="{
                flex: 1,
                overflow: 'auto',
                height: '100%',
            }"
        >
            <!-- 组件 A: InputPanelUI (可折叠) -->
            <NCard
                data-input-panel
                :style="{
                    flexShrink: 0,
                }"
            >
                <!-- 折叠态：只显示标题栏 -->
                <NFlex
                    v-if="isInputPanelCollapsed"
                    justify="space-between"
                    align="center"
                >
                    <NFlex align="center" :size="8">
                        <NText :depth="1" style="font-size: 18px; font-weight: 500">
                            {{ t('promptOptimizer.originalPrompt') }}
                        </NText>
                        <NText
                            v-if="prompt"
                            depth="3"
                            style="font-size: 12px;"
                        >
                            {{ promptSummary }}
                        </NText>
                    </NFlex>
                    <NButton
                        type="tertiary"
                        size="small"
                        ghost
                        round
                        @click="isInputPanelCollapsed = false"
                        :title="t('common.expand')"
                    >
                        <template #icon>
                            <NIcon>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </NIcon>
                        </template>
                    </NButton>
                </NFlex>

                <!-- 展开态：完整输入面板 -->
                <InputPanelUI
                    v-else
                    :model-value="prompt"
                    @update:model-value="emit('update:prompt', $event)"
                    :label="t('promptOptimizer.originalPrompt')"
                    :placeholder="t('promptOptimizer.placeholder')"
                    :model-label="t('promptOptimizer.optimizeModel')"
                    :template-label="t('promptOptimizer.templateLabel')"
                    :button-text="t('promptOptimizer.optimize')"
                    :loading-text="t('common.loading')"
                    :loading="isOptimizing"
                    :disabled="isOptimizing"
                    :show-preview="false"
                    :show-analyze-button="true"
                    :analyze-loading="analyzing"
                    @submit="emit('optimize')"
                    @analyze="handleAnalyze"
                    @configModel="emit('config-model')"
                    @open-preview="emit('open-input-preview')"
                >
                    <!-- 模型选择插槽 -->
                    <template #model-select>
                        <slot name="optimize-model-select"></slot>
                    </template>

                    <!-- 模板选择插槽 -->
                    <template #template-select>
                        <slot name="template-select"></slot>
                    </template>

                    <!-- 标题栏折叠按钮 -->
                    <template #header-extra>
                        <NButton
                            type="tertiary"
                            size="small"
                            ghost
                            round
                            @click="isInputPanelCollapsed = true"
                            :title="t('common.collapse')"
                        >
                            <template #icon>
                                <NIcon>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                                    </svg>
                                </NIcon>
                            </template>
                        </NButton>
                    </template>
                </InputPanelUI>
            </NCard>

            <!-- 组件 B: PromptPanelUI -->
            <NCard
                :style="{
                    flex: 1,
                    minHeight: '200px',
                    overflow: 'hidden',
                }"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <!-- PromptPanel 现在通过 inject 获取评估上下文，无需传递评估相关 props -->
                <PromptPanelUI
                    ref="promptPanelRef"
                    :optimized-prompt="optimizedPrompt"
                    @update:optimized-prompt="emit('update:optimizedPrompt', $event)"
                    :reasoning="optimizedReasoning"
                    :original-prompt="prompt"
                    :is-optimizing="isOptimizing"
                    :is-iterating="isIterating"
                    :selected-iterate-template="selectedIterateTemplate"
                    @update:selectedIterateTemplate="emit('update:selectedIterateTemplate', $event)"
                    :versions="currentVersions"
                    :current-version-id="currentVersionId"
                    :optimization-mode="optimizationMode"
                    :advanced-mode-enabled="advancedModeEnabled"
                    :show-preview="false"
                    @iterate="handleIterate"
                    @openTemplateManager="emit('open-template-manager')"
                    @switchVersion="handleSwitchVersion"
                    @save-favorite="emit('save-favorite', $event)"
                    @open-preview="emit('open-prompt-preview')"
                    @apply-improvement="emit('apply-improvement', $event)"
                    @apply-patch="emit('apply-patch', $event)"
                    @save-local-edit="emit('save-local-edit', $event)"
                />
            </NCard>
        </NFlex>

        <!-- 右侧：测试区域 -->
        <TestAreaPanel
            ref="testAreaPanelRef"
            :style="{
                flex: 1,
                overflow: 'auto',
                height: '100%',
                minHeight: 0,
            }"
            :optimization-mode="optimizationMode"
            :model-provider="modelProvider"
            :model-name="modelName"
            :optimized-prompt="optimizedPrompt"
            :is-test-running="isTestingOriginal || isTestingOptimized"
            :global-variables="globalVariables"
            :predefined-variables="predefinedVariables"
            :test-content="testContent"
            @update:test-content="emit('update:testContent', $event)"
            :is-compare-mode="isCompareMode"
            @update:isCompareMode="emit('update:isCompareMode', $event)"
            :enable-compare-mode="true"
            :enable-fullscreen="true"
            :input-mode="inputMode"
            :control-bar-layout="controlBarLayout"
            :button-size="buttonSize"
            :conversation-max-height="conversationMaxHeight"
            :show-original-result="true"
            :result-vertical-layout="resultVerticalLayout"
            :show-evaluation="true"
            :has-original-result="hasOriginalResult"
            :has-optimized-result="hasOptimizedResult"
            :is-evaluating-original="isEvaluatingOriginal"
            :is-evaluating-optimized="isEvaluatingOptimized"
            :original-score="originalScore"
            :optimized-score="optimizedScore"
            :has-original-evaluation="hasOriginalEvaluation"
            :has-optimized-evaluation="hasOptimizedEvaluation"
            :original-evaluation-result="originalEvaluationResult"
            :optimized-evaluation-result="optimizedEvaluationResult"
            :original-score-level="originalScoreLevel"
            :optimized-score-level="optimizedScoreLevel"
            @test="handleTest"
            @compare-toggle="emit('compare-toggle')"
            @open-variable-manager="handleOpenVariableManager"
            @evaluate-original="emit('evaluate-original')"
            @evaluate-optimized="emit('evaluate-optimized')"
            @show-original-detail="emit('show-original-detail')"
            @show-optimized-detail="emit('show-optimized-detail')"
            @apply-improvement="emit('apply-improvement', $event)"
            @apply-patch="emit('apply-patch', $event)"
        >
            <!-- 模型选择插槽 -->
            <template #model-select>
                <slot name="test-model-select"></slot>
            </template>

            <!-- 原始结果插槽 -->
            <template #original-result>
                <OutputDisplay
                    :content="originalResult"
                    :reasoning="originalReasoning"
                    :streaming="isTestingOriginal"
                    :enableDiff="false"
                    mode="readonly"
                    :style="{
                        height: '100%',
                        minHeight: '0',
                    }"
                />
            </template>

            <!-- 优化结果插槽 -->
            <template #optimized-result>
                <OutputDisplay
                    :content="optimizedResult"
                    :reasoning="testOptimizedReasoning"
                    :streaming="isTestingOptimized"
                    :enableDiff="false"
                    mode="readonly"
                    :style="{
                        height: '100%',
                        minHeight: '0',
                    }"
                />
            </template>

            <!-- 单一结果插槽 -->
            <template #single-result>
                <OutputDisplay
                    :content="optimizedResult"
                    :reasoning="testOptimizedReasoning"
                    :streaming="isTestingOptimized"
                    :enableDiff="false"
                    mode="readonly"
                    :style="{
                        height: '100%',
                        minHeight: '0',
                    }"
                />
            </template>

            <!-- 对比评估按钮（仅在对比模式且有两个结果时显示） -->
            <template #custom-actions>
                <template v-if="isCompareMode && originalResult && optimizedResult">
                    <!-- 已评估或评估中：显示分数徽章 -->
                    <EvaluationScoreBadge
                        v-if="hasCompareEvaluation || isEvaluatingCompare"
                        :score="compareScore"
                        :level="compareScoreLevel"
                        :loading="isEvaluatingCompare"
                        :result="compareEvaluationResult"
                        type="compare"
                        size="small"
                        @show-detail="emit('show-compare-detail')"
                        @apply-improvement="emit('apply-improvement', $event)"
                        @apply-patch="emit('apply-patch', $event)"
                    />
                    <!-- 未评估：显示评估按钮 -->
                    <NButton
                        v-else
                        quaternary
                        size="small"
                        @click="emit('evaluate-compare')"
                    >
                        {{ t('evaluation.compareEvaluate') }}
                    </NButton>
                </template>
            </template>
        </TestAreaPanel>
    </NFlex>
</template>

<script setup lang="ts">
/**
 * 基础模式工作区组件
 *
 * @description
 * 用于基础模式的提示词优化工作区,采用左右分栏布局:
 * - 左侧: 提示词输入 + 优化结果展示
 * - 右侧: 测试区域 (变量输入 + 测试执行 + 评估)
 *
 * @features
 * - 状态由父组件管理，通过 props/emits 传递
 * - 支持提示词优化和迭代
 * - 支持版本管理
 * - 支持变量系统 (全局变量 + 预定义变量)
 * - 支持对比测试和评估
 * - 支持响应式布局
 *
 * @example
 * ```vue
 * <BasicModeWorkspace
 *   :prompt="optimizer.prompt"
 *   :optimized-prompt="optimizer.optimizedPrompt"
 *   :is-optimizing="optimizer.isOptimizing"
 *   @optimize="handleOptimize"
 *   @iterate="handleIterate"
 * >
 *   <template #optimize-model-select>...</template>
 *   <template #template-select>...</template>
 *   <template #test-model-select>...</template>
 * </BasicModeWorkspace>
 * ```
 */
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NFlex, NButton, NText, NIcon } from 'naive-ui'
import InputPanelUI from '../InputPanel.vue'
import PromptPanelUI from '../PromptPanel.vue'
import TestAreaPanel from '../TestAreaPanel.vue'
import OutputDisplay from '../OutputDisplay.vue'
import { EvaluationScoreBadge } from '../evaluation'
import type { OptimizationMode } from '../../types'
import type { PromptRecord, Template, EvaluationResult, ScoreLevel, PatchOperation } from '@prompt-optimizer/core'
import type { PromptPanelInstance } from '../types/prompt-panel'
import type { TestAreaPanelInstance } from '../types/test-area'
import type { SaveFavoritePayload, IteratePayload } from '../../types/workspace'

// ========================
// Props 定义
// ========================
interface Props {
    // === 优化模式 ===
    /** 优化模式 */
    optimizationMode: OptimizationMode
    /** 是否启用高级模式 */
    advancedModeEnabled?: boolean

    // === 优化器状态（由父组件管理）===
    /** 原始提示词 */
    prompt: string
    /** 优化后的提示词 */
    optimizedPrompt: string
    /** 优化推理过程 */
    optimizedReasoning?: string
    /** 是否正在优化 */
    isOptimizing: boolean
    /** 是否正在迭代 */
    isIterating: boolean
    /** 当前版本列表 */
    currentVersions: PromptRecord[]
    /** 当前版本ID */
    currentVersionId: string
    /** 选中的迭代模板 */
    selectedIterateTemplate: Template | null

    // === 测试状态（由父组件管理）===
    /** 测试内容 */
    testContent?: string
    /** 是否启用对比模式 */
    isCompareMode: boolean
    /** 原始测试结果 */
    originalResult?: string
    /** 原始推理过程 */
    originalReasoning?: string
    /** 优化测试结果 */
    optimizedResult?: string
    /** 测试-优化推理过程 */
    testOptimizedReasoning?: string
    /** 是否正在测试原始 */
    isTestingOriginal?: boolean
    /** 是否正在测试优化 */
    isTestingOptimized?: boolean

    // === 变量数据 ===
    /** 全局变量 */
    globalVariables: Record<string, string>
    /** 预定义变量 */
    predefinedVariables: Record<string, string>

    // === 模型信息 ===
    /** 模型提供商 */
    modelProvider?: string
    /** 模型名称 */
    modelName?: string

    // === 评估状态 ===
    /** 是否有原始结果 */
    hasOriginalResult?: boolean
    /** 是否有优化结果 */
    hasOptimizedResult?: boolean
    /** 是否正在评估原始 */
    isEvaluatingOriginal?: boolean
    /** 是否正在评估优化 */
    isEvaluatingOptimized?: boolean
    /** 是否正在评估对比 */
    isEvaluatingCompare?: boolean
    /** 原始评估分数 */
    originalScore?: number
    /** 优化评估分数 */
    optimizedScore?: number
    /** 对比评估分数 */
    compareScore?: number
    /** 是否有原始评估结果 */
    hasOriginalEvaluation?: boolean
    /** 是否有优化评估结果 */
    hasOptimizedEvaluation?: boolean
    /** 是否有对比评估结果 */
    hasCompareEvaluation?: boolean
    /** 原始评估结果 */
    originalEvaluationResult?: EvaluationResult
    /** 优化评估结果 */
    optimizedEvaluationResult?: EvaluationResult
    /** 对比评估结果 */
    compareEvaluationResult?: EvaluationResult
    /** 原始分数等级 */
    originalScoreLevel?: ScoreLevel
    /** 优化分数等级 */
    optimizedScoreLevel?: ScoreLevel
    /** 对比分数等级 */
    compareScoreLevel?: ScoreLevel

    // 注：仅提示词评估状态（prompt-only/prompt-iterate）现在通过 provide/inject 机制在 PromptPanel 内部获取

    // === 响应式布局配置 ===
    /** 输入模式 */
    inputMode?: 'compact' | 'normal'
    /** 控制栏布局 */
    controlBarLayout?: 'horizontal' | 'vertical'
    /** 按钮尺寸 */
    buttonSize?: 'small' | 'medium' | 'large'
    /** 对话最大高度 */
    conversationMaxHeight?: number
    /** 结果区域是否垂直布局 */
    resultVerticalLayout?: boolean

    /** 🆕 是否正在分析（由 App 层驱动） */
    analyzing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    advancedModeEnabled: false,
    optimizedReasoning: '',
    testContent: '',
    originalResult: '',
    originalReasoning: '',
    optimizedResult: '',
    testOptimizedReasoning: '',
    isTestingOriginal: false,
    isTestingOptimized: false,
    modelProvider: '',
    modelName: '',
    hasOriginalResult: false,
    hasOptimizedResult: false,
    isEvaluatingOriginal: false,
    isEvaluatingOptimized: false,
    isEvaluatingCompare: false,
    originalScore: 0,
    optimizedScore: 0,
    compareScore: 0,
    hasOriginalEvaluation: false,
    hasOptimizedEvaluation: false,
    hasCompareEvaluation: false,
    inputMode: 'normal',
    controlBarLayout: 'horizontal',
    buttonSize: 'medium',
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
    analyzing: false,
})

// ========================
// Emits 定义
// ========================
const emit = defineEmits<{
    // === 数据更新事件 ===
    'update:prompt': [value: string]
    'update:optimizedPrompt': [value: string]
    'update:selectedIterateTemplate': [value: Template | null]
    'update:testContent': [value: string]
    'update:isCompareMode': [value: boolean]

    // === 优化操作事件 ===
    /** 执行优化 */
    'optimize': []
    /** 执行迭代 */
    'iterate': [payload: IteratePayload]
    /** 切换版本 */
    'switch-version': [version: PromptRecord]
    /** 切换到 V0 */
    'switch-to-v0': []

    // === 测试操作事件 ===
    /** 执行测试 */
    'test': [testVariables: Record<string, string>]
    /** 切换对比模式 */
    'compare-toggle': []

    // === 评估操作事件 ===
    /** 评估原始 */
    'evaluate-original': []
    /** 评估优化 */
    'evaluate-optimized': []
    /** 评估对比 */
    'evaluate-compare': []
    /** 评估仅提示词（分析模式） */
    'evaluate-prompt-only': []
    /** 显示原始详情 */
    'show-original-detail': []
    /** 显示优化详情 */
    'show-optimized-detail': []
    /** 显示对比详情 */
    'show-compare-detail': []
    /** 应用改进 */
    'apply-improvement': [payload: { improvement: string; type: string }]
    /** 应用补丁 */
    'apply-patch': [payload: { operation: PatchOperation }]
    // 注：PromptPanel 内的提示词评估（prompt-only/prompt-iterate）通过 inject 的 evaluation context 处理；
    // 这里的 evaluate-prompt-only 仅用于“分析模式”触发 App 层的 prompt-only 评估。

    // === 保存/管理事件 ===
    /** 保存收藏 */
    'save-favorite': [data: SaveFavoritePayload]
    /** 保存本地修改为新版本 */
    'save-local-edit': [payload: { note?: string }]

    // === 打开面板/管理器 ===
    /** 打开变量管理器 */
    'open-variable-manager': [variableName?: string]
    /** 打开输入预览 */
    'open-input-preview': []
    /** 打开提示词预览 */
    'open-prompt-preview': []
    /** 配置模型 */
    'config-model': []
    /** 打开模板管理器 */
    'open-template-manager': []
}>()

// ========================
// 内部状态
// ========================
const { t } = useI18n()

// 组件引用
const promptPanelRef = ref<PromptPanelInstance | null>(null)
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null)

// 输入区折叠状态（初始展开）
const isInputPanelCollapsed = ref(false)

/** 是否正在执行分析 */
const analyzing = computed(() => !!props.analyzing)

// 提示词摘要（折叠态显示）
const promptSummary = computed(() => {
    if (!props.prompt) return ''
    return props.prompt.length > 50
        ? props.prompt.slice(0, 50) + '...'
        : props.prompt
})

// ========================
// 事件处理
// ========================

/**
 * 处理分析操作
 * - 清空版本链，创建 V0（与优化同级）
 * - 不写入历史（分析不产生新提示词）
 * - 触发 prompt-only 评估
 */
const handleAnalyze = async () => {
    if (!props.prompt?.trim()) return
    if (props.isOptimizing) return
    if (analyzing.value) return

    // 1. 收起输入区域
    isInputPanelCollapsed.value = true

    await nextTick()

    // 2. 触发 App 层的分析（会清空版本链、创建 V0、触发评估）
    emit('evaluate-prompt-only')
}

/** 处理迭代 */
const handleIterate = (payload: IteratePayload) => {
    emit('iterate', payload)
}

/** 处理切换版本 */
const handleSwitchVersion = (version: PromptRecord) => {
    emit('switch-version', version)
}

/** 处理测试 */
const handleTest = (testVariables: Record<string, string>) => {
    emit('test', testVariables)
}

/** 处理打开变量管理器 */
const handleOpenVariableManager = (variableName?: string) => {
    emit('open-variable-manager', variableName)
}

// ========================
// 暴露给父组件的方法
// ========================
defineExpose({
    /** PromptPanel 组件引用 */
    promptPanelRef,
    /** TestAreaPanel 组件引用 */
    testAreaPanelRef,
    /** 打开迭代对话框 */
    openIterateDialog: (initialContent?: string) => {
        promptPanelRef.value?.openIterateDialog?.(initialContent)
    },
})
</script>
