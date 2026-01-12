<template>
  <NModal
    v-model:show="visible"
    preset="dialog"
    :title="t('test.variableValueGeneration.dialogTitle')"
    style="width: 900px"
    :positive-text="t('test.variableValueGeneration.batchApply', { count: selectedKeys.length })"
    :negative-text="t('common.cancel')"
    :positive-button-props="{ disabled: selectedKeys.length === 0 }"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <!-- 顶部总结 -->
    <NAlert
      v-if="result"
      :type="result.values.length > 0 ? 'success' : 'warning'"
      :title="result.summary"
      style="margin-bottom: 16px"
    />

    <!-- 变量值表格 (支持编辑) -->
    <NDataTable
      v-if="result && result.values.length > 0"
      :columns="columns"
      :data="editableValues"
      :checked-row-keys="selectedKeys"
      :row-key="(row: EditableVariableValue) => row.name"
      @update:checked-row-keys="handleSelectionChange"
      :pagination="editableValues.length > 10 ? { pageSize: 10 } : false"
      max-height="400"
    />

    <!-- 空状态 -->
    <NEmpty
      v-else-if="result && result.values.length === 0"
      :description="t('test.variableValueGeneration.noValues')"
    />

    <!-- 底部统计 -->
    <template v-if="result && result.values.length > 0" #footer>
      <NSpace justify="space-between" style="width: 100%">
        <NText depth="3">
          {{ t('test.variableValueGeneration.selected') }}: {{ selectedKeys.length }} / {{ editableValues.length }}
        </NText>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import {
  NModal,
  NAlert,
  NDataTable,
  NEmpty,
  NSpace,
  NText,
  NInput,
  NProgress,
  type DataTableColumns,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VariableValueGenerationResponse, GeneratedVariableValue } from '@prompt-optimizer/core'

/**
 * 可编辑的变量值（添加了编辑状态）
 */
interface EditableVariableValue extends GeneratedVariableValue {
  // 继承 name, value, reason, confidence
}

/**
 * 组件 Props
 */
interface Props {
  /** 是否显示对话框 */
  show: boolean
  /** 生成结果 */
  result: VariableValueGenerationResponse | null
}

/**
 * 组件 Emits
 */
interface Emits {
  /** 更新显示状态 */
  (event: 'update:show', value: boolean): void
  /** 确认批量应用 */
  (event: 'confirm', values: GeneratedVariableValue[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// 双向绑定显示状态
const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

// 可编辑的变量值列表（深拷贝）
const editableValues = ref<EditableVariableValue[]>([])

// 选中的变量键（变量名）
const selectedKeys = ref<string[]>([])

// 监听结果变化，初始化可编辑数据
watch(
  () => props.result,
  (newResult) => {
    if (newResult && newResult.values.length > 0) {
      // 深拷贝数据以支持编辑
      editableValues.value = newResult.values.map((v) => ({ ...v }))
      // 默认全选所有变量
      selectedKeys.value = newResult.values.map((v) => v.name)
    } else {
      editableValues.value = []
      selectedKeys.value = []
    }
  },
  { immediate: true }
)

// 表格列定义
const columns = computed<DataTableColumns<EditableVariableValue>>(() => [
  {
    type: 'selection',
  },
  {
    title: t('test.variableValueGeneration.variableName'),
    key: 'name',
    width: 120,
  },
  {
    title: t('test.variableValueGeneration.generatedValue'),
    key: 'value',
    width: 200,
    render: (row: EditableVariableValue) => {
      return h(NInput, {
        value: row.value,
        placeholder: t('test.variableValueGeneration.valuePlaceholder'),
        onUpdateValue: (newValue: string) => {
          row.value = newValue
        },
      })
    },
  },
  {
    title: t('test.variableValueGeneration.reason'),
    key: 'reason',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('test.variableValueGeneration.confidence'),
    key: 'confidence',
    width: 100,
    render: (row: EditableVariableValue) => {
      if (typeof row.confidence === 'number') {
        const percentage = Math.round(row.confidence * 100)
        return h(NProgress, {
          type: 'line',
          percentage,
          indicatorPlacement: 'inside',
          processing: false,
        })
      }
      return '-'
    },
  },
])

// 处理选择变化
const handleSelectionChange = (keys: string[]) => {
  selectedKeys.value = keys
}

// 处理确认
const handleConfirm = () => {
  if (selectedKeys.value.length === 0) {
    return
  }

  // 获取选中的变量值对象
  const selectedValues = editableValues.value.filter((v) =>
    selectedKeys.value.includes(v.name)
  )

  emit('confirm', selectedValues)
}

// 处理取消
const handleCancel = () => {
  visible.value = false
}
</script>
