<template>
    <NFlex vertical :style="{ height: mode === 'full' ? '100%' : 'auto', gap: '12px' }">
        <TemporaryVariablesPanel
            :compact="compact"
            :manager="variableManager"
            :show-generate-values="true"
            :is-generating="isGenerating"
            @generate-values="handleGenerateValues"
        />

        <template v-if="mode === 'full'">
            <!-- 控制工具栏 -->
            <NCard :style="{ flexShrink: 0 }" size="small">
                <TestControlBar
                    :model-label="t('test.model')"
                    :model-name="modelName"
                    :show-compare-toggle="enableCompareMode"
                    :is-compare-mode="isCompareMode"
                    @compare-toggle="handleCompareToggle"
                    :primary-action-text="primaryActionText"
                    :primary-action-disabled="primaryActionDisabled"
                    :primary-action-loading="isTestRunning"
                    :button-size="adaptiveButtonSize"
                    @primary-action="handleTest"
                >
                    <template #model-select>
                        <slot name="model-select"></slot>
                    </template>
                    <template #secondary-controls>
                        <slot name="secondary-controls"></slot>
                    </template>
                    <template #custom-actions>
                        <slot name="custom-actions"></slot>
                    </template>
                </TestControlBar>
            </NCard>

            <!-- 测试结果区域（不支持工具调用，仅显示文本结果）-->
            <TestResultSection
                :is-compare-mode="isCompareMode"
                :vertical-layout="adaptiveResultVerticalLayout"
                :show-primary="isCompareMode"
                :primary-title="t('test.compareResultA')"
                :secondary-title="t('test.compareResultB')"
                :single-result-title="singleResultTitle"
                :size="adaptiveButtonSize"
                :style="{ flex: 1, minHeight: 0 }"
                :show-evaluation="showEvaluation"
                :has-primary-result="hasPrimaryResult"
                :has-secondary-result="hasSecondaryResult"
                :is-evaluating-primary="isEvaluatingPrimary"
                :is-evaluating-secondary="isEvaluatingSecondary"
                :primary-score="primaryScore"
                :secondary-score="secondaryScore"
                :has-primary-evaluation="hasPrimaryEvaluation"
                :has-secondary-evaluation="hasSecondaryEvaluation"
                :primary-evaluation-result="primaryEvaluationResult"
                :secondary-evaluation-result="secondaryEvaluationResult"
                :primary-score-level="primaryScoreLevel"
                :secondary-score-level="secondaryScoreLevel"
                @evaluate-primary="emit('evaluate-primary')"
                @evaluate-secondary="emit('evaluate-secondary')"
                @evaluate-with-feedback="emit('evaluate-with-feedback', $event)"
                @show-primary-detail="emit('show-primary-detail')"
                @show-secondary-detail="emit('show-secondary-detail')"
                @apply-improvement="emit('apply-improvement', $event)"
                @apply-patch="emit('apply-patch', $event)"
            >
                <template #primary-result>
                    <slot name="primary-result"></slot>
                </template>

                <template #secondary-result>
                    <slot name="secondary-result"></slot>
                </template>

                <!-- 单一结果模式 -->
                <template #single-result>
                    <slot name="single-result"></slot>
                </template>
            </TestResultSection>
        </template>

        <!-- 变量值预览对话框 -->
        <VariableValuePreviewDialog
            v-model:show="showPreviewDialog"
            :result="generationResult"
            @confirm="confirmBatchApply"
        />
    </NFlex>
</template>

<script setup lang="ts">
import { computed, onUnmounted, toRef } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NFlex,
    NCard,
} from "naive-ui";
import { useResponsive } from '../../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../../composables/performance/useDebounceThrottle";
import { useTestVariableManager } from "../../composables/variable/useTestVariableManager";
import { useSmartVariableValueGeneration } from "../../composables/variable/useSmartVariableValueGeneration";
import TestControlBar from "../TestControlBar.vue";
import TestResultSection from "../TestResultSection.vue";
import TemporaryVariablesPanel from "../variable/TemporaryVariablesPanel.vue";
import VariableValuePreviewDialog from "../variable/VariableValuePreviewDialog.vue";
import type { EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core';
import type { ScoreLevel } from '../../composables/prompt/useEvaluation';
import type { AppServices } from '../../types/services';

const { t } = useI18n();

// 性能监控
const { recordUpdate, getPerformanceReport } = usePerformanceMonitor("ContextUserTestPanel");

// 防抖节流
const { debounce, throttle } = useDebounceThrottle();

// 响应式配置
const {
    shouldUseVerticalLayout,
    buttonSize,
} = useResponsive();

interface Props {
    /**
     * 渲染模式：
     * - full: 变量表单 + 测试控制栏 + 结果区（历史行为）
     * - variables-only: 仅变量表单（供 Workspace 自行渲染多列 variants 测试区）
     */
    mode?: "full" | "variables-only";
    compact?: boolean;

    // 原始提示词（fallback，当optimizedPrompt为空时使用）
    prompt?: string;
    // 优化后的提示词（优先使用）
    optimizedPrompt?: string;

    // 测试状态
    isTestRunning?: boolean;
    isCompareMode?: boolean;
    enableCompareMode?: boolean;

    // 模型信息（用于显示标签）
    modelName?: string;
    // 🆕 评估模型（用于变量提取和变量值生成）
    evaluationModelKey?: string;

    // 变量管理（三层）
    globalVariables?: Record<string, string>;
    predefinedVariables?: Record<string, string>;
    temporaryVariables?: Record<string, string>;

    // 🆕 应用服务
    services?: AppServices | null;

    // 布局配置
    buttonSize?: "small" | "medium" | "large";
    resultVerticalLayout?: boolean;

    // 结果显示配置
    singleResultTitle?: string;

    // 🆕 评估功能配置
    showEvaluation?: boolean;
    // 是否有测试结果（用于显示评估按钮）
    hasPrimaryResult?: boolean;
    hasSecondaryResult?: boolean;
    // 评估状态
    isEvaluatingPrimary?: boolean;
    isEvaluatingSecondary?: boolean;
    // 评估分数
    primaryScore?: number | null;
    secondaryScore?: number | null;
    // 是否有评估结果
    hasPrimaryEvaluation?: boolean;
    hasSecondaryEvaluation?: boolean;
    // 评估结果和等级（用于悬浮预览）
    primaryEvaluationResult?: EvaluationResponse | null;
    secondaryEvaluationResult?: EvaluationResponse | null;
    primaryScoreLevel?: ScoreLevel | null;
    secondaryScoreLevel?: ScoreLevel | null;
}

const props = withDefaults(defineProps<Props>(), {
    mode: "full",
    compact: false,
    prompt: "",
    optimizedPrompt: "",
    isTestRunning: false,
    isCompareMode: false,
    enableCompareMode: true,
    buttonSize: "medium",
    resultVerticalLayout: false,
    singleResultTitle: "",
    evaluationModelKey: "",
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    temporaryVariables: () => ({}),
    services: null,
    // 评估默认值
    showEvaluation: false,
    hasPrimaryResult: false,
    hasSecondaryResult: false,
    isEvaluatingPrimary: false,
    isEvaluatingSecondary: false,
    primaryScore: null,
    secondaryScore: null,
    hasPrimaryEvaluation: false,
    hasSecondaryEvaluation: false,
    primaryEvaluationResult: null,
    secondaryEvaluationResult: null,
    primaryScoreLevel: null,
    secondaryScoreLevel: null,
});

const emit = defineEmits<{
    "update:isCompareMode": [value: boolean];
    test: [testVariables: Record<string, string>];
    "compare-toggle": [];
    "open-variable-manager": [];
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string];
    "temporary-variable-remove": [name: string];
    "temporary-variables-clear": [];
    // 🆕 评估相关事件
    "evaluate-primary": [];
    "evaluate-secondary": [];
    "evaluate-with-feedback": [payload: { type: EvaluationType; feedback: string }];
    "show-primary-detail": [];
    "show-secondary-detail": [];
    "apply-improvement": [payload: { improvement: string; type: EvaluationType }];
    "apply-patch": [payload: { operation: PatchOperation }];
}>();

// 处理对比模式切换
const handleCompareToggle = () => {
    emit("update:isCompareMode", !props.isCompareMode);
    emit("compare-toggle");
    recordUpdate();
};

// 响应式布局配置
const adaptiveButtonSize = computed(() => {
    return buttonSize.value;
});

const adaptiveResultVerticalLayout = computed(() => {
    return shouldUseVerticalLayout.value || props.resultVerticalLayout;
});

// 主要操作按钮文本
const primaryActionText = computed(() => {
    if (props.isTestRunning) {
        return t("test.testing");
    }
    return props.isCompareMode
        ? t("test.startCompare")
        : t("test.startTest");
});

// 主要操作按钮禁用状态
const primaryActionDisabled = computed(() => {
    return props.isTestRunning;
});

const handleTest = throttle(
    () => {
        // 获取并传递测试变量
        const testVars = getVariableValues();
        emit("test", testVars);
        recordUpdate();
    },
    200,
    "handleTest",
);

// ========== 变量管理 ==========

const variableManager = useTestVariableManager({
    globalVariables: toRef(props, 'globalVariables'),
    predefinedVariables: toRef(props, 'predefinedVariables'),
    temporaryVariables: toRef(props, 'temporaryVariables'),
    onVariableChange: (name, value) => {
        emit('variable-change', name, value);
        recordUpdate();
    },
    onSaveToGlobal: (name, value) => {
        emit('save-to-global', name, value);
        recordUpdate();
    },
    onVariableRemove: (name) => {
        emit('temporary-variable-remove', name);
        recordUpdate();
    },
    onVariablesClear: () => {
        emit('temporary-variables-clear');
        recordUpdate();
    },
});

const {
    sortedVariables: displayVariables,
    getVariableSource,
    getVariableDisplayValue,
    handleVariableValueChange,
    getVariableValues,
    setVariableValues,
} = variableManager;

// ========== 变量值生成 ==========

const {
    isGenerating,
    generationResult,
    showPreviewDialog,
    handleGenerateValues,
    confirmBatchApply,
} = useSmartVariableValueGeneration({
    services: toRef(props, 'services'),
    promptContent: computed(() => props.optimizedPrompt || props.prompt),
    variableNames: displayVariables,
    getVariableValue: (name: string) => getVariableDisplayValue(name),
    getVariableSource: (name: string) => getVariableSource(name),
    applyValue: (name: string, value: string) => {
        handleVariableValueChange(name, value)
    },
    evaluationModelKey: computed(() => props.evaluationModelKey || ''),
})

// 开发环境下的性能调试
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn('ContextUserTestPanel performance is poor:', report);
            }
        },
        5000,
        false,
        "performanceLog",
    );

    const timer = setInterval(logPerformance, 10000);
    onUnmounted(() => clearInterval(timer));
}

// 暴露方法供父组件调用（兼容 TestAreaPanelInstance 接口）
defineExpose({
    // ContextUser 不支持工具调用，提供空实现
    clearToolCalls: () => {},
    handleToolCall: () => {},
    getToolCalls: () => ({}),

    // 变量管理
    getVariableValues,
    setVariableValues,

    // 预览功能占位符（兼容接口）
    showPreview: () => {},
    hidePreview: () => {},
});
</script>

<style scoped>
/* ContextUser 不需要工具调用相关样式 */
</style>
