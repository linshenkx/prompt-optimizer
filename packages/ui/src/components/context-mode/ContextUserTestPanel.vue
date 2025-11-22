<template>
    <NFlex vertical :style="{ height: '100%' }">
        <!-- 测试内容输入区 (ContextUser专属，ConversationTestPanel没有这个) -->
        <div :style="{ flexShrink: 0, marginBottom: '16px' }">
            <TestInputSection
                v-model="testContentProxy"
                :label="t('test.content')"
                :placeholder="t('test.simpleMode.placeholder')"
                :disabled="isTestRunning"
                :mode="inputMode"
                :size="inputSize"
                :enable-fullscreen="enableFullscreen"
            />
        </div>

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

        <!-- 测试结果区域（不支持工具调用，仅显示文本结果）-->
        <TestResultSection
            :is-compare-mode="isCompareMode"
            :vertical-layout="adaptiveResultVerticalLayout"
            :show-original="isCompareMode"
            :original-result-title="t('test.originalResult')"
            :optimized-result-title="t('test.optimizedResult')"
            :single-result-title="singleResultTitle"
            :size="adaptiveButtonSize"
            :style="{ flex: 1, minHeight: 0 }"
        >
            <!-- 对比模式：原始结果 -->
            <template #original-result>
                <slot name="original-result"></slot>
            </template>

            <!-- 对比模式：优化结果 -->
            <template #optimized-result>
                <slot name="optimized-result"></slot>
            </template>

            <!-- 单一结果模式 -->
            <template #single-result>
                <slot name="single-result"></slot>
            </template>
        </TestResultSection>
    </NFlex>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, toRef } from 'vue'

import { useI18n } from "vue-i18n";
import {
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
import { useResponsive } from '../../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../../composables/performance/useDebounceThrottle";
import { useTestVariableManager } from "../../composables/variable/useTestVariableManager";
import TestInputSection from "../TestInputSection.vue";
import TestControlBar from "../TestControlBar.vue";
import TestResultSection from "../TestResultSection.vue";

const { t } = useI18n();

// 性能监控
const { recordUpdate, getPerformanceReport } = usePerformanceMonitor("ContextUserTestPanel");

// 防抖节流
const { debounce, throttle } = useDebounceThrottle();

// 响应式配置
const {
    shouldUseVerticalLayout,
    shouldUseCompactMode,
    buttonSize,
    inputSize,
} = useResponsive();

interface Props {
    // 测试内容（ContextUser专属）
    testContent: string;

    // 优化后的提示词（用于检测变量）
    optimizedPrompt?: string;

    // 测试状态
    isTestRunning?: boolean;
    isCompareMode?: boolean;
    enableCompareMode?: boolean;

    // 变量管理（三层）
    globalVariables?: Record<string, string>;
    predefinedVariables?: Record<string, string>;
    temporaryVariables?: Record<string, string>;

    // 功能开关
    enableFullscreen?: boolean;

    // 布局配置
    inputMode?: "compact" | "normal";
    controlBarLayout?: "default" | "compact" | "minimal";
    buttonSize?: "small" | "medium" | "large";
    resultVerticalLayout?: boolean;

    // 结果显示配置
    singleResultTitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
    optimizedPrompt: "",
    isTestRunning: false,
    isCompareMode: false,
    enableCompareMode: true,
    enableFullscreen: true,
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
    "update:testContent": [value: string];
    "update:isCompareMode": [value: boolean];
    test: [testVariables: Record<string, string>];
    "compare-toggle": [];
    "open-variable-manager": [];
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string];
    "temporary-variable-remove": [name: string];
    "temporary-variables-clear": [];
}>();

// 测试内容双向绑定
const testContentProxy = computed({
    get: () => props.testContent,
    set: (value: string) => {
        emit("update:testContent", value);
        recordUpdate();
    },
});

// 处理对比模式切换
const handleCompareModeToggle = (value: boolean) => {
    emit("update:isCompareMode", value);
    emit("compare-toggle");
    recordUpdate();
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
    return props.isCompareMode
        ? t("test.startCompare")
        : t("test.startTest");
});

// 主要操作按钮禁用状态（纯业务逻辑，无模式判断）
const primaryActionDisabled = computed(() => {
    if (props.isTestRunning) return true;
    if (!props.testContent.trim()) return true;  // 测试内容不能为空
    return false;
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
    showAddVariableDialog,
    newVariableName,
    newVariableValue,
    newVariableNameError,
    sortedVariables: displayVariables,
    getVariableSource,
    getVariableDisplayValue,
    getVariablePlaceholder,
    validateNewVariableName,
    handleVariableValueChange,
    handleAddVariable,
    handleDeleteVariable,
    handleClearAllVariables,
    handleSaveToGlobal,
    getVariableValues,
    setVariableValues,
} = variableManager;

// 是否显示变量表单
const showVariableForm = computed(() => true);

// 开发环境下的性能调试
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn("ContextUserTestPanel 性能较差:", report);
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
    getToolCalls: () => ({ original: [], optimized: [] }),

    // 变量管理
    getVariableValues,
    setVariableValues,

    // 预览功能占位符（兼容接口）
    showPreview: () => {
        console.warn('[ContextUserTestPanel] showPreview not implemented');
    },
    hidePreview: () => {
        console.warn('[ContextUserTestPanel] hidePreview not implemented');
    },
});
</script>

<style scoped>
/* ContextUser 不需要工具调用相关样式 */
</style>
