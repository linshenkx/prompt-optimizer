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
            <!-- 提示词输入面板 -->
            <NCard style="flex-shrink: 0; min-height: 200px">
                <InputPanelUI
                    v-model="contextUserOptimization.prompt"
                    :label="t('promptOptimizer.userPromptInput')"
                    :placeholder="t('promptOptimizer.userPromptPlaceholder')"
                    :help-text="variableGuideInlineHint"
                    :model-label="t('promptOptimizer.optimizeModel')"
                    :template-label="t('promptOptimizer.templateLabel')"
                    :button-text="t('promptOptimizer.optimize')"
                    :loading-text="t('common.loading')"
                    :loading="contextUserOptimization.isOptimizing"
                    :disabled="contextUserOptimization.isOptimizing"
                    :show-preview="true"
                    @submit="handleOptimize"
                    @configModel="emit('config-model')"
                    @open-preview="emit('open-input-preview')"
                    :enable-variable-extraction="true"
                    :existing-global-variables="existingGlobalVariableNames"
                    :existing-temporary-variables="existingTemporaryVariableNames"
                    :predefined-variables="predefinedVariableNames"
                    :global-variable-values="globalVariableValues"
                    :temporary-variable-values="temporaryVariableValues"
                    :predefined-variable-values="predefinedVariableValues"
                    @variable-extracted="handleVariableExtracted"
                    @add-missing-variable="handleAddMissingVariable"
                >
                    <!-- 模型选择插槽 -->
                    <template #model-select>
                        <slot name="optimize-model-select"></slot>
                    </template>

                    <!-- 模板选择插槽 -->
                    <template #template-select>
                        <slot name="template-select"></slot>
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
                    @update:optimizedPrompt="contextUserOptimization.optimizedPrompt = $event"
                    :reasoning="contextUserOptimization.optimizedReasoning"
                    :original-prompt="contextUserOptimization.prompt"
                    :is-optimizing="contextUserOptimization.isOptimizing"
                    :is-iterating="contextUserOptimization.isIterating"
                    :selectedIterateTemplate="selectedIterateTemplate"
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
            :optimized-prompt="contextUserOptimization.optimizedPrompt"
            :is-test-running="contextUserTester.testResults.isTestingOriginal || contextUserTester.testResults.isTestingOptimized"
            :is-compare-mode="isCompareMode"
            @update:isCompareMode="emit('update:isCompareMode', $event)"
            :model-name="props.testModelName"
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
                <slot name="test-model-select"></slot>
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

        <!-- 🆕 评估详情面板 -->
        <EvaluationPanel
            v-bind="evaluationHandler.panelProps.value"
            @close="evaluationHandler.evaluation.closePanel"
            @re-evaluate="evaluationHandler.handleReEvaluate"
            @apply-improvement="handleApplyImprovement"
        />
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
import { ref, computed, inject, type Ref } from 'vue'

import { useI18n } from "vue-i18n";
import { NCard, NFlex } from "naive-ui";
import InputPanelUI from "../InputPanel.vue";
import PromptPanelUI from "../PromptPanel.vue";
import ContextUserTestPanel from "./ContextUserTestPanel.vue";
import OutputDisplay from "../OutputDisplay.vue";
import { EvaluationPanel } from "../evaluation";
import type { OptimizationMode } from "../../types";
import type {
    PromptRecord,
    PromptRecordChain,
    Template,
    ProUserEvaluationContext,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { AppServices } from '../../types/services';
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager';
import { useTemporaryVariables } from "../../composables/variable/useTemporaryVariables";
import { useContextUserOptimization } from '../../composables/prompt/useContextUserOptimization';
import { useContextUserTester } from '../../composables/prompt/useContextUserTester';
import { useEvaluationHandler } from '../../composables/prompt/useEvaluationHandler';

// ========================
// Props 定义
// ========================
interface Props {
    // --- 核心状态 ---
    /** 优化模式 */
    optimizationMode: OptimizationMode;

    // --- 🆕 模型和模板配置（用于初始化 composables）---
    /** 优化模型 */
    selectedOptimizeModel: string;
    /** 测试模型 */
    selectedTestModel: string;
    /** 测试模型名称（用于显示标签） */
    testModelName?: string;
    /** 优化模板 */
    selectedTemplate: Template | null;
    /** 选中的迭代模板 */
    selectedIterateTemplate: Template | null;

    // --- 测试数据 ---
    /** 是否启用对比模式 */
    isCompareMode: boolean;
    /** 是否正在执行测试（兼容性保留，实际由内部管理）*/
    isTestRunning?: boolean;

    // --- 变量数据 ---
    /** 全局变量 (持久化存储) */
    globalVariables: Record<string, string>;
    /** 预定义变量 (系统内置) */
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
    isTestRunning: false,
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
// 注入服务和变量管理器
// ========================
const services = inject<Ref<AppServices | null>>('services');
const variableManager = inject<VariableManagerHooks | null>('variableManager');

// ========================
// 内部状态管理
// ========================
/** 🆕 使用全局临时变量管理器 (从文本提取的变量,仅当前会话有效) */
const tempVarsManager = useTemporaryVariables();
const temporaryVariables = tempVarsManager.temporaryVariables;

// 🆕 初始化 ContextUser 专属优化器
const contextUserOptimization = useContextUserOptimization(
    services || ref(null),
    computed(() => props.selectedOptimizeModel),
    computed(() => props.selectedTemplate),
    computed(() => props.selectedIterateTemplate)
);

// 🆕 初始化 ContextUser 专属测试器
const contextUserTester = useContextUserTester(
    services || ref(null),
    computed(() => props.selectedTestModel),
    variableManager
);

// 🆕 构建 Pro-User 评估上下文
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
        const varPattern = /\{\{(\w+)\}\}/g;
        let match;
        if (rawPrompt) {
            while ((match = varPattern.exec(rawPrompt)) !== null) {
                usedVarNames.add(match[1]);
            }
        }
        if (resolvedPrompt) {
            varPattern.lastIndex = 0; // 重置正则表达式
            while ((match = varPattern.exec(resolvedPrompt)) !== null) {
                usedVarNames.add(match[1]);
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

// 🆕 测试结果数据
const testResultsData = computed(() => ({
    originalResult: contextUserTester.testResults.originalResult || undefined,
    optimizedResult: contextUserTester.testResults.optimizedResult || undefined,
}));

// 🆕 初始化评估处理器
const evaluationHandler = useEvaluationHandler({
    services: services || ref(null),
    originalPrompt: computed(() => contextUserOptimization.prompt),
    optimizedPrompt: computed(() => contextUserOptimization.optimizedPrompt),
    testContent: computed(() => ''), // 变量模式不需要单独的测试内容，通过变量系统管理
    testResults: testResultsData,
    evaluationModelKey: computed(() => props.selectedOptimizeModel),
    functionMode: computed(() => 'pro'),
    subMode: computed(() => 'user'),
    proContext,
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
    contextUserOptimization.optimize();
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

// 暴露 TestAreaPanel 引用给父组件（用于工具调用等高级功能）
defineExpose({
    testAreaPanelRef,
    restoreFromHistory
});
</script>
