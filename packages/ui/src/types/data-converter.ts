/**
 * 数据格式转换器接口定义
 */

import type { 
  StandardPromptData, 
  LangFuseTrace, 
  OpenAIRequest, 
  ConversionResult 
} from './standard-prompt'
import type { ConversationMessage } from './variable'

// 基础转换器接口
export interface DataConverter {
  /**
   * 从LangFuse trace数据转换为标准格式
   */
  fromLangFuse(trace: LangFuseTrace): ConversionResult<StandardPromptData>

  /**
   * 从OpenAI请求格式转换为标准格式
   */
  fromOpenAI(request: OpenAIRequest): ConversionResult<StandardPromptData>

  /**
   * 从会话消息格式转换为标准格式
   */
  fromConversationMessages(
    messages: ConversationMessage[], 
    metadata?: unknown
  ): ConversionResult<StandardPromptData>

  /**
   * 从标准格式转换为OpenAI请求格式
   */
  toOpenAI(
    data: StandardPromptData, 
    variables?: Record<string, string>
  ): ConversionResult<OpenAIRequest>

  /**
   * 从标准格式转换为会话消息格式
   */
  toConversationMessages(data: StandardPromptData): ConversionResult<ConversationMessage[]>

  /**
   * 验证数据格式是否有效
   */
  validate(data: unknown, format: 'standard' | 'langfuse' | 'openai' | 'conversation'): ConversionResult<boolean>
}

// 变量提取器接口
export interface VariableExtractor {
  /**
   * 从选中文本提取变量
   */
  extractVariable(
    messageContent: string, 
    selectedText: string, 
    variableName: string,
    startIndex: number,
    endIndex: number
  ): {
    updatedContent: string
    extractedVariable: {
      name: string
      value: string
      startIndex: number
      endIndex: number
    }
  }

  /**
   * 智能建议变量名
   */
  suggestVariableNames(selectedText: string): Array<{
    name: string
    confidence: number
    category: string
    reason: string
  }>

  /**
   * 替换变量为实际值
   */
  replaceVariables(content: string, variables: Record<string, string>): string

  /**
   * 扫描内容中的变量占位符
   */
  scanVariables(content: string): Array<{
    name: string
    placeholder: string
    positions: Array<{start: number, end: number}>
  }>
}

// 数据导入导出接口
export interface DataImportExport {
  /**
   * 从文件导入数据
   */
  importFromFile(file: File): Promise<ConversionResult<StandardPromptData>>

  /**
   * 从剪贴板导入JSON数据
   */
  importFromClipboard(jsonText: string): ConversionResult<StandardPromptData>

  /**
   * 导出为JSON文件
   */
  exportToFile(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template',
    filename?: string
  ): void

  /**
   * 导出到剪贴板
   */
  exportToClipboard(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template'
  ): Promise<boolean>

  /**
   * 自动检测数据格式
   */
  detectFormat(data: unknown): 'standard' | 'langfuse' | 'openai' | 'conversation' | 'unknown'
}

// 模板化相关接口
export interface TemplateProcessor {
  /**
   * 将StandardPromptData转换为模板+变量形式
   */
  toTemplate(data: StandardPromptData): {
    template: StandardPromptData
    variables: Record<string, string>
    variableDefinitions: Array<{
      name: string
      type: 'string' | 'number' | 'boolean' | 'object' | 'array'
      description?: string
      defaultValue?: unknown
      required?: boolean
    }>
  }

  /**
   * 从模板+变量生成完整的StandardPromptData
   */
  fromTemplate(
    template: StandardPromptData, 
    variables: Record<string, string>
  ): StandardPromptData

  /**
   * 验证变量完整性
   */
  validateVariables(
    template: StandardPromptData, 
    variables: Record<string, string>
  ): {
    isValid: boolean
    missingVariables: string[]
    unusedVariables: string[]
  }
}
