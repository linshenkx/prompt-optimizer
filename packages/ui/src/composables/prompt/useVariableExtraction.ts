/**
 * 变量提取服务 Composable
 *
 * 提供 AI 智能变量提取功能的响应式接口
 */

import { ref, getCurrentScope, onScopeDispose, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { formatErrorSummary } from '../../utils/error'
import type { AppServices } from '../../types/services'
import { VARIABLE_VALIDATION, isValidVariableName } from '../../types/variable'
import type {
  VariableExtractionResponse,
  ExtractedVariable,
} from '@prompt-optimizer/core'

/**
 * 变量提取 Composable 返回类型
 */
export interface UseVariableExtractionReturn {
  /** 是否正在提取 */
  isExtracting: Ref<boolean>
  /** 提取结果 */
  extractionResult: Ref<VariableExtractionResponse | null>
  /** 是否显示结果对话框 */
  showResultDialog: Ref<boolean>
  /** 提取变量方法 */
  extractVariables: (
    promptContent: string,
    extractionModelKey: string,
    existingVariableNames?: string[]
  ) => Promise<void>
  /** 批量创建变量方法 */
  confirmBatchCreate: (selectedVariables: ExtractedVariable[]) => void
}

/**
 * 使用变量提取功能
 *
 * @param services - 应用服务
 * @param onVariableCreated - 变量创建回调
 * @param onPromptReplaced - 提示词替换回调（返回替换后的提示词）
 * @returns 变量提取相关状态和方法
 */
export function useVariableExtraction(
  services: Ref<AppServices | null>,
  onVariableCreated?: (name: string, value: string) => void,
  onPromptReplaced?: (replacedPrompt: string) => void,
  context: {
    getCurrentPrompt?: () => string
    getExistingVariableNames?: () => string[]
  } = {},
): UseVariableExtractionReturn {
  const toast = useToast()
  const { t } = useI18n()

  // 状态
  const isExtracting = ref(false)
  const extractionResult = ref<VariableExtractionResponse | null>(null)
  const showResultDialog = ref(false)
  // 保存原始提示词内容用于替换
  const originalPrompt = ref('')
  let disposed = false
  if (getCurrentScope()) onScopeDispose(() => { disposed = true })

  const promptChanged = () => context.getCurrentPrompt
    && context.getCurrentPrompt() !== originalPrompt.value
  const discardStaleResult = () => {
    showResultDialog.value = false
    extractionResult.value = null
    toast.warning(t('evaluation.variableExtraction.staleResult'))
  }

  /**
   * 提取变量
   */
  const extractVariables = async (
    promptContent: string,
    extractionModelKey: string,
    existingVariableNames: string[] = []
  ): Promise<void> => {
    if (disposed || isExtracting.value || showResultDialog.value) return
    if (!promptContent.trim()) {
      toast.warning(t('evaluation.variableExtraction.noPromptContent'))
      return
    }
    if (!extractionModelKey) {
      toast.warning(t('evaluation.variableExtraction.noEvaluationModel'))
      return
    }
    if (!services.value) {
      toast.error(t('evaluation.error.serviceNotReady'))
      return
    }

    // 🔧 检查变量提取服务是否存在
    if (!services.value.variableExtractionService) {
      toast.error(t('evaluation.variableExtraction.serviceNotReady'))
      return
    }

    isExtracting.value = true
    extractionResult.value = null
    // 保存原始提示词用于后续替换
    originalPrompt.value = promptContent

    try {
      const result = await services.value.variableExtractionService.extract({
        promptContent,
        extractionModelKey,
        existingVariableNames,
      })

      if (disposed) return
      if (promptChanged()) {
        discardStaleResult()
        return
      }
      extractionResult.value = result

      if (result.variables.length > 0) {
        showResultDialog.value = true
      } else {
        toast.info(t('evaluation.variableExtraction.noVariables'))
      }
    } catch (error) {
      if (disposed) return
      toast.error(formatErrorSummary(t('evaluation.variableExtraction.extractFailed'), error))
      console.error('[useVariableExtraction] Extract failed:', error)
    } finally {
      isExtracting.value = false
    }
  }

  /**
   * 将提示词中的变量值替换为 {{变量名}} 格式
   */
  const replaceVariablesInPrompt = (
    prompt: string,
    variables: ExtractedVariable[]
  ): string => {
    let result = prompt

    // 按出现位置从后往前排序，避免替换时位置错乱
    const sortedVariables = [...variables].sort((a, b) => {
      const indexA = findOccurrenceIndex(prompt, a.position.originalText, a.position.occurrence)
      const indexB = findOccurrenceIndex(prompt, b.position.originalText, b.position.occurrence)
      return indexB - indexA
    })

    // 从后往前替换
    for (const variable of sortedVariables) {
      const { originalText, occurrence } = variable.position
      const placeholder = `{{${variable.name}}}`

      // 查找第 N 次出现的位置
      const index = findOccurrenceIndex(result, originalText, occurrence)
      if (index !== -1) {
        result =
          result.substring(0, index) +
          placeholder +
          result.substring(index + originalText.length)
      }
    }

    return result
  }

  /**
   * 查找文本第 N 次出现的索引位置
   */
  const findOccurrenceIndex = (
    text: string,
    searchText: string,
    occurrence: number
  ): number => {
    let count = 0
    let index = -1

    while (count < occurrence) {
      index = text.indexOf(searchText, index + 1)
      if (index === -1) {
        return -1
      }
      count++
    }

    return index
  }

  /**
   * 批量创建变量
   */
  const confirmBatchCreate = (selectedVariables: ExtractedVariable[]): void => {
    if (disposed || !showResultDialog.value || !extractionResult.value) return
    const existing = new Set(context.getExistingVariableNames?.().map(name => name.trim().toLowerCase()))
    if (promptChanged() || selectedVariables.some(variable => existing.has(variable.name.trim().toLowerCase()))) {
      discardStaleResult()
      return
    }
    // 🔧 校验变量名合法性，过滤掉不合法的变量
    const validVariables: ExtractedVariable[] = []
    const invalidVariables: string[] = []

    for (const variable of selectedVariables) {
      if (isValidVariableName(variable.name)) {
        validVariables.push(variable)
      } else {
        invalidVariables.push(variable.name)
      }
    }

    // 如果有不合法的变量名，提示用户
    if (invalidVariables.length > 0) {
      toast.warning(
        t('evaluation.variableExtraction.invalidVariableNames', {
          names: invalidVariables.join(', '),
          max: VARIABLE_VALIDATION.MAX_NAME_LENGTH,
        })
      )
    }

    // 如果没有合法的变量，直接返回
    if (validVariables.length === 0) {
      showResultDialog.value = false
      return
    }

    const createdVariables: ExtractedVariable[] = []

    // 创建变量（只创建合法的变量）
    for (const variable of validVariables) {
      try {
        if (onVariableCreated) {
          onVariableCreated(variable.name, variable.value)
          createdVariables.push(variable)
        }
      } catch (error) {
        console.error(`[useVariableExtraction] Failed to create variable ${variable.name}:`, error)
      }
    }

    // 替换提示词中的变量值为 {{变量名}}（只替换合法的变量）
    if (createdVariables.length > 0 && onPromptReplaced && originalPrompt.value) {
      const replacedPrompt = replaceVariablesInPrompt(originalPrompt.value, createdVariables)
      onPromptReplaced(replacedPrompt)
    }

    showResultDialog.value = false

    if (createdVariables.length > 0) {
      toast.success(t('evaluation.variableExtraction.createSuccess', { count: createdVariables.length }))
    }
  }

  return {
    isExtracting,
    extractionResult,
    showResultDialog,
    extractVariables,
    confirmBatchCreate,
  }
}
