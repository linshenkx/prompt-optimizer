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
                    :is-message-optimizing="conversationOptimization.isOptimizing.value"
                    @message-select="conversationOptimization.selectMessage"
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
                        :loading="displayAdapter.displayedIsOptimizing.value"
                        :disabled="displayAdapter.displayedIsOptimizing.value || !selectedMessageId"
                        @click="handleOptimizeClick"
                        block
                    >
                        {{ displayAdapter.displayedIsOptimizing.value ? $t('common.loading') : $t('promptOptimizer.optimize') }}
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
                <template v-if="displayAdapter.isInMessageOptimizationMode.value">
                    <PromptPanelUI
                        :original-prompt="displayAdapter.displayedOriginalPrompt.value"
                        :optimized-prompt="displayAdapter.displayedOptimizedPrompt.value"
                        :reasoning="optimizedReasoning"
                        :is-optimizing="displayAdapter.displayedIsOptimizing.value"
                        :is-iterating="isIterating"
                        :selectedIterateTemplate="selectedIterateTemplate"
                        @update:selectedIterateTemplate="
                            emit('update:selectedIterateTemplate', $event)
                        "
                        :versions="displayAdapter.displayedVersions.value"
                        :current-version-id="displayAdapter.displayedCurrentVersionId.value"
                        :show-apply-button="displayAdapter.isInMessageOptimizationMode.value"
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

                    <!-- 🆕 对比模式结果插槽：直接绑定测试结果 -->
                    <template #original-result>
                        <OutputDisplay
                            :content="conversationTester.testResults.originalResult"
                            :reasoning="conversationTester.testResults.originalReasoning"
                            :streaming="conversationTester.testResults.isTestingOriginal"
                            :enableDiff="false"
                            mode="readonly"
                            :style="{ height: '100%', minHeight: '0' }"
                        />
                    </template>

                    <template #optimized-result>
                        <OutputDisplay
                            :content="conversationTester.testResults.optimizedResult"
                            :reasoning="conversationTester.testResults.optimizedReasoning"
                            :streaming="conversationTester.testResults.isTestingOptimized"
                            :enableDiff="false"
                            mode="readonly"
                            :style="{ height: '100%', minHeight: '0' }"
                        />
                    </template>

                    <!-- 单一结果插槽 -->
                    <template #single-result>
                        <OutputDisplay
                            :content="conversationTester.testResults.optimizedResult"
                            :reasoning="conversationTester.testResults.optimizedReasoning"
                            :streaming="conversationTester.testResults.isTestingOptimized"
                            :enableDiff="false"
                            mode="readonly"
                            :style="{ height: '100%', minHeight: '0' }"
                        />
                    </template>
                </ConversationTestPanel>
            </NCard>
        </NFlex>
    </NFlex>
</template>

<script setup lang="ts">
import { ref, computed, inject, provide } from 'vue'

import { useI18n } from "vue-i18n";
import { NCard, NFlex, NButton, NText, NEmpty } from "naive-ui";
import { useBreakpoints } from "@vueuse/core";
import PromptPanelUI from "../PromptPanel.vue";
import ConversationTestPanel from "./ConversationTestPanel.vue";
import ConversationManager from "./ConversationManager.vue";
import OutputDisplay from "../OutputDisplay.vue";
import { useConversationTester } from '../../composables/prompt/useConversationTester'
import { useConversationOptimization } from '../../composables/prompt/useConversationOptimization'
import { usePromptDisplayAdapter } from '../../composables/prompt/usePromptDisplayAdapter'
import type { OptimizationMode, ConversationMessage } from "../../types";
import type {
    PromptRecord,
    Template,
    ToolDefinition,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import type { AppServices } from '../../types/services'

// 响应式断点
const breakpoints = useBreakpoints({
    mobile: 640,
    tablet: 1024,
});
const isMobile = breakpoints.smaller("mobile");

// Props 定义
interface Props {
    // 核心状态
    optimizedReasoning?: string;
    optimizationMode: OptimizationMode;

    // 优化状态
    isOptimizing: boolean;
    isIterating: boolean;
    isTestRunning?: boolean;

    // 外部状态注入（用于初始化本地 hook）
    selectedOptimizeModel: string;
    selectedTemplate: Template | null;
    selectedIterateTemplate: Template | null;

    // 上下文数据 (系统模式专属)
    optimizationContext: ConversationMessage[];
    toolCount: number;

    // 变量数据
    globalVariables: Record<string, string>;
    predefinedVariables: Record<string, string>;
    availableVariables: Record<string, string>;
    scanVariables: (content: string) => string[];

    // 🆕 消息优化功能（本地管理，移除部分外部 props）
    enableMessageOptimization?: boolean;
    
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

    // 🆕 测试相关（避免通过 App.vue 中转）
    selectedTestModel?: string;
}

const props = withDefaults(defineProps<Props>(), {
    optimizedReasoning: "",
    isTestRunning: false,
    inputMode: "normal",
    controlBarLayout: "default",
    buttonSize: "medium",
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
    enableMessageOptimization: false,
    isCompareMode: false,
});

// Emits 定义
const emit = defineEmits<{
    // 数据更新
    "update:selectedIterateTemplate": [value: Template | null];
    "update:optimizationContext": [value: ConversationMessage[]];

    // 操作事件（用于历史记录查看场景）
    test: [testVariables: Record<string, string>];
    "switch-version": [version: PromptRecord];
    "switch-to-v0": [version: PromptRecord];
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

    // 🆕 对比模式
    "update:isCompareMode": [value: boolean];
    "compare-toggle": [];
}>();

const { t } = useI18n();

// 注入服务和变量管理器
const services = inject<Ref<AppServices | null>>('services')
const variableManager = inject<VariableManagerHooks | null>('variableManager')

// 🆕 初始化本地会话优化逻辑
const conversationOptimization = useConversationOptimization(
    services || ref(null),
    computed(() => props.optimizationContext),
    computed(() => props.optimizationMode),
    computed(() => props.selectedOptimizeModel),
    computed(() => props.selectedTemplate),
    computed(() => props.selectedIterateTemplate)
)

// 暴露给子组件（虽然目前主要通过 Props 传递给 ConversationManager，但保持 Provide 以防万一）
provide('conversationOptimization', conversationOptimization);

// 🆕 初始化显示适配器（根据模式自动切换数据源）
const displayAdapter = usePromptDisplayAdapter(
    conversationOptimization,
    {
        enableMessageOptimization: computed(() => props.enableMessageOptimization || false),
        optimizationContext: computed(() => props.optimizationContext),
        globalVersions: computed(() => props.versions || []),
        globalCurrentVersionId: computed(() => props.currentVersionId),
        globalIsOptimizing: computed(() => props.isOptimizing),
    }
)

// 🆕 初始化多对话测试器
const selectedTestModel = computed(() => props.selectedTestModel || '')
// 从 inject 获取 optimizationContextTools（由 App.vue 提供）
const optimizationContextToolsRef = inject<Ref<ToolDefinition[]>>('optimizationContextTools', ref([]))
// 使用本地 managed 的 selectedMessageId
const selectedMessageId = conversationOptimization.selectedMessageId

const conversationTester = useConversationTester(
    services || ref(null),
    selectedTestModel,
    computed(() => props.optimizationContext),
    optimizationContextToolsRef,
    variableManager,
    selectedMessageId
)

// 处理迭代优化事件
// 注意：由于 displayedOptimizedPrompt 在未选中消息时为空，迭代按钮不会显示，所以此函数调用时必定处于消息优化模式
const handleIterate = (payload: IteratePayload) => {
    conversationOptimization.iterateMessage(payload)
}

// 处理优化点击事件
// 注意：优化按钮在没有选中消息时会被禁用，所以此函数调用时必定处于消息优化模式
const handleOptimizeClick = () => {
    conversationOptimization.optimizeMessage()
}

// 🆕 ConversationTestPanel 引用
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null);

// 🆕 处理版本切换
const handleSwitchVersion = (version: PromptRecord) => {
    if (displayAdapter.isInMessageOptimizationMode.value) {
        conversationOptimization.switchVersion(version);
    } else {
        emit('switch-version', version);
    }
};

// 🆕 处理 V0 切换
const handleSwitchToV0 = (version: PromptRecord) => {
    if (displayAdapter.isInMessageOptimizationMode.value) {
        conversationOptimization.switchToV0(version);
    } else {
        emit('switch-to-v0', version);
    }
};

const handleApplyToConversation = () => {
    if (!displayAdapter.isInMessageOptimizationMode.value) return;
    conversationOptimization.applyCurrentVersion();
};

// 🆕 处理测试事件
const handleTestWithVariables = async () => {
    const testVariables = testAreaPanelRef.value?.getVariableValues?.() || {};
    await conversationTester.executeTest(
        props.isCompareMode || false,
        testVariables,
        testAreaPanelRef.value
    );
};

// 暴露引用
defineExpose({
    testAreaPanelRef
});
</script>
