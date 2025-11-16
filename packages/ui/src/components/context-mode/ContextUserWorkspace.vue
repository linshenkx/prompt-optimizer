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
                    @save-favorite="emit('save-favorite', $event)"
                    @open-preview="emit('open-prompt-preview')"
                />
            </NCard>
        </NFlex>

        <!-- 右侧：测试区域 -->
        <NFlex
            vertical
            :size="12"
            style="flex: 1; height: 100%; overflow: auto"
        >
            <!-- 测试区域操作栏 -->
            <NCard size="small" style="flex-shrink: 0">
                <NFlex justify="space-between" align="center">
                    <!-- 左侧：区域标识 -->
                        <NText strong>{{ $t("test.areaTitle") }}</NText>

                    <!-- 右侧：快捷操作按钮 -->
                    <NFlex :size="8">
                        <!-- 全局变量管理 -->
                        <NButton
                            size="small"
                            quaternary
                            @click="emit('open-global-variables')"
                            :title="$t('contextMode.actions.globalVariables')"
                        >
                            <template #icon><span>📊</span></template>
                            <span v-if="!isMobile">{{
                                $t("contextMode.actions.globalVariables")
                            }}</span>
                        </NButton>

                        <!-- 工具管理 (仅用户模式显示) -->
                        <NButton
                            size="small"
                            quaternary
                            @click="emit('open-tool-manager')"
                            :title="$t('contextMode.actions.toolManager')"
                        >
                            <template #icon><span>🔧</span></template>
                            <span v-if="!isMobile">{{
                                $t("contextMode.actions.toolManager")
                            }}</span>
                        </NButton>
                    </NFlex>
                </NFlex>
            </NCard>

            <!-- 测试区域主内容 -->
            <NCard
                style="flex: 1; overflow: auto"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <TestAreaPanel
                    ref="testAreaPanelRef"
                    :optimization-mode="optimizationMode"
                    context-mode="user"
                    :optimized-prompt="contextUserOptimization.optimizedPrompt"
                    :is-test-running="contextUserTester.testResults.isTestingOriginal || contextUserTester.testResults.isTestingOptimized"
                    :global-variables="globalVariables"
                    :predefined-variables="predefinedVariables"
                    :temporary-variables="temporaryVariables"
                    :testContent="testContent"
                    @update:testContent="emit('update:testContent', $event)"
                    :isCompareMode="isCompareMode"
                    @update:isCompareMode="emit('update:isCompareMode', $event)"
                    :enable-compare-mode="true"
                    :enable-fullscreen="true"
                    :input-mode="inputMode"
                    :control-bar-layout="controlBarLayout"
                    :button-size="buttonSize"
                    :conversation-max-height="conversationMaxHeight"
                    :show-original-result="true"
                    :result-vertical-layout="resultVerticalLayout"
                    @test="handleTestWithVariables"
                    @compare-toggle="emit('compare-toggle')"
                    @open-variable-manager="emit('open-variable-manager')"
                    @variable-change="handleTestVariableChange"
                    @save-to-global="
                        (name: string, value: string) =>
                            emit('save-to-global', name, value)
                    "
                    @temporary-variable-remove="handleTestVariableRemove"
                    @temporary-variables-clear="handleClearTemporaryVariables"
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
                </TestAreaPanel>
            </NCard>
        </NFlex>
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
import { NCard, NFlex, NButton, NText } from "naive-ui";
import { useBreakpoints } from "@vueuse/core";
import InputPanelUI from "../InputPanel.vue";
import PromptPanelUI from "../PromptPanel.vue";
import TestAreaPanel from "../TestAreaPanel.vue";
import OutputDisplay from "../OutputDisplay.vue";
import type { OptimizationMode } from "../../types";
import type {
    PromptRecord,
    Template,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { AppServices } from '../../types/services';
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager';
import { useTemporaryVariables } from "../../composables/variable/useTemporaryVariables";
import { useContextUserOptimization } from '../../composables/prompt/useContextUserOptimization';
import { useContextUserTester } from '../../composables/prompt/useContextUserTester';

// ========================
// 响应式断点配置
// ========================
const breakpoints = useBreakpoints({
    mobile: 640,
    tablet: 1024,
});
const isMobile = breakpoints.smaller("mobile");

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
    /** 优化模板 */
    selectedTemplate: Template | null;
    /** 选中的迭代模板 */
    selectedIterateTemplate: Template | null;

    // --- 测试数据 ---
    /** 测试输入内容 */
    testContent: string;
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
    /** 输入模式 */
    inputMode?: "compact" | "normal";
    /** 控制栏布局 */
    controlBarLayout?: "default" | "compact" | "minimal";
    /** 按钮尺寸 */
    buttonSize?: "small" | "medium" | "large";
    /** 对话历史最大高度 */
    conversationMaxHeight?: number;
    /** 结果区域是否垂直布局 */
    resultVerticalLayout?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isTestRunning: false,
    inputMode: "normal",
    controlBarLayout: "default",
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
    "update:testContent": [value: string];
    "update:isCompareMode": [value: boolean];

    // --- 操作事件 ---
    /** 切换对比模式 */
    "compare-toggle": [];
    /** 保存到收藏 */
    "save-favorite": [data: SaveFavoritePayload];

    // --- 打开面板/管理器 ---
    /** 打开全局变量管理器 */
    "open-global-variables": [];
    /** 打开工具管理器 */
    "open-tool-manager": [];
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
    // 🆕 使用 composable 方法删除变量
    if (tempVarsManager.hasVariable(name)) {
        tempVarsManager.deleteVariable(name);
    }
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
        iterateInput: payload.iterationNote
    });
};

/**
 * 🆕 处理版本切换事件
 */
const handleSwitchVersion = (version: PromptRecord) => {
    contextUserOptimization.switchVersion(version);
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

        // 🆕 调用内部测试器执行测试
        await contextUserTester.executeTest(
            contextUserOptimization.prompt,
            contextUserOptimization.optimizedPrompt,
            props.testContent,
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

// 暴露 TestAreaPanel 引用给父组件（用于工具调用等高级功能）
defineExpose({
    testAreaPanelRef
});
</script>
