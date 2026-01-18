<template>
    <NModal
        v-model:show="localVisible"
        :mask-closable="!showEditor && !showImporter"
        preset="card"
        :title="props.title || t('variables.management.title')"
        size="huge"
        :segmented="{ content: true }"
        :style="modalStyle"
        @after-leave="handleClose"
    >
        <!-- 工具栏 -->
        <NSpace justify="space-between">
            <NButton
                type="primary"
                @click="showAddVariable"
                :disabled="props.disabled || loading"
                :loading="props.loading"
                :size="buttonSize"
            >
                <template #icon>
                    <NIcon>
                        <svg viewBox="0 0 16 16" fill="currentColor">
                            <path
                                d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"
                            />
                        </svg>
                    </NIcon>
                </template>
                {{ t("variables.management.addVariable") }}
            </NButton>

            <NSpace v-if="props.showImportExport !== false">
                <NButton
                    @click="showImportModal"
                    :disabled="props.disabled || props.readonly || loading"
                    :size="buttonSize"
                >
                    {{ t("variables.management.import") }}
                </NButton>

                <NButton
                    @click="showExportModal = true"
                    :disabled="props.disabled || loading"
                    :size="buttonSize"
                >
                    {{ t("variables.management.export") }}
                </NButton>
            </NSpace>
        </NSpace>
        <NDivider />

        <!-- 变量列表 - 分组显示 -->
        <NSpace vertical :size="16">
            <!-- 预定义变量组 -->
            <NCard v-if="predefinedVariables.length > 0" size="small">
                <template #header>
                    <NSpace align="center">
                        <NText strong>{{ t("variables.predefined") }}</NText>
                        <NTag size="small" type="info">{{
                            t("variables.readonly")
                        }}</NTag>
                        <NTag size="small" type="default">{{
                            predefinedVariables.length
                        }}</NTag>
                    </NSpace>
                </template>
                <NDataTable
                    :columns="predefinedTableColumns"
                    :data="predefinedVariables"
                    :max-height="200"
                    :bordered="false"
                    size="small"
                    :pagination="false"
                />
            </NCard>

            <!-- 自定义变量组 -->
            <NCard size="small">
                <template #header>
                    <NSpace align="center">
                        <NText strong>{{ t("variables.custom") }}</NText>
                        <NTag size="small" type="success">{{
                            customVariables.length
                        }}</NTag>
                    </NSpace>
                </template>

                <!-- 自定义变量表格或空状态 -->
                <div v-if="customVariables.length === 0">
                    <NEmpty :description="t('variables.addFirstVariable')">
                        <template #icon>
                            <NIcon size="48">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="1"
                                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                    />
                                </svg>
                            </NIcon>
                        </template>
                        <template #default>
                            <NText>{{
                                t("variables.noCustomVariables")
                            }}</NText>
                        </template>
                    </NEmpty>
                </div>

                <NDataTable
                    v-else
                    :columns="customTableColumns"
                    :data="customVariables"
                    :max-height="300"
                    :bordered="false"
                    size="small"
                    :pagination="false"
                    :loading="props.loading || loading"
                />

                <!-- 快速添加表单 -->
                <template #footer>
                    <NDivider />
                    <div>
                        <NText
                            strong
                            depth="1"
                            style="display: block; margin-bottom: 12px"
                        >
                            {{ t("variables.addNew") }}
                        </NText>
                        <NGrid cols="12" :x-gap="12" :y-gap="8">
                            <NGridItem span="4">
                                <NInput
                                    v-model:value="quickAddForm.name"
                                    :placeholder="
                                        t('variables.namePlaceholder')
                                    "
                                    size="small"
                                    :disabled="props.readonly || loading"
                                    @keyup.enter="quickAddVariable"
                                />
                            </NGridItem>
                            <NGridItem span="6">
                                <NInput
                                    v-model:value="quickAddForm.value"
                                    :placeholder="
                                        t('variables.valuePlaceholder')
                                    "
                                    size="small"
                                    :disabled="props.readonly || loading"
                                    @keyup.enter="quickAddVariable"
                                />
                            </NGridItem>
                            <NGridItem span="2">
                                <NButton
                                    @click="quickAddVariable"
                                    type="primary"
                                    size="small"
                                    :disabled="
                                        !canQuickAdd ||
                                        props.readonly ||
                                        loading
                                    "
                                    :loading="loading"
                                    block
                                >
                                    {{ t("variables.add") }}
                                </NButton>
                            </NGridItem>
                        </NGrid>
                    </div>
                </template>
            </NCard>
        </NSpace>

        <template #footer>
            <NSpace justify="space-between">
                <NText depth="3">{{
                    t("variables.management.totalCount", {
                        count: allVariables.length,
                    })
                }}</NText>
                <NSpace>
                    <NButton
                        v-if="!props.readonly"
                        type="primary"
                        @click="handleConfirm"
                        :disabled="props.disabled"
                        :loading="loading"
                    >
                        {{ t("common.confirm") }}
                    </NButton>
                    <NButton @click="handleCancel">
                        {{
                            props.readonly
                                ? t("common.close")
                                : t("common.cancel")
                        }}
                    </NButton>
                </NSpace>
            </NSpace>
        </template>

        <!-- 添加/编辑变量子弹窗 -->
        <VariableEditor
            v-model:show="showEditor"
            :variable="editingVariable"
            :existing-names="existingVariableNames"
            @save="onVariableSave"
            @cancel="onEditorCancel"
        />

        <!-- 导入弹窗 -->
        <VariableImporter
            v-model:show="showImporter"
            @import="onVariablesImport"
        />

        <!-- 导出弹窗 -->
        <NModal
            v-model:show="showExportModal"
            preset="card"
            :title="t('variables.management.exportTitle')"
            size="large"
            :segmented="{ content: true }"
            :style="{ width: '600px', maxWidth: '90vw' }"
            :mask-closable="!loading"
        >
            <NSpace vertical>
                <!-- 导出格式选择 -->
                <div>
                    <NText strong style="display: block; margin-bottom: 12px">
                        {{ t("variables.management.exportFormat") }}
                    </NText>
                    <NRadioGroup v-model:value="exportFormat">
                        <NSpace>
                            <NRadioButton value="csv">CSV</NRadioButton>
                            <NRadioButton value="txt">TXT</NRadioButton>
                        </NSpace>
                    </NRadioGroup>
                </div>

                <!-- 导出统计信息 -->
                <NCard size="small" embedded>
                    <NSpace justify="space-between" align="center">
                        <NText depth="2">{{
                            t("variables.management.exportInfo")
                        }}</NText>
                        <NTag type="info"
                            >{{ customVariables.length }}
                            {{ t("variables.management.variables") }}</NTag
                        >
                    </NSpace>
                </NCard>

                <!-- 预览区域 -->
                <div>
                    <NText strong style="display: block; margin-bottom: 12px">
                        {{ t("variables.management.exportPreview") }}
                    </NText>
                    <NInput
                        :value="getExportPreview()"
                        readonly
                        type="textarea"
                        :autosize="{ minRows: 8, maxRows: 12 }"
                        :input-props="{
                            style: 'font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\'Liberation Mono\',\'Courier New\',monospace; font-size: 12px;',
                        }"
                    />
                </div>
            </NSpace>

            <template #footer>
                <NSpace justify="end">
                    <NButton
                        @click="showExportModal = false"
                        :disabled="loading"
                    >
                        {{ t("common.cancel") }}
                    </NButton>
                    <NButton
                        type="primary"
                        @click="executeExport"
                        :disabled="customVariables.length === 0 || loading"
                        :loading="loading"
                    >
                        {{ t("variables.management.download") }}
                    </NButton>
                </NSpace>
            </template>
        </NModal>
    </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NModal,
    NButton,
    NSpace,
    NTag,
    NDataTable,
    NGrid,
    NGridItem,
    NInput,
    NCard,
    NRadioGroup,
    NRadioButton,
    NText,
    NEmpty,
    NDivider,
    NIcon,
    type DataTableColumns,
} from "naive-ui";
import { useResponsive } from "../../composables/ui/useResponsive";
import { useClipboard } from "../../composables/ui/useClipboard";
import type {
    VariableManagerModalProps,
} from "../../types/components";
import type { VariableSource } from "../../types/variable";
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager';
import type { VariableExportData, VariableImportOptions } from '@prompt-optimizer/core';
import VariableEditor from "./VariableEditor.vue";
import VariableImporter from "./VariableImporter.vue";

const { t } = useI18n();
const { copyText } = useClipboard();

interface VariableRow {
    name: string;
    value: string;
    source: VariableSource;
}

// 响应式配置
const {
    modalWidth,
    buttonSize: responsiveButtonSize,
    shouldUseCompactMode,
} = useResponsive();

// 使用标准化的 Props 接口，但保持向后兼容
interface Props extends Partial<VariableManagerModalProps> {
    visible: boolean;
    variableManager: VariableManagerHooks | null;
    focusVariable?: string;
}

const props = withDefaults(defineProps<Props>(), {
    size: "medium",
    showImportExport: true,
    readonly: false,
    disabled: false,
    loading: false,
    title: undefined,
    width: "90vw",
});

// 使用标准化的 Events 接口
const emit = defineEmits<{
    (event: "update:visible", visible: boolean): void;
    (event: "update:variables", variables: Record<string, string>): void;
    (
        event: "variableChange",
        name: string,
        value: string,
        action: "add" | "update" | "delete",
    ): void;
    (event: "import", data: VariableExportData, options?: VariableImportOptions): void;
    (event: "export"): void;
    (event: "confirm", variables: Record<string, string>): void;
    (event: "cancel"): void;
    (event: "close"): void;
    (event: "ready"): void;
    (event: "error", error: Error): void;
}>();

// 双向绑定本地可见状态
const localVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => emit("update:visible", value),
});

// 状态管理
const loading = ref(false);
const showEditor = ref(false);
const showImporter = ref(false);
const showExportModal = ref(false);
const editingVariable = ref<VariableRow | null>(null);
const exportFormat = ref<"csv" | "txt">("csv");

// 内联编辑状态
const editingRowKey = ref<string | null>(null);
const editingValue = ref("");
const quickAddForm = ref({
    name: "",
    value: "",
});

// 计算属性
const modalStyle = computed(() => ({
    width: modalWidth.value,
    maxWidth: shouldUseCompactMode.value ? "95vw" : "1200px",
}));

const buttonSize = computed(() => {
    return props.size === "small" || responsiveButtonSize.value === "small"
        ? "small"
        : responsiveButtonSize.value;
});

const allVariables = computed<VariableRow[]>(() => {
    const manager = props.variableManager?.variableManager.value;
    if (!manager) return [];

    // 获取所有变量并构建Variable对象
    try {
        const variables = manager.resolveAllVariables();
        return Object.entries(variables).map(([name, value]) => ({
            name,
            value,
            source: manager.getVariableSource(name),
        }));
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to resolve variables:",
            error,
        );
        return [];
    }
});

const existingVariableNames = computed(() => {
    return allVariables.value.map((v) => v.name);
});

// 分组变量
const predefinedVariables = computed(() => {
    return allVariables.value.filter((v) => v.source === "predefined");
});

const customVariables = computed(() => {
    return allVariables.value.filter((v) => v.source === "custom");
});

// 预定义变量表格列配置（只读）
const predefinedTableColumns = computed<DataTableColumns<VariableRow>>(() => [
    {
        title: t("variables.management.variableName"),
        key: "name",
        width: 200,
        render: (row: VariableRow) => {
            return h(
                NTag,
                { size: "small", type: "info" },
                { default: () => formatVariableName(row.name) },
            );
        },
    },
    {
        title: t("variables.management.description"),
        key: "description",
        ellipsis: {
            tooltip: true,
        },
        render: (row: VariableRow) => {
            const descriptionKey = `variables.predefinedDescriptions.${row.name}`;
            const description = t(descriptionKey);
            return h(
                NText,
                { depth: 2 },
                {
                    default: () =>
                        description !== descriptionKey
                            ? description
                            : row.name + " description",
                },
            );
        },
    },
    {
        title: t("common.actions"),
        key: "actions",
        width: 80,
        render: (row: VariableRow) => {
            return h(
                NButton,
                {
                    size: "small",
                    quaternary: true,
                    title: t("common.copy"),
                    onClick: () => copyVariableName(row.name),
                },
                {
                    icon: () =>
                        h(NIcon, null, {
                            default: () =>
                                h(
                                    "svg",
                                    {
                                        width: "16",
                                        height: "16",
                                        viewBox: "0 0 16 16",
                                        fill: "currentColor",
                                    },
                                    [
                                        h("path", {
                                            d: "M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z",
                                        }),
                                        h("path", {
                                            d: "M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z",
                                        }),
                                    ],
                                ),
                        }),
                },
            );
        },
    },
]);

// 自定义变量表格列配置（支持内联编辑）
const customTableColumns = computed<DataTableColumns<VariableRow>>(() => [
    {
        title: t("variables.management.variableName"),
        key: "name",
        width: 200,
        render: (row: VariableRow) => {
            return h(
                NTag,
                { size: "small", type: "success" },
                { default: () => formatVariableName(row.name) },
            );
        },
    },
    {
        title: t("variables.management.value"),
        key: "value",
        ellipsis: {
            tooltip: true,
        },
        render: (row: VariableRow) => {
            // 如果当前行正在编辑
            if (editingRowKey.value === row.name) {
                return h(NInput, {
                    value: editingValue.value,
                    size: "small",
                    autofocus: true,
                    onUpdateValue: (val: string) => (editingValue.value = val),
                    onKeydown: (e: KeyboardEvent) => {
                        if (e.key === "Enter") {
                            saveInlineEdit(row.name);
                        } else if (e.key === "Escape") {
                            cancelInlineEdit();
                        }
                    },
                    onBlur: () => saveInlineEdit(row.name),
                });
            }

            // 正常显示状态，点击可编辑
            return h(
                "span",
                {
                    class: "cursor-pointer",
                    onClick: () => startInlineEdit(row.name, row.value),
                },
                truncateValue(row.value),
            );
        },
    },
    {
        title: t("common.actions"),
        key: "actions",
        width: 160,
        render: (row: VariableRow) => {
            return h(
                NSpace,
                { size: "small" },
                {
                    default: () => [
                        h(
                            NButton,
                            {
                                size: "small",
                                quaternary: true,
                                title: t("common.copy"),
                                onClick: () => copyVariableName(row.name),
                            },
                            {
                                icon: () =>
                                    h(NIcon, null, {
                                        default: () =>
                                            h(
                                                "svg",
                                                {
                                                    width: "16",
                                                    height: "16",
                                                    viewBox: "0 0 16 16",
                                                    fill: "currentColor",
                                                },
                                                [
                                                    h("path", {
                                                        d: "M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z",
                                                    }),
                                                    h("path", {
                                                        d: "M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z",
                                                    }),
                                                ],
                                            ),
                                    }),
                            },
                        ),
                        h(
                            NButton,
                            {
                                size: "small",
                                quaternary: true,
                                title: t("common.edit"),
                                onClick: () => editVariable(row),
                            },
                            {
                                icon: () =>
                                    h(NIcon, null, {
                                        default: () =>
                                            h(
                                                "svg",
                                                {
                                                    width: "16",
                                                    height: "16",
                                                    viewBox: "0 0 16 16",
                                                    fill: "currentColor",
                                                },
                                                [
                                                    h("path", {
                                                        d: "M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708L9.708 9.708a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168L12.146.146z",
                                                    }),
                                                ],
                                            ),
                                    }),
                            },
                        ),
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
                                    h(NIcon, null, {
                                        default: () =>
                                            h(
                                                "svg",
                                                {
                                                    width: "16",
                                                    height: "16",
                                                    viewBox: "0 0 16 16",
                                                    fill: "currentColor",
                                                },
                                                [
                                                    h("path", {
                                                        d: "M6.5 1h3a.5.5 0 01.5.5v1H6v-1a.5.5 0 01.5-.5zM11 2.5v-1A1.5 1.5 0 009.5 0h-3A1.5 1.5 0 005 1.5v1H2.506a.58.58 0 000 1.152H3.5l.5 9A1.5 1.5 0 005.5 14h5a1.5 1.5 0 001.5-1.348l.5-9h.994a.58.58 0 000-1.152H11z",
                                                    }),
                                                ],
                                            ),
                                    }),
                            },
                        ),
                    ],
                },
            );
        },
    },
]);

// 工具函数
const truncateValue = (value: string, maxLength: number = 60): string => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + "...";
};

const formatVariableName = (name: string): string => {
    return `{{${name}}}`;
};

// 复制变量名功能
const copyVariableName = async (name: string) => {
    try {
        const formattedName = formatVariableName(name);
        await copyText(formattedName);
        console.log(
            `[VariableManagerModal] Copied variable name: ${formattedName}`,
        );
    } catch (error) {
        console.error(
            "[VariableManagerModal] Failed to copy variable name:",
            error,
        );
    }
};

const showAddVariable = () => {
    editingVariable.value = null;
    showEditor.value = true;
};

const editVariable = (variable: VariableRow) => {
    editingVariable.value = variable;
    showEditor.value = true;
};

// 内联编辑处理函数
const startInlineEdit = (rowKey: string, currentValue: string) => {
    editingRowKey.value = rowKey;
    editingValue.value = currentValue;
};

const saveInlineEdit = async (rowKey: string) => {
    if (!props.variableManager?.variableManager.value) {
        cancelInlineEdit();
        return;
    }

    const trimmedValue = editingValue.value.trim();
    if (!trimmedValue) {
        cancelInlineEdit();
        return;
    }

    try {
        loading.value = true;
        props.variableManager.addVariable(rowKey, trimmedValue);

        // 清空编辑状态
        editingRowKey.value = null;
        editingValue.value = "";

        // 触发变更事件
        handleVariableChange(rowKey, trimmedValue, "update");
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to save inline edit:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

const cancelInlineEdit = () => {
    editingRowKey.value = null;
    editingValue.value = "";
};

// 快速添加功能
const quickAddVariable = async () => {
    if (!props.variableManager?.variableManager.value) return;
    if (!quickAddForm.value.name.trim() || !quickAddForm.value.value.trim())
        return;

    try {
        loading.value = true;
        const name = quickAddForm.value.name.trim();
        const value = quickAddForm.value.value.trim();

        props.variableManager.addVariable(name, value);

        // 清空表单
        quickAddForm.value.name = "";
        quickAddForm.value.value = "";

        // 触发变更事件
        handleVariableChange(name, value, "add");
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to quick add variable:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

// 验证快速添加表单
const canQuickAdd = computed(() => {
    const name = quickAddForm.value.name.trim();
    const value = quickAddForm.value.value.trim();

    if (!name || !value) return false;

    // 验证变量名格式
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) return false;

    // 检查是否与预定义变量重名（标准化）
    if (
        props.variableManager?.variableManager.value?.isPredefinedVariable(name)
    )
        return false;

    // 检查是否与现有变量重名
    if (existingVariableNames.value.includes(name)) return false;

    return true;
});

const deleteVariable = async (name: string) => {
    if (!props.variableManager?.variableManager.value) return;
    if (props.readonly) return;

    if (confirm(t("variables.management.deleteConfirm", { name }))) {
        try {
            loading.value = true;
            props.variableManager.deleteVariable(name);

            // 发送删除事件
            handleVariableChange(name, "", "delete");
        } catch (error: unknown) {
            console.error(
                "[VariableManagerModal] Failed to delete variable:",
                error,
            );
            emit("error", error instanceof Error ? error : new Error(String(error)));
        } finally {
            loading.value = false;
        }
    }
};

const onVariableSave = async (variable: { name: string; value: string }) => {
    if (!props.variableManager?.variableManager.value) return;

    try {
        loading.value = true;
        const isUpdate = allVariables.value.some(
            (v) => v.name === variable.name,
        );

        props.variableManager.addVariable(variable.name, variable.value);
        showEditor.value = false;
        editingVariable.value = null;

        // 发送标准化变更事件
        handleVariableChange(
            variable.name,
            variable.value,
            isUpdate ? "update" : "add",
        );
    } catch (error: unknown) {
        console.error("[VariableManagerModal] Failed to save variable:", error);
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

const onEditorCancel = () => {
    showEditor.value = false;
    editingVariable.value = null;
};

const showImportModal = () => {
    showImporter.value = true;
};

const onVariablesImport = (variables: Record<string, string>) => {
    if (!props.variableManager) return;

    try {
        loading.value = true;
        Object.entries(variables).forEach(([name, value]) => {
            props.variableManager!.addVariable(name, value);
        });
        showImporter.value = false;

        // 发送标准化事件
        emit("import", {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            variables: Object.entries(variables).map(([name, value]) => ({
                name,
                value,
                type: "custom" as const,
                required: false,
            })),
        });
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to import variables:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

// 新增的标准化事件处理函数
const handleClose = () => {
    emit("close");
    emit("cancel");
};

const handleConfirm = () => {
    if (!props.variableManager) return;

    const currentVariables =
        props.variableManager.variableManager.value?.resolveAllVariables() ||
        {};
    emit("confirm", currentVariables);
    emit("update:variables", currentVariables);
    localVisible.value = false;
};

const handleCancel = () => {
    emit("cancel");
    localVisible.value = false;
};

// 变量变更事件增强
const handleVariableChange = (
    name: string,
    value: string,
    action: "add" | "update" | "delete",
) => {
    emit("variableChange", name, value, action);

    // 同时发送 update:variables 事件
    if (props.variableManager) {
        const allVars =
            props.variableManager.variableManager.value?.resolveAllVariables() ||
            {};
        emit("update:variables", allVars);
    }
};

// 监听visible变化，处理焦点变量
watch(
    () => props.visible,
    (visible) => {
        if (visible && props.focusVariable) {
            // 如果有指定要聚焦的变量，自动打开编辑器
            const targetVariable = allVariables.value.find(
                (v) => v.name === props.focusVariable,
            );
            if (targetVariable) {
                editingVariable.value = targetVariable;
                showEditor.value = true;
            } else {
                // 如果变量不存在，创建新变量
                editingVariable.value = {
                    name: props.focusVariable,
                    value: "",
                    source: "custom",
                };
                showEditor.value = true;
            }
        }

        // 发送ready事件
        if (visible) {
            emit("ready");
        }
    },
);

// 导出预览功能
const getExportPreview = (): string => {
    if (!props.variableManager?.variableManager.value) return "";

    // 使用已有的 customVariables 计算属性，转换为对象格式
    const customVarsObject = customVariables.value.reduce(
        (acc, variable) => {
            acc[variable.name] = variable.value;
            return acc;
        },
        {} as Record<string, string>,
    );

    switch (exportFormat.value) {
        case "csv": {
            const csvLines = ["name,value"];
            for (const [name, value] of Object.entries(customVarsObject)) {
                csvLines.push(`"${name}","${value.replace(/"/g, '""')}"`);
            }
            return csvLines.join("\n");
        }

        case "txt": {
            const txtLines: string[] = [];
            for (const [name, value] of Object.entries(customVarsObject)) {
                txtLines.push(`${name}=${value}`);
            }
            return txtLines.join("\n");
        }

        default: {
            return "";
        }
    }
};

// 执行导出功能
const executeExport = () => {
    if (!props.variableManager?.variableManager.value) return;

    try {
        loading.value = true;
        const content = getExportPreview();
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .replace("T", "_")
            .split(".")[0];
        const fileName = `variables-${timestamp}.${exportFormat.value}`;

        let mimeType: string;
        switch (exportFormat.value) {
            case "csv": {
                mimeType = "text/csv";
                break;
            }
            case "txt": {
                mimeType = "text/plain";
                break;
            }
            default: {
                mimeType = "text/plain";
            }
        }

        // 发送导出事件
        emit("export");

        // 执行实际导出
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        // 关闭弹窗
        showExportModal.value = false;
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to export variables:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

// 删除重复的onVariableSave函数，避免冲突
</script>

<style scoped>
/* Pure Naive UI implementation - no custom theme CSS needed */
</style>
