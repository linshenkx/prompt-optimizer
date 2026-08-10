/**
 * 上下文编辑管理 Composable
 * 整合所有数据转换、变量提取、导入导出功能
 */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { 
  StandardPromptData,
  OpenAIRequest,
  ConversionResult,
  VariableSuggestion,
  ConversationMessage
} from '../../types'
import {
  PromptDataConverter,
  SmartVariableExtractor,
  DataImportExportManager,
  EnhancedTemplateProcessor
} from '../../services'
import { useToast } from '../ui/useToast'

export function useContextEditor() {
  const { t } = useI18n()
  const toast = useToast()
  const unknownErrorFallback = t('contextEditor.feedback.unknownError')
  const formatErrorSummary = (summary: string, error: unknown, fallback = unknownErrorFallback) => {
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : fallback

    if (!detail || detail === fallback || detail === summary || /^\[object .+\]$/.test(detail)) {
      return summary
    }

    return `${summary}: ${detail}`
  }

  const localizeError = (summaryKey: string, detail?: unknown) =>
    formatErrorSummary(t(summaryKey), detail, unknownErrorFallback)

  const getImportFormatLabel = (format: string) => {
    switch (format) {
      case 'langfuse':
        return t('contextEditor.feedback.formatLabels.langfuse')
      case 'openai':
        return t('contextEditor.feedback.formatLabels.openai')
      case 'conversation':
        return t('contextEditor.feedback.formatLabels.conversation')
      case 'standard':
        return t('contextEditor.feedback.formatLabels.conversation')
      default:
        return format.toUpperCase()
    }
  }

  const isOpenAIRequest = (value: unknown): value is OpenAIRequest => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    if (typeof record.model !== 'string') return false
    if (!Array.isArray(record.messages)) return false
    return true
  }
  
  // 服务实例
  const converter = new PromptDataConverter()
  const variableExtractor = new SmartVariableExtractor()
  const importExportManager = new DataImportExportManager()
  const templateProcessor = new EnhancedTemplateProcessor()

  // 响应式状态
  const currentData = ref<StandardPromptData | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 统计信息
  const statistics = computed(() => {
    if (!currentData.value) {
      return {
        messageCount: 0,
        variableCount: 0,
        totalCharacters: 0,
        avgMessageLength: 0
      }
    }

    const messages = currentData.value.messages
    const variables = currentData.value.metadata?.variables || {}
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0)

    return {
      messageCount: messages.length,
      variableCount: Object.keys(variables).length,
      totalCharacters: totalChars,
      avgMessageLength: messages.length > 0 ? Math.round(totalChars / messages.length) : 0
    }
  })

  // 数据转换方法
  const convertFromLangFuse = (langfuseData: unknown): ConversionResult<StandardPromptData> => {
    try {
      isLoading.value = true
      error.value = null
      
      const result = converter.fromLangFuse(langfuseData)
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success(t('contextEditor.feedback.langfuseConverted'))
      } else {
        error.value = localizeError('contextEditor.feedback.conversionFailed', result.error)
        toast.error(error.value)
      }
      
      return result
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.conversionFailed', err)
      error.value = errorMsg
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      isLoading.value = false
    }
  }

  const convertFromOpenAI = (openaiData: unknown): ConversionResult<StandardPromptData> => {
    try {
      isLoading.value = true
      error.value = null
      
      if (!isOpenAIRequest(openaiData)) {
        const errorMsg = t('contextEditor.feedback.invalidOpenAIRequest')
        error.value = errorMsg
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }

      const result = converter.fromOpenAI(openaiData)
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success(t('contextEditor.feedback.openaiConverted'))
      } else {
        error.value = localizeError('contextEditor.feedback.conversionFailed', result.error)
        toast.error(error.value)
      }
      
      return result
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.conversionFailed', err)
      error.value = errorMsg
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      isLoading.value = false
    }
  }

  // 智能导入（自动检测格式）
  const smartImport = (data: unknown): ConversionResult<StandardPromptData> => {
    try {
      isLoading.value = true
      error.value = null
      
      const format = importExportManager.detectFormat(data)
      let result: ConversionResult<StandardPromptData>
      
      switch (format) {
        case 'langfuse':
          result = converter.fromLangFuse(data)
          break
        case 'openai':
          if (!isOpenAIRequest(data)) {
            result = { success: false, error: t('contextEditor.feedback.invalidOpenAIRequest') }
          } else {
            result = converter.fromOpenAI(data)
          }
          break
        case 'conversation':
          result = converter.fromConversationMessages(data as Array<Partial<ConversationMessage>>)
          break
        case 'standard': {
          const validation = converter.validate(data, 'standard')
          result = validation.success
            ? { success: true, data: data as StandardPromptData }
            : { success: false, error: validation.error }
          break
        }
        default:
          result = {
            success: false,
            error: t('contextEditor.feedback.unsupportedDataFormat', { format })
          }
      }

      if (result.success && result.data) {
        currentData.value = result.data
        toast.success(t('contextEditor.feedback.importSuccess', { format: getImportFormatLabel(format) }))
      } else {
        error.value = localizeError('contextEditor.feedback.importFailed', result.error)
        toast.error(error.value)
      }
      
      return result
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.importFailed', err)
      error.value = errorMsg
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      isLoading.value = false
    }
  }

  // 变量提取方法
  const extractVariable = (
    messageIndex: number,
    selectedText: string,
    variableName: string,
    startIndex: number,
    endIndex: number
  ) => {
    if (!currentData.value) {
      toast.error(t('contextEditor.feedback.noEditableData'))
      return false
    }

    try {
      const result = variableExtractor.extractVariable(
        currentData.value.messages[messageIndex].content,
        selectedText,
        variableName,
        startIndex,
        endIndex
      )

      // 更新消息内容
      currentData.value.messages[messageIndex].content = result.updatedContent

      // 添加变量到metadata
      if (!currentData.value.metadata) {
        currentData.value.metadata = {}
      }
      const metadataRecord = currentData.value.metadata as Record<string, unknown>
      const variables = metadataRecord.variables
      if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
        metadataRecord.variables = {}
      }
      (metadataRecord.variables as Record<string, string>)[variableName] = result.extractedVariable.value

      toast.success(t('contextEditor.feedback.variableExtracted', { name: variableName }))
      return true
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.variableExtractionFailed', err)
      toast.error(errorMsg)
      return false
    }
  }

  // 智能变量建议
  const coerceVariableCategory = (value: string): VariableSuggestion['category'] => {
    const allowed: VariableSuggestion['category'][] = ['database', 'examples', 'rules', 'context', 'input', 'output', 'custom']
    return allowed.includes(value as VariableSuggestion['category']) ? (value as VariableSuggestion['category']) : 'custom'
  }

  const suggestVariableNames = (selectedText: string): VariableSuggestion[] => {
    try {
      return variableExtractor.suggestVariableNames(selectedText).map(suggestion => ({
        name: suggestion.name,
        confidence: suggestion.confidence,
        category: coerceVariableCategory(suggestion.category),
        description: suggestion.reason
      }))
    } catch (err) {
      console.error('Failed to generate variable suggestions:', err)
      return []
    }
  }

  // 模板化处理
  const convertToTemplate = () => {
    if (!currentData.value) {
      toast.error(t('contextEditor.feedback.noDataToProcess'))
      return null
    }

    try {
      const result = templateProcessor.toTemplate(currentData.value)
      toast.success(t('contextEditor.feedback.templateConverted'))
      return result
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.templateConversionFailed', err)
      toast.error(errorMsg)
      return null
    }
  }

  const applyVariablesToTemplate = (
    template: StandardPromptData,
    variables: Record<string, string>
  ) => {
    try {
      const result = templateProcessor.fromTemplate(template, variables)
      currentData.value = result
      toast.success(t('contextEditor.feedback.variablesApplied'))
      return result
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.variableApplicationFailed', err)
      toast.error(errorMsg)
      return null
    }
  }

  const validateTemplateVariables = (
    template: StandardPromptData,
    variables: Record<string, string>
  ) => {
    try {
      return templateProcessor.validateVariables(template, variables)
    } catch (err) {
      console.error('Failed to validate variables:', err)
      return {
        isValid: false,
        missingVariables: [],
        unusedVariables: []
      }
    }
  }

  // 导入导出方法
  const importFromFile = async (file: File) => {
    try {
      isLoading.value = true
      const result = await importExportManager.importFromFile(file)
      
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success(t('contextEditor.feedback.fileImported'))
        return true
      } else {
        error.value = localizeError('contextEditor.feedback.fileImportFailed', result.error)
        toast.error(error.value)
        return false
      }
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.fileImportFailed', err)
      error.value = errorMsg
      toast.error(errorMsg)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const importFromClipboard = (jsonText: string) => {
    try {
      const result = importExportManager.importFromClipboard(jsonText)
      
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success(t('contextEditor.feedback.clipboardImported'))
        return true
      } else {
        error.value = localizeError('contextEditor.feedback.clipboardImportFailed', result.error)
        toast.error(error.value)
        return false
      }
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.clipboardImportFailed', err)
      error.value = errorMsg
      toast.error(errorMsg)
      return false
    }
  }

  const exportToFile = (format: 'standard' | 'openai' | 'template', filename?: string) => {
    if (!currentData.value) {
      toast.error(t('contextEditor.feedback.noDataToExport'))
      return false
    }

    try {
      importExportManager.exportToFile(currentData.value, format, filename)
      toast.success(t('contextEditor.feedback.exportToFileSuccess'))
      return true
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.exportFailed', err)
      toast.error(errorMsg)
      return false
    }
  }

  const exportToClipboard = async (format: 'standard' | 'openai' | 'template') => {
    if (!currentData.value) {
      toast.error(t('contextEditor.feedback.noDataToExport'))
      return false
    }

    try {
      const success = await importExportManager.exportToClipboard(currentData.value, format)
      if (success) {
        toast.success(t('contextEditor.feedback.exportToClipboardSuccess'))
      } else {
        toast.error(t('contextEditor.feedback.copyFailed'))
      }
      return success
    } catch (err) {
      const errorMsg = localizeError('contextEditor.feedback.exportFailed', err)
      toast.error(errorMsg)
      return false
    }
  }

  // 优化建议
  const getOptimizationSuggestions = () => {
    if (!currentData.value) return []
    
    try {
      return templateProcessor.suggestOptimizations(currentData.value)
    } catch (err) {
      console.error('Failed to generate optimization suggestions:', err)
      return []
    }
  }

  // 重置状态
  const reset = () => {
    currentData.value = null
    error.value = null
    isLoading.value = false
  }

  // 设置数据
  const setData = (data: StandardPromptData) => {
    currentData.value = data
    error.value = null
  }

  return {
    // 状态
    currentData,
    isLoading,
    error,
    statistics,

    // 转换方法
    convertFromLangFuse,
    convertFromOpenAI,
    smartImport,

    // 变量操作
    extractVariable,
    suggestVariableNames,

    // 模板处理
    convertToTemplate,
    applyVariablesToTemplate,
    validateTemplateVariables,

    // 导入导出
    importFromFile,
    importFromClipboard,
    exportToFile,
    exportToClipboard,

    // 工具方法
    getOptimizationSuggestions,
    reset,
    setData,

    // 服务实例（供高级用户直接访问）
    services: {
      converter,
      variableExtractor,
      importExportManager,
      templateProcessor
    }
  }
}
