<template>
    <div v-if="compact && displayVariables.length === 0" class="compact-empty-variables">
        <NButton quaternary size="small" :disabled="props.disabled" @click="showAddVariableDialog = true">
            {{ t('test.variables.addVariable') }}
        </NButton>
    </div>
    <!-- 变量值输入表单（临时变量编辑区） -->
    <NCard
        v-else
        class="temporary-variables-panel"
        :title="t('test.variables.title')"
        size="small"
        :bordered="true"
        :style="{ flexShrink: 0 }"
    >
        <template #header-extra>
            <NSpace :size="8">
                <NButton
                    v-if="props.showGenerateValues && !compact"
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

                <NDropdown
                    :options="headerActionOptions"
                    @select="handleHeaderActionSelect"
                >
                    <NButton
                        size="small"
                        quaternary
                        :disabled="props.disabled || displayVariables.length === 0"
                        :aria-label="t('common.actions')"
                    >
                        {{ t('common.actions') }}
                    </NButton>
                </NDropdown>

                <NButton
                    size="small"
                    quaternary
                    :aria-label="isPanelCollapsed ? t('common.expand') : t('common.collapse')"
                    @click="togglePanelCollapsed"
                >
                    {{ isPanelCollapsed ? t('common.expand') : t('common.collapse') }}
                </NButton>
            </NSpace>
        </template>

        <template v-if="!isPanelCollapsed">
            <NSpace vertical :size="10">
                <div
                    :style="{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                    }"
                >
                    <NText v-if="displayVariables.length > 0" :depth="3">
                        {{ t('test.variables.tempCount', { count: displayVariables.length }) }}
                    </NText>
                    <span v-else />

                    <NButton
                        size="small"
                        :disabled="props.disabled"
                        @click="showAddVariableDialog = true"
                    >
                        {{ t('test.variables.addVariable') }}
                    </NButton>
                </div>

                <!-- 变量输入项 -->
                <div
                    v-for="(varName, index) in displayVariables"
                    :key="varName"
                    class="temporary-variable-row"
                    :style="getVariableRowStyle(index)"
                >
                    <div
                        class="temporary-variable-meta"
                        :style="{
                            width: '220px',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                        }"
                    >
                        <NInput
                            v-if="isVariableNameEditing(varName)"
                            :value="variableNameDraft"
                            size="small"
                            :disabled="props.disabled"
                            :placeholder="t('variableExtraction.variableNamePlaceholder')"
                            @update:value="variableNameDraft = $event"
                            @keydown="handleVariableNameDraftKeydown"
                            @blur="commitVariableNameChange"
                        />

                        <NText
                            v-else
                            :style="{
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                fontSize: '13px',
                                lineHeight: '20px',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                cursor: canEditVariableName(varName) ? 'text' : 'default',
                            }"
                            @dblclick="beginVariableNameEdit(varName)"
                        >
                            {{ varName }}
                        </NText>

                        <NTag
                            v-if="getVariableSourceLabel(varName)"
                            size="small"
                            :bordered="false"
                            :type="getVariableSourceTagType(varName)"
                            :style="{ width: 'fit-content', maxWidth: '100%' }"
                        >
                            {{ getVariableSourceLabel(varName) }}
                        </NTag>
                    </div>

                    <NInput
                        class="temporary-variable-value"
                        :value="getVariableDisplayValue(varName)"
                        :placeholder="getVariablePlaceholder(varName)"
                        size="small"
                        type="textarea"
                        :autosize="{ minRows: 1, maxRows: 2 }"
                        :disabled="props.disabled"
                        :style="{ flex: 1, minWidth: 0 }"
                        @update:value="handleVariableValueChange(varName, $event)"
                    />

                    <div
                        class="temporary-variable-actions"
                        :style="{
                            width: '84px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                        }"
                    >
                        <NButton
                            size="small"
                            quaternary
                            :disabled="props.disabled"
                            @click="openValueFullscreenEditor(varName)"
                            :title="t('test.variables.fullscreenEdit')"
                            :aria-label="t('test.variables.fullscreenEdit')"
                        >
                            <NIcon size="16">
                                <ArrowsMaximize />
                            </NIcon>
                        </NButton>

                        <NDropdown
                            :options="getVariableActionOptions(varName)"
                            @select="(key) => handleVariableActionSelect(varName, key)"
                        >
                            <NButton
                                size="small"
                                quaternary
                                :disabled="props.disabled || !hasVariableActions(varName)"
                                :title="t('common.actions')"
                                :aria-label="t('common.actions')"
                            >
                                <NIcon size="16">
                                    <DotsVertical />
                                </NIcon>
                            </NButton>
                        </NDropdown>
                    </div>
                </div>

                <!-- 无变量提示 -->
                <div v-if="displayVariables.length === 0" :style="{ padding: '2px 0' }">
                    <NText :depth="3">{{ t('test.variables.noVariables') }}</NText>
                </div>
            </NSpace>
        </template>
    </NCard>

    <!-- 添加变量对话框 -->
    <AdaptiveModal
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
    </AdaptiveModal>

    <FullscreenDialog
        v-model="showValueFullscreenEditor"
        :title="t('test.variables.fullscreenEdit')"
    >
        <NFlex vertical :size="12" :style="{ height: '100%', minHeight: 0 }">
            <NText v-if="fullscreenEditorVariableName" :depth="2">
                {{ fullscreenEditorVariableName }}
            </NText>

            <div :style="{ flex: 1, minHeight: 0 }">
                <NInput
                    :value="fullscreenEditorValue"
                    type="textarea"
                    :disabled="props.disabled"
                    :placeholder="getVariablePlaceholder(fullscreenEditorVariableName)"
                    :autosize="false"
                    clearable
                    show-count
                    style="height: 100%; min-height: 0;"
                    @update:value="handleFullscreenValueChange"
                />
            </div>
        </NFlex>
    </FullscreenDialog>
</template>

<script setup lang="ts">
import AdaptiveModal from '../common/AdaptiveModal.vue'
import { computed, ref, watch } from 'vue'

import { useI18n } from 'vue-i18n'
import {
    NCard,
    NSpace,
    NTag,
    NButton,
    NInput,
    NFormItem,
    NIcon,
    NText,
    NDropdown,
    NFlex,
    useDialog,
    type DropdownOption,
} from 'naive-ui'

import { ArrowsMaximize, DotsVertical } from '@vicons/tabler'

import FullscreenDialog from '../FullscreenDialog.vue'
import type { TestVariableManager } from '../../composables/variable/useTestVariableManager'

interface Props {
    manager: TestVariableManager
    disabled?: boolean
    compact?: boolean

    // Optional actions
    showGenerateValues?: boolean
    isGenerating?: boolean
}

type VariableActionKey = 'rename' | 'save-global' | 'delete' | 'generate'
type HeaderActionKey = 'clear-all' | 'generate-values'

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    compact: false,
    showGenerateValues: false,
    isGenerating: false,
})

const emit = defineEmits<{
    (e: 'generate-values', variableName?: string): void
}>()

const { t } = useI18n()
const dialog = useDialog()

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
    renameVariable,
    handleAddVariable,
    handleDeleteVariable,
    handleClearAllVariables,
    handleSaveToGlobal,
} = props.manager

const isPanelCollapsed = ref(false)
const editingVariableName = ref('')
const variableNameDraft = ref('')

const showValueFullscreenEditor = ref(false)
const fullscreenEditorVariableName = ref('')
const fullscreenEditorValue = ref('')

const displayVariables = computed(() => sortedVariables.value)

const headerActionOptions = computed<DropdownOption[]>(() => [
    ...(props.compact && props.showGenerateValues ? [{
        key: 'generate-values',
        label: t('test.variableValueGeneration.generateButton'),
        disabled: props.disabled || props.isGenerating || displayVariables.value.length === 0,
    }] : []),
    {
        key: 'clear-all',
        label: t('test.variables.clearAll'),
        disabled: props.disabled || displayVariables.value.length === 0,
    },
])

const togglePanelCollapsed = () => {
    isPanelCollapsed.value = !isPanelCollapsed.value
}

const getVariableRowStyle = (index: number) => {
    const hasDivider = index < displayVariables.value.length - 1
    return {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '6px 0',
        borderBottom: hasDivider ? '1px solid rgba(128, 128, 128, 0.16)' : 'none',
    }
}

const canEditVariableName = (varName: string) => {
    return !props.disabled && getVariableSource(varName) === 'test'
}

const isVariableNameEditing = (varName: string) => {
    return editingVariableName.value === varName
}

const beginVariableNameEdit = (varName: string) => {
    if (!canEditVariableName(varName)) return
    editingVariableName.value = varName
    variableNameDraft.value = varName
}

const cancelVariableNameEdit = () => {
    editingVariableName.value = ''
    variableNameDraft.value = ''
}

const handleVariableNameDraftKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        event.preventDefault()
        commitVariableNameChange()
        return
    }
    if (event.key === 'Escape') {
        event.preventDefault()
        cancelVariableNameEdit()
    }
}

const commitVariableNameChange = () => {
    const currentName = editingVariableName.value
    if (!currentName) return

    const nextName = variableNameDraft.value.trim()
    if (!nextName || nextName === currentName) {
        cancelVariableNameEdit()
        return
    }

    const renamed = renameVariable(currentName, nextName)
    if (renamed) {
        if (fullscreenEditorVariableName.value === currentName) {
            fullscreenEditorVariableName.value = nextName
        }
        cancelVariableNameEdit()
        return
    }

    variableNameDraft.value = currentName
}

const getVariableSourceLabel = (varName: string) => {
    const source = getVariableSource(varName)
    if (source === 'predefined') return t('variableDetection.sourcePredefined')
    if (source === 'global') return t('variableDetection.sourceGlobal')
    return ''
}

const getVariableSourceTagType = (varName: string): 'success' | 'default' => {
    const source = getVariableSource(varName)
    if (source === 'predefined') return 'success'
    return 'default'
}

const getVariableActionOptions = (varName: string): DropdownOption[] => {
    const source = getVariableSource(varName)
    const options: DropdownOption[] = []

    if (props.showGenerateValues && source === 'test') {
        options.push({
            key: 'generate',
            label: t('test.variableValueGeneration.generateButton'),
            disabled: props.disabled || props.isGenerating,
        })
    }

    if (source === 'test') {
        options.push(
            {
                key: 'rename',
                label: t('common.edit'),
                disabled: props.disabled,
            },
            {
                key: 'save-global',
                label: t('test.variables.saveToGlobal'),
                disabled: props.disabled,
            },
            {
                key: 'delete',
                label: t('test.variables.delete'),
                disabled: props.disabled,
            }
        )
    }

    return options
}

const hasVariableActions = (varName: string) => {
    return getVariableActionOptions(varName).length > 0
}

const handleVariableActionSelect = (varName: string, actionKey: string | number) => {
    if (props.disabled) return

    const action = String(actionKey) as VariableActionKey

    switch (action) {
        case 'generate':
            emit('generate-values', varName)
            break
        case 'rename':
            beginVariableNameEdit(varName)
            break
        case 'save-global':
            handleSaveToGlobal(varName)
            break
        case 'delete':
            handleDeleteVariable(varName)
            if (fullscreenEditorVariableName.value === varName) {
                showValueFullscreenEditor.value = false
            }
            if (editingVariableName.value === varName) {
                cancelVariableNameEdit()
            }
            break
    }
}

const showClearAllConfirm = () => {
    dialog.warning({
        title: t('common.warning'),
        content: t('test.variables.clearAllConfirm', { count: displayVariables.value.length }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: () => {
            cancelVariableNameEdit()
            handleClearAllVariables()
        },
    })
}

const handleHeaderActionSelect = (actionKey: string | number) => {
    const action = String(actionKey) as HeaderActionKey
    if (props.disabled || displayVariables.value.length === 0) return
    if (action === 'generate-values' && props.compact && props.showGenerateValues && !props.isGenerating) {
        emit('generate-values')
    } else if (action === 'clear-all') {
        showClearAllConfirm()
    }
}

const openValueFullscreenEditor = (varName: string) => {
    fullscreenEditorVariableName.value = varName
    fullscreenEditorValue.value = getVariableDisplayValue(varName)
    showValueFullscreenEditor.value = true
}

const handleFullscreenValueChange = (value: string) => {
    fullscreenEditorValue.value = value
    if (!fullscreenEditorVariableName.value) return
    handleVariableValueChange(fullscreenEditorVariableName.value, value)
}

watch(showValueFullscreenEditor, (visible) => {
    if (visible) return
    fullscreenEditorVariableName.value = ''
    fullscreenEditorValue.value = ''
})

watch(displayVariables, (variableNames) => {
    if (
        editingVariableName.value &&
        !variableNames.includes(editingVariableName.value)
    ) {
        cancelVariableNameEdit()
    }

    if (
        fullscreenEditorVariableName.value &&
        !variableNames.includes(fullscreenEditorVariableName.value)
    ) {
        showValueFullscreenEditor.value = false
    }
})
</script>
