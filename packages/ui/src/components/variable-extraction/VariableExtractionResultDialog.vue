<template>
  <NModal
    v-model:show="visible"
    preset="dialog"
    :title="t('evaluation.variableExtraction.dialogTitle')"
    style="width: 800px"
    :positive-text="t('evaluation.variableExtraction.batchCreate', { count: selectedKeys.length })"
    :negative-text="t('common.cancel')"
    :positive-button-props="{ disabled: selectedKeys.length === 0 }"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <!-- 顶部总结 -->
    <NAlert
      v-if="result"
      :type="result.variables.length > 0 ? 'success' : 'warning'"
      :title="result.summary"
      style="margin-bottom: 16px"
    />

    <!-- 变量表格 (支持多选) -->
    <NDataTable
      v-if="result && result.variables.length > 0"
      :columns="columns"
      :data="result.variables"
      :checked-row-keys="selectedKeys"
      :row-key="(row: ExtractedVariable) => row.name"
      @update:checked-row-keys="handleSelectionChange"
      :pagination="result.variables.length > 10 ? { pageSize: 10 } : false"
      max-height="400"
    />

    <!-- 空状态 -->
    <NEmpty
      v-else-if="result && result.variables.length === 0"
      :description="t('evaluation.variableExtraction.noVariables')"
    />

    <!-- 底部统计 -->
    <template v-if="result && result.variables.length > 0" #footer>
      <NSpace justify="space-between" style="width: 100%">
        <NText depth="3">
          {{ t('evaluation.variableExtraction.selected') }}: {{ selectedKeys.length }} / {{ result.variables.length }}
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
  type DataTableColumns,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { ExtractedVariable, VariableExtractionResponse } from '@prompt-optimizer/core'

/**
 * 组件 Props
 */
interface Props {
  /** 是否显示对话框 */
  show: boolean
  /** 提取结果 */
  result: VariableExtractionResponse | null
}

/**
 * 组件 Emits
 */
interface Emits {
  /** 更新显示状态 */
  (event: 'update:show', value: boolean): void
  /** 确认批量创建 */
  (event: 'confirm', variables: ExtractedVariable[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// 双向绑定显示状态
const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

// 选中的变量键（变量名）
const selectedKeys = ref<string[]>([])

// 监听结果变化，自动全选
watch(
  () => props.result,
  (newResult) => {
    if (newResult && newResult.variables.length > 0) {
      // 默认全选所有变量
      selectedKeys.value = newResult.variables.map((v) => v.name)
    } else {
      selectedKeys.value = []
    }
  },
  { immediate: true }
)

// 表格列定义
const columns = computed<DataTableColumns<ExtractedVariable>>(() => [
  {
    type: 'selection',
  },
  {
    title: t('evaluation.variableExtraction.variableName'),
    key: 'name',
    width: 150,
  },
  {
    title: t('evaluation.variableExtraction.variableValue'),
    key: 'value',
    width: 200,
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('evaluation.variableExtraction.reason'),
    key: 'reason',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('evaluation.variableExtraction.category'),
    key: 'category',
    width: 100,
    render: (row: ExtractedVariable) => row.category || '-',
  },
])

// 处理选择变化
const handleSelectionChange = (keys: string[]) => {
  selectedKeys.value = keys
}

// 处理确认
const handleConfirm = () => {
  if (!props.result || selectedKeys.value.length === 0) {
    return
  }

  // 获取选中的变量对象
  const selectedVariables = props.result.variables.filter((v) =>
    selectedKeys.value.includes(v.name)
  )

  emit('confirm', selectedVariables)
}

// 处理取消
const handleCancel = () => {
  visible.value = false
}
</script>
