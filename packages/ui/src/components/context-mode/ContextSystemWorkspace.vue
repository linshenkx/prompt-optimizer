<template>
    <div data-testid="workspace" data-mode="pro-multi" style="width: 100%; height: 100%">
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
                     @message-change="(index, message, action) => {
                         // Pro Multi：新增/更新消息后自动选中最新消息，确保“优化”按钮可用
                         if ((action === 'add' || action === 'update') && (message.role === 'system' || message.role === 'user') && message.id) {
                             void conversationOptimization.selectMessage(message)
                         }
                         emit('message-change', index, message, action)
                     }"
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
                            <SelectWithConfig
                                v-model="selectedOptimizeModelKeyModel"
                                :options="modelSelection.textModelOptions.value"
                                :getPrimary="OptionAccessors.getPrimary"
                                :getSecondary="OptionAccessors.getSecondary"
                                :getValue="OptionAccessors.getValue"
                                @config="emit('config-model')"
                            />
                        </NFlex>

                        <!-- 模板选择 -->
                        <NFlex vertical :size="4" style="flex: 1">
                            <NText :depth="3" style="font-size: 12px">
                                {{ $t('promptOptimizer.templateLabel') }}
                            </NText>
                            <SelectWithConfig
                                v-model="selectedTemplateIdModel"
                                :options="templateSelection.templateOptions.value"
                                :getPrimary="OptionAccessors.getPrimary"
                                :getSecondary="OptionAccessors.getSecondary"
                                :getValue="OptionAccessors.getValue"
                                @config="emit('open-template-manager')"
                            />
                        </NFlex>
                    </NFlex>

                    <!-- 优化按钮 -->
                    <NButton
                        type="primary"
                        :loading="displayAdapter.displayedIsOptimizing.value"
                        :disabled="displayAdapter.displayedIsOptimizing.value || !selectedMessageId"
                        @click="handleOptimizeClick"
                        block
                        data-testid="pro-multi-optimize-button"
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
                         test-id="pro-multi"
                        ref="promptPanelRef"
                        :original-prompt="displayAdapter.displayedOriginalPrompt.value"
                        :optimized-prompt="displayAdapter.displayedOptimizedPrompt.value"
                        :reasoning="optimizedReasoning"
                        :is-optimizing="displayAdapter.displayedIsOptimizing.value"
                        :is-iterating="isIterating"
                        :selected-iterate-template="selectedIterateTemplate"
                        @update:selectedIterateTemplate="
                            emit('update:selectedIterateTemplate', $event)
                        "
                        :versions="displayAdapter.displayedVersions.value"
                        :current-version-id="displayAdapter.displayedCurrentVersionId.value ?? undefined"
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
                        @save-local-edit="handleSaveLocalEdit"
                    />
                </template>
                <template v-else>
                    <NEmpty
                        data-testid="pro-multi-empty-select-message"
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
                <SelectWithConfig
                    v-model="selectedTestModelKeyModel"
                    :options="modelSelection.textModelOptions.value"
                    :getPrimary="OptionAccessors.getPrimary"
                    :getSecondary="OptionAccessors.getSecondary"
                    :getValue="OptionAccessors.getValue"
                    @config="emit('config-model')"
                />
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
    </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, provide, watch, onMounted, type Ref } from 'vue'

import { useI18n } from "vue-i18n";
import { useProMultiMessageSession, type TestResults } from '../../stores/session/useProMultiMessageSession'
import { NCard, NFlex, NButton, NText, NEmpty } from "naive-ui";
import PromptPanelUI from "../PromptPanel.vue";
import ConversationTestPanel from "./ConversationTestPanel.vue";
import ConversationManager from "./ConversationManager.vue";
import OutputDisplay from "../OutputDisplay.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import { useConversationTester } from '../../composables/prompt/useConversationTester'
import { useConversationOptimization } from '../../composables/prompt/useConversationOptimization'
import { usePromptDisplayAdapter } from '../../composables/prompt/usePromptDisplayAdapter'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import { useEvaluationHandler, provideProContext, useEvaluationContext } from '../../composables/prompt'
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { OptionAccessors } from '../../utils/data-transformer'
import { useToast } from "../../composables/ui/useToast";
import {
    applyPatchOperationsToText,
    PREDEFINED_VARIABLES,
    type ConversationMessage,
    type OptimizationMode,
    type PromptRecord,
    type PromptRecordChain,
    type Template,
    type ToolDefinition,
    type ProSystemEvaluationContext,
    type PatchOperation,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import type { AppServices } from '../../types/services'

interface Props {
    // 核心状态
    optimizedReasoning?: string;

    // 优化状态
    isOptimizing?: boolean;
    isIterating?: boolean;

    // 外部状态注入（用于初始化本地 hook）
    // ✅ 已移除：selectedOptimizeModel, selectedTemplate, selectedIterateTemplate - 现在从 session store 直接读取
    // 🆕 评估模型（用于评估功能）
    evaluationModelKey?: string;

    // ✅ 已移除：optimizationContext - 改为从 inject('optimizationContext') 获取
    // ✅ 已移除：toolCount - 可从 optimizationContextTools 派生

    // ✅ 已移除：变量相关 props - 改为从 inject('variableManager') 获取
    // globalVariables, predefinedVariables, availableVariables, scanVariables

    // ✅ 已移除：enableMessageOptimization - 消息优化功能已移除

    // 全局优化链（用于历史记录恢复）
    versions?: PromptRecord[];
    currentVersionId?: string;

    // 响应式布局配置
    inputMode?: "compact" | "normal";
    buttonSize?: "small" | "medium" | "large";
    conversationMaxHeight?: number;
    resultVerticalLayout?: boolean;

    // 对比模式
    isCompareMode?: boolean;

    // ✅ 已移除：selectedTestModel - 现在从 session store 直接读取
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
    isOptimizing: false,
    isIterating: false,
    evaluationModelKey: undefined,
    versions: () => [],
    currentVersionId: "",
    inputMode: "normal",
    buttonSize: "medium",
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
    isCompareMode: false,
    testModelName: undefined,
});

// Emits 定义
const emit = defineEmits<{
    // 数据更新
    (e: "update:selectedIterateTemplate", value: Template | null): void;
    (e: "update:optimizationContext", value: ConversationMessage[]): void;

    // 操作事件（用于历史记录查看场景）
    (e: "test", testVariables: Record<string, string>): void;
    (e: "switch-version", version: PromptRecord): void;
    (e: "switch-to-v0", version: PromptRecord): void;
    (e: "save-favorite", data: SaveFavoritePayload): void;
    (e: "message-change", index: number, message: ConversationMessage, action: "add" | "update" | "delete"): void;

    // 打开面板/管理器
    (e: "open-global-variables"): void;
    (e: "open-variable-manager"): void;
    (e: "open-context-editor", tab?: string): void;
    (e: "open-template-manager", type?: string): void;
    (e: "open-tool-manager"): void;
    (e: "config-model"): void;

    // 预览相关
    (e: "open-prompt-preview"): void;

    // 变量管理
    (e: "variable-change", name: string, value: string): void;
    (e: "save-to-global", name: string, value: string): void;

    // 🆕 对比模式
    (e: "update:isCompareMode", value: boolean): void;
    (e: "compare-toggle"): void;
}>();

const { t } = useI18n();
const toast = useToast();

// 注入服务和变量管理器
const services = inject<Ref<AppServices | null>>('services')
const variableManager = inject<VariableManagerHooks | null>('variableManager', null)

// 🆕 注入优化上下文（多轮对话消息）
const optimizationContext = inject<Ref<ConversationMessage[]>>('optimizationContext', ref([]))

// ✅ 优化模式：固定为 'system'（此组件专门用于系统模式优化）
const optimizationMode: OptimizationMode = 'system';

// 🆕 访问变量数据（从 variableManager inject）
const globalVariables = computed(() => variableManager?.variableManager.value?.listVariables() || {})

const predefinedVariables = computed(() => {
    // 从 PREDEFINED_VARIABLES 常量获取预定义变量
    return PREDEFINED_VARIABLES.reduce((acc, name) => {
        acc[name] = variableManager?.variableManager.value?.getVariable(name) || ''
        return acc
    }, {} as Record<string, string>)
})

const availableVariables = computed(() => {
    // 合并全局变量和预定义变量
    return { ...globalVariables.value, ...predefinedVariables.value }
})

const scanVariables = (content: string) => {
    return variableManager?.variableManager.value?.scanVariablesInContent(content) || []
}

const toolCount = computed(() => {
    // 从 optimizationContextTools 派生
    return optimizationContextToolsRef.value?.length || 0
})

const enableMessageOptimization = computed(() => {
    // Pro Multi：自动选中最新消息进行优化（不需要显式“选择”按钮）
    // 这里仍需启用“消息优化模式”，以便 PromptPanel 展示优化结果区。
    return optimizationMode === 'system'
})

// 🆕 初始化临时变量管理器（与 ContextEditor 共享）
const tempVars = useTemporaryVariables()

// 🆕 测试结果持久化（Pro-system）
const proMultiSession = useProMultiMessageSession()

// ✨ 新增：直接使用 session store 管理模型和模板选择
const modelSelection = useWorkspaceModelSelection(services || ref(null), proMultiSession)
const templateSelection = useWorkspaceTemplateSelection(
    services || ref(null),
    proMultiSession,
    'conversationMessageOptimize',
    'contextIterate'
)

// 🆕 初始化本地会话优化逻辑
const conversationOptimization = useConversationOptimization(
    services || ref(null),
    optimizationContext,
    computed(() => optimizationMode),
    modelSelection.selectedOptimizeModelKey,
    templateSelection.selectedTemplate,
    templateSelection.selectedIterateTemplate
)

// 暴露给子组件（虽然目前主要通过 Props 传递给 ConversationManager，但保持 Provide 以防万一）
provide('conversationOptimization', conversationOptimization);

// 🆕 初始化显示适配器（根据模式自动切换数据源）
const displayAdapter = usePromptDisplayAdapter(
    conversationOptimization,
    {
        enableMessageOptimization,
        optimizationContext,
        globalVersions: computed(() => props.versions || []),
        globalCurrentVersionId: computed(() => props.currentVersionId),
        globalIsOptimizing: computed(() => props.isOptimizing),
    }
)

// 🆕 初始化多对话测试器
// ✅ 从 session store 读取测试模型
// 从 inject 获取 optimizationContextTools（由 App.vue 提供）
const optimizationContextToolsRef = inject<Ref<ToolDefinition[]>>('optimizationContextTools', ref([]))
// 使用本地 managed 的 selectedMessageId
const selectedMessageId = conversationOptimization.selectedMessageId

const conversationTester = useConversationTester(
    services || ref(null),
    modelSelection.selectedTestModelKey,
    optimizationContext,
    optimizationContextToolsRef,
    variableManager,
    selectedMessageId
)

// 🔧 为 SelectWithConfig 的 v-model 创建解包的 computed（避免 Vue prop 类型警告）
const selectedOptimizeModelKeyModel = computed({
    get: () => modelSelection.selectedOptimizeModelKey.value,
    set: (value) => { modelSelection.selectedOptimizeModelKey.value = value }
})

const selectedTemplateIdModel = computed({
    get: () => templateSelection.selectedTemplateId.value,
    set: (value) => { templateSelection.selectedTemplateId.value = value }
})

const selectedTestModelKeyModel = computed({
    get: () => modelSelection.selectedTestModelKey.value,
    set: (value) => { modelSelection.selectedTestModelKey.value = value }
})

const selectedIterateTemplate = computed<Template | null>({
    get: () => templateSelection.selectedIterateTemplate.value,
    set: (value) => {
        templateSelection.selectedIterateTemplateId.value = value?.id ?? ''
        templateSelection.selectedIterateTemplate.value = value ?? null
    }
})

// 🆕 从 session store 恢复测试结果（只恢复稳定字段，不恢复过程态）
onMounted(() => {
    // ✅ 刷新模型列表
    modelSelection.refreshTextModels()

    // Pro Multi：自动选中最新一条可优化消息（system/user），以便直接启用“优化”
    const latestSelectable = [...(optimizationContext.value || [])]
        .reverse()
        .find((msg) => msg && (msg.role === 'system' || msg.role === 'user') && !!msg.id)
    if (latestSelectable) {
        void conversationOptimization.selectMessage(latestSelectable)
    }

    // 兜底：如果还没有消息可选，但 session store 已有选中消息（刷新/恢复场景），尝试同步一次
    if (!latestSelectable && proMultiSession.selectedMessageId) {
        const restored = (optimizationContext.value || []).find((m) => m.id === proMultiSession.selectedMessageId)
        if (restored) {
            void conversationOptimization.selectMessage(restored)
        }
    }

    const saved = proMultiSession.testResults
    if (!saved) {
        return
    }

    // 只恢复稳定字段，不恢复 isTesting* 过程态
    conversationTester.testResults.originalResult = saved.originalResult || ""
    conversationTester.testResults.originalReasoning = saved.originalReasoning || ""
    conversationTester.testResults.optimizedResult = saved.optimizedResult || ""
    conversationTester.testResults.optimizedReasoning = saved.optimizedReasoning || ""
    conversationTester.testResults.isTestingOriginal = false
    conversationTester.testResults.isTestingOptimized = false
})

// 🆕 监听测试结果变化，同步到 session store（只持久化稳定字段）
watch(
    () => ({
        originalResult: conversationTester.testResults.originalResult,
        originalReasoning: conversationTester.testResults.originalReasoning,
        optimizedResult: conversationTester.testResults.optimizedResult,
        optimizedReasoning: conversationTester.testResults.optimizedReasoning,
    }),
    (stable) => {
        const hasAny =
            !!stable.originalResult ||
            !!stable.originalReasoning ||
            !!stable.optimizedResult ||
            !!stable.optimizedReasoning

        if (!hasAny) {
            proMultiSession.updateTestResults(null)
            return
        }

        const snapshot: TestResults = {
            originalResult: stable.originalResult || "",
            originalReasoning: stable.originalReasoning || "",
            optimizedResult: stable.optimizedResult || "",
            optimizedReasoning: stable.optimizedReasoning || "",
        }
        proMultiSession.updateTestResults(snapshot)
    },
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
        conversationMessages: optimizationContext.value.map((msg) => ({
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
    evaluationModelKey: computed(() => props.evaluationModelKey || modelSelection.selectedOptimizeModelKey.value),
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isConversationMessage = (value: unknown): value is ConversationMessage => {
    if (!isObjectRecord(value)) return false;
    return (
        typeof value.id === "string" &&
        typeof value.role === "string" &&
        typeof value.content === "string"
    );
};

const isContextSystemHistoryPayload = (
    value: unknown,
): value is ContextSystemHistoryPayload => {
    if (!isObjectRecord(value)) return false;

    const chain = value.chain;
    const record = value.record;
    const conversationSnapshot = value.conversationSnapshot;
    const message = value.message;

    if (
        !isObjectRecord(chain) ||
        typeof chain.chainId !== "string" ||
        !Array.isArray(chain.versions)
    ) {
        return false;
    }
    if (!isObjectRecord(record) || typeof record.id !== "string") return false;
    if (conversationSnapshot !== undefined && !Array.isArray(conversationSnapshot))
        return false;
    if (message !== undefined && !isConversationMessage(message)) return false;

    return true;
};

const restoreFromHistory = async (payload: unknown) => {
    if (!isContextSystemHistoryPayload(payload)) {
        console.warn(
            "[ContextSystemWorkspace] Invalid history payload, ignored:",
            payload,
        );
        return;
    }

    const { chain, record, conversationSnapshot, message } = payload;
    try {
        if (conversationSnapshot?.length) {
            let mappingCount = 0;
            conversationSnapshot.forEach((snapshotMsg) => {
                if (snapshotMsg.id && snapshotMsg.chainId) {
                    // 🔧 Codex 修复：使用纯 messageId 作为 key，与 useConversationOptimization 统一
                    conversationOptimization.messageChainMap.value.set(
                        snapshotMsg.id,
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

// 处理保存本地编辑
const handleSaveLocalEdit = async (payload: { note?: string }) => {
    await conversationOptimization.saveLocalEdit({
        optimizedPrompt: conversationOptimization.optimizedPrompt.value || '',
        note: payload.note,
        source: 'manual',
    });
};

// 暴露引用
defineExpose({
    testAreaPanelRef,
    restoreFromHistory,
    openIterateDialog: (initialContent?: string) => {
        promptPanelRef.value?.openIterateDialog?.(initialContent);
    },
    applyLocalPatch: (operation: PatchOperation) => {
        // 直接覆盖当前 optimizedPrompt（不自动创建新版本）
        // 用户可通过"保存修改"按钮显式保存为新版本
        const current = conversationOptimization.optimizedPrompt.value || '';
        const result = applyPatchOperationsToText(current, operation);
        conversationOptimization.optimizedPrompt.value = result.text;
        if (!result.ok) {
            toast.warning(t('toast.warning.patchApplyFailed'));
        } else {
            toast.success(t('evaluation.diagnose.applyFix'));
        }
    },
    reEvaluateActive: async () => {
        await evaluationHandler.handleReEvaluate();
    },
    // 🔧 Codex 修复：暴露 session store 恢复方法，供父组件在 session restore 完成后调用
    restoreConversationOptimizationFromSession: () => {
        conversationOptimization.restoreFromSessionStore();
    },
});
</script>
