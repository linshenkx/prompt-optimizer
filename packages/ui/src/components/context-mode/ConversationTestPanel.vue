<template>
    <NFlex vertical :style="{ height: '100%' }">
        <!-- 变量值输入表单 -->
        <div
            v-if="showVariableForm"
            :style="{ flexShrink: 0, marginBottom: '16px' }"
        >
            <NCard
                :title="t('test.variables.formTitle')"
                size="small"
                :bordered="true"
            >
                <template #header-extra>
                    <NSpace :size="8">
                        <NTag :bordered="false" type="info" size="small">
                            {{ t("test.variables.tempCount", { count: displayVariables.length }) }}
                        </NTag>
                        <NButton
                            size="small"
                            quaternary
                            @click="handleClearAllVariables"
                        >
                            {{ t("test.variables.clearAll") }}
                        </NButton>
                    </NSpace>
                </template>

                <NSpace vertical :size="12">
                    <!-- 变量输入项 -->
                    <div
                        v-for="varName in displayVariables"
                        :key="varName"
                        :style="{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }"
                    >
                        <NTag
                            size="small"
                            :bordered="false"
                            :type="
                                getVariableSource(varName) === 'predefined'
                                    ? 'success'
                                    : getVariableSource(varName) === 'test'
                                      ? 'warning'
                                      : 'default'
                            "
                            :style="{ minWidth: '120px', flexShrink: 0 }"
                        >
                            <span v-text="`{{${varName}}}`"></span>
                        </NTag>
                        <NInput
                            :value="getVariableDisplayValue(varName)"
                            :placeholder="getVariablePlaceholder(varName)"
                            size="small"
                            :style="{ flex: 1 }"
                            @update:value="
                                handleVariableValueChange(varName, $event)
                            "
                        />
                        <!-- 删除按钮 (仅临时变量显示) -->
                        <NButton
                            v-if="getVariableSource(varName) === 'test'"
                            size="small"
                            quaternary
                            @click="handleDeleteVariable(varName)"
                            :title="t('test.variables.delete')"
                        >
                            🗑️
                        </NButton>
                        <!-- 保存到全局按钮 (仅测试变量显示) -->
                        <NButton
                            v-if="getVariableSource(varName) === 'test'"
                            size="small"
                            quaternary
                            @click="handleSaveToGlobal(varName)"
                            :title="t('test.variables.saveToGlobal')"
                        >
                            💾
                        </NButton>
                    </div>

                    <!-- 无变量提示 -->
                    <NEmpty
                        v-if="displayVariables.length === 0"
                        :description="t('test.variables.noVariables')"
                        size="small"
                    />

                    <!-- 操作按钮 -->
                    <NSpace :size="8" justify="end">
                        <!-- 添加变量按钮 -->
                        <NButton
                            size="small"
                            @click="showAddVariableDialog = true"
                        >
                            {{ t("test.variables.addVariable") }}
                        </NButton>
                    </NSpace>
                </NSpace>
            </NCard>
        </div>

        <!-- 添加变量对话框 -->
        <NModal
            v-model:show="showAddVariableDialog"
            preset="dialog"
            :title="t('test.variables.addVariable')"
            :positive-text="t('common.confirm')"
            :negative-text="t('common.cancel')"
            :on-positive-click="handleAddVariable"
            :mask-closable="false"
        >
            <NSpace vertical :size="12" style="margin-top: 16px;">
                <NFormItem
                    :label="t('variableExtraction.variableName')"
                    :validation-status="
                        newVariableNameError ? 'error' : undefined
                    "
                    :feedback="newVariableNameError"
                >
                    <NInput
                        v-model:value="newVariableName"
                        :placeholder="
                            t('variableExtraction.variableNamePlaceholder')
                        "
                        @input="validateNewVariableName"
                    />
                </NFormItem>

                <NFormItem :label="t('variableExtraction.variableValue')">
                    <NInput
                        v-model:value="newVariableValue"
                        :placeholder="
                            t('variableExtraction.variableValuePlaceholder')
                        "
                    />
                </NFormItem>
            </NSpace>
        </NModal>

        <!-- 控制工具栏 -->
        <div :style="{ flexShrink: 0 }">
            <TestControlBar
                :model-label="t('test.model')"
                :show-compare-toggle="enableCompareMode"
                :is-compare-mode="isCompareMode"
                @update:is-compare-mode="handleCompareModeToggle"
                :primary-action-text="primaryActionText"
                :primary-action-disabled="primaryActionDisabled"
                :primary-action-loading="isTestRunning"
                :layout="adaptiveControlBarLayout"
                :button-size="adaptiveButtonSize"
                @primary-action="handleTest"
                :style="{ marginBottom: '16px' }"
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
        </div>

        <!-- 测试结果区域（支持对比模式）-->
        <TestResultSection
            :is-compare-mode="isCompareMode"
            :vertical-layout="adaptiveResultVerticalLayout"
            :show-original="isCompareMode"
            :original-result-title="t('test.originalResult')"
            :optimized-result-title="t('test.optimizedResult')"
            :single-result-title="singleResultTitle"
            :original-result="originalTestResult"
            :optimized-result="optimizedTestResult"
            :single-result="testResult"
            :size="adaptiveButtonSize"
            :style="{ flex: 1, minHeight: 0 }"
        >
            <!-- 🆕 对比模式：原始结果 -->
            <template #original-result>
                <div class="result-container">
                    <!-- 工具调用显示 -->
                    <ToolCallDisplay
                        v-if="originalToolCalls.length > 0"
                        :tool-calls="originalToolCalls"
                        :size="
                            adaptiveButtonSize === 'large' ? 'medium' : 'small'
                        "
                        class="tool-calls-section"
                    />

                    <div class="result-body">
                        <slot name="original-result"></slot>
                    </div>
                </div>
            </template>

            <!-- 🆕 对比模式：优化结果 -->
            <template #optimized-result>
                <div class="result-container">
                    <!-- 工具调用显示 -->
                    <ToolCallDisplay
                        v-if="optimizedToolCalls.length > 0"
                        :tool-calls="optimizedToolCalls"
                        :size="
                            adaptiveButtonSize === 'large' ? 'medium' : 'small'
                        "
                        class="tool-calls-section"
                    />

                    <div class="result-body">
                        <slot name="optimized-result"></slot>
                    </div>
                </div>
            </template>

            <!-- 单一结果模式 -->
            <template #single-result>
                <div class="result-container">
                    <!-- 工具调用显示 -->
                    <ToolCallDisplay
                        v-if="toolCalls.length > 0"
                        :tool-calls="toolCalls"
                        :size="
                            adaptiveButtonSize === 'large' ? 'medium' : 'small'
                        "
                        class="tool-calls-section"
                    />

                    <div class="result-body">
                        <slot name="single-result"></slot>
                    </div>
                </div>
            </template>
        </TestResultSection>
    </NFlex>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useI18n } from "vue-i18n";
import {
    useMessage,
    NFlex,
    NCard,
    NButton,
    NTag,
    NSpace,
    NInput,
    NEmpty,
    NModal,
    NFormItem,
} from "naive-ui";
import type {
    OptimizationMode,
    AdvancedTestResult,
    ToolCallResult,
} from "@prompt-optimizer/core";
import { useResponsive } from '../../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../../composables/performance/useDebounceThrottle";
import TestControlBar from "../TestControlBar.vue";
import TestResultSection from "../TestResultSection.vue";
import ToolCallDisplay from "../ToolCallDisplay.vue";

const { t } = useI18n();
const message = useMessage();

// 性能监控
const { recordUpdate, getPerformanceReport } = usePerformanceMonitor("ConversationTestPanel");

// 防抖节流
const { debounce, throttle } = useDebounceThrottle();

// 响应式配置
const {
    shouldUseVerticalLayout,
    shouldUseCompactMode,
    buttonSize,
} = useResponsive();

interface Props {
    // 核心状态
    optimizationMode: OptimizationMode;
    isTestRunning?: boolean;

    // 🆕 对比模式
    isCompareMode?: boolean;
    enableCompareMode?: boolean;

    // 变量管理
    globalVariables?: Record<string, string>;
    predefinedVariables?: Record<string, string>;
    temporaryVariables?: Record<string, string>;

    // 布局配置
    inputMode?: "compact" | "normal";
    controlBarLayout?: "default" | "compact" | "minimal";
    buttonSize?: "small" | "medium" | "large";
    resultVerticalLayout?: boolean;

    // 结果显示配置
    singleResultTitle?: string;

    // 🆕 测试结果数据（支持对比模式）
    testResult?: AdvancedTestResult;
    originalTestResult?: AdvancedTestResult;
    optimizedTestResult?: AdvancedTestResult;
}

const props = withDefaults(defineProps<Props>(), {
    isTestRunning: false,
    isCompareMode: false,
    enableCompareMode: true,
    inputMode: "normal",
    controlBarLayout: "default",
    buttonSize: "medium",
    resultVerticalLayout: false,
    singleResultTitle: "",
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    temporaryVariables: () => ({}),
});

const emit = defineEmits<{
    test: [testVariables: Record<string, string>];
    "update:isCompareMode": [value: boolean];
    "compare-toggle": [];
    "open-variable-manager": [];
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string];
    "tool-call": [toolCall: ToolCallResult];
    "tool-calls-updated": [toolCalls: ToolCallResult[]];
    "temporary-variable-remove": [name: string];
    "temporary-variables-clear": [];
}>();

// 🆕 工具调用状态管理（支持对比模式）
const toolCalls = ref<ToolCallResult[]>([]);
const originalToolCalls = ref<ToolCallResult[]>([]);
const optimizedToolCalls = ref<ToolCallResult[]>([]);

// 🆕 处理对比模式切换
const handleCompareModeToggle = (value: boolean) => {
    emit("update:isCompareMode", value);
    emit("compare-toggle");
    recordUpdate();
};

// 🆕 处理工具调用的方法（支持对比模式）
const handleToolCall = (toolCall: ToolCallResult, testType?: 'original' | 'optimized') => {
    if (props.isCompareMode && testType) {
        // 对比模式：根据 testType 添加到对应数组
        if (testType === 'original') {
            originalToolCalls.value.push(toolCall);
        } else {
            optimizedToolCalls.value.push(toolCall);
        }
    } else {
        // 单一模式：添加到统一数组
        toolCalls.value.push(toolCall);
    }
    emit("tool-call", toolCall);
    emit("tool-calls-updated", toolCalls.value);
    recordUpdate();
};

// 🆕 清除工具调用数据的方法（支持对比模式）
const clearToolCalls = (testType?: 'original' | 'optimized' | 'both') => {
    if (!testType || testType === 'both') {
        // 清除所有
        toolCalls.value = [];
        originalToolCalls.value = [];
        optimizedToolCalls.value = [];
    } else if (testType === 'original') {
        originalToolCalls.value = [];
    } else if (testType === 'optimized') {
        optimizedToolCalls.value = [];
    }
};

// 响应式布局配置
const adaptiveControlBarLayout = computed(() => {
    if (shouldUseCompactMode.value) return "minimal";
    if (shouldUseVerticalLayout.value) return "compact";
    return props.controlBarLayout || "default";
});

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

// 添加变量对话框状态
const showAddVariableDialog = ref(false);
const newVariableName = ref("");
const newVariableValue = ref("");
const newVariableNameError = ref("");

// 测试区临时变量
interface TestVariable {
    value: string;
    timestamp: number;
}

const testVariables = ref<Record<string, TestVariable>>({});

// 监听 props.temporaryVariables 变化
watch(
    () => props.temporaryVariables,
    (newVars) => {
        const newVarNames = new Set(Object.keys(newVars));
        for (const name of Object.keys(testVariables.value)) {
            if (!newVarNames.has(name)) {
                delete testVariables.value[name];
            }
        }

        for (const [name, value] of Object.entries(newVars)) {
            if (!testVariables.value[name]) {
                testVariables.value[name] = {
                    value,
                    timestamp: Date.now(),
                };
            } else {
                testVariables.value[name].value = value;
            }
        }
    },
    { deep: true, immediate: true }
);

// 三层变量合并
const mergedVariables = computed(() => {
    const testVarsFlat: Record<string, string> = {};
    for (const [name, data] of Object.entries(testVariables.value)) {
        testVarsFlat[name] = data.value;
    }

    return {
        ...props.globalVariables,
        ...testVarsFlat,
        ...props.predefinedVariables,
    };
});

// 按时间排序的临时变量列表
const sortedTestVariables = computed(() => {
    const entries = Object.entries(testVariables.value);
    return entries
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .map(([name]) => name);
});

// 实际显示的变量列表
const displayVariables = computed(() => {
    return sortedTestVariables.value;
});

// 是否显示变量表单
const showVariableForm = computed(() => {
    return !props.isTestRunning;
});

// 获取变量的显示值
const getVariableDisplayValue = (varName: string): string => {
    return mergedVariables.value[varName] || "";
};

// 获取变量的占位符提示
const getVariablePlaceholder = (varName: string): string => {
    if (props.predefinedVariables?.[varName]) {
        return (
            t("test.variables.inputPlaceholder") +
            ` (${t("variables.source.predefined")})`
        );
    }
    if (props.globalVariables?.[varName]) {
        return (
            t("test.variables.inputPlaceholder") +
            ` (${t("variables.source.global")})`
        );
    }
    return t("test.variables.inputPlaceholder");
};

// 事件处理函数
const handleVariableValueChange = (varName: string, value: string) => {
    if (testVariables.value[varName]) {
        testVariables.value[varName].value = value;
    } else {
        testVariables.value[varName] = {
            value,
            timestamp: Date.now(),
        };
    }
    emit("variable-change", varName, value);
    recordUpdate();
};

const handleClearAllVariables = () => {
    testVariables.value = {};
    emit("temporary-variables-clear");
    message.success(t("test.variables.clearSuccess"));
    recordUpdate();
};

// 保存测试变量到全局
const handleSaveToGlobal = (varName: string) => {
    const varData = testVariables.value[varName];
    if (!varData || !varData.value.trim()) {
        message.warning(t("test.variables.emptyValueWarning"));
        return;
    }

    emit("save-to-global", varName, varData.value);
    message.success(t("test.variables.savedToGlobal"));
    recordUpdate();
};

// 验证新变量名
const validateNewVariableName = () => {
    const name = newVariableName.value.trim();

    if (!name) {
        newVariableNameError.value = "";
        return false;
    }

    if (/^\d/.test(name)) {
        newVariableNameError.value = t(
            "variableExtraction.validation.noNumberStart"
        );
        return false;
    }

    if (!/^[\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*$/.test(name)) {
        newVariableNameError.value = t(
            "variableExtraction.validation.invalidCharacters"
        );
        return false;
    }

    if (testVariables.value[name]) {
        newVariableNameError.value = t(
            "variableExtraction.validation.duplicateVariable"
        );
        return false;
    }

    newVariableNameError.value = "";
    return true;
};

// 添加新变量
const handleAddVariable = () => {
    if (!validateNewVariableName()) {
        if (!newVariableName.value.trim()) {
            message.warning(t("test.variables.nameRequired"));
        }
        return false;
    }

    const name = newVariableName.value.trim();
    handleVariableValueChange(name, newVariableValue.value);
    if (testVariables.value[name]) {
        testVariables.value[name].timestamp = Date.now();
    }
    message.success(t("test.variables.addSuccess"));

    newVariableName.value = "";
    newVariableValue.value = "";
    newVariableNameError.value = "";
    showAddVariableDialog.value = false;

    return true;
};

// 删除变量
const handleDeleteVariable = (varName: string) => {
    delete testVariables.value[varName];
    emit("temporary-variable-remove", varName);
    emit("variable-change", varName, "");
    message.success(
        t("test.variables.deleteSuccess", { name: varName })
    );
    recordUpdate();
};

// 暴露变量值供外部访问
const getVariableValues = () => {
    return { ...mergedVariables.value };
};

// 设置变量值
const setVariableValues = (values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) {
        emit("variable-change", name, value);
    }
};

// 获取变量来源
const getVariableSource = (varName: string): "predefined" | "test" | "global" | "empty" => {
    if (props.predefinedVariables?.[varName]) return "predefined";
    if (testVariables.value[varName]) return "test";
    if (props.globalVariables?.[varName]) return "global";
    return "empty";
};

// 开发环境下的性能调试
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn("ConversationTestPanel 性能较差:", report);
            }
        },
        5000,
        false,
        "performanceLog",
    );

    setInterval(logPerformance, 10000);
}

// 暴露方法供父组件调用（兼容 TestAreaPanelInstance 接口）
defineExpose({
    handleToolCall,
    clearToolCalls,
    // 🆕 支持对比模式的工具调用数据
    getToolCalls: () => ({
        original: props.isCompareMode ? originalToolCalls.value : [],
        optimized: props.isCompareMode ? optimizedToolCalls.value : toolCalls.value
    }),
    getVariableValues,
    setVariableValues,
    // 预览功能占位符（兼容接口）
    showPreview: () => {
        console.warn('[ConversationTestPanel] showPreview not implemented');
    },
    hidePreview: () => {
        console.warn('[ConversationTestPanel] hidePreview not implemented');
    },
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
