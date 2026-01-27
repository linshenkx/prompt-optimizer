<template>
  <NModal
    v-model:show="isVisible"
    preset="dialog"
    :title="t('variableExtraction.dialogTitle')"
    :positive-text="t('common.confirm')"
    :negative-text="t('common.cancel')"
    :on-positive-click="handleConfirm"
    :on-negative-click="handleCancel"
    :mask-closable="false"
  >
    <NSpace vertical :size="16" style="margin-top: 16px;">
      <!-- 变量名输入 -->
      <NFormItem
        :label="t('variableExtraction.variableName')"
        :validation-status="validationStatus"
        :feedback="validationMessage"
      >
        <NInput
          v-model:value="variableName"
          :placeholder="t('variableExtraction.variableNamePlaceholder')"
          @input="handleVariableNameInput"
          @keyup.enter="handleConfirm"
        />
      </NFormItem>

      <!-- 变量值显示 (只读) -->
      <NFormItem :label="t('variableExtraction.variableValue')">
        <NInput
          :value="variableValue"
          readonly
          :placeholder="t('variableExtraction.variableValuePlaceholder')"
        />
      </NFormItem>

      <!-- 变量类型选择 -->
      <NFormItem :label="t('variableExtraction.variableType')">
        <NRadioGroup v-model:value="variableType">
          <NSpace vertical>
            <NRadio value="temporary">
              <span>{{ t('variableExtraction.temporaryVariable') }}</span>
              <NText depth="3" :style="{ marginLeft: '8px', fontSize: '12px' }">
                {{ t('variableExtraction.temporaryVariableDesc') }}
              </NText>
            </NRadio>
            <NRadio value="global">
              <span>{{ t('variableExtraction.globalVariable') }}</span>
              <NText depth="3" :style="{ marginLeft: '8px', fontSize: '12px' }">
                {{ t('variableExtraction.globalVariableDesc') }}
              </NText>
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NFormItem>

      <!-- 全部替换选项 (仅当检测到多个匹配时显示) -->
      <NFormItem v-if="occurrenceCount > 1">
        <NCheckbox v-model:checked="replaceAll">
          {{ t('variableExtraction.replaceAll', { count: occurrenceCount }) }}
          <NText depth="3" :style="{ marginLeft: '4px' }">
            {{ t('variableExtraction.replaceAllRecommended') }}
          </NText>
        </NCheckbox>
      </NFormItem>
    </NSpace>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import {
  NModal,
  NSpace,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadio,
  NCheckbox,
  NText
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useToast } from '../../composables/ui/useToast'
import { VARIABLE_VALIDATION } from '../../types/variable'

/**
 * 变量提取对话框组件
 *
 * 功能：
 * 1. 允许用户为选中的文本创建变量
 * 2. 支持全局变量和临时变量两种类型
 * 3. 验证变量名合法性
 * 4. 支持批量替换多个相同文本
 */

// Props 定义
interface Props {
  /** 对话框显示状态 */
  show: boolean
  /** 选中的文本值 */
  selectedText: string
  /** 已存在的全局变量名列表 */
  existingGlobalVariables?: string[]
  /** 已存在的临时变量名列表 */
  existingTemporaryVariables?: string[]
  /** 系统预定义变量名列表 */
  predefinedVariables?: string[]
  /** 当前文本中该值的出现次数 */
  occurrenceCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  existingGlobalVariables: () => [],
  existingTemporaryVariables: () => [],
  predefinedVariables: () => [],
  occurrenceCount: 1
})

// Emits 定义
interface Emits {
  /** 更新对话框显示状态 */
  (e: 'update:show', value: boolean): void
  /** 确认提取变量 */
  (e: 'confirm', data: {
    variableName: string
    variableValue: string
    variableType: 'global' | 'temporary'
    replaceAll: boolean
  }): void
  /** 取消操作 */
  (e: 'cancel'): void
}

const emit = defineEmits<Emits>()

const { t } = useI18n()
const message = useToast()

// 内部状态
const isVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const variableName = ref('')
const variableValue = ref('')
const variableType = ref<'global' | 'temporary'>('temporary')
const replaceAll = ref(true) // 默认选中"全部替换"

// 变量名验证
const validationStatus = computed<'success' | 'warning' | 'error' | undefined>(() => {
  if (!variableName.value) return undefined

  // 验证规则: 不能包含空白字符或花括号
  if (!VARIABLE_VALIDATION.NAME_PATTERN.test(variableName.value)) {
    return 'error'
  }

  // 验证规则3: 不能与预定义变量重名
  if (props.predefinedVariables.includes(variableName.value)) {
    return 'error'
  }

  // 验证规则4: 不能与已有变量重名
  const allExistingVariables = [
    ...props.existingGlobalVariables,
    ...props.existingTemporaryVariables
  ]
  if (allExistingVariables.includes(variableName.value)) {
    return 'warning'
  }

  return 'success'
})

const validationMessage = computed(() => {
  if (!variableName.value) return ''

  if (!VARIABLE_VALIDATION.NAME_PATTERN.test(variableName.value)) {
    return t('variableExtraction.validation.invalidCharacters')
  }

  if (props.predefinedVariables.includes(variableName.value)) {
    return t('variableExtraction.validation.predefinedVariable')
  }

  const allExistingVariables = [
    ...props.existingGlobalVariables,
    ...props.existingTemporaryVariables
  ]
  if (allExistingVariables.includes(variableName.value)) {
    return t('variableExtraction.validation.duplicateVariable')
  }

  return ''
})

// 监听 props 变化,更新内部状态
watch(() => props.selectedText, (newValue) => {
  variableValue.value = newValue
}, { immediate: true })

watch(() => props.show, (newValue) => {
  if (newValue) {
    // 对话框打开时重置状态
    variableName.value = ''
    variableValue.value = props.selectedText
    variableType.value = 'temporary'
    replaceAll.value = props.occurrenceCount > 1
  }
})

// 处理变量名输入
const handleVariableNameInput = () => {
  // 自动去除空格
  variableName.value = variableName.value.replace(/\s/g, '')
}

// 确认提取
const handleConfirm = () => {
  // 验证变量名
  if (!variableName.value) {
    message.warning(t('variableExtraction.validation.required'))
    return false
  }

  if (validationStatus.value === 'error') {
    message.error(validationMessage.value)
    return false
  }

  // 发射确认事件
  emit('confirm', {
    variableName: variableName.value,
    variableValue: variableValue.value,
    variableType: variableType.value,
    replaceAll: replaceAll.value
  })

  // 关闭对话框
  isVisible.value = false
  return true
}

// 取消操作
const handleCancel = () => {
  emit('cancel')
  isVisible.value = false
}
</script>

<style scoped>
/* 使用 Naive UI 的默认样式,无需自定义 CSS */
</style>
