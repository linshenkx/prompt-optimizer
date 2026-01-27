<template>
    <!-- 变量值输入表单（临时变量编辑区） -->
    <NCard
        :title="t('test.variables.title')"
        size="small"
        :bordered="true"
        :style="{ flexShrink: 0 }"
    >
        <template #header-extra>
            <NSpace :size="8">
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
                    :aria-label="
                        props.isGenerating
                            ? t('test.variableValueGeneration.generating')
                            : t('test.variableValueGeneration.generateButton')
                    "
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
                    type="error"
                    :disabled="props.disabled"
                    @click="handleClearAllVariables"
                    :aria-label="t('test.variables.clearAll')"
                >
                    {{ t('test.variables.clearAll') }}
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
                    padding: '2px 0',
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
                    :style="{ minWidth: '160px', maxWidth: '220px', flexShrink: 0 }"
                >
                    <span
                        :style="{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            lineHeight: '1.5',
                            maxWidth: '100%',
                        }"
                    >
                        <span
                            :style="{
                                maxWidth: '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }"
                            v-text="`{{${varName}}}`"
                        ></span>
                        <span
                            v-if="getVariableSourceLabel(varName)"
                            :style="{ fontSize: '12px', opacity: 0.75, whiteSpace: 'nowrap' }"
                        >
                            {{ getVariableSourceLabel(varName) }}
                        </span>
                    </span>
                </NTag>
                <NInput
                    :value="getVariableDisplayValue(varName)"
                    :placeholder="getVariablePlaceholder(varName)"
                    size="small"
                    :disabled="props.disabled"
                    :style="{ flex: 1, minWidth: 0 }"
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
                    :aria-label="t('test.variables.delete')"
                >
                    <NIcon size="16">
                        <Trash />
                    </NIcon>
                </NButton>
                <!-- 保存到全局按钮 (仅测试变量显示) -->
                <NButton
                    v-if="getVariableSource(varName) === 'test'"
                    size="small"
                    quaternary
                    :disabled="props.disabled"
                    @click="handleSaveToGlobal(varName)"
                    :title="t('test.variables.saveToGlobal')"
                    :aria-label="t('test.variables.saveToGlobal')"
                >
                    <NIcon size="16">
                        <DeviceFloppy />
                    </NIcon>
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
    NIcon,
} from 'naive-ui'

import { DeviceFloppy, Trash } from '@vicons/tabler'

import type { TestVariableManager } from '../../composables/variable/useTestVariableManager'

interface Props {
    manager: TestVariableManager
    disabled?: boolean

    // Optional actions
    showGenerateValues?: boolean
    isGenerating?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    showGenerateValues: false,
    isGenerating: false,
})

const emit = defineEmits<{
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

const getVariableSourceLabel = (varName: string) => {
    const source = getVariableSource(varName)
    if (source === 'predefined') return t('variableDetection.sourcePredefined')
    return ''
}

const displayVariables = computed(() => sortedVariables.value)
</script>
