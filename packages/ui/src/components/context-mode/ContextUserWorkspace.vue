<template>
    <!--
        上下文模式 - 用户提示词工作区

        职责:
        - 左侧: 用户提示词输入 + 优化结果显示
        - 右侧: 测试区域 (变量输入 + 测试执行)

        与系统模式的区别:
        - 不包含会话管理器 (ConversationManager)
        - 仅优化单条用户消息,无需管理多轮对话上下文
        - 包含工具管理按钮 (系统模式不包含)
    -->
    <NFlex
        data-testid="workspace"
        data-mode="pro-variable"
        justify="space-between"
        :wrap="false"
        :size="16"
        style="width: 100%; height: 100%"
    >
        <!-- 左侧：优化区域 -->
        <NFlex
            vertical
            :size="12"
            style="flex: 1; height: 100%; overflow: auto"
        >
            <!-- 提示词输入面板 (可折叠) -->
            <NCard style="flex-shrink: 0;">
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
                            v-if="contextUserOptimization.prompt"
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
                    test-id-prefix="pro-variable"
                    v-model="contextUserOptimization.prompt"
                    :label="t('promptOptimizer.originalPrompt')"
                    :placeholder="t('promptOptimizer.userPromptPlaceholder')"
                    :help-text="variableGuideInlineHint"
                    :model-label="t('promptOptimizer.optimizeModel')"
                    :template-label="t('promptOptimizer.templateLabel')"
                    :button-text="t('promptOptimizer.optimize')"
                    :loading-text="t('common.loading')"
                    :loading="contextUserOptimization.isOptimizing"
                    :disabled="contextUserOptimization.isOptimizing"
                    :show-preview="true"
                    :show-analyze-button="true"
                    :analyze-loading="isAnalyzing"
                    @submit="handleOptimize"
                    @analyze="handleAnalyze"
                    @configModel="emit('config-model')"
                    @open-preview="emit('open-input-preview')"
                    :enable-variable-extraction="true"
                    :show-extract-button="true"
                    :extracting="props.isExtracting"
                    :existing-global-variables="existingGlobalVariableNames"
                    :existing-temporary-variables="existingTemporaryVariableNames"
                    :predefined-variables="predefinedVariableNames"
                    :global-variable-values="globalVariableValues"
                    :temporary-variable-values="temporaryVariableValues"
                    :predefined-variable-values="predefinedVariableValues"
                    @extract-variables="handleExtractVariables"
                    @variable-extracted="handleVariableExtracted"
                    @add-missing-variable="handleAddMissingVariable"
                >
                    <!-- 模型选择插槽 -->
                    <template #model-select>
                        <SelectWithConfig
                            v-model="selectedOptimizeModelKeyModel"
                            :options="modelSelection.textModelOptions.value"
                            :getPrimary="OptionAccessors.getPrimary"
                            :getSecondary="OptionAccessors.getSecondary"
                            :getValue="OptionAccessors.getValue"
                            @config="emit('config-model')"
                        />
                    </template>

                    <!-- 模板选择插槽 -->
                    <template #template-select>
                        <SelectWithConfig
                            v-model="selectedTemplateIdModel"
                            :options="templateSelection.templateOptions.value"
                            :getPrimary="OptionAccessors.getPrimary"
                            :getSecondary="OptionAccessors.getSecondary"
                            :getValue="OptionAccessors.getValue"
                            @config="emit('open-template-manager')"
                        />
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

            <!--
                用户模式特性说明:
                此处不显示会话管理器 (ConversationManager)

                原因:
                - 用户模式专注于优化单条用户提示词
                - 不涉及多轮对话的上下文管理
                - 系统模式才需要管理 system/user/assistant/tool 多条消息

                如需管理复杂对话上下文,请使用系统模式
            -->

            <!-- 优化结果面板 -->
            <NCard
                style="flex: 1; min-height: 200px; overflow: hidden"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <PromptPanelUI
                    ref="promptPanelRef"
                    :optimized-prompt="contextUserOptimization.optimizedPrompt"
                    @update:optimized-prompt="contextUserOptimization.optimizedPrompt = $event"
                    :reasoning="contextUserOptimization.optimizedReasoning"
                    :original-prompt="contextUserOptimization.prompt"
                    :is-optimizing="contextUserOptimization.isOptimizing"
                    :is-iterating="contextUserOptimization.isIterating"
                    :selected-iterate-template="selectedIterateTemplate"
                    @update:selectedIterateTemplate="
                        emit('update:selectedIterateTemplate', $event)
                    "
                    :versions="contextUserOptimization.currentVersions"
                    :current-version-id="contextUserOptimization.currentVersionId"
                    :optimization-mode="optimizationMode"
                    :advanced-mode-enabled="true"
                    :show-preview="true"
                    @iterate="handleIterate"
                    @openTemplateManager="emit('open-template-manager', $event)"
                    @switchVersion="handleSwitchVersion"
                    @switchToV0="handleSwitchToV0"
                    @save-favorite="emit('save-favorite', $event)"
                    @open-preview="emit('open-prompt-preview')"
                    @apply-improvement="handleApplyImprovement"
                    @save-local-edit="handleSaveLocalEdit"
                />
            </NCard>
        </NFlex>

        <!-- 右侧：测试区域 -->
        <ContextUserTestPanel
            ref="testAreaPanelRef"
            :style="{
                flex: 1,
                overflow: 'auto',
                height: '100%',
                minHeight: 0,
            }"
            :prompt="contextUserOptimization.prompt"
            :optimized-prompt="contextUserOptimization.optimizedPrompt"
            :is-test-running="contextUserTester.testResults.isTestingOriginal || contextUserTester.testResults.isTestingOptimized"
            :is-compare-mode="isCompareMode"
            @update:isCompareMode="emit('update:isCompareMode', $event)"
            :model-name="props.testModelName"
            :evaluation-model-key="props.evaluationModelKey"
            :services="services"
            :global-variables="globalVariables"
            :predefined-variables="predefinedVariables"
            :temporary-variables="temporaryVariables"
            :button-size="buttonSize"
            :result-vertical-layout="resultVerticalLayout"
            :single-result-title="t('test.testResult')"
            @test="handleTestWithVariables"
            @compare-toggle="emit('compare-toggle')"
            @open-variable-manager="emit('open-variable-manager')"
            @open-global-variables="emit('open-global-variables')"
            @variable-change="handleTestVariableChange"
            @save-to-global="
                (name: string, value: string) =>
                    emit('save-to-global', name, value)
            "
            @temporary-variable-remove="handleTestVariableRemove"
            @temporary-variables-clear="handleClearTemporaryVariables"
            v-bind="evaluationHandler.testAreaEvaluationProps.value"
            @evaluate-original="evaluationHandler.handlers.onEvaluateOriginal"
            @evaluate-optimized="evaluationHandler.handlers.onEvaluateOptimized"
            @show-original-detail="evaluationHandler.handlers.onShowOriginalDetail"
            @show-optimized-detail="evaluationHandler.handlers.onShowOptimizedDetail"
            @apply-improvement="handleApplyImprovement"
        >
            <!-- 模型选择插槽 -->
            <template #model-select>
                <SelectWithConfig
                    v-model="selectedTestModelKeyModel"
                    :options="modelSelection.textModelOptions.value"
                    :getPrimary="OptionAccessors.getPrimary"
                    :getSecondary="OptionAccessors.getSecondary"
                    :getValue="OptionAccessors.getValue"
                    @config="emit('config-model')"
                />
            </template>

            <!-- 🆕 对比模式结果插槽：直接绑定测试结果 -->
            <template #original-result>
                <OutputDisplay
                    :content="contextUserTester.testResults.originalResult"
                    :reasoning="contextUserTester.testResults.originalReasoning"
                    :streaming="contextUserTester.testResults.isTestingOriginal"
                    :enableDiff="false"
                    mode="readonly"
                    :style="{ height: '100%', minHeight: '0' }"
                />
            </template>

            <template #optimized-result>
                <OutputDisplay
                    :content="contextUserTester.testResults.optimizedResult"
                    :reasoning="contextUserTester.testResults.optimizedReasoning"
                    :streaming="contextUserTester.testResults.isTestingOptimized"
                    :enableDiff="false"
                    mode="readonly"
                    :style="{ height: '100%', minHeight: '0' }"
                />
            </template>

            <!-- 单一结果插槽 -->
            <template #single-result>
                <OutputDisplay
                    :content="contextUserTester.testResults.optimizedResult"
                    :reasoning="contextUserTester.testResults.optimizedReasoning"
                    :streaming="contextUserTester.testResults.isTestingOptimized"
                    :enableDiff="false"
                    mode="readonly"
                    :style="{ height: '100%', minHeight: '0' }"
                />
            </template>
        </ContextUserTestPanel>

        <!-- 评估详情面板已移至 App 顶层统一管理，避免双套 evaluation 实例导致行为不一致 -->
    </NFlex>
</template>

<script setup lang="ts">
/**
 * 上下文模式 - 用户提示词工作区组件
 *
 * @description
 * 用于优化单条用户提示词的工作区界面,采用左右分栏布局:
 * - 左侧: 提示词输入 + 优化结果展示
 * - 右侧: 测试区域 (变量输入 + 测试执行)
 *
 * @features
 * - 🆕 完全独立的优化和测试逻辑（使用专属 composables）
 * - 支持提示词优化和迭代
 * - 支持版本管理和历史记录
 * - 支持变量系统 (全局变量 + 测试临时变量)
 * - 🆕 支持文本选择并提取为变量 (用户模式独有)
 * - 🆕 使用 composable 管理临时变量，无需 props 传递
 * - 支持工具调用配置
 * - 支持响应式布局
 *
 * @example
 * ```vue
 * <ContextUserWorkspace
 *   :optimization-mode="optimizationMode"
 *   :selected-optimize-model="modelKey"
 *   :selected-template="template"
 *   :global-variables="globalVars"
 * />
 * ```
 */
import { ref, computed, inject, nextTick, watch, onMounted, type Ref } from 'vue'

import { useI18n } from "vue-i18n";
import { NCard, NFlex, NText, NIcon, NButton } from "naive-ui";
import InputPanelUI from "../InputPanel.vue";
import PromptPanelUI from "../PromptPanel.vue";
import ContextUserTestPanel from "./ContextUserTestPanel.vue";
import OutputDisplay from "../OutputDisplay.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import type { OptimizationMode } from "../../types";
import {
    applyPatchOperationsToText,
    type PatchOperation,
    type PromptRecord,
    type PromptRecordChain,
    type Template,
    type ProUserEvaluationContext,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { AppServices } from '../../types/services';
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager';
import { useTemporaryVariables } from "../../composables/variable/useTemporaryVariables";
import { useContextUserOptimization } from '../../composables/prompt/useContextUserOptimization';
import { useContextUserTester } from '../../composables/prompt/useContextUserTester';
import { useEvaluationHandler, provideProContext, useEvaluationContext } from '../../composables/prompt';
import { useProVariableSession, type TestResults as ProVariableTestResults } from '../../stores/session/useProVariableSession';
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection';
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection';
import { OptionAccessors } from '../../utils/data-transformer';

// ========================
// Props 定义
// ========================
interface Props {
    // --- ✅ 已移除：模型和模板配置（现在从 session store 直接读取）---
    // ✅ 已移除：optimizationMode - 改为内部常量

    /** 测试模型名称（用于显示标签） */
    testModelName?: string;
    /** 🆕 评估模型（用于变量提取和变量值生成） */
    evaluationModelKey?: string;

    // --- 测试数据 ---
    /** 是否启用对比模式 */
    isCompareMode: boolean;
    /** 是否正在执行测试（兼容性保留，实际由内部管理）*/
    isTestRunning?: boolean;
    /** 🆕 是否正在执行AI变量提取 */
    isExtracting?: boolean;

    // --- 变量数据 ---
    /** 全局变量 (持久化存储) - 保留，用于变量检测 */
    globalVariables: Record<string, string>;
    /** 预定义变量 (系统内置) - 保留，用于变量检测 */
    predefinedVariables: Record<string, string>;

    // --- 响应式布局配置 ---
    /** 按钮尺寸 */
    buttonSize?: "small" | "medium" | "large";
    /** 对话历史最大高度 */
    conversationMaxHeight?: number;
    /** 结果区域是否垂直布局 */
    resultVerticalLayout?: boolean;
}

interface ContextUserHistoryPayload {
    record: PromptRecord;
    chain: PromptRecordChain;
    rootPrompt: string;
}

const props = withDefaults(defineProps<Props>(), {
    testModelName: undefined,
    evaluationModelKey: undefined,
    isTestRunning: false,
    isExtracting: false,
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    buttonSize: "medium",
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
});

// ========================
// Emits 定义
// ========================
const emit = defineEmits<{
    // --- 数据更新事件 ---
    "update:selectedIterateTemplate": [value: Template | null];
    "update:isCompareMode": [value: boolean];

    // --- 操作事件 ---
    /** 切换对比模式 */
    "compare-toggle": [];
    /** 保存到收藏 */
    "save-favorite": [data: SaveFavoritePayload];

    // --- 打开面板/管理器 ---
    /** 打开全局变量管理器 */
    "open-global-variables": [];
    /** 打开变量管理器 */
    "open-variable-manager": [];
    /** 打开模板管理器 */
    "open-template-manager": [type?: string];
    /** 配置模型 */
    "config-model": [];

    // --- 预览相关 ---
    /** 打开输入预览 */
    "open-input-preview": [];
    /** 打开提示词预览 */
    "open-prompt-preview": [];

    // --- 变量管理 ---
    /** 变量值变化 */
    "variable-change": [name: string, value: string];
    /** 保存测试变量到全局 */
    "save-to-global": [name: string, value: string];
    /** 🆕 AI变量提取事件 */
    "extract-variables": [];
    /** 🆕 变量提取事件 (用于处理文本选择提取的变量) */
    "variable-extracted": [
        data: {
            variableName: string;
            variableValue: string;
            variableType: "global" | "temporary";
        },
    ];
}>();

const { t } = useI18n();

// ========================
// 内部常量
// ========================
/** 优化模式：固定为 'user'（此组件专门用于用户提示词优化） */
const optimizationMode: OptimizationMode = 'user';

// ========================
// 注入服务和变量管理器
// ========================
const services = inject<Ref<AppServices | null>>('services');
const variableManager = inject<VariableManagerHooks | null>('variableManager');

// ========================
// 内部状态管理
// ========================

// 输入区折叠状态（初始展开）
const isInputPanelCollapsed = ref(false);

// ========================
// 分析状态
// ========================
/** 是否正在执行分析 */
const isAnalyzing = ref(false);

/** 🆕 使用全局临时变量管理器 (从文本提取的变量,仅当前会话有效) */
const tempVarsManager = useTemporaryVariables();
const temporaryVariables = tempVarsManager.temporaryVariables;

// Pro-user（变量模式）以 session store 为唯一真源（可持久化字段）
const proVariableSession = useProVariableSession();

// ✨ 新增：直接使用 session store 管理模型和模板选择
const modelSelection = useWorkspaceModelSelection(services || ref(null), proVariableSession)
const templateSelection = useWorkspaceTemplateSelection(
    services || ref(null),
    proVariableSession,
    'contextUserOptimize',
    'contextIterate'
)

const patchSessionOptimizedResult = (
    partial: Partial<{
        optimizedPrompt: string;
        reasoning: string;
        chainId: string;
        versionId: string;
    }>,
) => {
    proVariableSession.updateOptimizedResult({
        optimizedPrompt:
            partial.optimizedPrompt ??
            proVariableSession.optimizedPrompt ??
            "",
        reasoning: partial.reasoning ?? proVariableSession.reasoning ?? "",
        chainId: partial.chainId ?? proVariableSession.chainId ?? "",
        versionId: partial.versionId ?? proVariableSession.versionId ?? "",
    });
};

const sessionPrompt = computed<string>({
    get: () => proVariableSession.prompt ?? "",
    set: (value) => proVariableSession.updatePrompt(value || ""),
});

const sessionOptimizedPrompt = computed<string>({
    get: () => proVariableSession.optimizedPrompt ?? "",
    set: (value) => patchSessionOptimizedResult({ optimizedPrompt: value || "" }),
});

const sessionOptimizedReasoning = computed<string>({
    get: () => proVariableSession.reasoning ?? "",
    set: (value) => patchSessionOptimizedResult({ reasoning: value || "" }),
});

const sessionChainId = computed<string>({
    get: () => proVariableSession.chainId ?? "",
    set: (value) => patchSessionOptimizedResult({ chainId: value || "" }),
});

const sessionVersionId = computed<string>({
    get: () => proVariableSession.versionId ?? "",
    set: (value) => patchSessionOptimizedResult({ versionId: value || "" }),
});

// 🔧 为 SelectWithConfig 的 v-model 创建解包的 computed（避免 Vue prop 类型警告）
const selectedOptimizeModelKeyModel = computed({
    get: () => modelSelection.selectedOptimizeModelKey.value,
    set: (value) => { modelSelection.selectedOptimizeModelKey.value = value }
})

const selectedTemplateIdModel = computed({
    get: () => templateSelection.selectedTemplateId.value,
    set: (value) => { templateSelection.selectedTemplateId.value = value }
})

const selectedTestModelKeyModel = computed({
    get: () => modelSelection.selectedTestModelKey.value,
    set: (value) => { modelSelection.selectedTestModelKey.value = value }
})

const selectedIterateTemplate = computed<Template | null>({
    get: () => templateSelection.selectedIterateTemplate.value,
    set: (value) => {
        templateSelection.selectedIterateTemplateId.value = value?.id ?? ''
        templateSelection.selectedIterateTemplate.value = value ?? null
    }
})

// 🆕 初始化 ContextUser 专属优化器
const contextUserOptimization = useContextUserOptimization(
    services || ref(null),
    modelSelection.selectedOptimizeModelKey,
    templateSelection.selectedTemplate,
    templateSelection.selectedIterateTemplate,
    {
        prompt: sessionPrompt as unknown as Ref<string>,
        optimizedPrompt: sessionOptimizedPrompt as unknown as Ref<string>,
        optimizedReasoning: sessionOptimizedReasoning as unknown as Ref<string>,
        currentChainId: sessionChainId as unknown as Ref<string>,
        currentVersionId: sessionVersionId as unknown as Ref<string>,
    },
);

// 提示词摘要（折叠态显示）
const promptSummary = computed(() => {
    const prompt = contextUserOptimization.prompt;
    if (!prompt) return '';
    return prompt.length > 50
        ? prompt.slice(0, 50) + '...'
        : prompt;
});

// 🆕 初始化 ContextUser 专属测试器
const contextUserTester = useContextUserTester(
    services || ref(null),
    modelSelection.selectedTestModelKey,
    variableManager
);

// 🆕 构建 Pro-User 评估上下文
// ========================
// Pro-user 测试结果持久化（session store 唯一真源）
// ========================
onMounted(() => {
    // ✅ 刷新模型列表
    modelSelection.refreshTextModels()

    const saved = proVariableSession.testResults;
    if (!saved) {
        return;
    }

    // 只恢复稳定字段，不恢复 isTesting* 过程态
    contextUserTester.testResults.originalResult = saved.originalResult || "";
    contextUserTester.testResults.originalReasoning =
        saved.originalReasoning || "";
    contextUserTester.testResults.optimizedResult = saved.optimizedResult || "";
    contextUserTester.testResults.optimizedReasoning =
        saved.optimizedReasoning || "";
    contextUserTester.testResults.isTestingOriginal = false;
    contextUserTester.testResults.isTestingOptimized = false;
});

watch(
    () => ({
        originalResult: contextUserTester.testResults.originalResult,
        originalReasoning: contextUserTester.testResults.originalReasoning,
        optimizedResult: contextUserTester.testResults.optimizedResult,
        optimizedReasoning: contextUserTester.testResults.optimizedReasoning,
    }),
    (stable) => {
        const hasAny =
            !!stable.originalResult ||
            !!stable.originalReasoning ||
            !!stable.optimizedResult ||
            !!stable.optimizedReasoning;

        if (!hasAny) {
            proVariableSession.updateTestResults(null);
            return;
        }

        const snapshot: ProVariableTestResults = {
            originalResult: stable.originalResult || "",
            originalReasoning: stable.originalReasoning || "",
            optimizedResult: stable.optimizedResult || "",
            optimizedReasoning: stable.optimizedReasoning || "",
        };
        proVariableSession.updateTestResults(snapshot);
    },
);

const proContext = computed<ProUserEvaluationContext | undefined>(() => {
    const tempVars = temporaryVariables.value;
    const globalVars = props.globalVariables;
    const predefinedVars = props.predefinedVariables;
    const rawPrompt = contextUserOptimization.prompt;
    const resolvedPrompt = contextUserOptimization.optimizedPrompt;

    // 扫描提示词中实际使用的变量名
    // 同时扫描原始提示词和优化后的提示词，确保覆盖所有使用的变量
    const usedVarNames = new Set<string>();

    // 使用 variableManager 扫描变量
    if (variableManager?.variableManager.value) {
        const vm = variableManager.variableManager.value;
        // 扫描原始提示词中的变量
        if (rawPrompt) {
            vm.scanVariablesInContent(rawPrompt).forEach(name => usedVarNames.add(name));
        }
        // 扫描优化后提示词中的变量
        if (resolvedPrompt) {
            vm.scanVariablesInContent(resolvedPrompt).forEach(name => usedVarNames.add(name));
        }
    } else {
        // 回退方案：使用正则表达式扫描 {{varName}} 格式的变量
        // 使用 [^{}]+ 替代 \w+ 以支持中文等 Unicode 变量名
        const varPattern = /\{\{([^{}]+)\}\}/g;
        let match;
        if (rawPrompt) {
            while ((match = varPattern.exec(rawPrompt)) !== null) {
                const name = match[1]?.trim();
                if (name) usedVarNames.add(name);
            }
        }
        if (resolvedPrompt) {
            varPattern.lastIndex = 0; // 重置正则表达式
            while ((match = varPattern.exec(resolvedPrompt)) !== null) {
                const name = match[1]?.trim();
                if (name) usedVarNames.add(name);
            }
        }
    }

    // 只收集实际使用的变量
    const usedVariables: ProUserEvaluationContext['variables'] = [];

    // 按优先级顺序添加变量（临时 > 全局 > 预定义）
    usedVarNames.forEach(name => {
        // 临时变量优先级最高
        if (tempVars[name] !== undefined) {
            usedVariables.push({ name, value: tempVars[name], source: 'temporary' });
        }
        // 其次是全局变量
        else if (globalVars[name] !== undefined) {
            usedVariables.push({ name, value: globalVars[name], source: 'global' });
        }
        // 最后是预定义变量
        else if (predefinedVars[name] !== undefined) {
            usedVariables.push({ name, value: predefinedVars[name], source: 'predefined' });
        }
        // 变量未定义时仍然记录，标记为临时变量但值为空
        else {
            usedVariables.push({ name, value: '', source: 'temporary' });
        }
    });

    return {
        variables: usedVariables,
        rawPrompt: rawPrompt,
        resolvedPrompt: resolvedPrompt,
    };
});

// 🆕 提供 Pro 模式上下文给子组件（如 PromptPanel），用于评估时传递变量解析上下文
provideProContext(proContext);

// 🆕 获取全局评估实例（由 App 层 provideEvaluation 注入）
const globalEvaluation = useEvaluationContext();

// 🆕 测试结果数据
const testResultsData = computed(() => ({
    originalResult: contextUserTester.testResults.originalResult || undefined,
    optimizedResult: contextUserTester.testResults.optimizedResult || undefined,
}));

// 🆕 计算当前迭代需求（用于 prompt-iterate 的 re-evaluate）
const currentIterateRequirement = computed(() => {
    const versions = contextUserOptimization.currentVersions;
    const versionId = contextUserOptimization.currentVersionId;
    if (!versions || versions.length === 0 || !versionId) return '';
    const currentVersion = versions.find((v) => v.id === versionId);
    return currentVersion?.iterationNote || '';
});

// 🆕 初始化评估处理器（使用全局 evaluation 实例，避免双套状态）
const evaluationHandler = useEvaluationHandler({
    services: services || ref(null),
    originalPrompt: computed(() => contextUserOptimization.prompt),
    optimizedPrompt: computed(() => contextUserOptimization.optimizedPrompt),
    testContent: computed(() => ''), // 变量模式不需要单独的测试内容，通过变量系统管理
    testResults: testResultsData,
    evaluationModelKey: computed(() => props.evaluationModelKey || props.selectedOptimizeModel),
    functionMode: computed(() => 'pro'),
    subMode: computed(() => 'user'),
    proContext,
    currentIterateRequirement,
    externalEvaluation: globalEvaluation,
});

// ========================
// 计算属性
// ========================
/** 全局变量名列表 (用于变量名重复检测) */
const existingGlobalVariableNames = computed(() => Object.keys(props.globalVariables));

/** 临时变量名列表 (用于变量名重复检测) */
const existingTemporaryVariableNames = computed(() => Object.keys(temporaryVariables.value));

/** 预定义变量名列表 (用于变量名重复检测) */
const predefinedVariableNames = computed(() => Object.keys(props.predefinedVariables));

/** 全局变量名到值的映射 (用于补全展示) */
const globalVariableValues = computed(() => ({ ...props.globalVariables }));

/** 临时变量名到值的映射 (用于补全展示) */
const temporaryVariableValues = computed(() => ({ ...temporaryVariables.value }));

/** 预定义变量名到值的映射 (用于补全展示) */
const predefinedVariableValues = computed(() => ({ ...props.predefinedVariables }));

/** 变量提示文本，包含双花括号示例，避免模板解析误判 */
const doubleBraceToken = "{{}}";
const variableGuideInlineHint = computed(() =>
    t("variableGuide.inlineHint", { doubleBraces: doubleBraceToken }),
);

// ========================
// 组件引用
// ========================
/** TestAreaPanel 组件引用,用于获取测试变量 */
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null);

/** PromptPanel 组件引用,用于打开迭代弹窗 */
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

// ========================
// 事件处理
// ========================
/**
 * 🆕 处理变量提取事件
 *
 * 工作流程:
 * 1. 接收从 InputPanel 提取的变量数据
 * 2. 根据变量类型进行不同处理:
 *    - 全局变量: 直接触发 save-to-global 事件,由父组件保存到持久化存储
 *    - 临时变量: 保存到当前组件的 temporaryVariables 状态中
 * 3. 显示成功提示
 *
 * @param data 变量提取数据
 */
const handleVariableExtracted = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
}) => {
    if (data.variableType === "global") {
        // 全局变量: 触发事件,由父组件保存
        emit("save-to-global", data.variableName, data.variableValue);
        window.$message?.success(
            t("variableExtraction.savedToGlobal", {
                name: data.variableName,
            }),
        );
    } else {
        // 🆕 临时变量: 使用 composable 方法保存
        tempVarsManager.setVariable(data.variableName, data.variableValue);
        window.$message?.success(
            t("variableExtraction.savedToTemporary", {
                name: data.variableName,
            }),
        );
    }

    // 同时触发变量提取事件,通知父组件
    emit("variable-extracted", data);
};

/**
 * 🆕 处理添加缺失变量事件
 *
 * 当用户在输入框中悬停在缺失变量上并点击"添加到临时变量"时触发
 *
 * 工作流程:
 * 1. 将变量添加到临时变量列表,初始值为空字符串
 * 2. 显示成功提示
 *
 * @param varName 变量名
 */
const handleAddMissingVariable = (varName: string) => {
    // 🆕 使用 composable 方法添加到临时变量,值为空
    tempVarsManager.setVariable(varName, "");

    // 显示成功提示 (在 VariableAwareInput 中已经显示过了,这里不重复)
    // window.$message?.success(
    //     t("variableDetection.addSuccess", { name: varName })
    // );
};

/**
 * 🆕 处理AI变量提取事件
 *
 * 当用户点击"AI提取变量"按钮时触发
 *
 * 工作流程:
 * 1. 验证提示词内容和模型选择
 * 2. 收集已存在的变量名（全局+临时）
 * 3. 触发父组件的extract-variables事件
 * 4. 父组件调用AI服务并显示结果对话框
 */
const handleExtractVariables = () => {
    // 触发父组件事件，由App层处理AI提取逻辑
    emit('extract-variables');
};

/**
 * 🆕 同步测试区域对临时变量的修改
 *
 * 作用:
 * - 确保测试区域新增/编辑的变量能够参与左侧输入框的缺失变量检测
 * - 向父组件转发事件,保持既有对外接口不变
 */
const handleTestVariableChange = (name: string, value: string) => {
    // 🆕 使用 composable 方法设置变量
    tempVarsManager.setVariable(name, value);
    emit("variable-change", name, value);
};

/**
 * 🆕 测试区域移除临时变量时的处理
 */
const handleTestVariableRemove = (name: string) => {
    tempVarsManager.deleteVariable(name);
    emit("variable-change", name, "");
};

/**
 * 🆕 清空测试区域临时变量时的处理
 */
const handleClearTemporaryVariables = () => {
    // 🆕 使用 composable 方法清空所有临时变量
    const removedNames = Object.keys(temporaryVariables.value);
    tempVarsManager.clearAll();
    removedNames.forEach((name) => emit("variable-change", name, ""));
};

/**
 * 🆕 处理优化事件
 */
const handleOptimize = () => {
    if (isAnalyzing.value) return;
    contextUserOptimization.optimize();
};

/**
 * 处理分析操作
 * - 清空版本链，创建 V0（与优化同级）
 * - 不写入历史（分析不产生新提示词）
 * - 触发 prompt-only 评估
 */
const handleAnalyze = async () => {
    const prompt = contextUserOptimization.prompt;
    if (!prompt?.trim()) return;
    if (contextUserOptimization.isOptimizing) return;

    isAnalyzing.value = true;

    // 1. 清空版本链，创建虚拟 V0
    contextUserOptimization.handleAnalyze();

    // 2. 清理旧的提示词评估结果，避免跨提示词残留
    evaluationHandler.evaluation.clearResult('prompt-only');
    evaluationHandler.evaluation.clearResult('prompt-iterate');

    // 3. 收起输入区域
    isInputPanelCollapsed.value = true;

    await nextTick();

    // 4. 触发 prompt-only 评估
    try {
        await evaluationHandler.handleEvaluate('prompt-only');
    } finally {
        isAnalyzing.value = false;
    }
};

/**
 * 🆕 处理迭代优化事件
 */
const handleIterate = (payload: IteratePayload) => {
    contextUserOptimization.iterate({
        originalPrompt: contextUserOptimization.prompt,
        optimizedPrompt: contextUserOptimization.optimizedPrompt,
        iterateInput: payload.iterateInput
    });
};

/**
 * 🆕 处理版本切换事件
 */
const handleSwitchVersion = (version: PromptRecord) => {
    contextUserOptimization.switchVersion(version);
};

/**
 * 🆕 处理 V0 切换事件
 */
const handleSwitchToV0 = (version: PromptRecord) => {
    contextUserOptimization.switchToV0(version);
};

const restoreFromHistory = (payload: ContextUserHistoryPayload) => {
    contextUserOptimization.loadFromHistory(payload);
};

/**
 * 🆕 处理测试事件（使用内部测试器）
 *
 * 工作流程:
 * 1. 从 TestAreaPanel 获取用户输入的测试变量
 * 2. 验证数据有效性
 * 3. 调用内部测试器执行测试
 */
const handleTestWithVariables = async () => {
    try {
        // 验证组件引用是否可用
        if (!testAreaPanelRef.value) {
            console.warn(
                "[ContextUserWorkspace] testAreaPanelRef not available, using empty variables",
            );
            return;
        }

        // 获取测试变量
        const getVariableValues = testAreaPanelRef.value.getVariableValues;
        if (typeof getVariableValues !== "function") {
            console.warn(
                "[ContextUserWorkspace] getVariableValues method not found, using empty variables",
            );
            return;
        }

        const testVariables = getVariableValues() || {};

        // 验证返回值类型
        if (typeof testVariables !== "object" || testVariables === null) {
            console.error(
                "[ContextUserWorkspace] Invalid test variables type:",
                typeof testVariables,
            );
            window.$message?.error(t("test.invalidVariables"));
            return;
        }

        // 🆕 重新测试时清理之前的评估结果
        evaluationHandler.clearBeforeTest();

        // 🆕 调用内部测试器执行测试
        await contextUserTester.executeTest(
            contextUserOptimization.prompt,
            contextUserOptimization.optimizedPrompt,
            props.isCompareMode,
            testVariables
        );
    } catch (error) {
        console.error(
            "[ContextUserWorkspace] Failed to execute test:",
            error,
        );
        window.$message?.error(t("test.getVariablesFailed"));
    }
};

// 🆕 处理应用改进建议事件（使用 evaluationHandler 提供的工厂方法）
const handleApplyImprovement = evaluationHandler.createApplyImprovementHandler(promptPanelRef);

// 处理保存本地编辑
const handleSaveLocalEdit = async (payload: { note?: string }) => {
    await contextUserOptimization.saveLocalEdit({
        optimizedPrompt: contextUserOptimization.optimizedPrompt || '',
        note: payload.note,
        source: 'manual',
    });
};

// 暴露 TestAreaPanel 引用给父组件（用于工具调用等高级功能）
defineExpose({
    testAreaPanelRef,
    restoreFromHistory,
    contextUserOptimization,  // 🆕 暴露优化器状态，供父组件访问（如AI变量提取）
    temporaryVariables,        // 🆕 暴露临时变量，供父组件访问
    // 🆕 提供最小可用的公开 API，避免父组件依赖内部实现细节（不再需要 as any 访问内部状态）
    setPrompt: (prompt: string) => {
        contextUserOptimization.prompt = prompt;
    },
    getPrompt: () => contextUserOptimization.prompt || '',
    getOptimizedPrompt: () => contextUserOptimization.optimizedPrompt || '',
    getTemporaryVariableNames: () => Object.keys(temporaryVariables.value || {}),
    openIterateDialog: (initialContent?: string) => {
        promptPanelRef.value?.openIterateDialog?.(initialContent);
    },
    applyLocalPatch: (operation: PatchOperation) => {
        // 直接覆盖当前 optimizedPrompt（不自动创建新版本）
        // 用户可通过"保存修改"按钮显式保存为新版本
        const current = contextUserOptimization.optimizedPrompt || '';
        const result = applyPatchOperationsToText(current, operation);
        contextUserOptimization.optimizedPrompt = result.text;
        if (!result.ok) {
            window.$message?.warning(t('toast.warning.patchApplyFailed'));
        } else {
            window.$message?.success(t('evaluation.diagnose.applyFix'));
        }
    },
    reEvaluateActive: async () => {
        await evaluationHandler.handleReEvaluate();
    },
});
</script>
