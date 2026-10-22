<template>
    <NModal
        v-model:show="localVisible"
        preset="card"
        :title="
            isEditing
                ? t('variables.editor.editTitle')
                : t('variables.editor.addTitle')
        "
        size="medium"
        :segmented="{ content: true }"
        :style="modalStyle"
        @after-leave="onAfterLeave"
        :mask-closable="!isCompact || !isBusy"
        compact-class="mobile-variable-editor"
    >
        <NAlert v-if="isCompact && saveError" type="error" class="variable-save-error">{{ saveError }}</NAlert>
        <NForm
            ref="formRef"
            :model="formData"
            :rules="formRules"
            label-placement="top"
        >
            <!-- 变量名 -->
            <NFormItem
                path="name"
                :label="t('variables.editor.variableName')"
                required
            >
                <NInput
                    v-model:value="formData.name"
                    :placeholder="t('variables.editor.variableNamePlaceholder')"
                    :disabled="isEditing || isBusy"
                    clearable
                />
                <template #feedback>
                    <NText
                        depth="3"
                        style="font-size: 12px; display: block; margin-top: 4px"
                    >
                        {{ t("variables.editor.variableNameHelp") }}
                    </NText>
                </template>
            </NFormItem>

            <!-- 变量值 -->
            <NFormItem
                path="value"
                class="variable-value-field"
                :label="t('variables.editor.variableValue')"
                required
            >
                <NInput
                    ref="valueInputRef"
                    v-model:value="formData.value"
                    type="textarea"
                    :placeholder="
                        t('variables.editor.variableValuePlaceholder')
                    "
                    :disabled="isBusy"
                    :autosize="isCompact ? { minRows: 5, maxRows: 14 } : { minRows: 4, maxRows: 8 }"
                    clearable
                />
                <template #feedback>
                    <NText
                        depth="3"
                        style="font-size: 12px; display: block; margin-top: 4px"
                    >
                        {{ t("variables.editor.variableValueHelp") }}
                    </NText>
                </template>
            </NFormItem>
        </NForm>

        <template #footer>
            <NSpace justify="end" :class="{ 'variable-editor-actions': isCompact }">
                <NButton @click="cancel" :disabled="isBusy">
                    {{ t("common.cancel") }}
                </NButton>
                <NButton
                    type="primary"
                    @click="save"
                    :disabled="!isValid || isBusy"
                    :loading="isBusy"
                >
                    {{ isEditing ? t("common.save") : t("common.add") }}
                </NButton>
            </NSpace>
        </template>
    </NModal>
</template>

<script setup lang="ts">
import NModal from '../common/AdaptiveModal.vue'
import { ref, computed, onMounted, watch, nextTick } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NForm,
    NFormItem,
    NInput,
    NButton,
    NSpace,
    NText,
    NAlert,
    type FormInst,
    type FormRules,
} from "naive-ui";
import {
    PREDEFINED_VARIABLES,
    getVariableNameValidationError,
} from "../../types/variable";

import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout';
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog';

const { t } = useI18n();
const { isCompact } = useWorkspaceLayout();
const confirmDialog = useConfirmDialog();

interface VariableItem {
    name: string;
    value: string;
}

interface Props {
    variable?: VariableItem | null;
    existingNames: string[];
    show?: boolean;
    saving?: boolean;
    saveError?: string;
}

const props = withDefaults(defineProps<Props>(), {
    variable: null,
    show: true,
});

interface Emits {
    (e: "save", variable: { name: string; value: string }): void;
    (e: "cancel"): void;
    (e: "update:show", value: boolean): void;
}
const emit = defineEmits<Emits>();

// 显隐受控，统一动画与尺寸
const localVisible = computed({
    get: () => props.show ?? true,
    set: (val: boolean) => {
        if (!val && isCompact.value) void requestClose();
        else emit("update:show", val);
    },
});

const modalStyle = { width: "600px", maxWidth: "90vw" };

// 状态管理
const loading = ref(false);
const isBusy = computed(() => loading.value || props.saving);
const initialDraft = ref(props.variable
    ? { name: props.variable.name, value: props.variable.value }
    : { name: "", value: "" });
const confirmingClose = ref(false);
const formRef = ref<FormInst>();
const valueInputRef = ref<InstanceType<typeof NInput> | null>(null);
const formData = ref({
    name: "",
    value: "",
});

// 计算属性
const isEditing = computed(() => !!props.variable);

const isValid = computed(() => {
    return (
        formData.value.name.trim() !== "" && formData.value.value.trim() !== ""
    );
});

// 表单验证规则
const formRules: FormRules = {
    name: [
        {
            required: true,
            message: () => t("variables.editor.errors.nameRequired"),
            trigger: ["input", "blur"],
        },
        {
            validator: (_rule: unknown, value: string) => {
                const name = value?.trim();
                if (name && getVariableNameValidationError(name)) {
                    return new Error(t("variables.editor.errors.nameInvalid"));
                }
            },
            trigger: ["input", "blur"],
        },
        {
            validator: (_rule: unknown, value: string) => {
                if (
                    value &&
                    PREDEFINED_VARIABLES.includes(
                        value.trim() as typeof PREDEFINED_VARIABLES[number],
                    )
                ) {
                    return new Error(
                        t("variables.editor.errors.namePredefined"),
                    );
                }
            },
            trigger: ["input", "blur"],
        },
        {
            validator: (_rule: unknown, value: string) => {
                const existingNames = props.existingNames.filter((n) =>
                    isEditing.value ? n !== props.variable?.name : true,
                );
                if (value && existingNames.includes(value.trim())) {
                    return new Error(t("variables.editor.errors.nameExists"));
                }
            },
            trigger: ["input", "blur"],
        },
    ],
    value: [
        {
            required: true,
            message: () => t("variables.editor.errors.valueRequired"),
            trigger: ["input", "blur"],
        },
        {
            validator: (_rule: unknown, value: string) => {
                if (value && value.trim().length > 5000) {
                    return new Error(t("variables.editor.errors.valueTooLong"));
                }
            },
            trigger: ["input", "blur"],
        },
    ],
};

// 事件处理
const save = async () => {
    if (!formRef.value || isBusy.value) return;

    try {
        await formRef.value.validate();
        loading.value = true;
        emit("save", {
            name: formData.value.name.trim(),
            value: formData.value.value.trim(),
        });
    } catch (error: unknown) {
        console.error("[VariableEditor] Validation error:", error);
    } finally {
        loading.value = false;
    }
};

const onAfterLeave = () => {
    emit("cancel");
};

const requestClose = async () => {
    if (isBusy.value || confirmingClose.value) return;
    const dirty = formData.value.name !== initialDraft.value.name || formData.value.value !== initialDraft.value.value;
    if (dirty) {
        confirmingClose.value = true;
        try {
            const discard = await confirmDialog.warning({
                title: t('common.warning'),
                content: t('workspace.unsavedForm'),
                positiveText: t('common.confirm'),
                negativeText: t('common.cancel'),
            });
            if (!discard) return;
        } finally {
            confirmingClose.value = false;
        }
    }
    emit('update:show', false);
};

const cancel = () => {
    localVisible.value = false;
};

// Only a newly opened mobile edit session initializes the draft. Resizing never does.
watch(() => props.show, (show) => {
    if (!show || !isCompact.value) return;
    formData.value = props.variable
        ? { name: props.variable.name, value: props.variable.value }
        : { name: '', value: '' };
    initialDraft.value = { ...formData.value };
    formRef.value?.restoreValidation();
}, { immediate: true });

// 初始化
onMounted(() => {
    if (isCompact.value) return;
    if (props.variable) {
        formData.value = {
            name: props.variable.name,
            value: props.variable.value,
        };
        if ((props.variable.value ?? "") === "") {
            nextTick(() => {
                valueInputRef.value?.focus();
            });
        }
        // 如果是从缺失变量引导添加，通常会以新增模式打开，此处保持默认行为
    } else {
        // 新增模式：自动聚焦到值输入，方便直接填写
        nextTick(() => {
            valueInputRef.value?.focus();
        });
    }
});

// 监听props变化
watch(
    () => props.variable,
    (newVariable) => {
        initialDraft.value = newVariable ? { name: newVariable.name, value: newVariable.value } : { name: '', value: '' };
        if (newVariable) {
            formData.value = {
                name: newVariable.name,
                value: newVariable.value,
            };
            if ((newVariable.value ?? "") === "") {
                nextTick(() => {
                    valueInputRef.value?.focus();
                });
            }
        } else {
            formData.value = {
                name: "",
                value: "",
            };
        }
    },
);
</script>

<style scoped>
:global(.workspace-compact .mobile-variable-editor .n-form-item-label) {
    font-size: 13px;
    line-height: 1.4;
}
:global(.workspace-compact .mobile-variable-editor .n-form-item-feedback-wrapper) {
    min-height: 0;
}
:global(.workspace-compact .mobile-variable-editor .variable-value-field) {
    margin-bottom: 0;
}
.variable-save-error { margin-bottom: 12px; }
.variable-editor-actions { width: 100%; }
</style>
