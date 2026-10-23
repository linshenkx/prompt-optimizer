<template>
    <NFlex vertical :style="{ height: mode === 'full' ? '100%' : 'auto', gap: '12px' }">
        <TemporaryVariablesPanel
            :compact="compact"
            :manager="variableManager"
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

            <!-- 测试结果区域（支持对比模式）-->
            <TestResultSection
                :is-compare-mode="isCompareMode"
                :vertical-layout="adaptiveResultVerticalLayout"
                :show-primary="isCompareMode"
                :primary-title="t('test.compareResultA')"
                :secondary-title="t('test.compareResultB')"
                :single-result-title="singleResultTitle"
                :primary-result="primaryTestResult"
                :secondary-result="secondaryTestResult"
                :single-result="testResult"
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
                    <div class="result-container">
                        <ToolCallDisplay
                            v-if="variantToolCalls[COMPARE_BASELINE_VARIANT_ID].length > 0"
                            :tool-calls="variantToolCalls[COMPARE_BASELINE_VARIANT_ID]"
                            :size="
                                adaptiveButtonSize === 'small' ? 'small' : 'medium'
                            "
                            class="tool-calls-section"
                        />

                        <div class="result-body">
                            <slot name="primary-result"></slot>
                        </div>
                    </div>
                </template>

                <template #secondary-result>
                    <div class="result-container">
                        <ToolCallDisplay
                            v-if="variantToolCalls[COMPARE_CANDIDATE_VARIANT_ID].length > 0"
                            :tool-calls="variantToolCalls[COMPARE_CANDIDATE_VARIANT_ID]"
                            :size="
                                adaptiveButtonSize === 'small' ? 'small' : 'medium'
                            "
                            class="tool-calls-section"
                        />

                        <div class="result-body">
                            <slot name="secondary-result"></slot>
                        </div>
                    </div>
                </template>

                <!-- 单一结果模式 -->
                <template #single-result>
                    <div class="result-container">
                        <!-- 工具调用显示 -->
                        <ToolCallDisplay
                            v-if="variantToolCalls[SINGLE_TEST_VARIANT_ID].length > 0"
                            :tool-calls="variantToolCalls[SINGLE_TEST_VARIANT_ID]"
                            :size="
                                adaptiveButtonSize === 'small' ? 'small' : 'medium'
                            "
                            class="tool-calls-section"
                        />

                        <div class="result-body">
                            <slot name="single-result"></slot>
                        </div>
                    </div>
                </template>
            </TestResultSection>
        </template>
    </NFlex>
</template>

<script setup lang="ts">
import { computed, reactive, onUnmounted, toRef } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NFlex,
    NCard,
} from "naive-ui";
import type {
    OptimizationMode,
    AdvancedTestResult,
    ToolCallResult,
    EvaluationResponse,
    EvaluationType,
    PatchOperation,
} from "@prompt-optimizer/core";
import type { ScoreLevel } from '../../composables/prompt/useEvaluation';
import { useResponsive } from '../../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../../composables/performance/useDebounceThrottle";
import {
    COMPARE_BASELINE_VARIANT_ID,
    COMPARE_CANDIDATE_VARIANT_ID,
    SINGLE_TEST_VARIANT_ID,
} from "../../composables/prompt/testVariantState";
import TestControlBar from "../TestControlBar.vue";
import TestResultSection from "../TestResultSection.vue";
import ToolCallDisplay from "../ToolCallDisplay.vue";
import TemporaryVariablesPanel from "../variable/TemporaryVariablesPanel.vue";
import { useTestVariableManager } from "../../composables/variable/useTestVariableManager";

const { t } = useI18n();

// 性能监控
const { recordUpdate, getPerformanceReport } = usePerformanceMonitor("ConversationTestPanel");

// 防抖节流
const { debounce, throttle } = useDebounceThrottle();

// 响应式配置
const {
    shouldUseVerticalLayout,
    buttonSize: responsiveButtonSize,
} = useResponsive();

interface Props {
    /**
     * 渲染模式：
     * - full: 变量表单 + 测试控制栏 + 结果区（历史行为）
     * - variables-only: 仅变量表单（供 Workspace 自行渲染多列 variants 测试区）
     */
    mode?: "full" | "variables-only";
    compact?: boolean;

    // 核心状态
    optimizationMode: OptimizationMode;
    isTestRunning?: boolean;

    // 🆕 对比模式
    isCompareMode?: boolean;
    enableCompareMode?: boolean;

    // 模型信息（用于显示标签）
    modelName?: string;

    // 变量管理
    globalVariables?: Record<string, string>;
    predefinedVariables?: Record<string, string>;
    temporaryVariables?: Record<string, string>;

    // 布局配置
    inputMode?: "compact" | "normal";
    buttonSize?: "small" | "medium" | "large";
    resultVerticalLayout?: boolean;

    // 结果显示配置
    singleResultTitle?: string;

    // 🆕 测试结果数据（支持对比模式）
    testResult?: AdvancedTestResult;
    primaryTestResult?: AdvancedTestResult;
    secondaryTestResult?: AdvancedTestResult;

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
    isTestRunning: false,
    isCompareMode: false,
    enableCompareMode: true,
    inputMode: "normal",
    buttonSize: "medium",
    resultVerticalLayout: false,
    singleResultTitle: "",
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    temporaryVariables: () => ({}),
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
    test: [testVariables: Record<string, string>];
    "update:isCompareMode": [value: boolean];
    "compare-toggle": [];
    "open-variable-manager": [];
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string];
    "tool-call": [toolCall: ToolCallResult, variantId?: string];
    "tool-calls-updated": [toolCalls: ToolCallResult[], variantId?: string];
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

// 🆕 工具调用状态管理（按 variantId 分桶）
const variantToolCalls = reactive<Record<string, ToolCallResult[]>>({
    [COMPARE_BASELINE_VARIANT_ID]: [],
    [COMPARE_CANDIDATE_VARIANT_ID]: [],
    [SINGLE_TEST_VARIANT_ID]: [],
});

const ensureToolCallBucket = (variantId: string): ToolCallResult[] => {
    if (!variantToolCalls[variantId]) {
        variantToolCalls[variantId] = [];
    }
    return variantToolCalls[variantId];
};

// 🆕 处理对比模式切换
const handleCompareToggle = () => {
    emit("update:isCompareMode", !props.isCompareMode);
    emit("compare-toggle");
    recordUpdate();
};

// 🆕 处理工具调用的方法（支持对比模式）
const handleToolCall = (toolCall: ToolCallResult, variantId?: string) => {
    const resolvedVariantId =
        variantId ||
        (props.isCompareMode ? COMPARE_CANDIDATE_VARIANT_ID : SINGLE_TEST_VARIANT_ID);
    const bucket = ensureToolCallBucket(resolvedVariantId);
    bucket.push(toolCall);

    emit("tool-call", toolCall, resolvedVariantId);
    emit("tool-calls-updated", bucket, resolvedVariantId);
    recordUpdate();
};

// 🆕 清除工具调用数据的方法（按 variantId 分桶）
const clearToolCalls = (variantId?: string) => {
    if (!variantId) {
        Object.keys(variantToolCalls).forEach((key) => {
            variantToolCalls[key] = [];
        });
        return;
    }
    variantToolCalls[variantId] = [];
};

// 响应式布局配置
const adaptiveButtonSize = computed(() => {
    return props.buttonSize ?? responsiveButtonSize.value;
});

const adaptiveResultVerticalLayout = computed(() => {
    return shouldUseVerticalLayout.value || props.resultVerticalLayout;
});

// 主要操作按钮文本
const primaryActionText = computed(() => {
    if (props.isTestRunning) {
        return t("test.testing");
    }
    return t("test.startTest");
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
        emit('variable-change', name, value)
        recordUpdate()
    },
    onSaveToGlobal: (name, value) => {
        emit('save-to-global', name, value)
        recordUpdate()
    },
    onVariableRemove: (name) => {
        emit('temporary-variable-remove', name)
        recordUpdate()
    },
    onVariablesClear: () => {
        emit('temporary-variables-clear')
        recordUpdate()
    },
})

const getVariableValues = () => {
    return variableManager.getVariableValues()
}

const setVariableValues = (values: Record<string, string>) => {
    variableManager.setVariableValues(values)
}

// 开发环境下的性能调试
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn('ConversationTestPanel performance is poor:', report);
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
    handleToolCall,
    clearToolCalls,
    getToolCalls: () => ({ ...variantToolCalls }),
    getVariableValues,
    setVariableValues,
    // 预览功能占位符（兼容接口）
    showPreview: () => {},
    hidePreview: () => {},
});
</script>

<style scoped>
.result-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.result-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.tool-calls-section {
    flex: 0 0 auto;
}

.result-container:has(.tool-call-display) :deep(.n-empty) {
    display: none;
}
</style>
