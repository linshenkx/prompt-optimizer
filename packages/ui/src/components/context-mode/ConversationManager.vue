<template>
    <NCard class="conversation-manager" :size="size" :bordered="false">
        <!-- 标题和统计信息 -->
        <template #header>
            <NSpace class="conversation-heading" item-class="conversation-heading-item" justify="space-between" align="center">
                <!-- 左侧：标题 -->
                <NText class="text-base font-semibold conversation-manager-title">
                    {{ title || t("conversation.management.title") }}
                </NText>

                <!-- 右侧：统计信息和操作按钮 -->
                <NSpace :size="8" align="center">
                    <!-- 消息数量 -->
                    <NText v-if="messages.length > 0" :depth="3" style="font-size: 13px">
                        <UiMessageSquare :size="14" style="vertical-align: -2px" aria-hidden="true" /> {{ t("conversation.stats.messages") }}: {{ messages.length }}
                    </NText>

                    <!-- 变量统计 -->
                    <NText
                        v-if="showVariablePreview && allUsedVariables.length > 0"
                        :depth="3"
                        style="font-size: 13px"
                    >
                        <UiTags :size="14" style="vertical-align: -2px" aria-hidden="true" /> {{ t("conversation.stats.variables") }}: {{ allUsedVariables.length }}
                    </NText>

                    <!-- 缺失变量警告 -->
                    <NText
                        v-if="allMissingVariables.length > 0"
                        :depth="3"
                        style="font-size: 13px; color: var(--warning-color)"
                    >
                        <TriangleAlert :size="12" style="vertical-align: -2px" /> {{ t("conversation.stats.missing") }}: {{ allMissingVariables.length }}
                    </NText>

                    <!-- 工具数量标签（可点击） -->
                    <NText
                        v-if="enableToolManagement && (!isCompact || toolCount > 0)"
                        :depth="3"
                        style="font-size: 13px; cursor: pointer"
                        @click="emit('open-tool-manager')"
                        :title="t('contextEditor.toolsTab')"
                    >
                        <Wrench :size="12" style="vertical-align: -2px" /> {{ t("conversation.stats.tools") }}: {{ toolCount || 0 }}
                    </NText>

                    <NButton v-if="isCompact && collapsible" quaternary size="small"
                        :aria-expanded="!isCollapsed" @click="isCollapsed = !isCollapsed">
                        {{ t(isCollapsed ? 'common.expand' : 'common.collapse') }}
                    </NButton>
                    <!-- 打开上下文编辑器按钮 -->
                    <NButton
                        v-if="messages.length > 0 && canEditMessages"
                        @click="handleOpenContextEditor"
                        :size="buttonSize"
                        secondary
                        :loading="loading"
                        data-testid="pro-multi-open-context-editor"
                    >
                        <template #icon>
                            <UiSquarePen />
                        </template>
                        {{ t("conversation.management.openEditor") }}
                    </NButton>
                </NSpace>
            </NSpace>
        </template>

        <!-- 消息列表内容 -->
        <p v-if="isCompact && isCollapsed" class="conversation-collapsed-preview">{{ messages.find(message => message.id === selectedMessageId)?.content || messages[0]?.content }}</p>
        <div v-show="!isCompact || !isCollapsed" :style="contentStyle">
            <!-- 空状态 -->
            <NEmpty
                v-if="messages.length === 0"
                :description="t('conversation.noMessages')"
                size="small"
            >
                <template #icon>
                    <UiMessageSquare :size="48" />
                </template>
                <template #extra>
                        <NButton
                            v-if="canEditMessages"
                            @click="handleAddMessage"
                            :size="buttonSize"
                            type="primary"
                            dashed
                            data-testid="pro-multi-add-first-message"
                        >
                            {{ t("conversation.addFirst") }}
                        </NButton>
                </template>
            </NEmpty>

            <!-- 消息列表 -->
            <NScrollbar v-else :style="scrollbarStyle">
                <NList>
                    <NListItem
                        v-for="(message, index) in messages"
                        :key="`message-${index}`"
                        style="padding: 0"
                    >
                            <NCard
                                :size="cardSize"
                                embedded
                                :bordered="false"
                                content-style="padding: 0;"
                                :data-testid="`pro-multi-message-card-${index}`"
                                :data-message-id="message.id"
                                :class="{
                                    'message-card': true,
                                    'message-card-selected': enableMessageOptimization && message.id === selectedMessageId,
                                }"
                            >
                            <div class="cm-row">
                                <!-- 角色标签（小号，单行布局） -->
                                <NSpace align="center" :size="4" class="left">
                                    <NDropdown
                                        trigger="click"
                                        :options="roleOptions"
                                        placement="bottom-start"
                                        @select="
                                            (key) =>
                                                handleRoleSelect(
                                                    index,
                                                    key as
                                                        | 'system'
                                                        | 'user'
                                                        | 'assistant',
                                                )
                                        "
                                    >
                                        <NTag
                                            :size="tagSize"
                                            :type="getRoleTagType(message.role)"
                                            class="clickable-tag"
                                        >
                                            {{
                                                t(
                                                    `conversation.roles.${message.role}`,
                                                )
                                            }}
                                        </NTag>
                                    </NDropdown>
                                </NSpace>

                                <!-- 内容输入 -->
                                <div class="content">
                                    <VariableAwareInput
                                        v-if="canEditMessages"
                                        :model-value="message.content"
                                        @update:model-value="(value) => handleMessageUpdate(index, { ...message, content: value })"
                                        :placeholder="t(`conversation.placeholders.${message.role}`)"
                                        :autosize="{ minRows: 1, maxRows: 10 }"
                                        :existing-global-variables="Object.keys(props.availableVariables || {})"
                                        :existing-temporary-variables="Object.keys(props.temporaryVariables || {})"
                                        :predefined-variables="[...PREDEFINED_VARIABLES]"
                                        :global-variable-values="props.availableVariables || {}"
                                        :temporary-variable-values="props.temporaryVariables || {}"
                                        :predefined-variable-values="{}"
                                        @variable-extracted="handleVariableExtracted"
                                        @add-missing-variable="handleAddMissingVariable"
                                    />
                                    <!-- 只读模式下显示纯文本 -->
                                    <NText v-if="!canEditMessages">{{ message.content }}</NText>
                                </div>

                                <!-- 操作按钮（选择/上/下/删） -->
                                <NSpace
                                    v-if="canEditMessages"
                                    :size="4"
                                    class="actions"
                                >
                                    <!-- 🆕 选择按钮（仅在启用消息优化且消息可优化时显示） -->
                                    <NButton
                                        v-if="enableMessageOptimization && canOptimizeMessage(message)"
                                        @click.stop="handleMessageClick(message)"
                                        :size="buttonSize"
                                        :type="message.id === selectedMessageId ? 'primary' : 'default'"
                                        quaternary
                                        circle
                                        :title="message.id === selectedMessageId ? t('conversation.selected') : t('conversation.selectForOptimization')"
                                        :data-testid="`pro-multi-select-message-${index}`"
                                    >
                                        <template #icon>
                                            <UiCircleCheck v-if="message.id === selectedMessageId" :size="14" /><UiCircle v-else :size="14" />
                                        </template>
                                    </NButton>

                                    <NButton
                                        v-if="index > 0"
                                        @click="handleMoveMessage(index, -1)"
                                        :size="buttonSize"
                                        quaternary
                                        circle
                                        :title="t('common.moveUp')"
                                    >
                                        <template #icon>
                                            <UiChevronUp :size="14" />
                                        </template>
                                    </NButton>

                                    <NButton
                                        v-if="index < messages.length - 1"
                                        @click="handleMoveMessage(index, 1)"
                                        :size="buttonSize"
                                        quaternary
                                        circle
                                        :title="t('common.moveDown')"
                                    >
                                        <template #icon>
                                            <UiChevronDown :size="14" />
                                        </template>
                                    </NButton>

                                    <NButton
                                        @click="handleDeleteMessage(index)"
                                        :size="buttonSize"
                                        quaternary
                                        circle
                                        type="error"
                                        :title="t('common.delete')"
                                    >
                                        <template #icon>
                                            <UiTrash2 :size="14" />
                                        </template>
                                    </NButton>
                                </NSpace>
                            </div>
                        </NCard>
                    </NListItem>
                </NList>

                <!-- 添加消息按钮（去边框、去额外内边距） -->
                <div v-if="canEditMessages" class="mt-4 add-row">
                    <NSpace justify="center">
                        <NDropdown
                            :options="addMessageOptions"
                            @select="handleAddMessageWithRole"
                        >
                            <NButton
                                :size="buttonSize"
                                dashed
                                type="primary"
                                block
                                data-testid="pro-multi-add-message"
                            >
                                <template #icon>
                                    <UiPlus />
                                </template>
                                {{ t("conversation.addMessage") }}
                            </NButton>
                        </NDropdown>
                    </NSpace>
                </div>
            </NScrollbar>
        </div>
    </NCard>
</template>

<script setup lang="ts">
import { Tags as UiTags, TriangleAlert, Wrench, Settings as RenderSettings, User as RenderUser, Lightbulb as RenderLightbulb, Wrench as RenderWrench, SquarePen as UiSquarePen, MessageSquare as UiMessageSquare, CircleCheck as UiCircleCheck, Circle as UiCircle, ChevronUp as UiChevronUp, ChevronDown as UiChevronDown, Trash2 as UiTrash2, Plus as UiPlus } from '@lucide/vue'
import { ref, computed, watch, h, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'

import { useI18n } from "vue-i18n";
import {
    NCard,
    NSpace,
    NText,
    NTag,
    NButton,
    NEmpty,
    NScrollbar,
    NList,
    NListItem,
    NDropdown,
} from "naive-ui";
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from '../../composables/performance/useDebounceThrottle';
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout';
import { useToast } from "../../composables/ui/useToast";
import { VariableAwareInput } from "../variable-extraction";
import { PREDEFINED_VARIABLES } from "../../types/variable";
import type {
    ConversationManagerProps,
} from "../../types/components";
import type { ConversationMessage } from "@prompt-optimizer/core";

const { t } = useI18n();
const { isCompact } = useWorkspaceLayout();
const toast = useToast();

// 性能监控
const { recordUpdate } = usePerformanceMonitor("ConversationManager");

// 防抖节流
const { batchExecute } = useDebounceThrottle();

// Props 和 Events
const props = withDefaults(defineProps<ConversationManagerProps>(), {
    disabled: false,
    readonly: false,
    size: "medium",
    showVariablePreview: true,
    maxHeight: 400,
    collapsible: true,
    title: undefined,
    toolCount: 0,
    optimizationMode: "system",
    scanVariables: () => [],
    replaceVariables: (content: string) => content,
    isPredefinedVariable: () => false,
    // 🆕 临时变量
    temporaryVariables: () => ({}),
    // 🆕 消息优化相关
    selectedMessageId: undefined,
    enableMessageOptimization: false,
    isMessageOptimizing: false,
    // 🆕 工具管理相关
    enableToolManagement: true,
});

const emit = defineEmits<{
    (e: "update:messages", messages: ConversationMessage[]): void;
    (e: "messageChange", index: number, message: ConversationMessage, action: "add" | "update" | "delete"): void;
    (e: "messageReorder", fromIndex: number, toIndex: number): void;
    (e: "openContextEditor", messages: ConversationMessage[], variables: Record<string, string>): void;
    (e: "open-tool-manager"): void;
    (e: "variable-extracted", data: { variableName: string; variableValue: string; variableType: "global" | "temporary" }): void;
    (e: "add-missing-variable", name: string): void;
    (e: "messageSelect", message: ConversationMessage): void;
    (e: "ready"): void;
}>();

// 状态管理 - 使用 shallowRef 优化大数据渲染
const loading = ref(false);
const isCollapsed = ref(false);
watch(() => props.isMessageOptimizing, busy => {
    if (isCompact.value && props.collapsible && busy) isCollapsed.value = true;
});
defineExpose({ expand: () => { isCollapsed.value = false } });

// 批处理状态更新优化
const batchStateUpdate = batchExecute((updates: Array<() => void>) => {
    updates.forEach((update) => update());
    recordUpdate();
}, 16); // 使用16ms批处理，匹配60fps

// 计算属性
const buttonSize = computed(() => {
    const sizeMap = {
        small: "tiny",
        medium: "small",
        large: "medium",
    } as const;
    return sizeMap[props.size] || "small";
});

const tagSize = computed(() => {
    const sizeMap = {
        small: "small",
        medium: "small",
        large: "medium",
    } as const;
    return sizeMap[props.size] || "small";
});

const cardSize = computed(() => {
    const sizeMap = {
        small: "small",
        medium: "small",
        large: "medium",
    } as const;
    return sizeMap[props.size] || "small";
});

const contentStyle = computed(() => {
    const style: Record<string, string | number> = {};
    if (props.maxHeight && (!isCompact.value || !isCollapsed.value)) {
        style.maxHeight = `${props.maxHeight}px`;
    }
    return style;
});

const scrollbarStyle = computed(() => {
    if (props.maxHeight && (!isCompact.value || !isCollapsed.value)) {
        return { maxHeight: `${props.maxHeight - 100}px` };
    }
    return {};
});

// 消息编辑权限控制
const canEditMessages = computed(() => {
    // readonly优先级最高
    if (props.readonly) return false;
    // 允许编辑
    return true;
});

// 变量相关计算属性（统一使用注入函数）
const allUsedVariables = computed(() => {
    if (!props.showVariablePreview) return [];
    const vars = new Set<string>();
    props.messages.forEach((message) => {
        const content = message?.content || "";
        const detected = props.scanVariables(content) || [];
        detected.forEach((name) => vars.add(name));
    });
    return Array.from(vars);
});

const allMissingVariables = computed(() => {
    const globalVars = props.availableVariables || {};
    const tempVars = props.temporaryVariables || {};
    return allUsedVariables.value.filter(
        (name) => globalVars[name] === undefined && tempVars[name] === undefined,
    );
});

// 角色切换下拉
const roleOptions = computed(() => [
    { label: t("conversation.roles.system"), key: "system" },
    { label: t("conversation.roles.user"), key: "user" },
    { label: t("conversation.roles.assistant"), key: "assistant" },
    { label: t("conversation.roles.tool"), key: "tool" },
]);

// 添加消息的下拉菜单选项
const addMessageOptions = computed(() => [
    {
        label: t("conversation.roles.system"),
        key: "system",
        icon: () =>
            h(RenderSettings, { size: 14 }),
    },
    {
        label: t("conversation.roles.user"),
        key: "user",
        icon: () =>
            h(RenderUser, { size: 14 }),
    },
    {
        label: t("conversation.roles.assistant"),
        key: "assistant",
        icon: () =>
            h(RenderLightbulb, { size: 14 }),
    },
    {
        label: t("conversation.roles.tool"),
        key: "tool",
        icon: () =>
            h(RenderWrench, { size: 14 }),
    },
]);

// 工具函数
const getRoleTagType = (role: ConversationMessage["role"]) => {
    const typeMap = {
        system: "info",
        user: "success",
        assistant: "primary",
        tool: "warning",
    } as const;
    return typeMap[role] || "default";
};

// 动态autosize配置（轻量化版本）

// 消息处理方法 - 移除防抖以确保输入显示同步
const handleMessageUpdate = (index: number, message: ConversationMessage) => {
    const newMessages = [...props.messages];
    newMessages[index] = message;
    emit("update:messages", newMessages);
    emit("messageChange", index, message, "update");
    recordUpdate();
};

const handleMoveMessage = (fromIndex: number, direction: number) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= props.messages.length) return;

    const newMessages = [...props.messages];
    const temp = newMessages[fromIndex];
    newMessages[fromIndex] = newMessages[toIndex];
    newMessages[toIndex] = temp;

    emit("update:messages", newMessages);
    emit("messageReorder", fromIndex, toIndex);
};

const handleDeleteMessage = (index: number) => {
    const newMessages = props.messages.filter((_, i) => i !== index);
    emit("update:messages", newMessages);
    emit("messageChange", index, props.messages[index], "delete");
};

const handleAddMessage = () => {
    handleAddMessageWithRole("user");
};

const handleAddMessageWithRole = (role: ConversationMessage["role"]) => {
    const newMessage: ConversationMessage = {
        id: uuidv4(), // 🆕 自动生成唯一 ID
        role,
        content: "",
        originalContent: "", // 🆕 保存原始内容
    };

    const newMessages = [...props.messages, newMessage];
    emit("update:messages", newMessages);
    emit("messageChange", newMessages.length - 1, newMessage, "add");
};

const handleOpenContextEditor = () => {
    emit("openContextEditor", [...props.messages], props.availableVariables);
};

// 角色切换
const handleRoleSelect = (index: number, role: ConversationMessage["role"]) => {
    const current = props.messages[index];
    if (!current || current.role === role) return;
    const updated: ConversationMessage = { ...current, role };
    const newMessages = [...props.messages];
    newMessages[index] = updated;
    emit("update:messages", newMessages);
    emit("messageChange", index, updated, "update");
};

// 处理变量提取
// 注意：只 emit 事件，由父组件处理保存和显示 toast（参考 ContextEditor 的实现）
const handleVariableExtracted = (data: {
  variableName: string;
  variableValue: string;
  variableType: "global" | "temporary";
}) => {
  emit('variable-extracted', data);
};

// 处理添加缺失变量
const handleAddMissingVariable = (varName: string) => {
  emit('add-missing-variable', varName);
};

// 🆕 消息优化功能
// 判断消息是否可以被优化（只有 user 和 system 角色可优化）
const canOptimizeMessage = (message: ConversationMessage): boolean => {
    return message.role === 'user' || message.role === 'system';
};

// 处理消息点击（用于选择要优化的消息）
const handleMessageClick = (message: ConversationMessage) => {
    // 如果未启用消息优化功能，直接返回
    if (!props.enableMessageOptimization) return;

    // 只有可优化的消息才能被选中
    if (!canOptimizeMessage(message)) {
        toast.warning(
            t("toast.warning.cannotOptimizeRole", {
                role: t(`conversation.roles.${message.role}`),
            }),
        );
        return;
    }

    // 触发消息选择事件
    // 父组件应该监听此事件并调用 useConversationOptimization 的 selectMessage 方法
    emit('messageSelect', message);
};

// 初始化：为现有消息补全 id 和 originalContent 字段
onMounted(() => {
    let needsUpdate = false;
    const updatedMessages = props.messages.map(msg => {
        const updated = { ...msg };

        // 补全缺失的 id
        if (!updated.id) {
            updated.id = uuidv4();
            needsUpdate = true;
        }

        // 补全缺失的 originalContent
        if (updated.originalContent === undefined) {
            updated.originalContent = updated.content;
            needsUpdate = true;
        }

        return updated;
    });

    // 如果有更新，emit 新的消息数组
    if (needsUpdate) {
        emit("update:messages", updatedMessages);
    }
});

// 生命周期 - 使用批处理优化
watch(
    () => props.messages,
    () => {
        batchStateUpdate(() => {
            emit("ready");
        });
    },
    { deep: true, immediate: true },
);
</script>

<style scoped>
/* Pure Naive UI implementation - no custom theme CSS needed */
.conversation-manager {
    /* All styling handled by Naive UI components */
}

.cm-row {
    display: flex;
    align-items: flex-start;  /* 改为顶部对齐 */
    gap: 8px;
    flex-wrap: nowrap;
}

.cm-row .actions {
    flex-shrink: 0;
    opacity: 0.6;
    transition: opacity 0.15s ease;
}

.cm-row:hover .actions {
    opacity: 1;
}

.clickable-tag {
    cursor: pointer;
}

.cm-row .left {
    flex: 0 0 auto;
}

.cm-row .content {
    flex: 1 1 auto;
    min-width: 0;
}

/* VariableAwareInput 样式适配 */
.cm-row .content :deep(.variable-aware-input-wrapper) {
    width: 100%;
}

.cm-row .content :deep(.codemirror-container) {
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
    transition: border-color 0.3s;
}

.cm-row .content :deep(.codemirror-container:hover) {
    border-color: var(--n-border-color-hover);
}

.cm-row .content :deep(.codemirror-container:focus-within) {
    border-color: var(--n-primary-color);
    box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
}

/* CodeMirror 高度控制 */
.cm-row .content :deep(.cm-scroller) {
    min-height: 1.5em;
    max-height: 15em;  /* 约 10 行 */
}

/* 移动端适配 */
@media (max-width: 768px) {
    .cm-row {
        gap: 4px;
    }

    .cm-row .content :deep(.cm-scroller) {
        max-height: 12em;
    }
}

/* 🆕 消息优化功能样式 */
.message-card {
    transition: all 0.2s ease;
}

.message-card-selectable {
    cursor: pointer;
}

.message-card-selectable:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
}

.message-card-selected {
    box-shadow: 0 0 0 2px var(--n-color-target) !important;
    background-color: var(--n-color-target-hover, rgba(24, 160, 88, 0.08));
}

.message-card-not-optimizable {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
