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

        <!-- 主编辑区域 -->
        <div
            class="context-editor-content"
            role="main"
            :aria-label="aria.getLabel('editorMain')"
        >
            <NTabs
                v-model:value="activeTab"
                type="line"
                :size="size"
                :class="{ 'context-editor-tabs--single': !!onlyShowTab }"
                role="tablist"
                :aria-label="aria.getLabel('editorTabs')"
                @update:value="handleTabChange"
            >
                <!-- 消息编辑标签页 (系统模式下显示) -->
                <NTabPane
                    v-if="showMessagesTab"
                    name="messages"
                    :tab="t('contextEditor.messagesTab')"
                    role="tabpanel"
                    :aria-label="aria.getLabel('messagesTab')"
                    :aria-describedby="aria.getDescription('messagesTab')"
                >
                    <div
                        class="messages-panel"
                        role="region"
                        :aria-label="aria.getLabel('messagesPanel')"
                    >
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
                                    <path
                                        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                                    />
                                </svg>
                            </template>
                            <template #extra>
                                <NButton
                                    @click="addMessage"
                                    :size="buttonSize"
                                    type="primary"
                                    :aria-label="
                                        aria.getLabel('addFirstMessage')
                                    "
                                    :aria-describedby="
                                        aria.getDescription('addFirstMessage')
                                    "
                                >
                                    {{ t("contextEditor.addFirstMessage") }}
                                </NButton>
                            </template>
                        </NEmpty>

                        <!-- 消息列表 -->
                        <NScrollbar
                            v-else
                            :style="scrollbarStyle"
                            :aria-label="aria.getLabel('messagesList')"
                        >
                            <NList
                                role="list"
                                :aria-label="
                                    aria.getLabel('conversationMessages')
                                "
                            >
                                <NListItem
                                    v-for="(
                                        message, index
                                    ) in localState.messages"
                                    :key="`message-${index}`"
                                    role="listitem"
                                    :aria-label="
                                        aria.getLabel(
                                            'messageItem',
                                            t('contextEditor.messageItemLabel', { index: index + 1, role: message.role }),
                                        )
                                    "
                                >
                                    <NCard
                                        :size="cardSize"
                                        embedded
                                        :class="{
                                            'focused-card':
                                                focusedIndex === index,
                                        }"
                                        :ref="
                                            (el: HTMLElement | null) =>
                                                setMessageRef(index, el)
                                        "
                                    >
                                        <template #header>
                                            <NSpace
                                                justify="space-between"
                                                align="center"
                                            >
                                                <NSpace
                                                    align="center"
                                                    :size="4"
                                                >
                                                    <!-- 消息序号 -->
                                                    <NTag :size="tagSize" round>
                                                        {{ index + 1 }}
                                                    </NTag>

                                                    <!-- 角色选择 -->
                                                    <NSelect
                                                        v-model:value="
                                                            message.role
                                                        "
                                                        :size="size"
                                                        style="width: 100px"
                                                        :options="roleOptions"
                                                        :disabled="disabled"
                                                        @update:value="
                                                            handleMessageUpdate(
                                                                index,
                                                                message,
                                                            )
                                                        "
                                                    />

                                                    <!-- 变量统计 -->
                                                    <NTag
                                                        v-if="
                                                            getMessageVariables(
                                                                message.content,
                                                            ).detected.length >
                                                            0
                                                        "
                                                        :size="tagSize"
                                                        type="info"
                                                    >
                                                        {{ t('contextEditor.variableDetected', { count: getMessageVariables(message.content).detected.length }) }}
                                                    </NTag>
                                                    <NTag
                                                        v-if="
                                                            getMessageVariables(
                                                                message.content,
                                                            ).missing.length > 0
                                                        "
                                                        :size="tagSize"
                                                        type="warning"
                                                    >
                                                        {{ t('contextEditor.missingVariableLabel', { count: getMessageVariables(message.content).missing.length }) }}
                                                    </NTag>
                                                </NSpace>

                                                <!-- 消息操作按钮 -->
                                                <NSpace :size="4">
                                                    <NButton
                                                        @click="
                                                            togglePreview(index)
                                                        "
                                                        :size="buttonSize"
                                                        :type="
                                                            previewMode.get(
                                                                index,
                                                            )
                                                                ? 'primary'
                                                                : 'default'
                                                        "
                                                        quaternary
                                                        circle
                                                        :title="
                                                            previewMode.get(
                                                                index,
                                                            )
                                                                ? t(
                                                                      'common.edit',
                                                                  )
                                                                : t(
                                                                      'common.preview',
                                                                  )
                                                        "
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
                                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                />
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                                />
                                                            </svg>
                                                        </template>
                                                    </NButton>
                                                    <NButton
                                                        v-if="index > 0"
                                                        @click="
                                                            moveMessage(
                                                                index,
                                                                -1,
                                                            )
                                                        "
                                                        :size="buttonSize"
                                                        quaternary
                                                        circle
                                                        :title="
                                                            t('common.moveUp')
                                                        "
                                                        :disabled="disabled"
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
                                                        v-if="
                                                            index <
                                                            localState.messages
                                                                .length -
                                                                1
                                                        "
                                                        @click="
                                                            moveMessage(
                                                                index,
                                                                1,
                                                            )
                                                        "
                                                        :size="buttonSize"
                                                        quaternary
                                                        circle
                                                        :title="
                                                            t('common.moveDown')
                                                        "
                                                        :disabled="disabled"
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
                                                        @click="
                                                            deleteMessage(index)
                                                        "
                                                        :size="buttonSize"
                                                        quaternary
                                                        circle
                                                        type="error"
                                                        :title="
                                                            t('common.delete')
                                                        "
                                                        :disabled="
                                                            disabled ||
                                                            localState.messages
                                                                .length <= 1
                                                        "
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
                                            </NSpace>
                                        </template>

                                        <!-- 消息内容 -->
                                        <div v-if="!previewMode.get(index)">
                                            <NInput
                                                v-model:value="message.content"
                                                type="textarea"
                                                :placeholder="
                                                    getPlaceholderText(
                                                        message.role,
                                                    )
                                                "
                                                :autosize="{
                                                    minRows: 1,
                                                    maxRows: 20,
                                                }"
                                                :size="inputSize"
                                                :disabled="disabled"
                                                @update:value="
                                                    handleMessageUpdate(
                                                        index,
                                                        message,
                                                    )
                                                "
                                            />
                                            <!-- 缺失变量提示与快捷操作 -->
                                            <NCard
                                                v-if="
                                                    getMessageVariables(
                                                        message.content,
                                                    ).missing.length > 0
                                                "
                                                size="small"
                                                class="mt-2"
                                                embedded
                                            >
                                                <NSpace
                                                    size="small"
                                                    align="center"
                                                    wrap
                                                >
                                                    <NTag
                                                        :size="tagSize"
                                                        type="warning"
                                                        >{{
                                                            t(
                                                                "conversation.missingVars",
                                                            )
                                                        }}</NTag
                                                    >
                                                    <NButton
                                                        v-for="varName in getMessageVariables(
                                                            message.content,
                                                        ).missing.slice(0, 3)"
                                                        :key="`miss-${index}-${varName}`"
                                                        size="tiny"
                                                        text
                                                        type="warning"
                                                        :title="
                                                            t(
                                                                'conversation.clickToCreateVariable',
                                                            )
                                                        "
                                                        @click="
                                                            handleCreateVariableAndOpenManager(
                                                                varName,
                                                            )
                                                        "
                                                    >
                                                        {{ varName }}
                                                    </NButton>
                                                    <NTag
                                                        v-if="
                                                            getMessageVariables(
                                                                message.content,
                                                            ).missing.length > 3
                                                        "
                                                        :size="tagSize"
                                                        type="warning"
                                                    >
                                                        +{{
                                                            getMessageVariables(
                                                                message.content,
                                                            ).missing.length - 3
                                                        }}
                                                    </NTag>
                                                    <NButton
                                                        size="tiny"
                                                        quaternary
                                                        @click="
                                                            emit(
                                                                'openVariableManager',
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            t(
                                                                "variables.management.title",
                                                            )
                                                        }}
                                                    </NButton>
                                                </NSpace>
                                            </NCard>
                                        </div>
                                        <div v-else class="preview-content">
                                            <NText>{{
                                                replaceVariables(
                                                    message.content,
                                                )
                                            }}</NText>
                                        </div>
                                    </NCard>
                                </NListItem>
                            </NList>

                            <!-- 添加消息按钮 -->
                            <div class="mt-4">
                                <NCard :size="cardSize" embedded dashed>
                                    <NSpace justify="center">
                                        <NButton
                                            @click="addMessage"
                                            :size="buttonSize"
                                            dashed
                                            type="primary"
                                            block
                                            :disabled="disabled"
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
                                            {{ t("contextEditor.addMessage") }}
                                        </NButton>
                                    </NSpace>
                                </NCard>
                            </div>
                        </NScrollbar>
                    </div>
                </NTabPane>

                <!-- 模板管理标签页 (系统模式下显示) -->
                <NTabPane
                    v-if="showTemplatesTab"
                    name="templates"
                    :tab="t('contextEditor.templatesTab')"
                >
                    <div
                        class="templates-panel"
                        role="region"
                        :aria-label="aria.getLabel('templatesPanel')"
                    >
                        <!-- 模板分类和筛选 -->
                        <NCard size="small" embedded class="mb-4">
                            <NSpace align="center" justify="space-between">
                                <NSpace align="center" :size="8">
                                    <NText strong>{{
                                        t("contextEditor.templateCategory")
                                    }}</NText>
                                    <NTag :size="tagSize" type="info">
                                        {{
                                            t(
                                                `contextEditor.${optimizationMode}Templates`,
                                            )
                                        }}
                                    </NTag>
                                </NSpace>
                                <NTag :size="tagSize" type="success">
                                    {{
                                        t("contextEditor.templateCount", {
                                            count: quickTemplates.length,
                                        })
                                    }}
                                </NTag>
                            </NSpace>
                        </NCard>

                        <!-- 模板列表 -->
                        <NEmpty
                            v-if="quickTemplates.length === 0"
                            :description="t('contextEditor.noTemplates')"
                            role="status"
                            :aria-label="aria.getLabel('emptyTemplates')"
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
                                    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                            </template>
                            <template #extra>
                                <NText depth="3">{{
                                    t("contextEditor.noTemplatesHint")
                                }}</NText>
                            </template>
                        </NEmpty>

                        <NScrollbar v-else :style="scrollbarStyle">
                            <NGrid
                                :cols="isMobile ? 1 : 2"
                                :x-gap="12"
                                :y-gap="12"
                            >
                                <NGridItem
                                    v-for="template in quickTemplates"
                                    :key="template.id"
                                >
                                    <NCard
                                        :size="cardSize"
                                        embedded
                                        hoverable
                                        class="template-card"
                                        role="button"
                                        :aria-label="
                                            aria.getLabel(
                                                'templateCard',
                                                template.name,
                                            )
                                        "
                                        tabindex="0"
                                        @click="handleTemplatePreview(template)"
                                        @keydown.enter="
                                            handleTemplatePreview(template)
                                        "
                                        @keydown.space.prevent="
                                            handleTemplatePreview(template)
                                        "
                                    >
                                        <template #header>
                                            <NSpace
                                                justify="space-between"
                                                align="center"
                                            >
                                                <NSpace
                                                    align="center"
                                                    :size="4"
                                                >
                                                    <NTag
                                                        :size="tagSize"
                                                        round
                                                        type="primary"
                                                    >
                                                        {{ template.name }}
                                                    </NTag>
                                                    <NTag
                                                        v-if="template.messages"
                                                        :size="tagSize"
                                                        type="info"
                                                    >
                                                        {{ t('contextEditor.messageCount', { count: template.messages.length }) }}
                                                    </NTag>
                                                </NSpace>
                                                <NSpace :size="4">
                                                    <NButton
                                                        @click.stop="
                                                            handleTemplatePreview(
                                                                template,
                                                            )
                                                        "
                                                        :size="buttonSize"
                                                        quaternary
                                                        circle
                                                        :title="
                                                            t(
                                                                'common.preview',
                                                            )
                                                        "
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
                                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                />
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                                />
                                                            </svg>
                                                        </template>
                                                    </NButton>
                                                    <NButton
                                                        @click.stop="
                                                            handleTemplateApply(
                                                                template,
                                                            )
                                                        "
                                                        :size="buttonSize"
                                                        type="primary"
                                                        circle
                                                        :title="
                                                            t(
                                                                'contextEditor.applyTemplate',
                                                            )
                                                        "
                                                        :disabled="disabled"
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
                                                                    d="M5 13l4 4L19 7"
                                                                />
                                                            </svg>
                                                        </template>
                                                    </NButton>
                                                </NSpace>
                                            </NSpace>
                                        </template>

                                        <div class="template-content">
                                            <NText
                                                depth="3"
                                                class="template-description"
                                            >
                                                {{
                                                    template.description ||
                                                    t(
                                                        "contextEditor.noDescription",
                                                    )
                                                }}
                                            </NText>

                                            <!-- 模板消息预览 -->
                                            <div
                                                v-if="
                                                    template.messages &&
                                                    template.messages.length > 0
                                                "
                                                class="template-preview mt-3"
                                            >
                                                <div
                                                    v-for="(
                                                        message, index
                                                    ) in template.messages.slice(
                                                        0,
                                                        2,
                                                    )"
                                                    :key="`preview-${index}`"
                                                    class="preview-message"
                                                >
                                                    <NSpace
                                                        align="center"
                                                        :size="4"
                                                        class="mb-1"
                                                    >
                                                        <NTag
                                                            :size="tagSize"
                                                            round
                                                            >{{
                                                                getRoleLabel(
                                                                    message.role,
                                                                )
                                                            }}</NTag
                                                        >
                                                        <NText
                                                            depth="3"
                                                            class="text-xs"
                                                        >
                                                            {{
                                                                message.content
                                                                    .length > 40
                                                                    ? message.content.substring(
                                                                          0,
                                                                          40,
                                                                      ) + "..."
                                                                    : message.content
                                                            }}
                                                        </NText>
                                                    </NSpace>
                                                </div>
                                                <NText
                                                    v-if="
                                                        template.messages
                                                            .length > 2
                                                    "
                                                    depth="3"
                                                    class="text-xs mt-1"
                                                >
                                                    {{
                                                        t(
                                                            "contextEditor.moreMessages",
                                                            {
                                                                count:
                                                                    template
                                                                        .messages
                                                                        .length -
                                                                    2,
                                                            },
                                                        )
                                                    }}
                                                </NText>
                                            </div>
                                        </div>
                                    </NCard>
                                </NGridItem>
                            </NGrid>
                        </NScrollbar>
                    </div>
                </NTabPane>

                <!-- 变量管理标签页已移除，使用独立的 VariableManagerModal -->

                <!-- 工具管理标签页 -->
                <NTabPane v-if="showToolsTab" name="tools" :tab="t('contextEditor.toolsTab')">
                    <div class="tools-panel">
                        <!-- 工具列表内容 -->
                        <NEmpty
                            v-if="localState.tools.length === 0"
                            :description="t('contextEditor.noTools')"
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
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                            </template>
                            <template #extra>
                                <NButton
                                    @click="addTool"
                                    :size="buttonSize"
                                    type="primary"
                                    :disabled="disabled"
                                >
                                    {{ t("contextEditor.addFirstTool") }}
                                </NButton>
                            </template>
                        </NEmpty>

                        <NList v-else>
                            <NListItem
                                v-for="(tool, index) in localState.tools"
                                :key="`tool-${index}`"
                            >
                                <NCard :size="cardSize" embedded>
                                    <template #header>
                                        <NSpace
                                            justify="space-between"
                                            align="center"
                                        >
                                            <NTag
                                                type="primary"
                                                :size="tagSize"
                                                >{{ tool.function.name }}</NTag
                                            >
                                            <NSpace :size="4">
                                                <NButton
                                                    @click="editTool(index)"
                                                    :size="buttonSize"
                                                    quaternary
                                                    circle
                                                    :title="t('common.edit')"
                                                    :disabled="disabled"
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
                                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                            />
                                                        </svg>
                                                    </template>
                                                </NButton>
                                                <NButton
                                                    @click="focusMessage(index)"
                                                    :size="buttonSize"
                                                    quaternary
                                                    circle
                                                    :title="
                                                        t('common.focus')
                                                    "
                                                >
                                                    <template #icon>
                                                        <svg
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                        >
                                                            <circle
                                                                cx="12"
                                                                cy="12"
                                                                r="3"
                                                                stroke-width="2"
                                                            />
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                stroke-width="2"
                                                                d="M12 5v2m0 10v2m7-7h-2M7 12H5m11.657 4.657l-1.414-1.414M8.757 9.343 7.343 7.929m8.314 0-1.414 1.414M8.757 14.657l-1.414 1.414"
                                                            />
                                                        </svg>
                                                    </template>
                                                </NButton>
                                                <NButton
                                                    @click="deleteTool(index)"
                                                    :size="buttonSize"
                                                    quaternary
                                                    circle
                                                    type="error"
                                                    :title="t('common.delete')"
                                                    :disabled="disabled"
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
                                        </NSpace>
                                    </template>

                                    <NText depth="3" :size="size">{{
                                        tool.function.description ||
                                        t("contextEditor.noDescription")
                                    }}</NText>
                                    <div class="mt-2">
                                        <NTag :size="tagSize">{{
                                            t("contextEditor.parametersCount", {
                                                count: Object.keys(
                                                    tool.function.parameters
                                                        ?.properties || {},
                                                ).length,
                                            })
                                        }}</NTag>
                                    </div>
                                </NCard>
                            </NListItem>
                        </NList>

                        <!-- 添加工具按钮 -->
                        <div v-if="localState.tools.length > 0" class="mt-4">
                            <NCard :size="cardSize" embedded dashed>
                                <NSpace justify="center">
                                    <NButton
                                        @click="addTool"
                                        :size="buttonSize"
                                        dashed
                                        type="primary"
                                        block
                                        :disabled="disabled"
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
                                        {{ t("contextEditor.addTool") }}
                                    </NButton>
                                </NSpace>
                            </NCard>
                        </div>
                    </div>
                </NTabPane>
            </NTabs>
        </div>

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

    <!-- 模板预览弹窗 -->
    <NModal
        v-model:show="showTemplatePreview"
        preset="card"
        :title="previewTemplate?.name || t('common.preview')"
        :mask-closable="true"
        :style="previewModalStyle"
    >
        <div>
            <NText depth="3" class="mb-2 block">
                {{
                    previewTemplate?.description ||
                    t("contextEditor.noDescription")
                }}
            </NText>

            <NAlert
                v-if="!previewTemplate"
                type="warning"
                :show-icon="false"
                class="mb-2"
            >
                {{ t("contextEditor.noTemplates") }}
            </NAlert>

            <NScrollbar v-else :style="scrollbarStyle">
                <NList hoverable clickable>
                    <NListItem
                        v-for="(msg, idx) in previewTemplate.messages"
                        :key="`msg-${idx}`"
                    >
                        <NCard :size="cardSize" embedded>
                            <NSpace align="center" :size="8" class="mb-2">
                                <NTag :size="tagSize" round type="info">{{
                                    getRoleLabel(msg.role)
                                }}</NTag>
                                <NText depth="3">#{{ idx + 1 }}</NText>
                            </NSpace>
                            <div class="preview-content">
                                <NText>{{ msg.content }}</NText>
                            </div>
                        </NCard>
                    </NListItem>
                </NList>
            </NScrollbar>
        </div>

        <template #action>
            <NSpace justify="end">
                <NButton
                    @click="showTemplatePreview = false"
                    :size="buttonSize"
                >
                    {{ t("common.close") }}
                </NButton>
                <NButton
                    type="primary"
                    :size="buttonSize"
                    :disabled="!previewTemplate || disabled"
                    @click="
                        previewTemplate &&
                        (handleTemplateApply(previewTemplate),
                        (showTemplatePreview = false))
                    "
                >
                    {{ t("contextEditor.applyTemplate") }}
                </NButton>
            </NSpace>
        </template>
    </NModal>

    <!-- 工具编辑器（简化版） -->
    <NModal
        v-model:show="toolEditState.showEditor"
        preset="card"
        :title="
            toolEditState.editingIndex !== null
                ? t('contextEditor.editTool')
                : t('contextEditor.addTool')
        "
        style="width: 600px"
    >
        <NSpace vertical>
            <!-- 示例提示（仅新建时显示） -->
            <NAlert
                v-if="toolEditState.editingIndex === null"
                type="info"
                :title="t('contextEditor.exampleTemplate')"
            >
                {{ t("contextEditor.exampleTemplateDesc") }}
            </NAlert>

            <!-- 基本信息 -->
            <NCard size="small" :title="t('contextEditor.basicInfo')">
                <NSpace vertical v-if="toolEditState.editingTool">
                    <NInput
                        v-model:value="toolEditState.editingTool.function.name"
                        :placeholder="t('contextEditor.toolNamePlaceholder')"
                    />
                    <NInput
                        v-model:value="
                            toolEditState.editingTool.function.description
                        "
                        type="textarea"
                        :placeholder="t('contextEditor.toolDescPlaceholder')"
                    />
                </NSpace>
            </NCard>

            <!-- 参数配置 -->
            <NCard size="small" :title="t('contextEditor.parameters')">
                <NInput
                    v-model:value="parametersJson"
                    type="textarea"
                    :autosize="{ minRows: 8, maxRows: 12 }"
                    :placeholder="defaultParametersJson"
                    style="
                        font-family:
                            ui-monospace, SFMono-Regular, Menlo, Monaco,
                            Consolas, &quot;Liberation Mono&quot;,
                            &quot;Courier New&quot;, monospace;
                    "
                />
                <NText v-if="jsonError" type="error" class="mt-2">
                    {{ t("contextEditor.invalidJson") }}: {{ jsonError }}
                </NText>
            </NCard>
        </NSpace>

        <template #action>
            <NSpace>
                <NButton @click="closeToolEditor">{{
                    t("common.cancel")
                }}</NButton>
                <NButton
                    @click="useWeatherExample"
                    secondary
                    v-if="toolEditState.editingIndex === null"
                >
                    {{ t("contextEditor.useExample") }}
                </NButton>
                <NButton
                    @click="useEmptyTemplate"
                    secondary
                    v-if="toolEditState.editingIndex === null"
                >
                    {{ t("contextEditor.startEmpty") }}
                </NButton>
                <NButton
                    @click="saveTool"
                    type="primary"
                    :disabled="!isValidTool"
                >
                    {{ t("common.save") }}
                </NButton>
            </NSpace>
        </template>
    </NModal>

    <!-- 导入对话框 -->
    <NModal
        v-model:show="showImportDialog"
        preset="dialog"
        :title="t('contextEditor.importTitle')"
        :show-icon="false"
        style="width: 600px"
        :mask-closable="false"
    >
        <template #default>
            <!-- 格式选择 -->
            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.importFormat")
                }}</label>
                <NSpace size="small" wrap>
                    <NButton
                        v-for="format in importFormats"
                        :key="format.id"
                        @click="selectedImportFormat = format.id"
                        :type="
                            selectedImportFormat === format.id
                                ? 'primary'
                                : 'default'
                        "
                        :size="buttonSize"
                    >
                        {{ format.name }}
                    </NButton>
                </NSpace>
                <p class="text-xs text-gray-500 mt-2">
                    {{
                        importFormats.find((f) => f.id === selectedImportFormat)
                            ?.description
                    }}
                </p>
            </div>

            <!-- 文件上传 -->
            <div class="mb-4">
                <NSpace align="center" :size="8" class="mb-2">
                    <input
                        type="file"
                        ref="fileInputRef"
                        accept=".json,.txt"
                        @change="handleFileUpload"
                        class="hidden"
                    />
                    <NButton
                        @click="fileInputRef?.click()"
                        secondary
                        :size="buttonSize"
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
                        {{ t("contextEditor.selectFile") }}
                    </NButton>
                    <NText depth="3" class="text-sm">
                        {{ t("contextEditor.orPasteText") }}
                    </NText>
                </NSpace>
            </div>

            <!-- 文本输入区域 -->
            <NInput
                v-model:value="importData"
                type="textarea"
                :placeholder="getImportPlaceholder()"
                :autosize="{ minRows: 12, maxRows: 16 }"
                class="font-mono text-sm"
            />

            <div v-if="importError" class="text-sm text-red-500 mt-2">
                {{ importError }}
            </div>
        </template>

        <template #action>
            <NSpace justify="end">
                <NButton @click="showImportDialog = false" :size="buttonSize">
                    {{ t("common.cancel") }}
                </NButton>
                <NButton
                    @click="handleImportSubmit"
                    :disabled="!importData.trim()"
                    type="primary"
                    :size="buttonSize"
                    :loading="contextEditor.isLoading.value"
                >
                    {{ t("contextEditor.import") }}
                </NButton>
            </NSpace>
        </template>
    </NModal>

    <!-- 导出对话框 -->
    <NModal
        v-model:show="showExportDialog"
        preset="dialog"
        :title="t('contextEditor.exportTitle')"
        :show-icon="false"
        style="width: 600px"
        :mask-closable="false"
    >
        <template #default>
            <!-- 格式选择 -->
            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.exportFormat")
                }}</label>
                <NSpace size="small" wrap>
                    <NButton
                        v-for="format in exportFormats"
                        :key="format.id"
                        @click="selectedExportFormat = format.id"
                        :type="
                            selectedExportFormat === format.id
                                ? 'primary'
                                : 'default'
                        "
                        :size="buttonSize"
                    >
                        {{ format.name }}
                    </NButton>
                </NSpace>
                <p class="text-xs text-gray-500 mt-2">
                    {{
                        exportFormats.find((f) => f.id === selectedExportFormat)
                            ?.description
                    }}
                </p>
            </div>

            <!-- 导出预览 -->
            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.exportPreview")
                }}</label>
                <NInput
                    :value="
                        JSON.stringify(
                            {
                                messages: localState.messages,
                                metadata: {
                                    variables: localState.variables,
                                    tools: localState.tools,
                                    exportTime: new Date().toISOString(),
                                },
                            },
                            null,
                            2,
                        )
                    "
                    readonly
                    type="textarea"
                    :autosize="{ minRows: 8, maxRows: 12 }"
                    class="font-mono text-sm"
                />
            </div>
        </template>

        <template #action>
            <NSpace justify="space-between">
                <NButton @click="showExportDialog = false" :size="buttonSize">
                    {{ t("common.cancel") }}
                </NButton>

                <NSpace>
                    <NButton
                        @click="handleExportToClipboard"
                        secondary
                        :size="buttonSize"
                        :loading="contextEditor.isLoading.value"
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
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </template>
                        {{ t("contextEditor.copyToClipboard") }}
                    </NButton>
                    <NButton
                        @click="handleExportToFile"
                        type="primary"
                        :size="buttonSize"
                        :loading="contextEditor.isLoading.value"
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
                                    d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                                />
                            </svg>
                        </template>
                        {{ t("contextEditor.saveToFile") }}
                    </NButton>
                </NSpace>
            </NSpace>
        </template>
    </NModal>

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
                    v-if="PREDEFINED_VARIABLES.includes(variableEditState.name)"
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
                        PREDEFINED_VARIABLES.includes(variableEditState.name)
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
import { ref, computed, watch, shallowRef, nextTick, h } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NModal,
    NTabs,
    NTabPane,
    NCard,
    NButton,
    NSpace,
    NTag,
    NList,
    NListItem,
    NEmpty,
    NScrollbar,
    NInput,
    NSelect,
    NText,
    NGrid,
    NGridItem,
    NAlert,
    NDataTable,
    NRadioGroup,
    NRadio,
    type DataTableColumns,
} from "naive-ui";
import { useResponsive } from "../../composables/ui/useResponsive";
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from '../../composables/performance/useDebounceThrottle';
import { useAccessibility } from "../../composables/accessibility/useAccessibility";
import { useContextEditor } from '../../composables/context/useContextEditor';
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables';
import { useAggregatedVariables } from '../../composables/variable/useAggregatedVariables';
import {
    quickTemplateManager,
    type QuickTemplateDefinition,
} from "../../data/quickTemplates";
import type {
    ContextEditorProps,
    ContextEditorEvents,
} from "../../types/components";
import type {
    ContextEditorState,
    ConversationMessage,
    ToolDefinition,
} from "@prompt-optimizer/core";
import type { StandardPromptData } from "../../types";
import {
    PREDEFINED_VARIABLES,
    type PredefinedVariable,
} from "../../types/variable";

const { t, locale } = useI18n();

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

const emit = defineEmits<ContextEditorEvents>();

// 导入导出功能
const contextEditor = useContextEditor();

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
    inputSize: responsiveInputSize,
    isMobile,
} = useResponsive();

// 状态管理 - 使用性能优化
const loading = ref(false);
const activeTab = ref("messages");
const localVisible = ref(props.visible);

// 导入导出状态
const showImportDialog = ref(false);
const showExportDialog = ref(false);
const importData = ref("");
const importError = ref("");
const selectedImportFormat = ref("smart");
const selectedExportFormat = ref("standard");
const fileInputRef = ref<HTMLInputElement | null>(null);
// 变量值输入框引用（用于自动聚焦）
const variableValueInputRef = ref(null);

// 模板预览状态
const showTemplatePreview = ref(false);
const previewTemplate = ref<QuickTemplateDefinition | null>(null);

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
type TabName = 'messages' | 'templates' | 'variables' | 'tools';

// 标签页默认可见性配置（ContextEditor 仅用于 Context System 模式）
// 变量管理已移除，使用独立的 VariableManagerModal
const TAB_VISIBILITY_CONFIG: Record<TabName, () => boolean> = {
    messages: () => true,
    templates: () => true,
    variables: () => false, // 已移除变量标签页
    tools: () => props.showToolManager,
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
const showTemplatesTab = createTabVisibility('templates');
const showVariablesTab = createTabVisibility('variables');
const showToolsTab = createTabVisibility('tools');

const resolveDefaultTab = (): string => {
    const candidate = props.onlyShowTab || props.defaultTab;
    const visibilityMap: Record<string, boolean> = {
        messages: showMessagesTab.value,
        templates: showTemplatesTab.value,
        variables: showVariablesTab.value,
        tools: showToolsTab.value,
    };
    if (candidate && visibilityMap[candidate]) {
        return candidate;
    }
    const preferenceOrder: Array<keyof typeof visibilityMap> = [
        "messages",
        "templates",
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

const inputSize = computed(() => {
    return responsiveInputSize.value;
});

const modalStyle = computed(() => ({
    width: modalWidth.value,
    height: isMobile.value ? "95vh" : props.height || "85vh",
}));

// 模板预览弹窗尺寸（限制宽度，移动端占满宽度）
const previewModalStyle = computed(() => ({
    width: isMobile.value ? "95vw" : "840px",
    maxWidth: "95vw",
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

// 仅统计"全局自定义变量"（排除预定义变量），用于避免"全局7"的误导
const globalCustomVariableCount = computed(() => {
    return variableManager.statistics.value.customVariableCount;
});

const roleOptions = computed(() => [
    { label: t("conversation.roles.system"), value: "system" },
    { label: t("conversation.roles.user"), value: "user" },
    { label: t("conversation.roles.assistant"), value: "assistant" },
    { label: t("conversation.roles.tool"), value: "tool" },
]);

// 快速模板管理 - 根据优化模式和语言获取
const quickTemplates = computed(() => {
    const currentLanguage = locale?.value || "zh-CN";
    return quickTemplateManager.getTemplates(
        props.optimizationMode,
        currentLanguage,
    );
});

// 变量表格数据类型定义
interface VariableTableRow {
    key: string;
    name: string;
    value: string;
    fullValue: string;
    source: "temporary" | "global" | "predefined";
    status: "active" | "overridden" | "missing";
    readonly: boolean;
}

const normalizeMessage = (
    msg: Partial<ConversationMessage>,
): ConversationMessage => {
    const normalizedRole = (msg.role ?? "user") as ConversationMessage["role"];

    let content = "";
    if (typeof msg.content === "string") {
        content = msg.content;
    } else if (msg.content != null) {
        try {
            content =
                typeof msg.content === "object"
                    ? JSON.stringify(msg.content)
                    : String(msg.content);
        } catch {
            content = String(msg.content);
        }
    }

    const normalized: ConversationMessage = {
        role: normalizedRole,
        content,
    };

    if (typeof msg.name === "string") normalized.name = msg.name;
    if (Array.isArray(msg.tool_calls)) {
        normalized.tool_calls =
            msg.tool_calls as ConversationMessage["tool_calls"];
    }
    if (typeof msg.tool_call_id === "string")
        normalized.tool_call_id = msg.tool_call_id;

    return normalized;
};

const variableTableData = computed(() => {
    const data: VariableTableRow[] = [];
    const temporaryVars = tempVars.listVariables();

    // 添加全局变量（可编辑，但预定义变量只读）
    const globalVars = variableManager.customVariables.value;
    Object.entries(globalVars).forEach(([name, value]) => {
        const isPredefined = PREDEFINED_VARIABLES.includes(name as PredefinedVariable);
        if (!isPredefined) {
            const isOverridden = name in temporaryVars;
            data.push({
                key: `global-${name}`,
                name,
                value:
                    value.length > 50
                        ? value.substring(0, 50) + "..."
                        : value,
                fullValue: value,
                source: "global",
                status: isOverridden ? "overridden" : "active",
                readonly: false, // 全局自定义变量现在可编辑
            });
        }
    });

    // 添加临时变量（可编辑）
    Object.entries(temporaryVars).forEach(([name, value]) => {
        if (!PREDEFINED_VARIABLES.includes(name as PredefinedVariable)) {
            data.push({
                key: `temporary-${name}`,
                name,
                value:
                    value.length > 50 ? value.substring(0, 50) + "..." : value,
                fullValue: value,
                source: "temporary",
                status: "active",
                readonly: false,
            });
        }
    });

    return data;
});

// 变量表格列定义
const variableColumns = computed(
    (): DataTableColumns => [
        {
            title: t("contextEditor.variableName"),
            key: "name",
            width: 140,
            render: (row: VariableTableRow) => {
                return h(
                    NTag,
                    {
                        size: "small",
                        type: row.source === "temporary" ? "primary" : "default",
                        round: true,
                    },
                    () => `{{${row.name}}}`,
                );
            },
        },
        {
            title: t("contextEditor.variableValue"),
            key: "value",
            ellipsis: {
                tooltip: true,
            },
            render: (row: VariableTableRow) => {
                return h(
                    NText,
                    {
                        depth: row.readonly ? 3 : 1,
                        style: {
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "12px",
                            textDecoration:
                                row.status === "overridden"
                                    ? "line-through"
                                    : "none",
                        },
                    },
                    () => row.value,
                );
            },
        },
        {
            title: t("contextEditor.variableSource"),
            key: "source",
            width: 80,
            render: (row: VariableTableRow) => {
                const typeMap = {
                    global: {
                        type: "info",
                        text: t("contextEditor.variableSourceLabels.global"),
                    },
                    temporary: {
                        type: "warning",
                        text: t("contextEditor.variableSourceLabels.temporary"),
                    },
                    predefined: {
                        type: "default",
                        text: t("contextEditor.variableSourceLabels.predefined"),
                    },
                };
                const config = typeMap[row.source] || {
                    type: "default",
                    text: row.source,
                };
                return h(
                    NTag,
                    {
                        size: "small",
                        type: config.type,
                    },
                    () => config.text,
                );
            },
        },
        {
            title: t("contextEditor.variableStatus"),
            key: "status",
            width: 80,
            render: (row: VariableTableRow) => {
                const statusMap = {
                    active: {
                        type: "success",
                        text: t("contextEditor.variableStatusLabels.active"),
                    },
                    overridden: {
                        type: "default",
                        text: t(
                            "contextEditor.variableStatusLabels.overridden",
                        ),
                    },
                };
                const config = statusMap[row.status] || {
                    type: "default",
                    text: row.status,
                };
                return h(
                    NTag,
                    {
                        size: "small",
                        type: config.type,
                    },
                    () => config.text,
                );
            },
        },
        {
            title: t("common.actions"),
            key: "actions",
            width: 120,
            render: (row: VariableTableRow) => {
                const actions = [];

                if (!row.readonly) {
                    // 编辑按钮
                    actions.push(
                        h(
                            NButton,
                            {
                                size: "small",
                                quaternary: true,
                                title: t("common.edit"),
                                onClick: () => editVariable(row.name),
                            },
                            {
                                icon: () =>
                                    h(
                                        "svg",
                                        {
                                            width: "14",
                                            height: "14",
                                            viewBox: "0 0 24 24",
                                            fill: "none",
                                            stroke: "currentColor",
                                        },
                                        [
                                            h("path", {
                                                "stroke-linecap": "round",
                                                "stroke-linejoin": "round",
                                                "stroke-width": "2",
                                                d: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
                                            }),
                                        ],
                                    ),
                            },
                        ),
                    );

                    // 删除按钮
                    actions.push(
                        h(
                            NButton,
                            {
                                size: "small",
                                quaternary: true,
                                type: "error",
                                title: t("common.delete"),
                                onClick: () => deleteVariable(row.name),
                            },
                            {
                                icon: () =>
                                    h(
                                        "svg",
                                        {
                                            width: "14",
                                            height: "14",
                                            viewBox: "0 0 24 24",
                                            fill: "none",
                                            stroke: "currentColor",
                                        },
                                        [
                                            h("path", {
                                                "stroke-linecap": "round",
                                                "stroke-linejoin": "round",
                                                "stroke-width": "2",
                                                d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
                                            }),
                                        ],
                                    ),
                            },
                        ),
                    );
                }

                return h(NSpace, { size: 4 }, () => actions);
            },
        },
    ],
);

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

const getRoleLabel = (role: string) => {
    switch (role) {
        case "system":
            return t("conversation.roles.system");
        case "user":
            return t("conversation.roles.user");
        case "assistant":
            return t("conversation.roles.assistant");
        case "tool":
            return t("conversation.roles.tool");
        default:
            return role;
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

const handleTabChange = (activeKey: string) => {
    recordUpdate();
    const tabName = activeKey === "messages" ? t("contextEditor.messagesTab") : t("contextEditor.toolsTab");
    announce(
        aria.getLiveRegionText("tabChanged").replace("{tab}", tabName),
        "polite",
    );
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

// 模板管理方法
const handleTemplatePreview = (template: QuickTemplateDefinition) => {
    previewTemplate.value = template;
    showTemplatePreview.value = true;
};

const handleTemplateApply = (template: QuickTemplateDefinition) => {
    if (!template.messages || template.messages.length === 0) {
        console.warn("Template has no messages to apply");
        return;
    }

    // 应用模板到本地状态
    localState.value.messages = [...template.messages];
    handleStateChange();

    // 切换到消息编辑标签页
    activeTab.value = "messages";

    // 通知用户模板已应用
    announce(
        t("contextEditor.templateApplied", { name: template.name }),
        "polite",
    );
};

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

// ============ 工具管理：状态、校验与事件 ============
interface ToolEditState {
    editingIndex: number | null;
    editingTool: ToolDefinition | null;
    showEditor: boolean;
}

const toolEditState = ref<ToolEditState>({
    editingIndex: null,
    editingTool: null,
    showEditor: false,
});

const parametersJson = ref("");
const jsonError = ref("");

const createWeatherToolTemplate = (): ToolDefinition => ({
    type: "function",
    function: {
        name: "get_weather",
        description: "Get current weather information for a specific location",
        parameters: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "The location to get weather for",
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                    default: "celsius",
                },
            },
            required: ["location"],
        },
    },
});

const createEmptyToolTemplate = (): ToolDefinition => ({
    type: "function",
    function: {
        name: "",
        description: "",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
});

// 独立定义字符串变量，避免内联复杂字符串
const defaultParametersJson = `{
  "type": "object",
  "properties": {},
  "required": []
}`;

// 默认参数对象
const defaultParametersObject = {
    type: "object",
    properties: {},
    required: [],
};

const syncParametersJsonFromTool = (tool: ToolDefinition | null) => {
    if (!tool) {
        parametersJson.value = "";
        jsonError.value = "";
        return;
    }
    try {
        parametersJson.value = JSON.stringify(
            tool.function?.parameters ?? defaultParametersObject,
            null,
            2,
        );
        jsonError.value = "";
    } catch (e) {
        jsonError.value =
            e instanceof Error ? e.message : "JSON stringify error";
    }
};

const isValidTool = computed(() => {
    const tool = toolEditState.value.editingTool;
    if (!tool) return false;
    const name = tool.function?.name?.trim();
    if (!name) return false;
    // 参数必须为可解析的对象
    try {
        const parsed = parametersJson.value
            ? JSON.parse(parametersJson.value)
            : defaultParametersObject;
        return parsed && typeof parsed === "object";
    } catch {
        return false;
    }
});

// 固定占位符：不通过 i18n，避免大括号与 i18n 插值冲突

const useWeatherExample = () => {
    toolEditState.value.editingTool = createWeatherToolTemplate();
    syncParametersJsonFromTool(toolEditState.value.editingTool);
};

const useEmptyTemplate = () => {
    toolEditState.value.editingTool = createEmptyToolTemplate();
    syncParametersJsonFromTool(toolEditState.value.editingTool);
};

const addTool = () => {
    toolEditState.value = {
        editingIndex: null,
        editingTool: createWeatherToolTemplate(),
        showEditor: true,
    };
    syncParametersJsonFromTool(toolEditState.value.editingTool);
};

const editTool = (index: number) => {
    if (index < 0 || index >= localState.value.tools.length) {
        console.error(t("contextEditor.consoleErrors.toolEditIndexOutOfRange", { index }));
        return;
    }

    const tool = localState.value.tools[index];
    if (!tool) {
        console.error(t("contextEditor.consoleErrors.toolEditToolNotFound", { index }));
        return;
    }

    toolEditState.value = {
        editingIndex: index,
        editingTool: JSON.parse(JSON.stringify(tool)),
        showEditor: true,
    };
    syncParametersJsonFromTool(toolEditState.value.editingTool);
};

const closeToolEditor = () => {
    toolEditState.value = {
        editingIndex: null,
        editingTool: null,
        showEditor: false,
    };
    parametersJson.value = "";
    jsonError.value = "";
};

const saveTool = () => {
    const state = toolEditState.value;
    const current = state.editingTool
        ? (JSON.parse(JSON.stringify(state.editingTool)) as ToolDefinition)
        : null;
    if (!current) return;

    // 更严格的防护性检查
    if (!current.function) {
        console.error(t("contextEditor.consoleErrors.toolSaveMissingFunction"));
        jsonError.value = t("contextEditor.consoleErrors.toolDataStructureError");
        return;
    }

    try {
        const parsed = parametersJson.value
            ? JSON.parse(parametersJson.value)
            : defaultParametersObject;
        current.function.parameters = parsed;
        const editingIndex = state.editingIndex;
        if (editingIndex !== null) {
            // update
            localState.value.tools[editingIndex] = current;
            emit(
                "toolChange",
                [...localState.value.tools],
                "update",
                editingIndex,
            );
        } else {
            // add
            localState.value.tools.push(current);
            emit(
                "toolChange",
                [...localState.value.tools],
                "add",
                localState.value.tools.length - 1,
            );
        }
        emit("update:tools", [...localState.value.tools]);
        handleStateChange();
        announce(t("common.save"), "polite");
        closeToolEditor();
    } catch (e) {
        jsonError.value =
            e instanceof Error ? e.message : t("contextEditor.invalidJson");
    }
};

const deleteTool = (index: number) => {
    const tool = localState.value.tools[index];
    const confirmed = confirm(
        t("contextEditor.deleteToolConfirm", {
            name: tool?.function?.name || "",
        }),
    );
    if (!confirmed) return;
    localState.value.tools.splice(index, 1);
    emit("toolChange", [...localState.value.tools], "delete", index);
    emit("update:tools", [...localState.value.tools]);
    handleStateChange();
    announce(
        t("contextEditor.toolDeleted", { name: tool?.function?.name || "" }),
        "polite",
    );
};

// 工具变更自动同步给父级（保持向后兼容）
watch(
    () => localState.value.tools,
    (newTools) => {
        emit("update:tools", [...newTools]);
    },
    { deep: true },
);

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

// 变量管理方法
const addVariable = () => {
    // 打开编辑对话框，默认创建临时变量
    variableEditState.value = {
        show: true,
        isEditing: false,
        isFromMissing: false,
        editingName: "",
        name: "",
        value: "",
        type: "temporary",
    };
};

/**
 * 获取变量来源和值
 * @param name 变量名
 * @returns 变量类型和值，如果不存在则返回 null
 */
const getVariableSource = (name: string): {
    type: "temporary" | "global";
    value: string;
} | null => {
    const temporaryVars = tempVars.listVariables();

    if (name in temporaryVars) {
        return { type: "temporary", value: temporaryVars[name] || "" };
    }

    const globalVars = variableManager.customVariables.value;
    if (name in globalVars) {
        return { type: "global", value: globalVars[name] || "" };
    }

    return null;
};

const editVariable = (name: string) => {
    const source = getVariableSource(name);

    if (!source) {
        announce(t("contextEditor.variableNotFound"), "assertive");
        return;
    }

    variableEditState.value = {
        show: true,
        isEditing: true,
        isFromMissing: false,
        editingName: name,
        name,
        value: source.value,
        type: source.type,
        originalType: source.type,
    };
};

const deleteVariable = (name: string) => {
    const source = getVariableSource(name);

    if (!source) {
        announce(t("contextEditor.variableNotFound"), "assertive");
        return;
    }

    const confirmed = confirm(
        t("contextEditor.deleteVariableConfirm", { name }),
    );
    if (!confirmed) return;

    // 根据类型删除变量
    if (source.type === "temporary") {
        tempVars.deleteVariable(name);
    } else if (source.type === "global") {
        variableManager.deleteVariable(name);
    }

    handleStateChange();
    announce(t("contextEditor.variableDeleted", { name }), "polite");
};

const saveVariable = () => {
    const { isEditing, editingName, name, value, type, originalType } = variableEditState.value;

    // 验证变量名
    if (!name.trim()) {
        return;
    }

    // 检查是否是预定义变量名
    if (PREDEFINED_VARIABLES.includes(name as PredefinedVariable)) {
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
        variableValueInputRef.value?.focus?.();
    });
};

// 消息聚焦（滚动并高亮）
const focusedIndex = ref<number | null>(null);
const messageRefs = new Map<number, HTMLElement>();
const setMessageRef = (
    index: number,
    el: HTMLElement | { $el: HTMLElement } | null,
) => {
    if (!el) return;
    const element = el && "$el" in el ? el.$el : el;
    if (element) messageRefs.set(index, element);
};
const focusMessage = (index: number) => {
    focusedIndex.value = index;
    nextTick(() => {
        const el = messageRefs.get(index);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        // 1.5s 后移除高亮
        setTimeout(() => {
            if (focusedIndex.value === index) focusedIndex.value = null;
        }, 1500);
    });
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
    [showMessagesTab, showTemplatesTab, showVariablesTab, showToolsTab],
    () => {
        const visibilityMap: Record<string, boolean> = {
            messages: showMessagesTab.value,
            templates: showTemplatesTab.value,
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

// 导入导出方法
const importFormats = computed(() => [
    { id: "smart", name: t("contextEditor.importFormats.smart.name"), description: t("contextEditor.importFormats.smart.description") },
    { id: "conversation", name: t("contextEditor.importFormats.conversation.name"), description: t("contextEditor.importFormats.conversation.description") },
    { id: "openai", name: t("contextEditor.importFormats.openai.name"), description: t("contextEditor.importFormats.openai.description") },
    { id: "langfuse", name: t("contextEditor.importFormats.langfuse.name"), description: t("contextEditor.importFormats.langfuse.description") },
]);

type ExportFormat = "standard" | "openai" | "template";

const exportFormats = computed(() => [
    {
        id: "standard" as ExportFormat,
        name: t("contextEditor.exportFormats.standard.name"),
        description: t("contextEditor.exportFormats.standard.description"),
    },
    {
        id: "openai" as ExportFormat,
        name: t("contextEditor.exportFormats.openai.name"),
        description: t("contextEditor.exportFormats.openai.description"),
    },
    {
        id: "template" as ExportFormat,
        name: t("contextEditor.exportFormats.template.name"),
        description: t("contextEditor.exportFormats.template.description"),
    },
]);

const handleFileUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
        loading.value = true;
        importError.value = "";

        const success = await contextEditor.importFromFile(file);

        if (success && contextEditor.currentData.value) {
            // 将导入的数据同步到本地状态
            const data = contextEditor.currentData.value;
            localState.value.messages = (data.messages || []).map((msg) =>
                normalizeMessage(msg),
            );
            // 不导入 variables，临时变量不持久化
            localState.value.tools = data.tools || [];

            handleStateChange();
            showImportDialog.value = false;
            importData.value = "";
            importError.value = "";

            // 切换到消息编辑标签页
            activeTab.value = "messages";
            announce(t("contextEditor.importSuccess"), "polite");
        } else {
            importError.value = t("contextEditor.importFailed");
        }
    } catch (err) {
        console.error("File upload error:", err);
        const errorMsg = err instanceof Error ? err.message : t("contextEditor.importFailed");
        importError.value = errorMsg;
    } finally {
        loading.value = false;
    }
};

const handleImportSubmit = async () => {
    if (!importData.value.trim()) {
        importError.value = t("contextEditor.importDataRequired");
        return;
    }

    try {
        loading.value = true;
        importError.value = "";
        const jsonData = JSON.parse(importData.value);
        let result;

        switch (selectedImportFormat.value) {
            case "smart":
                result = contextEditor.smartImport(jsonData);
                break;
            case "openai":
                result = contextEditor.convertFromOpenAI(jsonData);
                break;
            case "langfuse":
                result = contextEditor.convertFromLangFuse(jsonData);
                break;
            case "conversation":
                // 直接设置为对话格式
                if (Array.isArray(jsonData)) {
                    localState.value.messages = jsonData.map(
                        (msg: Partial<ConversationMessage>) =>
                            normalizeMessage(msg),
                    );
                } else if (
                    jsonData.messages &&
                    Array.isArray(jsonData.messages)
                ) {
                    localState.value.messages = jsonData.messages.map(
                        (msg: Partial<ConversationMessage>) =>
                            normalizeMessage(msg),
                    );
                    // 不导入 variables，临时变量不持久化
                    localState.value.tools = jsonData.tools || [];
                } else {
                    importError.value = t("contextEditor.invalidConversationFormat");
                    return;
                }
                handleStateChange();
                showImportDialog.value = false;
                importData.value = "";
                importError.value = "";
                activeTab.value = "messages";
                announce(t("contextEditor.importSuccess"), "polite");
                return;
            default:
                importError.value = t("contextEditor.unsupportedImportFormat");
                return;
        }

        // 处理转换结果
        if (result && result.success && contextEditor.currentData.value) {
            // 将导入的数据同步到本地状态
            const data = contextEditor.currentData.value;
            localState.value.messages = (data.messages || []).map((msg) =>
                normalizeMessage(msg),
            );
            // 不导入 variables，临时变量不持久化
            localState.value.tools = data.tools || [];

            handleStateChange();
            showImportDialog.value = false;
            importData.value = "";
            importError.value = "";
            activeTab.value = "messages";
            announce(t("contextEditor.importSuccess"), "polite");
        } else {
            importError.value = result?.error || t("contextEditor.importFailed");
        }
    } catch (err) {
        console.error("Import error:", err);
        const errorMsg =
            err instanceof Error ? err.message : t("contextEditor.invalidJsonFormat");
        importError.value = errorMsg;
    } finally {
        loading.value = false;
    }
};

const handleExportToFile = () => {
    try {
        loading.value = true;

        // 准备导出数据 - 转换为 StandardPromptData 格式
        const exportData: StandardPromptData = {
            messages: localState.value.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
                // 保留其他可能的属性
                ...(msg.name && { name: msg.name }),
                ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
                ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
            })),
            tools: localState.value.tools,
            metadata: {
                // 不导出临时变量（会话级别，不持久化）
                exportTime: new Date().toISOString(),
                version: "1.0",
                source: "manual",
                origin: "context_editor",
            },
        };

        // 设置导出数据到contextEditor
        contextEditor.setData(exportData);

        // 执行导出
        const success = contextEditor.exportToFile(
            selectedExportFormat.value as ExportFormat,
            `context-export-${Date.now()}`,
        );

        if (success) {
            showExportDialog.value = false;
            announce(t("contextEditor.exportSuccess"), "polite");
        } else {
            throw new Error(t("contextEditor.exportFailed"));
        }
    } catch (err) {
        console.error("Export to file error:", err);
        const errorMsg = err instanceof Error ? err.message : t("contextEditor.exportFailed");
        // TODO: 显示错误提示给用户
        announce(`${t("contextEditor.exportFailed")}: ${errorMsg}`, "assertive");
    } finally {
        loading.value = false;
    }
};

const handleExportToClipboard = async () => {
    try {
        loading.value = true;

        // 准备导出数据 - 转换为 StandardPromptData 格式
        const exportData: StandardPromptData = {
            messages: localState.value.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
                // 保留其他可能的属性
                ...(msg.name && { name: msg.name }),
                ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
                ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
            })),
            tools: localState.value.tools,
            metadata: {
                // 不导出临时变量（会话级别，不持久化）
                exportTime: new Date().toISOString(),
                version: "1.0",
                source: "manual",
                origin: "context_editor",
            },
        };

        // 设置导出数据到contextEditor
        contextEditor.setData(exportData);

        // 执行导出到剪贴板
        const success = await contextEditor.exportToClipboard(
            selectedExportFormat.value as ExportFormat,
        );

        if (success) {
            showExportDialog.value = false;
            announce(t("contextEditor.copySuccess"), "polite");
        } else {
            throw new Error(t("contextEditor.copyFailed"));
        }
    } catch (err) {
        console.error("Export to clipboard error:", err);
        const errorMsg = err instanceof Error ? err.message : t("contextEditor.exportFailed");
        // TODO: 显示错误提示给用户
        announce(`${t("contextEditor.copyFailed")}: ${errorMsg}`, "assertive");
    } finally {
        loading.value = false;
    }
};

const getImportPlaceholder = () => {
    switch (selectedImportFormat.value) {
        case "openai":
            return t("contextEditor.importPlaceholders.openai");
        case "langfuse":
            return t("contextEditor.importPlaceholders.langfuse");
        case "conversation":
            return t("contextEditor.importPlaceholders.conversation");
        case "smart":
        default:
            return t("contextEditor.importPlaceholders.smart");
    }
};
</script>

<style scoped>
/* Pure Naive UI implementation - no custom theme CSS needed */
.context-editor-content {
    /* All styling handled by Naive UI components */
}

.messages-panel {
    /* Naive UI layout */
}

.templates-panel {
    /* Template management styling */
}

.template-card {
    cursor: pointer;
    transition: all 0.2s ease;
}

.template-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.template-content {
    /* Template content styling */
}

.template-description {
    line-height: 1.4;
    margin-bottom: 8px;
}

.template-preview {
    /* Template preview styling */
}

.preview-message {
    padding: 2px 0;
    border-left: 2px solid var(--n-color-border, #e0e0e6);
    padding-left: 8px;
    margin-bottom: 4px;
}

.preview-content {
    /* Preview styling */
    white-space: pre-wrap;
    word-break: break-word;
}

.focused-card {
    box-shadow: 0 0 0 2px var(--n-color-target, #18a058) inset;
    transition: box-shadow 0.2s ease;
}

.context-editor-tabs--single :deep(.n-tabs-tab-wrapper),
.context-editor-tabs--single :deep(.n-tabs-nav) {
    display: none;
}

/* 可访问性支持样式 */
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

/* 减少动画偏好支持 */
.reduce-motion * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
}

/* 高对比度模式支持 */
.high-contrast {
    /* 增强对比度的样式将由Naive UI主题系统处理 */
}

/* 键盘导航模式高亮 */
.keyboard-only *:focus-visible {
    outline: 2px solid var(--n-color-target);
    outline-offset: 2px;
}

/* 屏幕阅读器模式优化 */
.screen-reader {
    /* 为屏幕阅读器优化的样式 */
}
</style>
