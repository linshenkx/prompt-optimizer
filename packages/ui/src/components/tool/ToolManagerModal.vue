<template>
    <AdaptiveModal
        v-model:show="localVisible"
        preset="card"
        :title="title || t('contextEditor.toolsTab')"
        :style="modalStyle"
        :bordered="false"
        :mask-closable="true"
        @update:show="handleVisibilityChange"
    >
        <!-- 工具列表 -->
        <div class="tools-panel">
            <NEmpty
                v-if="localTools.length === 0"
                :description="t('contextEditor.noTools')"
            >
                <template #icon>
                    <UiSettings :size="48" />
                </template>
                <template #extra>
                    <NButton
                        @click="addTool"
                        size="medium"
                        type="primary"
                        :disabled="disabled"
                    >
                        {{ t('contextEditor.addFirstTool') }}
                    </NButton>
                </template>
            </NEmpty>

            <NList v-else>
                <NListItem
                    v-for="(tool, index) in localTools"
                    :key="`tool-${index}`"
                >
                    <NCard size="small" embedded>
                        <template #header>
                            <NSpace justify="space-between" align="center">
                                <NTag type="primary" size="small">{{
                                    tool.function.name
                                }}</NTag>
                                <NSpace :size="4">
                                    <NButton
                                        @click="editTool(index)"
                                        size="small"
                                        quaternary
                                        circle
                                        :title="t('common.edit')"
                                        :disabled="disabled"
                                    >
                                        <template #icon>
                                            <UiSquarePen :size="14" />
                                        </template>
                                    </NButton>
                                    <NButton
                                        @click="deleteTool(index)"
                                        size="small"
                                        quaternary
                                        circle
                                        type="error"
                                        :title="t('common.delete')"
                                        :disabled="disabled"
                                    >
                                        <template #icon>
                                            <UiTrash2 :size="14" />
                                        </template>
                                    </NButton>
                                </NSpace>
                            </NSpace>
                        </template>

                        <NText depth="3">{{
                            tool.function.description ||
                            t('contextEditor.noDescription')
                        }}</NText>
                        <div class="mt-2">
                            <NTag size="small">{{
                                t('contextEditor.parametersCount', {
                                    count: getParametersCount(tool),
                                })
                            }}</NTag>
                        </div>
                    </NCard>
                </NListItem>
            </NList>

            <!-- 添加工具按钮 -->
            <div v-if="localTools.length > 0" class="mt-4">
                <NCard size="small" embedded dashed>
                    <NSpace justify="center">
                        <NButton
                            @click="addTool"
                            size="medium"
                            dashed
                            type="primary"
                            block
                            :disabled="disabled"
                        >
                            <template #icon>
                                <UiPlus />
                            </template>
                            {{ t('contextEditor.addTool') }}
                        </NButton>
                    </NSpace>
                </NCard>
            </div>
        </div>

        <!-- 底部操作栏 -->
        <template #action>
            <NSpace justify="end">
                <NButton @click="handleCancel" :disabled="loading">
                    {{ t('common.cancel') }}
                </NButton>
                <NButton
                    @click="handleConfirm"
                    type="primary"
                    :loading="loading"
                >
                    {{ t('common.save') }}
                </NButton>
            </NSpace>
        </template>
    </AdaptiveModal>

    <!-- 工具编辑器 -->
    <AdaptiveModal
        v-model:show="showEditor"
        preset="card"
        :title="
            editingIndex !== null
                ? t('contextEditor.editTool')
                : t('contextEditor.addTool')
        "
        style="width: 600px"
    >
        <NSpace vertical>
            <!-- 示例提示 -->
            <NAlert
                v-if="editingIndex === null"
                type="info"
                :title="t('contextEditor.exampleTemplate')"
            >
                {{ t('contextEditor.exampleTemplateDesc') }}
            </NAlert>

            <!-- 基本信息 -->
            <NCard size="small" :title="t('contextEditor.basicInfo')">
                <NSpace vertical v-if="editingTool">
                    <NInput
                        v-model:value="editingTool.function.name"
                        :placeholder="t('contextEditor.toolNamePlaceholder')"
                    />
                    <NInput
                        v-model:value="editingTool.function.description"
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
                    style="font-family: ui-monospace, monospace"
                />
                <NText v-if="jsonError" type="error" class="mt-2">
                    {{ t('contextEditor.invalidJson') }}: {{ jsonError }}
                </NText>
            </NCard>
        </NSpace>

        <template #action>
            <NSpace>
                <NButton @click="closeToolEditor">{{
                    t('common.cancel')
                }}</NButton>
                <NButton
                    @click="useWeatherExample"
                    secondary
                    v-if="editingIndex === null"
                >
                    {{ t('contextEditor.useExample') }}
                </NButton>
                <NButton
                    @click="useEmptyTemplate"
                    secondary
                    v-if="editingIndex === null"
                >
                    {{ t('contextEditor.startEmpty') }}
                </NButton>
                <NButton
                    @click="saveTool"
                    type="primary"
                    :disabled="!isValidTool"
                >
                    {{ t('common.save') }}
                </NButton>
            </NSpace>
        </template>
    </AdaptiveModal>
</template>

<script setup lang="ts">
import { Settings as UiSettings, SquarePen as UiSquarePen, Trash2 as UiTrash2, Plus as UiPlus } from '@lucide/vue'
import AdaptiveModal from '../common/AdaptiveModal.vue'
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {

    NCard,
    NButton,
    NSpace,
    NTag,
    NList,
    NListItem,
    NEmpty,
    NInput,
    NText,
    NAlert,
} from 'naive-ui'
import type { ToolDefinition } from '@prompt-optimizer/core'
import type {
    ToolManagerModalProps,
} from '../../types/components'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'

const { t } = useI18n()
const confirmDialog = useConfirmDialog()

const props = withDefaults(defineProps<ToolManagerModalProps>(), {
    disabled: false,
    readonly: false,
    loading: false,
    size: 'medium',
    width: '800px',
})

const emit = defineEmits<{
    'update:visible': [visible: boolean]
    'update:tools': [tools: ToolDefinition[]]
    toolChange: [
        tools: ToolDefinition[],
        action: 'add' | 'update' | 'delete',
        index: number,
    ]
    confirm: [tools: ToolDefinition[]]
    cancel: []
}>()

const getParametersCount = (tool: ToolDefinition): number => {
    const params = tool.function.parameters
    if (!params || typeof params !== 'object') return 0

    const properties = (params as { properties?: unknown }).properties
    if (!properties || typeof properties !== 'object') return 0

    return Object.keys(properties as Record<string, unknown>).length
}

// 本地状态
const localVisible = ref(props.visible)
const localTools = ref<ToolDefinition[]>([])
const showEditor = ref(false)
const editingIndex = ref<number | null>(null)
const editingTool = ref<ToolDefinition | null>(null)
const parametersJson = ref('')
const jsonError = ref('')

// 样式
const modalStyle = computed(() => ({
    width: props.width,
    maxWidth: '95vw',
}))

// 默认参数
const defaultParametersJson = `{
  "type": "object",
  "properties": {},
  "required": []
}`

const defaultParametersObject = {
    type: 'object',
    properties: {},
    required: [],
}

// 工具模板
const createWeatherToolTemplate = (): ToolDefinition => ({
    type: 'function',
    function: {
        name: 'get_weather',
        description: 'Get current weather information for a specific location',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The location to get weather for',
                },
                unit: {
                    type: 'string',
                    enum: ['celsius', 'fahrenheit'],
                    default: 'celsius',
                },
            },
            required: ['location'],
        },
    },
})

const createEmptyToolTemplate = (): ToolDefinition => ({
    type: 'function',
    function: {
        name: '',
        description: '',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
})

// 工具验证
const isValidTool = computed(() => {
    if (!editingTool.value) return false
    const name = editingTool.value.function?.name?.trim()
    if (!name) return false
    try {
        const parsed = parametersJson.value
            ? JSON.parse(parametersJson.value)
            : defaultParametersObject
        return parsed && typeof parsed === 'object'
    } catch {
        return false
    }
})

// 初始化本地副本
watch(
    () => props.visible,
    (visible) => {
        localVisible.value = visible
        if (visible) {
            localTools.value = JSON.parse(JSON.stringify(props.tools))
        }
    }
)

watch(
    () => props.tools,
    (newTools) => {
        if (props.visible) {
            localTools.value = JSON.parse(JSON.stringify(newTools))
        }
    },
    { deep: true }
)

// 事件处理
const handleVisibilityChange = (visible: boolean) => {
    localVisible.value = visible
    emit('update:visible', visible)
}

const handleConfirm = () => {
    emit('confirm', [...localTools.value])
    emit('update:tools', [...localTools.value])
    emit('update:visible', false)
}

const handleCancel = () => {
    emit('cancel')
    emit('update:visible', false)
}

// 工具管理
const addTool = () => {
    editingIndex.value = null
    editingTool.value = createWeatherToolTemplate()
    syncParametersJsonFromTool(editingTool.value)
    showEditor.value = true
}

const editTool = (index: number) => {
    if (index < 0 || index >= localTools.value.length) return
    editingIndex.value = index
    editingTool.value = JSON.parse(JSON.stringify(localTools.value[index]))
    syncParametersJsonFromTool(editingTool.value)
    showEditor.value = true
}

const deleteTool = async (index: number) => {
    const tool = localTools.value[index]
    const confirmed = await confirmDialog.warning({
        title: t('common.warning'),
        content: t('contextEditor.deleteToolConfirm', {
            name: tool?.function?.name || '',
        }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
    })
    if (!confirmed) return
    localTools.value.splice(index, 1)
    emit('toolChange', [...localTools.value], 'delete', index)
}

const saveTool = () => {
    if (!editingTool.value) return
    try {
        const parsed = parametersJson.value
            ? JSON.parse(parametersJson.value)
            : defaultParametersObject
        editingTool.value.function.parameters = parsed

        if (editingIndex.value !== null) {
            localTools.value[editingIndex.value] = editingTool.value
            emit(
                'toolChange',
                [...localTools.value],
                'update',
                editingIndex.value
            )
        } else {
            localTools.value.push(editingTool.value)
            emit(
                'toolChange',
                [...localTools.value],
                'add',
                localTools.value.length - 1
            )
        }
        closeToolEditor()
    } catch (e) {
        jsonError.value =
            e instanceof Error ? e.message : t('contextEditor.invalidJson')
    }
}

const closeToolEditor = () => {
    showEditor.value = false
    editingIndex.value = null
    editingTool.value = null
    parametersJson.value = ''
    jsonError.value = ''
}

const useWeatherExample = () => {
    editingTool.value = createWeatherToolTemplate()
    syncParametersJsonFromTool(editingTool.value)
}

const useEmptyTemplate = () => {
    editingTool.value = createEmptyToolTemplate()
    syncParametersJsonFromTool(editingTool.value)
}

const syncParametersJsonFromTool = (tool: ToolDefinition | null) => {
    if (!tool) {
        parametersJson.value = ''
        jsonError.value = ''
        return
    }
    try {
        parametersJson.value = JSON.stringify(
            tool.function?.parameters ?? defaultParametersObject,
            null,
            2
        )
        jsonError.value = ''
    } catch (e) {
        jsonError.value =
            e instanceof Error ? e.message : 'JSON stringify error'
    }
}
</script>

<style scoped>
.tools-panel {
    max-height: 60vh;
    overflow-y: auto;
}
</style>
