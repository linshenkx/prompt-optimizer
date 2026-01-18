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
        :mask-closable="true"
    >
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
                    :disabled="isEditing || loading"
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
                    :disabled="loading"
                    :autosize="{ minRows: 4, maxRows: 8 }"
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
            <NSpace justify="end">
                <NButton @click="cancel" :disabled="loading">
                    {{ t("common.cancel") }}
                </NButton>
                <NButton
                    type="primary"
                    @click="save"
                    :disabled="!isValid || loading"
                    :loading="loading"
                >
                    {{ isEditing ? t("common.save") : t("common.add") }}
                </NButton>
            </NSpace>
        </template>
    </NModal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NModal,
    NForm,
    NFormItem,
    NInput,
    NButton,
    NSpace,
    NText,
    type FormInst,
    type FormRules,
} from "naive-ui";

const { t } = useI18n();

interface VariableItem {
    name: string;
    value: string;
}

interface Props {
    variable?: VariableItem | null;
    existingNames: string[];
    show?: boolean;
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
    set: (val: boolean) => emit("update:show", val),
});

const modalStyle = { width: "600px", maxWidth: "90vw" };

// 状态管理
const loading = ref(false);
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
                if (value && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.trim())) {
                    return new Error(t("variables.editor.errors.nameInvalid"));
                }
            },
            trigger: ["input", "blur"],
        },
        {
            validator: (_rule: unknown, value: string) => {
                const predefinedNames = [
                    "originalPrompt",
                    "lastOptimizedPrompt",
                    "iterateInput",
                    "currentPrompt",
                    "userQuestion",
                    "conversationContext",
                    "toolsContext",
                ];
                if (value && predefinedNames.includes(value.trim())) {
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
    if (!formRef.value) return;

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

const cancel = () => {
    localVisible.value = false;
};

// 初始化
onMounted(() => {
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

<style scoped></style>
