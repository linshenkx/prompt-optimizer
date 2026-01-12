<!-- 输入面板组件 - 纯Naive UI实现 -->
<template>
    <NSpace vertical :size="16">
        <!-- 标题区域 -->
        <NFlex justify="space-between" align="center" :wrap="false">
            <NFlex align="center" :size="8">
                <NText :depth="1" style="font-size: 18px; font-weight: 500">{{
                    label
                }}</NText>
                <!-- 🆕 帮助提示图标 -->
                <NPopover
                    v-if="helpText"
                    trigger="hover"
                    placement="right"
                    :show-arrow="true"
                >
                    <template #trigger>
                        <NButton
                            text
                            size="tiny"
                            :focusable="false"
                            style="cursor: help; opacity: 0.6"
                        >
                            <template #icon>
                                <NIcon :size="16">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </NIcon>
                            </template>
                        </NButton>
                    </template>
                    <div style="max-width: 320px; line-height: 1.6">
                        {{ helpText }}
                    </div>
                </NPopover>
            </NFlex>
            <NFlex align="center" :size="12">
                <!-- 🆕 AI提取变量按钮（带文字） -->
                <NButton
                    v-if="enableVariableExtraction && showExtractButton"
                    type="tertiary"
                    size="small"
                    @click="$emit('extract-variables')"
                    :loading="extracting"
                    :disabled="extracting || !modelValue.trim()"
                    ghost
                    round
                >
                    <template #icon>
                        <NIcon>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
                            </svg>
                        </NIcon>
                    </template>
                    {{ extracting ? $t('evaluation.variableExtraction.extracting') : $t('evaluation.variableExtraction.extractButton') }}
                </NButton>
                <!-- 预览按钮 -->
                <NButton
                    v-if="showPreview"
                    type="tertiary"
                    size="small"
                    @click="$emit('open-preview')"
                    :title="$t('common.preview')"
                    ghost
                    round
                >
                    <template #icon>
                        <NIcon>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                            </svg>
                        </NIcon>
                    </template>
                </NButton>
                <!-- 全屏按钮 -->
                <NButton
                    type="tertiary"
                    size="small"
                    @click="openFullscreen"
                    :title="$t('common.expand')"
                    ghost
                    round
                >
                    <template #icon>
                        <NIcon>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                />
                            </svg>
                        </NIcon>
                    </template>
                </NButton>
                <!-- 标题栏额外按钮插槽 -->
                <slot name="header-extra"></slot>
            </NFlex>
        </NFlex>

        <!-- 输入框 - 使用变量感知输入框 (支持变量提取) -->
        <VariableAwareInput
            v-if="enableVariableExtraction"
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            :placeholder="placeholder"
            :autosize="{ minRows: 4, maxRows: 12 }"
            :data-testid="`${testIdPrefix}-input`"
            :existing-global-variables="existingGlobalVariables"
            :existing-temporary-variables="existingTemporaryVariables"
            :predefined-variables="predefinedVariables"
            :global-variable-values="globalVariableValues"
            :temporary-variable-values="temporaryVariableValues"
            :predefined-variable-values="predefinedVariableValues"
            @variable-extracted="handleVariableExtracted"
            @add-missing-variable="handleAddMissingVariable"
        />

        <!-- 原生输入框 (不支持变量提取) -->
        <NInput
            v-else
            :value="modelValue"
            @update:value="$emit('update:modelValue', $event)"
            type="textarea"
            :placeholder="placeholder"
            :rows="4"
            :autosize="{ minRows: 4, maxRows: 12 }"
            clearable
            show-count
            :data-testid="`${testIdPrefix}-input`"
        />

        <!-- 控制面板 -->
        <NGrid :cols="24" :x-gap="8" responsive="screen">
            <!-- 模型选择 -->
            <NGridItem :span="6" :xs="24" :sm="6">
                <NSpace vertical :size="8">
                    <NText
                        :depth="2"
                        style="font-size: 14px; font-weight: 500"
                        >{{ modelLabel }}</NText
                    >
                    <slot name="model-select"></slot>
                </NSpace>
            </NGridItem>

            <!-- 提示词模板选择 -->
            <NGridItem v-if="templateLabel" :span="11" :xs="24" :sm="11">
                <NSpace vertical :size="8">
                    <NText
                        :depth="2"
                        style="font-size: 14px; font-weight: 500"
                        >{{ templateLabel }}</NText
                    >
                    <slot name="template-select"></slot>
                </NSpace>
            </NGridItem>

            <!-- 控制按钮组 -->
            <NGridItem
                :span="templateLabel ? 2 : 13"
                :xs="24"
                :sm="templateLabel ? 2 : 13"
            >
                <NSpace vertical :size="8" align="end">
                    <slot name="control-buttons"></slot>
                </NSpace>
            </NGridItem>

            <!-- 提交按钮区域 -->
            <NGridItem :span="5" :xs="24" :sm="5" class="flex items-end">
                <NSpace :size="8" justify="end" style="width: 100%">
                    <!-- 分析按钮（与优化同级） -->
                    <NButton
                        v-if="showAnalyzeButton"
                        type="default"
                        size="medium"
                        :data-testid="`${testIdPrefix}-analyze-button`"
                        @click="$emit('analyze')"
                        :loading="analyzeLoading"
                        :disabled="analyzeLoading || loading || disabled || !modelValue.trim()"
                    >
                        {{ analyzeLoading ? $t('promptOptimizer.analyzing') : $t('promptOptimizer.analyze') }}
                    </NButton>
                    <!-- 优化按钮 -->
                    <NButton
                        type="primary"
                        size="medium"
                        :data-testid="`${testIdPrefix}-optimize-button`"
                        @click="$emit('submit')"
                        :loading="loading"
                        :disabled="analyzeLoading || loading || disabled || !modelValue.trim()"
                    >
                        {{ loading ? loadingText : buttonText }}
                    </NButton>
                </NSpace>
            </NGridItem>
        </NGrid>
    </NSpace>

    <!-- 全屏弹窗 -->
    <FullscreenDialog v-model="isFullscreen" :title="label">
        <NInput
            v-model:value="fullscreenValue"
            type="textarea"
            :placeholder="placeholder"
            :autosize="{ minRows: 20 }"
            clearable
            show-count
        />
    </FullscreenDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
    NInput,
    NButton,
    NText,
    NSpace,
    NFlex,
    NGrid,
    NGridItem,
    NIcon,
    NPopover,
} from "naive-ui";
import { useFullscreen } from '../composables/ui/useFullscreen';
import FullscreenDialog from "./FullscreenDialog.vue";
import { VariableAwareInput } from "./variable-extraction";

/**
 * 输入面板组件
 *
 * 功能：
 * 1. 提供输入框用于用户输入内容
 * 2. 支持全屏编辑模式
 * 3. 支持变量提取功能 (可选)
 * 4. 提供模型选择、模板选择等控制面板
 */

interface Props {
    /** 输入框的值 */
    modelValue: string;
    /** 选中的模型 */
    selectedModel: string;
    /** 面板标题 */
    label: string;
    /** 占位符文本 */
    placeholder?: string;
    /** 模型选择标签 */
    modelLabel: string;
    /** 模板选择标签 */
    templateLabel?: string;
    /** 提交按钮文本 */
    buttonText: string;
    /** 加载中文本 */
    loadingText: string;
    /** 是否正在加载 */
    loading?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否显示预览按钮 */
    showPreview?: boolean;
    /** 🆕 帮助提示文本（显示在标题旁边的问号图标，悬浮时显示） */
    helpText?: string;

    /** 是否显示分析按钮 */
    showAnalyzeButton?: boolean;
    /** 分析按钮是否正在加载 */
    analyzeLoading?: boolean;

    /** 🆕 是否显示AI提取变量按钮 */
    showExtractButton?: boolean;
    /** 🆕 AI提取变量是否进行中 */
    extracting?: boolean;

    /** 🆕 是否启用变量提取功能 */
    enableVariableExtraction?: boolean;
    /** 🆕 已存在的全局变量名列表 */
    existingGlobalVariables?: string[];
    /** 🆕 已存在的临时变量名列表 */
    existingTemporaryVariables?: string[];
    /** 🆕 系统预定义变量名列表 */
    predefinedVariables?: string[];
    /** 🆕 全局变量名到变量值的映射 */
    globalVariableValues?: Record<string, string>;
    /** 🆕 临时变量名到变量值的映射 */
    temporaryVariableValues?: Record<string, string>;
    /** 🆕 预定义变量名到变量值的映射 */
    predefinedVariableValues?: Record<string, string>;

    /** 🆕 测试 ID 前缀（用于区分不同模式，如 'basic-system', 'basic-user'） */
    testIdPrefix?: string;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "",
    templateLabel: "",
    loading: false,
    disabled: false,
    showPreview: false,
    helpText: "",
    showAnalyzeButton: false,
    analyzeLoading: false,
    showExtractButton: false,
    extracting: false,
    enableVariableExtraction: false,
    existingGlobalVariables: () => [],
    existingTemporaryVariables: () => [],
    predefinedVariables: () => [],
    globalVariableValues: () => ({}),
    temporaryVariableValues: () => ({}),
    predefinedVariableValues: () => ({}),
    testIdPrefix: "input-panel",
});

const emit = defineEmits<{
    "update:modelValue": [value: string];
    "update:selectedModel": [value: string];
    submit: [];
    analyze: [];
    configModel: [];
    "open-preview": [];
    /** 🆕 AI提取变量事件 */
    "extract-variables": [];
    /** 🆕 变量提取事件 */
    "variable-extracted": [
        data: {
            variableName: string;
            variableValue: string;
            variableType: "global" | "temporary";
        },
    ];
    /** 🆕 添加缺失变量事件 */
    "add-missing-variable": [varName: string];
}>();

// 使用全屏组合函数
const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
    computed(() => props.modelValue),
    (value) => emit("update:modelValue", value),
);

// 处理变量提取事件
const handleVariableExtracted = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
}) => {
    emit("variable-extracted", data);
};

// 处理添加缺失变量事件
const handleAddMissingVariable = (varName: string) => {
    emit("add-missing-variable", varName);
};
</script>
