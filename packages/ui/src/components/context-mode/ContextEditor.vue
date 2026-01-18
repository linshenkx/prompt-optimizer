<template>
    <NModal
        v-model:show="localVisible"
        preset="card"
        :title="modalTitle"
        :style="modalStyle"
        size="huge"
        :bordered="false"
        :segmented="false"
        :mask-closable="true"
        :class="accessibilityClasses"
        role="dialog"
        :aria-label="aria.getLabel('contextEditor')"
        :aria-describedby="aria.getDescription('contextEditor')"
        aria-modal="true"
        @update:show="handleVisibilityChange"
        @after-enter="handleModalOpen"
        @after-leave="handleModalClose"
    >
        <!-- 顶部工具栏 -->
        <template #header-extra>
            <NSpace
                v-if="!onlyShowTab"
                :size="buttonSize"
                role="toolbar"
                :aria-label="aria.getLabel('statisticsToolbar')"
            >
                <!-- 统计信息 -->
                <NTag
                    :size="tagSize"
                    type="info"
                    role="status"
                    :aria-label="
                        aria.getLabel(
                            'messageCount',
                            t('contextEditor.messageCount', { count: localState.messages.length }),
                        )
                    "
                >
                    {{ t('contextEditor.messageCount', { count: localState.messages.length }) }}
                </NTag>
                <NTag
                    v-if="variableCount > 0"
                    :size="tagSize"
                    type="success"
                    role="status"
                    :aria-label="
                        aria.getLabel('variableCount', t('contextEditor.variableCountLabel', { count: variableCount }))
                    "
                >
                    {{ t('contextEditor.variableCountLabel', { count: variableCount }) }}
                </NTag>
                <NTag
                    v-if="localState.tools.length > 0"
                    :size="tagSize"
                    type="primary"
                    role="status"
                    :aria-label="
                        aria.getLabel(
                            'toolCount',
                            t('contextEditor.toolCountLabel', { count: localState.tools.length }),
                        )
                    "
                >
                    {{ t('contextEditor.toolCountLabel', { count: localState.tools.length }) }}
                </NTag>
            </NSpace>
        </template>

        <!-- 空状态 -->
        <NEmpty
            v-if="localState.messages.length === 0"
            :description="t('contextEditor.noMessages')"
            role="status"
            :aria-label="aria.getLabel('emptyMessages')"
        >
            <template #icon>
                <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1"
                    role="img"
                    :aria-label="aria.getLabel('messageIcon')"
                >
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
            </template>
            <template #extra>
                <NButton
                    @click="addMessage"
                    :size="buttonSize"
                    type="primary"
                    :aria-label="aria.getLabel('addFirstMessage')"
                    :aria-describedby="aria.getDescription('addFirstMessage')"
                >
                    {{ t("contextEditor.addFirstMessage") }}
                </NButton>
            </template>
        </NEmpty>

        <!-- 消息列表 -->
        <NScrollbar v-else :style="scrollbarStyle">
            <NSpace vertical :size="12" style="padding-right: 12px;">
                <NCard
                    v-for="(message, index) in localState.messages"
                    :key="`message-${index}`"
                    :size="cardSize"
                    embedded
                    :class="{ 'focused-card': focusedIndex === index }"
                    :ref="messageCardRef(index)"
                >
                    <template #header>
                        <NSpace justify="space-between" align="center">
                            <NSpace align="center" :size="4">
                                <NTag :size="tagSize" round>{{ index + 1 }}</NTag>
                                <NSelect
                                    v-model:value="message.role"
                                    :size="size"
                                    style="width: 100px"
                                    :options="roleOptions"
                                    :disabled="disabled"
                                    @update:value="handleMessageUpdate(index, message)"
                                />
                                <NTag
                                    v-if="getMessageVariables(message.content).detected.length > 0"
                                    :size="tagSize"
                                    type="info"
                                >
                                    {{ t('contextEditor.variableDetected', { count: getMessageVariables(message.content).detected.length }) }}
                                </NTag>
                                <NTag
                                    v-if="getMessageVariables(message.content).missing.length > 0"
                                    :size="tagSize"
                                    type="warning"
                                >
                                    {{ t('contextEditor.missingVariableLabel', { count: getMessageVariables(message.content).missing.length }) }}
                                </NTag>
                            </NSpace>
                            <NSpace :size="4">
                                <NButton
                                    @click="togglePreview(index)"
                                    :size="buttonSize"
                                    :type="previewMode.get(index) ? 'primary' : 'default'"
                                    quaternary
                                    circle
                                    :title="previewMode.get(index) ? t('common.edit') : t('common.preview')"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </template>
                                </NButton>
                                <NButton
                                    v-if="index > 0"
                                    @click="moveMessage(index, -1)"
                                    :size="buttonSize"
                                    quaternary
                                    circle
                                    :title="t('common.moveUp')"
                                    :disabled="disabled"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                        </svg>
                                    </template>
                                </NButton>
                                <NButton
                                    v-if="index < localState.messages.length - 1"
                                    @click="moveMessage(index, 1)"
                                    :size="buttonSize"
                                    quaternary
                                    circle
                                    :title="t('common.moveDown')"
                                    :disabled="disabled"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </template>
                                </NButton>
                                <NButton
                                    @click="deleteMessage(index)"
                                    :size="buttonSize"
                                    quaternary
                                    circle
                                    type="error"
                                    :title="t('common.delete')"
                                    :disabled="disabled || localState.messages.length <= 1"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </template>
                                </NButton>
                            </NSpace>
                        </NSpace>
                    </template>
                    <VariableAwareInput
                        v-if="!previewMode.get(index)"
                        :model-value="message.content"
                        @update:model-value="handleMessageUpdate(index, { ...message, content: $event })"
                        :placeholder="getPlaceholderText(message.role)"
                        :autosize="{ minRows: 1, maxRows: 20 }"
                        :disabled="disabled"
                        :existing-global-variables="Object.keys(aggregatedVars.variablesBySource.value.global)"
                        :existing-temporary-variables="Object.keys(aggregatedVars.variablesBySource.value.temporary)"
                        :predefined-variables="Object.keys(aggregatedVars.variablesBySource.value.predefined)"
                        :global-variable-values="aggregatedVars.variablesBySource.value.global"
                        :temporary-variable-values="aggregatedVars.variablesBySource.value.temporary"
                        :predefined-variable-values="aggregatedVars.variablesBySource.value.predefined"
                        @variable-extracted="handleVariableExtracted"
                        @add-missing-variable="handleCreateVariableAndOpenManager"
                    />
                    <NText v-else style="white-space: pre-wrap; word-break: break-word;">
                        {{ replaceVariables(message.content) }}
                    </NText>
                </NCard>

                <!-- 添加消息按钮 -->
                <NButton
                    @click="addMessage"
                    :size="buttonSize"
                    dashed
                    type="primary"
                    :disabled="disabled"
                >
                    <template #icon>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </template>
                    {{ t("contextEditor.addMessage") }}
                </NButton>
            </NSpace>
        </NScrollbar>

        <!-- 底部操作栏 -->
        <template #action>
            <NSpace justify="space-between">
                <NSpace>
                    <!-- 导入导出按钮 -->
                    <NButton
                        @click="handleImport"
                        :size="buttonSize"
                        secondary
                        :disabled="disabled || loading"
                    >
                        <template #icon>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                                />
                            </svg>
                        </template>
                        {{ t("common.import") }}
                    </NButton>

                    <NButton
                        @click="handleExport"
                        :size="buttonSize"
                        secondary
                        :disabled="
                            disabled ||
                            loading ||
                            (localState.messages.length === 0 &&
                                localState.tools.length === 0)
                        "
                    >
                        <template #icon>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                        </template>
                        {{ t("common.export") }}
                    </NButton>
                </NSpace>

                <NSpace>
                    <NButton
                        @click="handleCancel"
                        :size="buttonSize"
                        :disabled="loading"
                    >
                        {{ t("common.cancel") }}
                    </NButton>
                    <NButton
                        @click="handleSave"
                        :size="buttonSize"
                        type="primary"
                        :loading="loading"
                    >
                        {{ t("common.save") }}
                    </NButton>
                </NSpace>
            </NSpace>
        </template>
    </NModal>

    <!-- 导入对话框 -->
    <ImportExportDialog
        v-model:visible="showImportDialog"
        mode="import"
        :messages="[]"
        @import-success="handleImportSuccess"
        @export-error="handleExportError"
    />

    <!-- 导出对话框 -->
    <ImportExportDialog
        v-model:visible="showExportDialog"
        mode="export"
        :messages="localState.messages"
        :tools="localState.tools"
        @export-success="handleExportSuccess"
        @export-error="handleExportError"
    />

    <!-- 变量编辑对话框 -->
    <NModal
        v-model:show="variableEditState.show"
        preset="card"
        :title="
            variableEditState.isEditing
                ? t('contextEditor.editVariable')
                : t('contextEditor.addVariable')
        "
        style="width: 500px"
        :mask-closable="false"
    >
        <NSpace vertical>
            <!-- 变量名 -->
            <div>
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.variableName")
                }}</label>
                <NInput
                    v-model:value="variableEditState.name"
                    :placeholder="t('contextEditor.variableNamePlaceholder')"
                    :disabled="
                        variableEditState.isEditing ||
                        variableEditState.isFromMissing
                    "
                    @keydown.enter="saveVariable"
                />
                <NText
                    depth="3"
                    class="text-xs mt-1"
                    v-if="isPredefinedVariable(variableEditState.name)"
                >
                    <span class="text-red-500">{{
                        t("contextEditor.predefinedVariableWarning")
                    }}</span>
                </NText>
            </div>

            <!-- 变量类型 -->
            <div>
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.variableType")
                }}</label>
                <NRadioGroup v-model:value="variableEditState.type">
                    <NSpace>
                        <NRadio value="temporary">
                            <NSpace :size="4" align="center">
                                <span>{{ t("contextEditor.variableSourceLabels.temporary") }}</span>
                                <NText depth="3" class="text-xs">
                                    {{ t("contextEditor.temporaryVariableHint") }}
                                </NText>
                            </NSpace>
                        </NRadio>
                        <NRadio value="global">
                            <NSpace :size="4" align="center">
                                <span>{{ t("contextEditor.variableSourceLabels.global") }}</span>
                                <NText depth="3" class="text-xs">
                                    {{ t("contextEditor.globalVariableHint") }}
                                </NText>
                            </NSpace>
                        </NRadio>
                    </NSpace>
                </NRadioGroup>
            </div>

            <!-- 变量值 -->
            <div>
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.variableValue")
                }}</label>
                <NInput
                    ref="variableValueInputRef"
                    v-model:value="variableEditState.value"
                    type="textarea"
                    :placeholder="t('contextEditor.variableValuePlaceholder')"
                    :autosize="{ minRows: 3, maxRows: 8 }"
                    @keydown.ctrl.enter="saveVariable"
                />
            </div>
        </NSpace>

        <template #action>
            <NSpace justify="end">
                <NButton @click="cancelVariableEdit" :size="buttonSize">
                    {{ t("common.cancel") }}
                </NButton>
                <NButton
                    @click="saveVariable"
                    type="primary"
                    :size="buttonSize"
                    :disabled="
                        !variableEditState.name.trim() ||
                        isPredefinedVariable(variableEditState.name)
                    "
                >
                    {{
                        variableEditState.isEditing
                            ? t("common.save")
                            : t("common.add")
                    }}
                </NButton>
            </NSpace>
        </template>
    </NModal>

    <!-- 实时区域用于屏幕阅读器 -->
    <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
        v-if="liveRegionMessage"
    >
        {{ liveRegionMessage }}
    </div>

    <!-- 断言性实时区域 -->
    <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        class="sr-only"
        v-if="isAccessibilityMode && announcements.length > 0"
    >
        {{ announcements[announcements.length - 1] }}
    </div>
</template>

<script setup lang="ts">
import {
    ref,
    computed,
    watch,
    shallowRef,
    nextTick,
    type ComponentPublicInstance,
    type VNodeRef,
} from 'vue'

import { useI18n } from "vue-i18n";
import {
    NModal,
    NCard,
    NButton,
    NSpace,
    NTag,
    NEmpty,
    NScrollbar,
    NInput,
    NSelect,
    NText,
    NRadioGroup,
    NRadio,
} from "naive-ui";
import { useResponsive } from "../../composables/ui/useResponsive";
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from '../../composables/performance/useDebounceThrottle';
import { useAccessibility } from "../../composables/accessibility/useAccessibility";
import { useToast } from "../../composables/ui/useToast";
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables';
import { VariableAwareInput } from "../variable-extraction";
import ImportExportDialog from './ImportExportDialog.vue';
import { useAggregatedVariables } from '../../composables/variable/useAggregatedVariables';
import type {
    ContextEditorProps,
} from "../../types/components";
import type {
    ContextEditorState,
    ConversationMessage,
    ToolDefinition,
} from "@prompt-optimizer/core";
import {
    PREDEFINED_VARIABLES,
    type PredefinedVariable,
} from "../../types/variable";

const { t } = useI18n();
const toast = useToast();

// 性能监控
const { recordUpdate } = usePerformanceMonitor("ContextEditor");

// 防抖节流
const { debounce, throttle, batchExecute } = useDebounceThrottle();

// 可访问性支持
const {
    aria,
    announce,
    accessibilityClasses,
    isAccessibilityMode,
    liveRegionMessage,
    announcements,
} = useAccessibility("ContextEditor");

// Props 和 Events（必须在最前面定义，因为后面的代码会用到）
const props = withDefaults(
    defineProps<ContextEditorProps>(),
    {
        disabled: false,
        readonly: false,
        size: "medium",
        visible: false,
        showToolManager: true,
        optimizationMode: "system",
        title: "",
        width: "90vw",
        height: "85vh",
        defaultTab: "messages",
        onlyShowTab: undefined,
    },
);

const emit = defineEmits({
    "update:visible": (visible: boolean) => typeof visible === "boolean",
    "update:state": (state: ContextEditorState) => !!state,
    "update:tools": (tools: ToolDefinition[]) => Array.isArray(tools),
    contextChange: (messages: ConversationMessage[], variables: Record<string, string>) =>
        Array.isArray(messages) && !!variables,
    toolChange: (tools: ToolDefinition[], action: "add" | "update" | "delete", index?: number) =>
        Array.isArray(tools) &&
        (action === "add" || action === "update" || action === "delete") &&
        (index === undefined || typeof index === "number"),
    save: (context: { messages: ConversationMessage[]; variables: Record<string, string>; tools: ToolDefinition[] }) =>
        !!context,
    cancel: () => true,
    previewToggle: (enabled: boolean) => typeof enabled === "boolean",
    openVariableManager: (focusVariable?: string) =>
        focusVariable === undefined || typeof focusVariable === "string",
    createVariable: (name: string, defaultValue?: string) =>
        typeof name === "string" && (defaultValue === undefined || typeof defaultValue === "string"),
});

// 临时变量管理
const tempVars = useTemporaryVariables();

// 全局变量管理
// 从 props 接收 variableManager 实例，确保与全局变量管理器数据同步
if (!props.variableManager) {
    throw new Error('[ContextEditor] Missing required prop: variableManager. ContextEditor must receive a variableManager instance from parent component.');
}

const variableManager = props.variableManager;

// 聚合变量（包含预定义、全局、临时三层）
const aggregatedVars = useAggregatedVariables(variableManager);

// 响应式配置
const {
    modalWidth,
    buttonSize: responsiveButtonSize,
    isMobile,
} = useResponsive();

// 状态管理 - 使用性能优化
const loading = ref(false);
const activeTab = ref("messages");
const localVisible = ref(props.visible);

// 导入导出对话框状态
const showImportDialog = ref(false);
const showExportDialog = ref(false);

// 变量值输入框引用（用于自动聚焦）
type FocusableInput = { focus: () => void };
const variableValueInputRef = ref<FocusableInput | null>(null);

const isPredefinedVariable = (name: string): name is PredefinedVariable => {
    return (PREDEFINED_VARIABLES as readonly string[]).includes(name);
};

// 使用shallowRef优化深度对象
// 注意：variables 已迁移到 useTemporaryVariables() 和 useVariableManager() 管理
const localState = shallowRef<ContextEditorState>({
    messages: [],
    tools: [],
    showVariablePreview: true,
    showToolManager: props.showToolManager,
    mode: "edit",
});

// 预览模式控制 - 使用Map优化
const previewMode = shallowRef<Map<number, boolean>>(new Map());

// 批量状态更新
const batchStateUpdate = batchExecute((updates: Array<() => void>) => {
    updates.forEach((update) => update());
    recordUpdate();
}, 16); // 使用16ms批处理，匹配60fps

// 计算属性
const buttonSize = computed(() => {
    return responsiveButtonSize.value;
});

const tagSize = computed(() => {
    const sizeMap = {
        small: "small",
        medium: "small",
        large: "medium",
    } as const;
    return sizeMap[responsiveButtonSize.value] || "small";
});

// 标签页显示控制逻辑 - 配置驱动
type TabName = 'messages' | 'variables' | 'tools';

// 标签页默认可见性配置（ContextEditor 仅用于 Context System 模式）
// 变量管理已移除，使用独立的 VariableManagerModal
// 工具管理已移除，使用独立的 ToolManagerModal
const TAB_VISIBILITY_CONFIG: Record<TabName, () => boolean> = {
    messages: () => true,
    variables: () => false, // 已移除变量标签页
    tools: () => false, // 已移除工具标签页，使用独立的 ToolManagerModal
};

// 通用标签页可见性计算函数
const createTabVisibility = (tabName: TabName) => computed(() => {
    // 如果指定了 onlyShowTab，只有当值匹配时才显示
    if (props.onlyShowTab) {
        return props.onlyShowTab === tabName;
    }
    // 否则使用配置的默认可见性规则
    return TAB_VISIBILITY_CONFIG[tabName]();
});

// 各标签页可见性
const showMessagesTab = createTabVisibility('messages');
const showVariablesTab = createTabVisibility('variables');
const showToolsTab = createTabVisibility('tools');

const resolveDefaultTab = (): string => {
    const candidate = props.onlyShowTab || props.defaultTab;
    const visibilityMap: Record<string, boolean> = {
        messages: showMessagesTab.value,
        variables: showVariablesTab.value,
        tools: showToolsTab.value,
    };
    if (candidate && visibilityMap[candidate]) {
        return candidate;
    }
    const preferenceOrder: Array<keyof typeof visibilityMap> = [
        "messages",
        "variables",
        "tools",
    ];
    for (const key of preferenceOrder) {
        if (visibilityMap[key]) return key;
    }
    return "messages";
};

activeTab.value = resolveDefaultTab();

const cardSize = computed(() => {
    const sizeMap = {
        small: "small",
        medium: "small",
        large: "medium",
    } as const;
    return sizeMap[responsiveButtonSize.value] || "small";
});

const modalStyle = computed(() => ({
    width: modalWidth.value,
    height: isMobile.value ? "95vh" : props.height || "85vh",
}));

const scrollbarStyle = computed(() => ({
    maxHeight: isMobile.value ? "40vh" : "60vh",
}));

const modalTitle = computed(() => props.title || t("contextEditor.title"));

const size = computed(() => responsiveButtonSize.value);

const variableCount = computed(() => {
    const variables = new Set<string>();
    localState.value.messages.forEach((message) => {
        const detected = props.scanVariables(message.content || "");
        detected.forEach((v) => variables.add(v));
    });
    return variables.size;
});


const roleOptions = computed(() => [
    { label: t("conversation.roles.system"), value: "system" },
    { label: t("conversation.roles.user"), value: "user" },
    { label: t("conversation.roles.assistant"), value: "assistant" },
    { label: t("conversation.roles.tool"), value: "tool" },
]);

// 工具函数（统一使用注入函数）
const getMessageVariables = (content: string) => {
    const detected = props.scanVariables(content || "") || [];
    const missing = detected.filter(
        (varName) => aggregatedVars.allVariables.value[varName] === undefined,
    );
    return { detected, missing };
};

const replaceVariables = (content: string): string => {
    return props.replaceVariables(content || "", aggregatedVars.allVariables.value);
};

const getPlaceholderText = (role: string) => {
    switch (role) {
        case "system":
            return t("conversation.placeholders.system");
        case "user":
            return t("conversation.placeholders.user");
        case "assistant":
            return t("conversation.placeholders.assistant");
        case "tool":
            return t("conversation.placeholders.tool");
        default:
            return t("conversation.placeholders.default");
    }
};

// 可访问性事件处理（不启用键盘焦点陷阱，避免拦截箭头键）
const handleModalOpen = () => {
    nextTick(() => {
        announce(aria.getLiveRegionText("modalOpened"), "assertive");
    });
};

const handleModalClose = () => {
    announce(aria.getLiveRegionText("modalClosed"), "polite");
};

// 消息处理方法
const addMessage = () => {
    const newMessage: ConversationMessage = {
        role: "user",
        content: "",
    };
    localState.value.messages.push(newMessage);
    handleStateChange();
};

const deleteMessage = (index: number) => {
    if (localState.value.messages.length > 1) {
        localState.value.messages.splice(index, 1);
        handleStateChange();
    }
};

const moveMessage = (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < localState.value.messages.length) {
        const temp = localState.value.messages[index];
        localState.value.messages[index] = localState.value.messages[newIndex];
        localState.value.messages[newIndex] = temp;
        handleStateChange();
    }
};

const handleMessageUpdate = debounce(
    (index: number, message: ConversationMessage) => {
        batchStateUpdate(() => {
            localState.value.messages[index] = { ...message };
        });
        handleStateChange();
    },
    300,
    false,
    "messageUpdate",
);

// 变量提取处理
const handleVariableExtracted = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
}) => {
    if (data.variableType === "global") {
        props.variableManager.addVariable(data.variableName, data.variableValue);
        toast.success(
            t("variableExtraction.savedToGlobal", { name: data.variableName }),
        );
    } else {
        tempVars.setVariable(data.variableName, data.variableValue);
        toast.success(
            t("variableExtraction.savedToTemporary", { name: data.variableName }),
        );
    }
};

const togglePreview = throttle(
    (index: number) => {
        const currentMode = previewMode.value.get(index) || false;
        previewMode.value.set(index, !currentMode);
        recordUpdate();
    },
    100,
    "togglePreview",
);

// 工具管理方法 - 实际实现在后面

// 事件处理方法
const handleVisibilityChange = (visible: boolean) => {
    localVisible.value = visible;
    emit("update:visible", visible);
};

const handleStateChange = () => {
    emit("update:state", { ...localState.value });
    // 传递临时变量的快照，供父组件使用
    // 注意：全局变量由 useVariableManager 管理，不包含在此事件中
    emit("contextChange", [...localState.value.messages], tempVars.listVariables());
};

const handleImport = () => {
    showImportDialog.value = true;
};

const handleExport = () => {
    showExportDialog.value = true;
};

const handleSave = () => {
    const context = {
        messages: [...localState.value.messages],
        variables: {}, // 不再保存临时变量到上下文
        tools: [...localState.value.tools],
    };
    emit("save", context);
};

const handleCancel = () => {
    emit("cancel");
    handleVisibilityChange(false);
};

// 变量管理相关状态
const variableEditState = ref<{
    show: boolean;
    isEditing: boolean;
    isFromMissing: boolean;
    editingName: string;
    name: string;
    value: string;
    type: "temporary" | "global";
    originalType?: "temporary" | "global";
}>({
    show: false,
    isEditing: false,
    isFromMissing: false,
    editingName: "",
    name: "",
    value: "",
    type: "temporary",
});

const saveVariable = () => {
    const { isEditing, editingName, name, value, type, originalType } = variableEditState.value;

    // 验证变量名
    if (!name.trim()) {
        return;
    }

    // 检查是否是预定义变量名
    if (isPredefinedVariable(name)) {
        announce(t("contextEditor.predefinedVariableError"), "assertive");
        return;
    }

    // 如果是编辑模式且变量名发生变化，需要删除旧变量
    if (isEditing && editingName !== name && originalType) {
        if (originalType === "temporary") {
            tempVars.deleteVariable(editingName);
        } else if (originalType === "global") {
            variableManager.deleteVariable(editingName);
        }
    }

    // 根据类型保存变量
    if (type === "temporary") {
        tempVars.setVariable(name, value);
    } else if (type === "global") {
        // 保存全局变量 - 检查是否已初始化
        if (!variableManager.isReady.value) {
            announce(t("contextEditor.variableManagerNotReady"), "assertive");
            return;
        }

        try {
            if (isEditing) {
                variableManager.updateVariable(name, value);
            } else {
                variableManager.addVariable(name, value);
            }
        } catch (error) {
            console.error('[ContextEditor] Failed to save global variable:', error);
            announce(t("contextEditor.variableSaveFailed"), "assertive");
            return;
        }
    }

    // 关闭编辑器
    variableEditState.value.show = false;

    // 触发状态更新
    handleStateChange();

    // 通知用户
    const action = isEditing ? t("common.edit") : t("common.add");
    const typeLabel = type === "temporary" ? t("contextEditor.variableSourceLabels.temporary") : t("contextEditor.variableSourceLabels.global");
    announce(t("contextEditor.variableSaved", { action, name, type: typeLabel }), "polite");
};

const cancelVariableEdit = () => {
    variableEditState.value.show = false;
};

// 变量快捷操作（修改行为：直接在上下文中创建临时变量）
const handleCreateVariableAndOpenManager = (name: string) => {
    if (!name) return;
    // 直接在上下文中创建临时变量，标记为来自缺失变量
    variableEditState.value = {
        show: true,
        isEditing: false,
        isFromMissing: true,
        editingName: "",
        name,
        value: "",
        type: "temporary",
    };
    // 等待弹窗打开后自动聚焦到变量值输入框
    nextTick(() => {
        variableValueInputRef.value?.focus();
    });
};

// 消息聚焦（滚动并高亮）
const focusedIndex = ref<number | null>(null);
const messageRefs = new Map<number, HTMLElement>();

const resolveHtmlElementFromVNodeRef = (
    refEl: Element | ComponentPublicInstance | null,
): HTMLElement | null => {
    if (!refEl) return null;
    if (refEl instanceof HTMLElement) return refEl;
    if (refEl instanceof Element) return null;
    if (typeof refEl === "object" && "$el" in refEl) {
        const maybeEl = (refEl as { $el?: unknown }).$el;
        return maybeEl instanceof HTMLElement ? maybeEl : null;
    }
    return null;
};

const setMessageRef = (
    index: number,
    refEl: Element | ComponentPublicInstance | null,
) => {
    const element = resolveHtmlElementFromVNodeRef(refEl);
    if (element) messageRefs.set(index, element);
};

const messageCardRef = (index: number): VNodeRef => {
    return (refEl) => setMessageRef(index, refEl);
};
// 生命周期
watch(
    () => props.visible,
    (newVisible) => {
        localVisible.value = newVisible;
        activeTab.value = resolveDefaultTab();
    },
);

watch(
    () => props.onlyShowTab,
    (tab) => {
        if (tab) {
            activeTab.value = resolveDefaultTab();
        }
    },
);

watch(
    () => props.defaultTab,
    () => {
        activeTab.value = resolveDefaultTab();
    },
);

watch(
    [showMessagesTab, showVariablesTab, showToolsTab],
    () => {
        const visibilityMap: Record<string, boolean> = {
            messages: showMessagesTab.value,
            variables: showVariablesTab.value,
            tools: showToolsTab.value,
        };
        if (!visibilityMap[activeTab.value]) {
            activeTab.value = resolveDefaultTab();
        }
    },
);

watch(
    () => props.state,
    (newState) => {
        if (newState) {
            localState.value = { ...newState };
        }
    },
    { deep: true },
);

watch(
    () => props.showToolManager,
    (show) => {
        localState.value.showToolManager = show;
    },
);

// 导入导出事件处理
interface ImportSuccessData {
    messages: ConversationMessage[];
    tools?: ToolDefinition[];
}

const handleImportSuccess = (data: ImportSuccessData) => {
    // 将导入的数据同步到本地状态
    localState.value.messages = data.messages;
    localState.value.tools = data.tools || [];

    handleStateChange();

    // 切换到消息编辑标签页
    activeTab.value = "messages";
    announce(t("contextEditor.importSuccess"), "polite");
};

const handleExportSuccess = () => {
    announce(t("contextEditor.exportSuccess"), "polite");
};

const handleExportError = (message?: string) => {
    const fallbackMessage = message || t("contextEditor.exportFailed");
    console.error(fallbackMessage);
    announce(fallbackMessage, "assertive");
};
</script>

<style scoped>
/* 可访问性：屏幕阅读器专用 */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* 聚焦卡片高亮 */
.focused-card {
    box-shadow: 0 0 0 2px var(--n-color-target, #18a058) inset;
    transition: box-shadow 0.2s ease;
}
</style>
