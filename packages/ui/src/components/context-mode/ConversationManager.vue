<template>
    <NCard class="conversation-manager" :size="size" :bordered="false">
        <!-- 标题和统计信息 -->
        <template #header>
            <NSpace justify="space-between" align="center">
                <!-- 左侧：标题 -->
                <NText class="text-base font-semibold">
                    {{ title || t("conversation.management.title") }}
                </NText>

                <!-- 右侧：统计信息和操作按钮 -->
                <NSpace :size="8" align="center">
                    <!-- 消息数量 -->
                    <NText v-if="messages.length > 0" :depth="3" style="font-size: 13px">
                        💬 {{ t("conversation.stats.messages") }}: {{ messages.length }}
                    </NText>

                    <!-- 变量统计 -->
                    <NText
                        v-if="showVariablePreview && allUsedVariables.length > 0"
                        :depth="3"
                        style="font-size: 13px"
                    >
                        🏷️ {{ t("conversation.stats.variables") }}: {{ allUsedVariables.length }}
                    </NText>

                    <!-- 缺失变量警告 -->
                    <NText
                        v-if="allMissingVariables.length > 0"
                        :depth="3"
                        style="font-size: 13px; color: var(--warning-color)"
                    >
                        ⚠️ {{ t("conversation.stats.missing") }}: {{ allMissingVariables.length }}
                    </NText>

                    <!-- 工具数量 -->
                    <NText
                        v-if="toolCount && toolCount > 0"
                        :depth="3"
                        style="font-size: 13px"
                    >
                        🔧 {{ t("conversation.stats.tools") }}: {{ toolCount }}
                    </NText>

                    <!-- 打开上下文编辑器按钮 -->
                    <NButton
                        v-if="messages.length > 0 && canEditMessages"
                        @click="handleOpenContextEditor"
                        :size="buttonSize"
                        type="primary"
                        :loading="loading"
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
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                            </svg>
                        </template>
                        {{ t("conversation.management.openEditor") }}
                    </NButton>
                </NSpace>
            </NSpace>
        </template>

        <!-- 消息列表内容 -->
        <div v-if="!isCollapsed" :style="contentStyle">
            <!-- 空状态 -->
            <NEmpty
                v-if="messages.length === 0"
                :description="t('conversation.noMessages')"
                size="small"
            >
                <template #icon>
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1"
                    >
                        <path
                            d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                        />
                    </svg>
                </template>
                <template #extra>
                    <NButton
                        v-if="canEditMessages"
                        @click="handleAddMessage"
                        :size="buttonSize"
                        type="primary"
                        dashed
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

                                <!-- 内容输入，单行自增高 -->
                                <div class="content">
                                    <NInput
                                        v-if="canEditMessages"
                                        :value="message.content"
                                        @update:value="
                                            (value) =>
                                                handleMessageUpdate(index, {
                                                    ...message,
                                                    content: value,
                                                })
                                        "
                                        type="textarea"
                                        :placeholder="
                                            t(
                                                `conversation.placeholders.${message.role}`,
                                            )
                                        "
                                        :autosize="{ minRows: 1, maxRows: 1 }"
                                        :resizable="false"
                                        :size="inputSize"
                                        :style="{ width: '100%' }"
                                    />
                                    <NText v-else>{{ message.content }}</NText>
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
                                    >
                                        <template #icon>
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    v-if="message.id === selectedMessageId"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                                <circle
                                                    v-else
                                                    cx="12"
                                                    cy="12"
                                                    r="9"
                                                    stroke-width="2"
                                                />
                                            </svg>
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
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M5 15l7-7 7 7"
                                                />
                                            </svg>
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
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M19 9l-7 7-7-7"
                                                />
                                            </svg>
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
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
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
                                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                        />
                                    </svg>
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
    NInput,
    NDropdown,
} from "naive-ui";
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from '../../composables/performance/useDebounceThrottle';
import { useToast } from "../../composables/ui/useToast";
import type {
    ConversationManagerProps,
    ConversationManagerEvents,
} from "../../types/components";
import type { ConversationMessage } from "@prompt-optimizer/core";

const { t } = useI18n();
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
    contextMode: "system",
    scanVariables: () => [],
    replaceVariables: (content: string) => content,
    isPredefinedVariable: () => false,
    // 🆕 消息优化相关
    selectedMessageId: undefined,
    enableMessageOptimization: false,
    isMessageOptimizing: false,
});

const emit = defineEmits<ConversationManagerEvents>();

// 状态管理 - 使用 shallowRef 优化大数据渲染
const loading = ref(false);
const isCollapsed = ref(false);

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

const inputSize = computed(() => {
    const sizeMap = {
        small: "small",
        medium: "medium",
        large: "large",
    } as const;
    return sizeMap[props.size] || "medium";
});

const contentStyle = computed(() => {
    const style: Record<string, string | number> = {};
    if (props.maxHeight && !isCollapsed.value) {
        style.maxHeight = `${props.maxHeight}px`;
    }
    return style;
});

const scrollbarStyle = computed(() => {
    if (props.maxHeight && !isCollapsed.value) {
        return { maxHeight: `${props.maxHeight - 100}px` };
    }
    return {};
});

// 模式化行为：用户模式隐藏消息增删改按钮，系统模式保留完整能力
const canEditMessages = computed(() => {
    // readonly优先级最高
    if (props.readonly) return false;
    // 用户模式不允许编辑消息
    if (props.contextMode === "user") return false;
    // 系统模式允许编辑
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
    const available = props.availableVariables || {};
    return allUsedVariables.value.filter(
        (name) => available[name] === undefined,
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
            h(
                "svg",
                {
                    width: 14,
                    height: 14,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                },
                [
                    h("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
                    }),
                    h("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
                    }),
                ],
            ),
    },
    {
        label: t("conversation.roles.user"),
        key: "user",
        icon: () =>
            h(
                "svg",
                {
                    width: 14,
                    height: 14,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                },
                [
                    h("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
                    }),
                ],
            ),
    },
    {
        label: t("conversation.roles.assistant"),
        key: "assistant",
        icon: () =>
            h(
                "svg",
                {
                    width: 14,
                    height: 14,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                },
                [
                    h("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
                    }),
                ],
            ),
    },
    {
        label: t("conversation.roles.tool"),
        key: "tool",
        icon: () =>
            h(
                "svg",
                {
                    width: 14,
                    height: 14,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                },
                [
                    h("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M15.232 5.232a3 3 0 11-4.242 4.242L4.5 16H3v-1.5l6.232-6.232a3 3 0 114.242-4.242l3.536 3.536a1 1 0 010 1.414l-2.121 2.121a1 1 0 01-1.414 0l-1.414-1.414",
                    }),
                ],
            ),
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
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
    white-space: nowrap;
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
