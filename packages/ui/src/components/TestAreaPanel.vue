<template>
    <NFlex vertical :style="{ height: '100%' }">
        <!-- 测试输入区域 (仅在系统提示词优化模式下显示) -->
        <div v-if="showTestInput" :style="{ flexShrink: 0 }">
            <TestInputSection
                v-model="testContentProxy"
                :label="t('test.content')"
                :placeholder="t('test.placeholder')"
                :help-text="t('test.simpleMode.help')"
                :disabled="isTestRunning"
                :mode="adaptiveInputMode"
                :size="inputSize"
                :enable-fullscreen="enableFullscreen"
                :style="{ marginBottom: '16px' }"
            />
        </div>

        <!-- 变量值输入表单 (完整实现) -->
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
                                      : getVariableSource(varName) === 'global'
                                        ? 'default'
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
                        <!-- 🆕 删除按钮 (仅临时变量显示) -->
                        <NButton
                            v-if="getVariableSource(varName) === 'test'"
                            size="small"
                            quaternary
                            @click="handleDeleteVariable(varName)"
                            :title="t('test.variables.delete')"
                        >
                            🗑️
                        </NButton>
                        <!-- 🆕 保存到全局按钮 (仅测试变量显示) -->
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
                        <!-- 🆕 添加变量按钮 -->
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


        <!-- 🆕 添加变量对话框 -->
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
                :is-compare-mode="props.isCompareMode"
                :primary-action-text="primaryActionText"
                :primary-action-disabled="primaryActionDisabled"
                :primary-action-loading="isTestRunning"
                :layout="adaptiveControlBarLayout"
                :button-size="adaptiveButtonSize"
                @compare-toggle="handleCompareToggle"
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

        <!-- 测试结果区域 -->
        <TestResultSection
            :is-compare-mode="props.isCompareMode && enableCompareMode"
            :vertical-layout="adaptiveResultVerticalLayout"
            :show-original="showOriginalResult"
            :original-title="originalResultTitle"
            :optimized-title="optimizedResultTitle"
            :single-result-title="singleResultTitle"
            :original-result="originalResult"
            :optimized-result="optimizedResult"
            :single-result="singleResult"
            :size="adaptiveButtonSize"
            :style="{ flex: 1, minHeight: 0 }"
        >
            <template #original-result>
                <div class="result-container">
                    <!-- 原始结果的工具调用显示 - 移到正文之前 -->
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
            <template #optimized-result>
                <div class="result-container">
                    <!-- 优化结果的工具调用显示 - 移到正文之前 -->
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
            <template #single-result>
                <div class="result-container">
                    <!-- 单一结果的工具调用显示 - 移到正文之前（使用优化结果的数据） -->
                    <ToolCallDisplay
                        v-if="optimizedToolCalls.length > 0"
                        :tool-calls="optimizedToolCalls"
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
import { useResponsive } from '../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../composables/performance/useDebounceThrottle";
import { useCurrentMode } from "../composables/mode";
import TestInputSection from "./TestInputSection.vue";
import TestControlBar from "./TestControlBar.vue";
import TestResultSection from "./TestResultSection.vue";
import ToolCallDisplay from "./ToolCallDisplay.vue";

const { t } = useI18n();
const message = useMessage();

// 性能监控
const {
    recordUpdate,
    getPerformanceReport,
    // performanceGrade  // 保留用于性能监控
} = usePerformanceMonitor("TestAreaPanel");

// 防抖节流
const { debounce, throttle } = useDebounceThrottle();

// 响应式配置
const {
    shouldUseVerticalLayout,
    shouldUseCompactMode,
    // spaceSize,  // 保留用于响应式布局
    buttonSize,
    inputSize,
    // gridConfig  // 保留用于网格布局
} = useResponsive();

// 🆕 模式检测（用于隐藏基础模式下的变量功能）
const { isBasicMode } = useCurrentMode();

interface Props {
    // 核心状态
    optimizationMode: OptimizationMode;
    contextMode?: import("@prompt-optimizer/core").ContextMode;
    isTestRunning?: boolean;

    // 测试内容
    testContent?: string;
    optimizedPrompt?: string; // 优化后的提示词（用于变量检测）
    isCompareMode?: boolean;

    // 🆕 两层变量体系 (简化)
    globalVariables?: Record<string, string>; // 全局自定义变量
    predefinedVariables?: Record<string, string>; // 内置预定义变量
    temporaryVariables?: Record<string, string>; // 🆕 临时变量 (从InputPanel提取的变量)

    // 功能开关
    enableCompareMode?: boolean;
    enableFullscreen?: boolean;

    // 布局配置
    inputMode?: "compact" | "normal";
    controlBarLayout?: "default" | "compact" | "minimal";
    buttonSize?: "small" | "medium" | "large";

    // 结果显示配置
    showOriginalResult?: boolean;
    resultVerticalLayout?: boolean;
    originalResultTitle?: string;
    optimizedResultTitle?: string;
    singleResultTitle?: string;

    // 高级功能：测试结果数据（支持工具调用显示）
    originalResult?: AdvancedTestResult;
    optimizedResult?: AdvancedTestResult;
    singleResult?: AdvancedTestResult;
}

const props = withDefaults(defineProps<Props>(), {
    contextMode: "user",
    isTestRunning: false,
    testContent: "",
    isCompareMode: true,
    enableCompareMode: true,
    enableFullscreen: true,
    inputMode: "normal",
    controlBarLayout: "default",
    buttonSize: "medium",
    showOriginalResult: true,
    resultVerticalLayout: false,
    originalResultTitle: "",
    optimizedResultTitle: "",
    singleResultTitle: "",
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    temporaryVariables: () => ({}),
});

const emit = defineEmits<{
    "update:testContent": [value: string];
    "update:isCompareMode": [value: boolean];
    test: [testVariables: Record<string, string>]; // 🆕 传递测试变量
    "compare-toggle": [];
    // 高级功能事件
    "open-variable-manager": [];
    "open-context-editor": [];
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string]; // 🆕 保存测试变量到全局
    "get-test-variables": []; // 🆕 请求获取测试变量（用于测试执行）
    "context-change": [
        messages: ConversationMessage[],
        variables: Record<string, string>,
    ];
    // 工具调用事件
    "tool-call": [toolCall: ToolCallResult, testType: "original" | "optimized"];
    "tool-calls-updated": [
        toolCalls: ToolCallResult[],
        testType: "original" | "optimized",
    ];
    "temporary-variable-remove": [name: string];
    "temporary-variables-clear": [];
}>();

// 内部状态管理 - 去除防抖，保证输入即时响应
const testContentProxy = computed({
    get: () => props.testContent,
    set: (value: string) => {
        emit("update:testContent", value);
        recordUpdate();
    },
});

// 工具调用状态管理
const originalToolCalls = ref<ToolCallResult[]>([]);
const optimizedToolCalls = ref<ToolCallResult[]>([]);

// 处理工具调用的方法
const handleToolCall = (
    toolCall: ToolCallResult,
    testType: "original" | "optimized",
) => {
    if (testType === "original") {
        originalToolCalls.value.push(toolCall);
    } else {
        optimizedToolCalls.value.push(toolCall);
    }

    emit("tool-call", toolCall, testType);
    emit(
        "tool-calls-updated",
        testType === "original"
            ? originalToolCalls.value
            : optimizedToolCalls.value,
        testType,
    );
    recordUpdate();
};

// 清除工具调用数据的方法
const clearToolCalls = (
    testType: "original" | "optimized" | "both" = "both",
) => {
    if (testType === "original" || testType === "both") {
        originalToolCalls.value = [];
    }
    if (testType === "optimized" || testType === "both") {
        optimizedToolCalls.value = [];
    }
};

// 移除结果缓存与相关节流逻辑，避免不必要的复杂度

// 关键计算属性：showTestInput 取决于当前功能模式
const showTestInput = computed(() => {
    // 基础模式始终以系统提示词布尔值决定可见性
    if (isBasicMode.value) {
        return props.optimizationMode === "system";
    }
    // 上下文模式判断
    // - 多轮对话模式（contextMode === "system"）：不显示测试内容输入框（测试内容就是会话消息）
    // - 变量模式（contextMode === "user"）：显示测试内容输入框
    return (
        props.contextMode === "user" && props.optimizationMode === "system"
    );
});

// 响应式布局配置
const adaptiveInputMode = computed(() => {
    if (shouldUseCompactMode.value) return "compact";
    return props.inputMode || "normal";
});

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
    return props.isCompareMode && props.enableCompareMode
        ? t("test.startCompare")
        : t("test.startTest");
});

// 主要操作按钮禁用状态
const primaryActionDisabled = computed(() => {
    if (props.isTestRunning) return true;

    // 系统提示词模式需要测试内容
    // 但多轮对话模式（contextMode === "system"）例外，因为测试内容就是会话消息
    if (props.optimizationMode === "system" && props.contextMode !== "system" && !props.testContent.trim()) {
        return true;
    }

    return false;
});

// 事件处理 - 立即切换对比模式，避免点击延迟
const handleCompareToggle = () => {
    const newValue = !props.isCompareMode;
    emit("update:isCompareMode", newValue);
    emit("compare-toggle");
    recordUpdate();
};

const handleTest = throttle(
    () => {
        // 🆕 获取并传递测试变量
        const testVars = getVariableValues();
        emit("test", testVars);
        recordUpdate();
    },
    200,
    "handleTest",
);

// ========== 变量管理 ==========

// 🆕 添加变量对话框状态
const showAddVariableDialog = ref(false);
const newVariableName = ref("");
const newVariableValue = ref("");
const newVariableNameError = ref("");

// 🧪 测试区临时变量 (仅内存,刷新丢失) - 新增功能
// 数据结构: { 变量名: { value: 值, timestamp: 时间戳 } }
interface TestVariable {
    value: string;
    timestamp: number;
}

const testVariables = ref<Record<string, TestVariable>>({});

// 监听 props.temporaryVariables 变化,同步到内部状态
watch(
    () => props.temporaryVariables,
    (newVars) => {
        // 🔧 第一步：删除不再存在于 newVars 中的过期变量（防止内存泄漏）
        const newVarNames = new Set(Object.keys(newVars));
        for (const name of Object.keys(testVariables.value)) {
            if (!newVarNames.has(name)) {
                delete testVariables.value[name];
            }
        }

        // 第二步：合并新的临时变量,为新变量添加时间戳
        for (const [name, value] of Object.entries(newVars)) {
            if (!testVariables.value[name]) {
                testVariables.value[name] = {
                    value,
                    timestamp: Date.now(),
                };
            } else {
                // 更新现有变量的值,保留时间戳
                testVariables.value[name].value = value;
            }
        }
    },
    { deep: true, immediate: true }
);

// 三层变量合并（按优先级：全局 < 测试 < 内置）
const mergedVariables = computed(() => {
    // 将 testVariables 转换为 { name: value } 格式
    const testVarsFlat: Record<string, string> = {};
    for (const [name, data] of Object.entries(testVariables.value)) {
        testVarsFlat[name] = data.value;
    }

    return {
        ...props.globalVariables, // 优先级 1: 全局自定义变量
        ...testVarsFlat, // 优先级 2: 测试区临时变量
        ...props.predefinedVariables, // 优先级 3: 内置预定义变量
    };
});

// 🆕 按时间排序的临时变量列表 (最新的在最前面)
const sortedTestVariables = computed(() => {
    const entries = Object.entries(testVariables.value);
    return entries
        .sort((a, b) => b[1].timestamp - a[1].timestamp) // 降序排列
        .map(([name]) => name);
});

// 🆕 实际显示的变量列表 = 临时变量 (不再依赖 detectedVariables)
const displayVariables = computed(() => {
    return sortedTestVariables.value;
});

// 是否显示变量表单：默认显示（基础模式除外）
const showVariableForm = computed(() => {
    // 🆕 基础模式不显示变量功能（变量系统仅在上下文模式下可用）
    if (isBasicMode.value) {
        return false;
    }

    // 测试运行期间也应保持显示，避免界面闪烁和信息丢失
    return true;
});

// 获取变量的显示值（从合并后的变量中获取）
const getVariableDisplayValue = (varName: string): string => {
    return mergedVariables.value[varName] || "";
};

// 🆕 获取变量的占位符提示（显示变量来源）
const getVariablePlaceholder = (varName: string): string => {
    // 如果有来自全局/内置的值，提示来源
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

// 变量列表变化时的清理逻辑已不再需要（不再使用 userInputValues）

// 事件处理函数
const handleVariableValueChange = (varName: string, value: string) => {
    // 🧪 更新测试区临时变量
    if (testVariables.value[varName]) {
        testVariables.value[varName].value = value;
    } else {
        // 如果变量不存在,创建新变量
        testVariables.value[varName] = {
            value,
            timestamp: Date.now(),
        };
    }
    emit("variable-change", varName, value);
    recordUpdate();
};

const handleClearAllVariables = () => {
    // 清空测试区临时变量
    testVariables.value = {};
    emit("temporary-variables-clear");
    message.success(t("test.variables.clearSuccess"));
    recordUpdate();
};

// 🆕 保存测试变量到全局
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

// 🆕 验证新变量名
const validateNewVariableName = () => {
    const name = newVariableName.value.trim();

    if (!name) {
        newVariableNameError.value = "";
        return false;
    }

    // 验证规则1: 不能以数字开头
    if (/^\d/.test(name)) {
        newVariableNameError.value = t(
            "variableExtraction.validation.noNumberStart"
        );
        return false;
    }

    // 验证规则2: 只能包含中文、英文、数字、下划线
    if (!/^[\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*$/.test(name)) {
        newVariableNameError.value = t(
            "variableExtraction.validation.invalidCharacters"
        );
        return false;
    }

    // 验证规则3: 不能与已有变量重名
    if (testVariables.value[name]) {
        newVariableNameError.value = t(
            "variableExtraction.validation.duplicateVariable"
        );
        return false;
    }

    newVariableNameError.value = "";
    return true;
};

// 🆕 添加新变量
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

    // 重置对话框
    newVariableName.value = "";
    newVariableValue.value = "";
    newVariableNameError.value = "";
    showAddVariableDialog.value = false;

    return true;
};

// 🆕 删除变量
const handleDeleteVariable = (varName: string) => {
    delete testVariables.value[varName];
    emit("temporary-variable-remove", varName);
    emit("variable-change", varName, "");
    message.success(
        t("test.variables.deleteSuccess", { name: varName })
    );
    recordUpdate();
};

// 暴露变量值供外部访问（返回合并后的最终值）
const getVariableValues = () => {
    return { ...mergedVariables.value };
};

// 设置变量值（外部调用）- 通过 emit 同步到会话变量
const setVariableValues = (values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) {
        emit("variable-change", name, value);
    }
};

// 🧪 获取变量来源 (简化)
const getVariableSource = (varName: string): "predefined" | "test" | "global" | "empty" => {
    if (props.predefinedVariables?.[varName]) return "predefined";
    if (testVariables.value[varName]) return "test";
    if (props.globalVariables?.[varName]) return "global";
    return "empty";
};

// 移除未使用的 props 变化防抖处理，避免多余复杂度

// 开发环境下的性能调试
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn("TestAreaPanel 性能较差:", report);
            }
        },
        5000,
        false,
        "performanceLog",
    );

    // 定期检查性能
    setInterval(logPerformance, 10000);
}

// 暴露方法供父组件调用
defineExpose({
    handleToolCall,
    clearToolCalls,
    // 获取当前工具调用状态
    getToolCalls: () => ({
        original: originalToolCalls.value,
        optimized: optimizedToolCalls.value,
    }),
    // 变量管理
    getVariableValues,
    setVariableValues,
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

/* 当存在工具调用列表时，隐藏结果区中的空内容占位 */
/* 依赖同级容器存在 .tool-call-display 时，隐藏 Naive UI 的 NEmpty */
.result-container:has(.tool-call-display) :deep(.n-empty) {
    display: none;
}
</style>
