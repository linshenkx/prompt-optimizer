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
                    :temporary-variables="tempVars.temporaryVariables.value"
                    :scan-variables="scanVariables"
                    :optimization-mode="optimizationMode"
                    :tool-count="toolCount"
                    @open-variable-manager="emit('open-variable-manager')"
                    @open-context-editor="emit('open-context-editor')"
                    @open-tool-manager="emit('open-tool-manager')"
                    :enable-tool-management="true"
                    :collapsible="true"
                    :max-height="300"
                    :selected-message-id="selectedMessageId"
                    :enable-message-optimization="enableMessageOptimization"
                    :is-message-optimizing="conversationOptimization.isOptimizing.value"
                    @message-select="conversationOptimization.selectMessage"
                    @optimize-message="handleOptimizeClick"
                    @message-change="(index, message, action) => emit('message-change', index, message, action)"
                    @variable-extracted="handleVariableExtracted"
                    @add-missing-variable="handleAddMissingVariable"
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
                        ref="promptPanelRef"
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
                        @apply-improvement="handleApplyImprovement"
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
        <ConversationTestPanel
            ref="testAreaPanelRef"
            :style="{
                flex: 1,
                overflow: 'auto',
                height: '100%',
                minHeight: 0,
            }"
            :optimization-mode="optimizationMode"
            :is-test-running="conversationTester.testResults.isTestingOriginal || conversationTester.testResults.isTestingOptimized"
            :is-compare-mode="isCompareMode"
            :enable-compare-mode="true"
            @update:isCompareMode="emit('update:isCompareMode', $event)"
            @compare-toggle="emit('compare-toggle')"
            :model-name="props.testModelName"
            :global-variables="globalVariables"
            :predefined-variables="predefinedVariables"
            :temporary-variables="tempVars.temporaryVariables.value"
            :input-mode="inputMode"
            :button-size="buttonSize"
            :result-vertical-layout="resultVerticalLayout"
            @test="handleTestWithVariables"
            @open-variable-manager="emit('open-variable-manager')"
            @open-global-variables="emit('open-global-variables')"
            @variable-change="handleVariableChange"
            @save-to-global="(name: string, value: string) => emit('save-to-global', name, value)"
            @temporary-variable-remove="handleVariableRemove"
            @temporary-variables-clear="handleVariablesClear"
            v-bind="evaluationHandler.testAreaEvaluationProps.value"
            @evaluate-original="evaluationHandler.handlers.onEvaluateOriginal"
            @evaluate-optimized="evaluationHandler.handlers.onEvaluateOptimized"
            @show-original-detail="evaluationHandler.handlers.onShowOriginalDetail"
            @show-optimized-detail="evaluationHandler.handlers.onShowOptimizedDetail"
            @apply-improvement="handleApplyImprovement"
        >
            <!-- 模型选择插槽 -->
            <template #model-select>
                <slot name="test-model-select"></slot>
            </template>

            <!-- 对比模式结果插槽 -->
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

        <!-- 评估详情面板已移至 App 顶层统一管理，避免双套 evaluation 实例导致行为不一致 -->
    </NFlex>
</template>

<script setup lang="ts">
import { ref, computed, inject, provide, type Ref } from 'vue'

import { useI18n } from "vue-i18n";
import { NCard, NFlex, NButton, NText, NEmpty } from "naive-ui";
import PromptPanelUI from "../PromptPanel.vue";
import ConversationTestPanel from "./ConversationTestPanel.vue";
import ConversationManager from "./ConversationManager.vue";
import OutputDisplay from "../OutputDisplay.vue";
import { useConversationTester } from '../../composables/prompt/useConversationTester'
import { useConversationOptimization } from '../../composables/prompt/useConversationOptimization'
import { usePromptDisplayAdapter } from '../../composables/prompt/usePromptDisplayAdapter'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import { useEvaluationHandler, provideProContext, useEvaluationContext } from '../../composables/prompt'
import type { OptimizationMode, ConversationMessage } from "../../types";
import type {
    PromptRecord,
    PromptRecordChain,
    Template,
    ToolDefinition,
    ProSystemEvaluationContext,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import type { AppServices } from '../../types/services'

interface Props {
    // 核心状态
    optimizedReasoning?: string;
    optimizationMode: OptimizationMode;

    // 优化状态
    isOptimizing: boolean;
    isIterating: boolean;

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
    buttonSize?: "small" | "medium" | "large";
    conversationMaxHeight?: number;
    resultVerticalLayout?: boolean;

    // 🆕 对比模式
    isCompareMode?: boolean;

    // 🆕 测试相关（避免通过 App.vue 中转）
    selectedTestModel?: string;
    /** 测试模型名称（用于显示标签） */
    testModelName?: string;
}

interface ConversationSnapshotEntry extends ConversationMessage {
    chainId?: string;
    appliedVersion?: number;
}

interface ContextSystemHistoryPayload {
    chain: PromptRecordChain;
    record: PromptRecord;
    conversationSnapshot?: ConversationSnapshotEntry[];
    message?: ConversationMessage;
}

const props = withDefaults(defineProps<Props>(), {
    optimizedReasoning: "",
    inputMode: "normal",
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
    "message-change": [index: number, message: ConversationMessage, action: "add" | "update" | "delete"];

    // 打开面板/管理器
    "open-global-variables": [];
    "open-variable-manager": [];
    "open-context-editor": [tab?: string];
    "open-template-manager": [type?: string];
    "open-tool-manager": [];
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

// 🆕 初始化临时变量管理器（与 ContextEditor 共享）
const tempVars = useTemporaryVariables()

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

// 🆕 构建 Pro-System 评估上下文
const proContext = computed<ProSystemEvaluationContext | undefined>(() => {
    const selectedMsg = conversationOptimization.selectedMessage.value
    if (!selectedMsg) return undefined

    return {
        targetMessage: {
            role: selectedMsg.role as 'system' | 'user' | 'assistant' | 'tool',
            content: conversationOptimization.optimizedPrompt.value || selectedMsg.content,
            originalContent: selectedMsg.content,
        },
        conversationMessages: props.optimizationContext.map((msg) => ({
            role: msg.role,
            content: msg.content,
            isTarget: msg.id === selectedMsg.id,
        })),
    }
})

// 🆕 提供 Pro 模式上下文给子组件（如 PromptPanel），用于评估时传递多消息上下文
provideProContext(proContext)

// 🆕 获取全局评估实例（由 App 层 provideEvaluation 注入）
const globalEvaluation = useEvaluationContext()

// 🆕 测试结果数据
const testResultsData = computed(() => ({
    originalResult: conversationTester.testResults.originalResult || undefined,
    optimizedResult: conversationTester.testResults.optimizedResult || undefined,
}))

// 🆕 计算当前迭代需求（用于 prompt-iterate 的 re-evaluate）
const currentIterateRequirement = computed(() => {
    const versions = displayAdapter.displayedVersions.value
    const versionId = displayAdapter.displayedCurrentVersionId.value
    if (!versions || versions.length === 0 || !versionId) return ''
    const currentVersion = versions.find((v) => v.id === versionId)
    return currentVersion?.iterationNote || ''
})

// 🆕 初始化评估处理器（使用全局 evaluation 实例，避免双套状态）
const evaluationHandler = useEvaluationHandler({
    services: services || ref(null),
    originalPrompt: computed(() => conversationOptimization.selectedMessage.value?.content || ''),
    optimizedPrompt: computed(() => conversationOptimization.optimizedPrompt.value),
    testContent: computed(() => ''), // Pro-System 模式无测试内容输入
    testResults: testResultsData,
    evaluationModelKey: computed(() => props.selectedOptimizeModel),
    functionMode: computed(() => 'pro'),
    subMode: computed(() => 'system'),
    proContext,
    currentIterateRequirement,
    externalEvaluation: globalEvaluation,
})

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

/** PromptPanel 组件引用,用于打开迭代弹窗 */
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

const restoreFromHistory = async ({
    chain,
    record,
    conversationSnapshot,
    message,
}: ContextSystemHistoryPayload) => {
    try {
        if (conversationSnapshot?.length) {
            let mappingCount = 0;
            conversationSnapshot.forEach((snapshotMsg) => {
                if (snapshotMsg.id && snapshotMsg.chainId) {
                    const mapKey = `${props.optimizationMode}:${snapshotMsg.id}`;
                    conversationOptimization.messageChainMap.value.set(
                        mapKey,
                        snapshotMsg.chainId,
                    );
                    mappingCount += 1;
                }
            });
            if (mappingCount > 0) {
                console.log(
                    `[ContextSystemWorkspace] 已重建 ${mappingCount} 个消息的优化链映射关系`,
                );
            }
        }

        if (!message) {
            return;
        }

        await conversationOptimization.selectMessage(message);
        conversationOptimization.currentChainId.value = chain.chainId;
        conversationOptimization.currentVersions.value = chain.versions;
        conversationOptimization.currentRecordId.value = record.id;
        conversationOptimization.optimizedPrompt.value = record.optimizedPrompt;
    } catch (error) {
        console.error('[ContextSystemWorkspace] 历史记录恢复失败:', error);
        // 错误会向上传播到 App.vue 的 handleHistoryReuse 中统一处理
        throw error;
    }
};

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

// 🆕 处理变量提取
// 注意：toast 已在 VariableAwareInput 中显示，这里不重复（参考 ContextUserWorkspace 的实现）
const handleVariableExtracted = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
}) => {
    if (data.variableType === "global") {
        variableManager?.addVariable(data.variableName, data.variableValue);
    } else {
        tempVars.setVariable(data.variableName, data.variableValue);
    }
};

// 🆕 处理添加缺失变量
// 注意：toast 已在 VariableAwareInput 中显示，这里不重复（参考 ContextUserWorkspace 的实现）
const handleAddMissingVariable = (varName: string) => {
    tempVars.setVariable(varName, "");
};

// 🆕 处理临时变量变更
const handleVariableChange = (name: string, value: string) => {
    tempVars.setVariable(name, value);
    emit('variable-change', name, value);
};

// 🆕 处理临时变量移除
const handleVariableRemove = (name: string) => {
    tempVars.deleteVariable(name);
    emit('variable-change', name, '');
};

// 🆕 处理清空所有临时变量
const handleVariablesClear = () => {
    const removedNames = Object.keys(tempVars.temporaryVariables.value);
    tempVars.clearAll();
    removedNames.forEach(name => emit('variable-change', name, ''));
};

// 🆕 处理测试事件
const handleTestWithVariables = async () => {
    // 重新测试时清理之前的评估结果
    evaluationHandler.clearBeforeTest();

    const testVariables = testAreaPanelRef.value?.getVariableValues?.() || {};
    await conversationTester.executeTest(
        props.isCompareMode || false,
        testVariables,
        testAreaPanelRef.value
    );
};

// 🆕 处理应用改进建议事件（使用 evaluationHandler 提供的工厂方法）
const handleApplyImprovement = evaluationHandler.createApplyImprovementHandler(promptPanelRef);

// 暴露引用
defineExpose({
    testAreaPanelRef,
    restoreFromHistory,
    openIterateDialog: (initialContent?: string) => {
        promptPanelRef.value?.openIterateDialog?.(initialContent);
    },
    reEvaluateActive: async () => {
        await evaluationHandler.handleReEvaluate();
    },
});
</script>
