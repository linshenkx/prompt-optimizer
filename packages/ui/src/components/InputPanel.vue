<!-- 输入面板组件 - 纯Naive UI实现 -->
<template>
    <NSpace vertical :size="16" class="input-panel-stack" :class="{ 'input-panel--compact': compact }">
        <!-- 标题区域 -->
        <NFlex class="input-panel-heading" justify="space-between" align="center" :wrap="false">
            <NFlex class="input-panel-heading-group" align="center" :size="8">
                <NText class="input-panel-title" :depth="1" style="font-size: 18px; font-weight: 500">{{
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
                                    <UiCircleHelp />
                                </NIcon>
                            </template>
                        </NButton>
                    </template>
                    <div style="max-width: 320px; line-height: 1.6">
                        {{ helpText }}
                    </div>
                </NPopover>
            </NFlex>
            <NFlex class="input-panel-heading-group input-panel-heading-actions" align="center" :size="12">
                <!-- 🆕 AI提取变量按钮（带文字） -->
                <NButton
                    v-if="enableVariableExtraction && showExtractButton"
                    type="tertiary"
                    size="small"
                    @click="$emit('extract-variables')"
                    :loading="extracting"
              :disabled="disabled || extracting || !modelValue.trim()"
                    :title="extracting ? $t('evaluation.variableExtraction.extracting') : $t('evaluation.variableExtraction.extractButton')"
                    :aria-label="$t('evaluation.variableExtraction.extractButton')"
                    ghost
                    round
                >
                    <template #icon>
                        <NIcon :size="16">
                            <UiMessageSquareText />
                        </NIcon>
                    </template>
                    <template v-if="!compact">{{ extracting ? $t('evaluation.variableExtraction.extracting') : $t('evaluation.variableExtraction.extractButton') }}</template>
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
                        <NIcon :size="16">
                            <UiEye />
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
                        <NIcon :size="16">
                            <UiMaximize2 />
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
            :autosize="compact ? { minRows: 2, maxRows: compactInputRows } : { minRows: 4, maxRows: 12 }"
            clearable
            show-count
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
            class="input-panel-primary-editor"
            :value="modelValue"
            @update:value="$emit('update:modelValue', $event)"
            type="textarea"
            :placeholder="placeholder"
            :rows="4"
            :resizable="!compact"
            :autosize="compact ? { minRows: 2, maxRows: compactInputRows } : { minRows: 4, maxRows: 12 }"
            clearable
            show-count
            :data-testid="`${testIdPrefix}-input`"
        />

        <!-- 控制面板 -->
        <NGrid class="input-panel-controls" :cols="24" :x-gap="8" responsive="screen">
            <!-- 模型选择 -->
            <NGridItem class="input-panel-control" :span="6" :xs="24" :sm="6">
                <NSpace class="input-panel-field" item-class="input-panel-field-item" vertical :size="8">
                    <NFlex align="center" :size="6" :wrap="false" class="input-panel-label-row">
                        <NText
                            class="input-panel-label"
                            :depth="2"
                            style="font-size: 14px; font-weight: 500; flex-shrink: 0;"
                            >{{ modelLabel }}</NText
                        >
                        <slot name="model-label-extra"></slot>
                    </NFlex>
                    <slot name="model-select"></slot>
                </NSpace>
            </NGridItem>

            <!-- 提示词模板选择 -->
            <NGridItem class="input-panel-control" v-if="templateLabel" :span="11" :xs="24" :sm="11">
                <NSpace class="input-panel-field" item-class="input-panel-field-item" vertical :size="8">
                    <NText
                        class="input-panel-label"
                        :depth="2"
                        style="font-size: 14px; font-weight: 500"
                        >{{ templateLabel }}</NText
                    >
                    <slot name="template-select"></slot>
                </NSpace>
            </NGridItem>

            <!-- 控制按钮组 -->
            <NGridItem
                class="input-panel-control input-panel-secondary-actions"
                :span="templateLabel ? 2 : 13"
                :xs="24"
                :sm="templateLabel ? 2 : 13"
            >
                <NSpace class="input-panel-field" item-class="input-panel-field-item" vertical :size="8" align="end">
                    <slot name="control-buttons"></slot>
                </NSpace>
            </NGridItem>

            <!-- 提交按钮区域 -->
            <NGridItem :span="5" :xs="24" :sm="5" class="input-panel-control input-panel-submit flex items-end">
                <NSpace class="input-panel-submit-actions" item-class="input-panel-submit-item" :size="8" justify="end" style="width: 100%">
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
                        :aria-label="compact ? buttonText : undefined"
                        :aria-busy="compact ? loading : undefined"
                        @click="$emit('submit')"
                        :loading="loading"
                        :disabled="analyzeLoading || loading || disabled || !modelValue.trim()"
                    >
                        {{ compact ? buttonText : loading ? loadingText : buttonText }}
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
            :autosize="false"
            style="height: 100%; min-height: 0;"
            clearable
            show-count
        />
    </FullscreenDialog>
</template>

<script setup lang="ts">
import { CircleHelp as UiCircleHelp, MessageSquareText as UiMessageSquareText, Eye as UiEye, Maximize2 as UiMaximize2 } from '@lucide/vue'
import { computed } from 'vue'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
const { compactInputRows } = useWorkspaceLayout()

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
    compact?: boolean
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
    compact: false,
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
