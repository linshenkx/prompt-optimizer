<template>
    <NFlex
        justify="space-between"
        :style="{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '100%',
            'max-height': '100%',
            gap: '16px',
        }"
    >
        <!-- 左侧：优化区域 -->
        <NFlex
            vertical
            :style="{
                flex: 1,
                overflow: 'auto',
                height: '100%',
            }"
        >
            <!-- 会话管理器 (系统模式专属，也是消息输入界面) -->
            <NCard
                :style="{ flexShrink: 0, overflow: 'auto' }"
                content-style="padding: 0;"
            >
                <ConversationManager
                    :messages="optimizationContext"
                    @update:messages="
                        emit('update:optimizationContext', $event)
                    "
                    :available-variables="availableVariables"
                    :scan-variables="scanVariables"
                    :optimization-mode="optimizationMode"
                    context-mode="system"
                    :tool-count="toolCount"
                    @open-variable-manager="emit('open-variable-manager')"
                    @open-context-editor="emit('open-context-editor')"
                    :collapsible="true"
                    :max-height="300"
                    :selected-message-id="selectedMessageId"
                    :enable-message-optimization="enableMessageOptimization"
                    :is-message-optimizing="isMessageOptimizing"
                    @message-select="emit('message-select', $event)"
                    @optimize-message="handleOptimizeClick"
                    @message-change="(index, message, action) => emit('message-change', index, message, action)"
                />
            </NCard>

            <!-- 优化控制区 -->
            <NCard :style="{ flexShrink: 0 }" size="small">
                <NFlex vertical :size="12">
                    <!-- 模型和模板选择行 -->
                    <NFlex :size="12" :wrap="false">
                        <!-- 优化模型选择 -->
                        <NFlex vertical :size="4" style="flex: 1">
                            <NText :depth="3" style="font-size: 12px">
                                {{ $t('promptOptimizer.optimizeModel') }}
                            </NText>
                            <slot name="optimize-model-select"></slot>
                        </NFlex>

                        <!-- 模板选择 -->
                        <NFlex vertical :size="4" style="flex: 1">
                            <NText :depth="3" style="font-size: 12px">
                                {{ $t('promptOptimizer.templateLabel') }}
                            </NText>
                            <slot name="template-select"></slot>
                        </NFlex>
                    </NFlex>

                    <!-- 优化按钮 -->
                    <NButton
                        type="primary"
                        :loading="isOptimizing"
                        :disabled="isOptimizing || !selectedMessageId"
                        @click="handleOptimizeClick"
                        block
                    >
                        {{ isOptimizing ? $t('common.loading') : $t('promptOptimizer.optimize') }}
                    </NButton>
                </NFlex>
            </NCard>

            <!-- 优化结果面板 -->
            <NCard
                :style="{
                    flex: 1,
                    minHeight: '200px',
                    overflow: 'hidden',
                }"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <template v-if="isInMessageOptimizationMode">
                    <PromptPanelUI
                        :original-prompt="displayedOriginalPrompt"
                        :optimized-prompt="displayedOptimizedPrompt"
                        :reasoning="optimizedReasoning"
                        :is-optimizing="displayedIsOptimizing"
                        :is-iterating="isIterating"
                        :selectedIterateTemplate="selectedIterateTemplate"
                        @update:selectedIterateTemplate="
                            emit('update:selectedIterateTemplate', $event)
                        "
                        :versions="displayedVersions"
                        :current-version-id="displayedCurrentVersionId"
                        :show-apply-button="isInMessageOptimizationMode"
                        :optimization-mode="optimizationMode"
                        :advanced-mode-enabled="true"
                        :show-preview="true"
                        @iterate="handleIterate"
                        @openTemplateManager="emit('open-template-manager', $event)"
                        @switchVersion="handleSwitchVersion"
                        @switchToV0="handleSwitchToV0"
                        @save-favorite="emit('save-favorite', $event)"
                        @open-preview="emit('open-prompt-preview')"
                        @apply-to-conversation="handleApplyToConversation"
                    />
                </template>
                <template v-else>
                    <NEmpty
                        :description="t('contextMode.system.selectMessageHint')"
                        size="large"
                    />
                </template>
            </NCard>
        </NFlex>

        <!-- 右侧：测试区域 -->
        <NFlex
            vertical
            :style="{
                flex: 1,
                overflow: 'auto',
                height: '100%',
                gap: '12px',
            }"
        >
            <!-- 测试区域操作栏 -->
            <NCard size="small" :style="{ flexShrink: 0 }">
                <NFlex justify="space-between" align="center">
                    <!-- 左侧：区域标识 -->
                    <NFlex align="center" :size="8">
                        <NText strong>{{ $t("test.areaTitle") }}</NText>
                    </NFlex>

                    <!-- 右侧：快捷操作按钮 -->
                    <NFlex :size="8">
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
                    </NFlex>
                </NFlex>
            </NCard>

            <!-- 测试区域主内容 -->
            <NCard
                :style="{ flex: 1, overflow: 'auto' }"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <ConversationTestPanel
                    ref="testAreaPanelRef"
                    :optimization-mode="optimizationMode"
                    :is-test-running="isTestRunning"
                    :is-compare-mode="isCompareMode"
                    :enable-compare-mode="true"
                    @update:isCompareMode="emit('update:isCompareMode', $event)"
                    @compare-toggle="emit('compare-toggle')"
                    :global-variables="globalVariables"
                    :predefined-variables="predefinedVariables"
                    :input-mode="inputMode"
                    :control-bar-layout="controlBarLayout"
                    :button-size="buttonSize"
                    :result-vertical-layout="resultVerticalLayout"
                    @test="handleTestWithVariables"
                    @open-variable-manager="emit('open-variable-manager')"
                    @variable-change="
                        (name: string, value: string) => emit('variable-change', name, value)
                    "
                    @save-to-global="
                        (name: string, value: string) => emit('save-to-global', name, value)
                    "
                >
                    <!-- 模型选择插槽 -->
                    <template #model-select>
                        <slot name="test-model-select"></slot>
                    </template>

                    <!-- 🆕 对比模式结果插槽 -->
                    <template #original-result>
                        <slot name="original-result"></slot>
                    </template>

                    <template #optimized-result>
                        <slot name="optimized-result"></slot>
                    </template>

                    <!-- 单一结果插槽 -->
                    <template #single-result>
                        <slot name="single-result"></slot>
                    </template>
                </ConversationTestPanel>
            </NCard>
        </NFlex>
    </NFlex>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'

import { useI18n } from "vue-i18n";
import { NCard, NFlex, NButton, NText, NEmpty } from "naive-ui";
import { useBreakpoints } from "@vueuse/core";
import PromptPanelUI from "../PromptPanel.vue";
import ConversationTestPanel from "./ConversationTestPanel.vue";
import ConversationManager from "./ConversationManager.vue";
import type { UseConversationOptimization } from '../../composables/prompt/useConversationOptimization'
import type { OptimizationMode, ConversationMessage } from "../../types";
import type {
    PromptRecord,
    Template,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";

// 响应式断点
const breakpoints = useBreakpoints({
    mobile: 640,
    tablet: 1024,
});
const isMobile = breakpoints.smaller("mobile");

// Props 定义 (移除 contextMode，因为固定为 system；移除 prompt，因为消息输入在 ConversationManager 中)
// 🔧 移除 optimizedPrompt/versions/currentVersionId，防止基础模式状态污染
interface Props {
    // 核心状态
    optimizedReasoning?: string;
    optimizationMode: OptimizationMode;

    // 优化状态
    isOptimizing: boolean;
    isIterating: boolean;
    isTestRunning?: boolean;

    // 版本管理
    selectedIterateTemplate: Template | null;

    // 上下文数据 (系统模式专属)
    optimizationContext: ConversationMessage[];
    toolCount: number;

    // 变量数据
    globalVariables: Record<string, string>;
    predefinedVariables: Record<string, string>;
    availableVariables: Record<string, string>;
    scanVariables: (content: string) => string[];

    // 🆕 消息优化功能
    selectedMessageId?: string;
    enableMessageOptimization?: boolean;
    messageOptimizedPrompt?: string;
    messageVersions?: PromptRecord[];
    messageCurrentVersionId?: string | null;
    isMessageOptimizing?: boolean;

    // 全局优化链（用于历史记录恢复）
    versions?: PromptRecord[];
    currentVersionId?: string;

    // 响应式布局配置
    inputMode?: "compact" | "normal";
    controlBarLayout?: "default" | "compact" | "minimal";
    buttonSize?: "small" | "medium" | "large";
    conversationMaxHeight?: number;
    resultVerticalLayout?: boolean;

    // 🆕 对比模式
    isCompareMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    optimizedReasoning: "",
    isTestRunning: false,
    inputMode: "normal",
    controlBarLayout: "default",
    buttonSize: "medium",
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
    selectedMessageId: undefined,
    enableMessageOptimization: false,
    messageOptimizedPrompt: "",
    messageVersions: () => [],
    messageCurrentVersionId: null,
    isMessageOptimizing: false,
    isCompareMode: false,
});

// Emits 定义
// 🔧 移除 update:optimizedPrompt，防止基础模式状态污染
const emit = defineEmits<{
    // 数据更新
    "update:selectedIterateTemplate": [value: Template | null];
    "update:optimizationContext": [value: ConversationMessage[]];

    // 操作事件
    optimize: []; // 执行优化
    iterate: [payload: IteratePayload];
    test: [testVariables: Record<string, string>]; // 🆕 传递测试变量
    "switch-version": [version: PromptRecord];
    "switch-to-v0": [version: PromptRecord];  // 🆕 V0 切换事件
    "save-favorite": [data: SaveFavoritePayload];

    // 打开面板/管理器
    "open-global-variables": [];
    "open-variable-manager": [];
    "open-context-editor": [tab?: string];
    "open-template-manager": [type?: string];
    "config-model": [];

    // 预览相关
    "open-prompt-preview": [];

    // 变量管理
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string];

    // 🆕 消息优化相关
    "message-select": [message: ConversationMessage];
    "message-switch-version": [version: PromptRecord];
    "message-switch-to-v0": [version: PromptRecord];  // 🆕 消息 V0 切换事件
    "optimize-message": [];
    "message-change": [index: number, message: ConversationMessage, action: 'add' | 'update' | 'delete'];
    "message-apply-version": [];

    // 🆕 对比模式
    "update:isCompareMode": [value: boolean];
    "compare-toggle": [];
}>();

const { t } = useI18n();

const conversationOptimization = inject<UseConversationOptimization>('conversationOptimization')

const handleIterate = (payload: IteratePayload) => {
    if (isInMessageOptimizationMode.value && conversationOptimization) {
        conversationOptimization.iterateMessage(payload)
    } else {
        emit('iterate', payload)
    }
}

const handleOptimizeClick = () => {
    if (isInMessageOptimizationMode.value && conversationOptimization) {
        conversationOptimization.optimizeMessage()
    } else {
        emit('optimize-message')
    }
}

// 🆕 ConversationTestPanel 引用（兼容 TestAreaPanelInstance 接口）
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null);

// 🆕 消息优化模式：根据是否有选中消息来决定显示内容
const isInMessageOptimizationMode = computed(() => {
    return props.enableMessageOptimization && !!props.selectedMessageId;
});

// 🆕 PromptPanel 显示的原始提示词（当前选中消息的原始内容）
const displayedOriginalPrompt = computed(() => {
    if (!isInMessageOptimizationMode.value) return ''
    const message = props.optimizationContext?.find(m => m.id === props.selectedMessageId)
    return message?.originalContent || message?.content || ''
});

// 🆕 PromptPanel 显示的优化结果（消息优化 或 提示词优化）
const displayedOptimizedPrompt = computed(() => {
    return isInMessageOptimizationMode.value
        ? props.messageOptimizedPrompt
        : ''; // 没有选中消息时，不显示优化结果
});

// 🆕 PromptPanel 显示的版本列表
const displayedVersions = computed(() => {
    if (isInMessageOptimizationMode.value) {
        // 消息优化模式：使用消息级优化版本
        return props.messageVersions || [];
    }
    // 历史记录恢复时：使用全局优化链
    return props.versions || [];
});

// 🆕 PromptPanel 显示的当前版本ID
const displayedCurrentVersionId = computed(() => {
    if (isInMessageOptimizationMode.value) {
        // 消息优化模式：使用消息级版本ID
        return props.messageCurrentVersionId || null;
    }
    // 历史记录恢复时：使用全局版本ID
    return props.currentVersionId || null;
});

// 🆕 PromptPanel 显示的优化中状态
const displayedIsOptimizing = computed(() => {
    return isInMessageOptimizationMode.value
        ? props.isMessageOptimizing
        : props.isOptimizing;
});

// 🆕 处理版本切换：根据模式决定触发哪个事件
const handleSwitchVersion = (version: PromptRecord) => {
    if (isInMessageOptimizationMode.value) {
        // 消息优化模式：触发消息版本切换事件
        emit('message-switch-version', version);
    } else {
        // 提示词优化模式：触发普通版本切换事件
        emit('switch-version', version);
    }
};

// 🆕 处理 V0 切换：根据模式决定触发哪个事件
const handleSwitchToV0 = (version: PromptRecord) => {
    if (isInMessageOptimizationMode.value) {
        // 消息优化模式：触发消息 V0 切换事件
        emit('message-switch-to-v0', version);
    } else {
        // 提示词优化模式：触发普通 V0 切换事件
        emit('switch-to-v0', version);
    }
};

const handleApplyToConversation = () => {
    if (!isInMessageOptimizationMode.value) return;
    emit('message-apply-version');
};

// 🆕 处理测试事件并获取测试变量
const handleTestWithVariables = async () => {
    // 从 ref 获取测试变量
    const testVariables = testAreaPanelRef.value?.getVariableValues?.() || {};

    // 触发测试事件，传递测试变量给 App.vue
    emit('test', testVariables);
};

// 暴露 TestAreaPanel 引用给父组件（用于工具调用等高级功能）
defineExpose({
    testAreaPanelRef
});
</script>
