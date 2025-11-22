/**
 * 测试变量管理 Composable
 *
 * 用于测试面板的变量管理，包含 UI 交互逻辑
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'

interface TestVariable {
  value: string
  timestamp: number
}

export interface TestVariableManagerOptions {
  /** 全局变量（持久化） */
  globalVariables: Ref<Record<string, string>>
  /** 预定义变量（内置） */
  predefinedVariables: Ref<Record<string, string>>
  /** 临时变量（从外部同步） */
  temporaryVariables: Ref<Record<string, string>>
  /** 变量值变化回调 */
  onVariableChange?: (name: string, value: string) => void
  /** 保存到全局回调 */
  onSaveToGlobal?: (name: string, value: string) => void
  /** 删除变量回调 */
  onVariableRemove?: (name: string) => void
  /** 清空所有变量回调 */
  onVariablesClear?: () => void
}

export function useTestVariableManager(options: TestVariableManagerOptions) {
  const { t } = useI18n()
  const message = useMessage()

  // 添加变量对话框状态
  const showAddVariableDialog = ref(false)
  const newVariableName = ref('')
  const newVariableValue = ref('')
  const newVariableNameError = ref('')

  // 内部测试变量（带时间戳）
  const testVariables = ref<Record<string, TestVariable>>({})

  // 监听外部临时变量变化
  watch(
    () => options.temporaryVariables.value,
    (newVars) => {
      const newVarNames = new Set(Object.keys(newVars))
      for (const name of Object.keys(testVariables.value)) {
        if (!newVarNames.has(name)) {
          delete testVariables.value[name]
        }
      }

      for (const [name, value] of Object.entries(newVars)) {
        if (!testVariables.value[name]) {
          testVariables.value[name] = { value, timestamp: Date.now() }
        } else {
          testVariables.value[name].value = value
        }
      }
    },
    { deep: true, immediate: true }
  )

  // 三层变量合并（优先级：全局 < 临时 < 预定义）
  const mergedVariables = computed(() => {
    const testVarsFlat: Record<string, string> = {}
    for (const [name, data] of Object.entries(testVariables.value)) {
      testVarsFlat[name] = data.value
    }

    return {
      ...options.globalVariables.value,
      ...testVarsFlat,
      ...options.predefinedVariables.value,
    }
  })

  // 按时间排序的变量列表
  const sortedVariables = computed(() => {
    return Object.entries(testVariables.value)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map(([name]) => name)
  })

  // 获取变量来源
  const getVariableSource = (varName: string): 'predefined' | 'test' | 'global' | 'empty' => {
    if (options.predefinedVariables.value[varName]) return 'predefined'
    if (testVariables.value[varName]) return 'test'
    if (options.globalVariables.value[varName]) return 'global'
    return 'empty'
  }

  // 获取变量显示值
  const getVariableDisplayValue = (varName: string): string => {
    return mergedVariables.value[varName] || ''
  }

  // 获取变量占位符
  const getVariablePlaceholder = (varName: string): string => {
    if (options.predefinedVariables.value[varName]) {
      return t('test.variables.inputPlaceholder') + ` (${t('variables.source.predefined')})`
    }
    if (options.globalVariables.value[varName]) {
      return t('test.variables.inputPlaceholder') + ` (${t('variables.source.global')})`
    }
    return t('test.variables.inputPlaceholder')
  }

  // 验证变量名
  const validateVariableName = (name: string): string => {
    if (!name) return ''
    if (/^\d/.test(name)) return t('variableExtraction.validation.noNumberStart')
    if (!/^[\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*$/.test(name)) {
      return t('variableExtraction.validation.invalidCharacters')
    }
    if (testVariables.value[name]) return t('variableExtraction.validation.duplicateVariable')
    return ''
  }

  // 验证新变量名
  const validateNewVariableName = () => {
    const name = newVariableName.value.trim()
    newVariableNameError.value = validateVariableName(name)
    return !newVariableNameError.value
  }

  // 变量值变化
  const handleVariableValueChange = (varName: string, value: string) => {
    if (testVariables.value[varName]) {
      testVariables.value[varName].value = value
    } else {
      testVariables.value[varName] = { value, timestamp: Date.now() }
    }
    options.onVariableChange?.(varName, value)
  }

  // 添加变量
  const handleAddVariable = () => {
    if (!validateNewVariableName()) {
      if (!newVariableName.value.trim()) {
        message.warning(t('test.variables.nameRequired'))
      }
      return false
    }

    const name = newVariableName.value.trim()
    handleVariableValueChange(name, newVariableValue.value)
    message.success(t('test.variables.addSuccess'))

    newVariableName.value = ''
    newVariableValue.value = ''
    newVariableNameError.value = ''
    showAddVariableDialog.value = false
    return true
  }

  // 删除变量
  const handleDeleteVariable = (varName: string) => {
    delete testVariables.value[varName]
    options.onVariableRemove?.(varName)
    options.onVariableChange?.(varName, '')
    message.success(t('test.variables.deleteSuccess', { name: varName }))
  }

  // 清空所有变量
  const handleClearAllVariables = () => {
    testVariables.value = {}
    options.onVariablesClear?.()
    message.success(t('test.variables.clearSuccess'))
  }

  // 保存到全局
  const handleSaveToGlobal = (varName: string) => {
    const varData = testVariables.value[varName]
    if (!varData || !varData.value.trim()) {
      message.warning(t('test.variables.emptyValueWarning'))
      return
    }
    options.onSaveToGlobal?.(varName, varData.value)
    message.success(t('test.variables.savedToGlobal'))
  }

  // 获取所有变量值
  const getVariableValues = () => {
    return { ...mergedVariables.value }
  }

  // 设置变量值
  const setVariableValues = (values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) {
      options.onVariableChange?.(name, value)
    }
  }

  return {
    // 状态
    showAddVariableDialog,
    newVariableName,
    newVariableValue,
    newVariableNameError,
    sortedVariables,
    mergedVariables,

    // 方法
    getVariableSource,
    getVariableDisplayValue,
    getVariablePlaceholder,
    validateNewVariableName,
    handleVariableValueChange,
    handleAddVariable,
    handleDeleteVariable,
    handleClearAllVariables,
    handleSaveToGlobal,
    getVariableValues,
    setVariableValues,
  }
}
