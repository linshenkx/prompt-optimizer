<template>
    <!-- 变量值输入表单（临时变量编辑区） -->
    <NCard
        :title="t('test.variables.formTitle')"
        size="small"
        :bordered="true"
        :style="{ flexShrink: 0 }"
    >
        <template #header-extra>
            <NSpace :size="8">
                <NTag :bordered="false" type="info" size="small">
                    {{
                        t('test.variables.tempCount', {
                            count: displayVariables.length,
                        })
                    }}
                </NTag>
                <NButton
                    v-if="props.showGenerateValues"
                    size="small"
                    quaternary
                    :loading="props.isGenerating"
                    :disabled="
                        props.disabled ||
                        props.isGenerating ||
                        displayVariables.length === 0
                    "
                    @click="emit('generate-values')"
                >
                    {{
                        props.isGenerating
                            ? t('test.variableValueGeneration.generating')
                            : t('test.variableValueGeneration.generateButton')
                    }}
                </NButton>
                <NButton
                    size="small"
                    quaternary
                    :disabled="props.disabled"
                    @click="handleClearAllVariables"
                >
                    {{ t('test.variables.clearAll') }}
                </NButton>
                <NButton
                    v-if="props.showOpenGlobalVariables"
                    size="small"
                    quaternary
                    :disabled="props.disabled"
                    @click="emit('open-global-variables')"
                >
                    {{ t('contextMode.actions.globalVariables') }}
                </NButton>
            </NSpace>
        </template>

        <NSpace vertical :size="12">
            <!-- 变量输入项 -->
            <div
                v-for="varName in displayVariables"
                :key="varName"
                :style="{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }"
            >
                <NTag
                    size="small"
                    :bordered="false"
                    :type="
                        getVariableSource(varName) === 'predefined'
                            ? 'success'
                            : getVariableSource(varName) === 'test'
                              ? 'warning'
                              : 'default'
                    "
                    :style="{ minWidth: '120px', flexShrink: 0 }"
                >
                    <span v-text="`{{${varName}}}`"></span>
                </NTag>
                <NInput
                    :value="getVariableDisplayValue(varName)"
                    :placeholder="getVariablePlaceholder(varName)"
                    size="small"
                    :disabled="props.disabled"
                    :style="{ flex: 1 }"
                    @update:value="handleVariableValueChange(varName, $event)"
                />
                <!-- 删除按钮 (仅临时变量显示) -->
                <NButton
                    v-if="getVariableSource(varName) === 'test'"
                    size="small"
                    quaternary
                    :disabled="props.disabled"
                    @click="handleDeleteVariable(varName)"
                    :title="t('test.variables.delete')"
                >
                    🗑️
                </NButton>
                <!-- 保存到全局按钮 (仅测试变量显示) -->
                <NButton
                    v-if="getVariableSource(varName) === 'test'"
                    size="small"
                    quaternary
                    :disabled="props.disabled"
                    @click="handleSaveToGlobal(varName)"
                    :title="t('test.variables.saveToGlobal')"
                >
                    💾
                </NButton>
            </div>

            <!-- 无变量提示 -->
            <NEmpty
                v-if="displayVariables.length === 0"
                :description="t('test.variables.noVariables')"
                size="small"
            />

            <!-- 操作按钮 -->
            <NSpace :size="8" justify="end">
                <!-- 添加变量按钮 -->
                <NButton
                    size="small"
                    :disabled="props.disabled"
                    @click="showAddVariableDialog = true"
                >
                    {{ t('test.variables.addVariable') }}
                </NButton>
            </NSpace>
        </NSpace>
    </NCard>

    <!-- 添加变量对话框 -->
    <NModal
        v-model:show="showAddVariableDialog"
        preset="dialog"
        :title="t('test.variables.addVariable')"
        :positive-text="t('common.confirm')"
        :negative-text="t('common.cancel')"
        :on-positive-click="handleAddVariable"
        :mask-closable="false"
    >
        <NSpace vertical :size="12" style="margin-top: 16px">
            <NFormItem
                :label="t('variableExtraction.variableName')"
                :validation-status="newVariableNameError ? 'error' : undefined"
                :feedback="newVariableNameError"
            >
                <NInput
                    v-model:value="newVariableName"
                    :placeholder="t('variableExtraction.variableNamePlaceholder')"
                    :disabled="props.disabled"
                    @input="validateNewVariableName"
                />
            </NFormItem>

            <NFormItem :label="t('variableExtraction.variableValue')">
                <NInput
                    v-model:value="newVariableValue"
                    :placeholder="t('variableExtraction.variableValuePlaceholder')"
                    :disabled="props.disabled"
                />
            </NFormItem>
        </NSpace>
    </NModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from 'vue-i18n'
import {
    NCard,
    NSpace,
    NTag,
    NButton,
    NInput,
    NEmpty,
    NModal,
    NFormItem,
} from 'naive-ui'

import type { TestVariableManager } from '../../composables/variable/useTestVariableManager'

interface Props {
    manager: TestVariableManager
    disabled?: boolean

    // Optional actions
    showOpenGlobalVariables?: boolean
    showGenerateValues?: boolean
    isGenerating?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    showOpenGlobalVariables: true,
    showGenerateValues: false,
    isGenerating: false,
})

const emit = defineEmits<{
    (e: 'open-global-variables'): void
    (e: 'generate-values'): void
}>()

const { t } = useI18n()

const {
    showAddVariableDialog,
    newVariableName,
    newVariableValue,
    newVariableNameError,
    sortedVariables,
    getVariableSource,
    getVariableDisplayValue,
    getVariablePlaceholder,
    validateNewVariableName,
    handleVariableValueChange,
    handleAddVariable,
    handleDeleteVariable,
    handleClearAllVariables,
    handleSaveToGlobal,
} = props.manager

const displayVariables = computed(() => sortedVariables.value)
</script>
