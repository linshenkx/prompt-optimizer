/**
 * 数据导入导出管理器实现
 */

import type { DataImportExport, StandardPromptData, ConversionResult, ConversationMessage, OpenAIRequest } from '../types'
import { PromptDataConverter } from './PromptDataConverter'
import { scanVariableNames } from '../utils/prompt-variables'

export class DataImportExportManager implements DataImportExport {
  private converter = new PromptDataConverter()

  private isOpenAIRequest(value: unknown): value is OpenAIRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    if (typeof record.model !== 'string') return false
    if (!Array.isArray(record.messages)) return false
    return true
  }

  /**
   * 从文件导入数据
   */
  async importFromFile(file: File): Promise<ConversionResult<StandardPromptData>> {
    try {
      if (!file) {
        return {
          success: false,
          error: 'No file provided'
        }
      }

      // 检查文件类型
      if (!file.name.toLowerCase().endsWith('.json')) {
        return {
          success: false,
          error: 'Only JSON files are supported'
        }
      }

      // 读取文件内容
      const text = await this.readFileAsText(file)
      
      // 解析JSON
      let jsonData: unknown
      try {
        jsonData = JSON.parse(text)
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        }
      }

      // 自动检测格式并转换
      return this.importFromParsedData(jsonData)
    } catch (error) {
      return {
        success: false,
        error: `File import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 从剪贴板导入JSON数据
   */
  importFromClipboard(jsonText: string): ConversionResult<StandardPromptData> {
    try {
      if (!jsonText || typeof jsonText !== 'string') {
        return {
          success: false,
          error: 'No text provided'
        }
      }

      // 解析JSON
      let jsonData: unknown
      try {
        jsonData = JSON.parse(jsonText.trim())
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        }
      }

      // 自动检测格式并转换
      return this.importFromParsedData(jsonData)
    } catch (error) {
      return {
        success: false,
        error: `Clipboard import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 导出为JSON文件
   */
  exportToFile(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template',
    filename?: string
  ): void {
    try {
      const exportData = this.prepareExportData(data, format)
      const jsonString = JSON.stringify(exportData, null, 2)
      
      // 生成文件名
      const defaultFilename = this.generateFilename(format)
      const finalFilename = filename || defaultFilename

      // 创建下载链接
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = finalFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 清理URL对象
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export to file failed:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 导出到剪贴板
   */
  async exportToClipboard(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template'
  ): Promise<boolean> {
    try {
      const exportData = this.prepareExportData(data, format)
      const jsonString = JSON.stringify(exportData, null, 2)
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString)
        return true
      } else {
        // 降级方案：使用传统方法
        return this.fallbackCopyToClipboard(jsonString)
      }
    } catch (error) {
      console.error('Export to clipboard failed:', error)
      return false
    }
  }

  /**
   * 自动检测数据格式
   */
  detectFormat(data: unknown): 'langfuse' | 'openai' | 'conversation' | 'unknown' {
    if (!data || typeof data !== 'object') {
      return 'unknown'
    }

    const dataObj = data as Record<string, unknown>

    // 检测LangFuse格式
    if (dataObj.id && dataObj.input && typeof dataObj.input === 'object' &&
        (dataObj.input as Record<string, unknown>).messages) {
      return 'langfuse'
    }

    // 检测OpenAI格式
    if (dataObj.messages && Array.isArray(dataObj.messages) && dataObj.model) {
      return 'openai'
    }

    // 检测会话消息格式
    if (Array.isArray(data) && data.length > 0 &&
        data[0] && typeof data[0] === 'object' &&
        (data[0] as Record<string, unknown>).role &&
        (data[0] as Record<string, unknown>).content) {
      return 'conversation'
    }

    // 检测标准格式
    if (dataObj.messages && Array.isArray(dataObj.messages) &&
        (!dataObj.model || typeof dataObj.model === 'string')) {
      return 'openai' // 当作OpenAI格式处理
    }

    return 'unknown'
  }

  // 私有方法：从解析后的数据导入
  private importFromParsedData(jsonData: unknown): ConversionResult<StandardPromptData> {
    const format = this.detectFormat(jsonData)
    
    switch (format) {
      case 'langfuse':
        return this.converter.fromLangFuse(jsonData as Record<string, unknown>)

      case 'openai':
        if (!this.isOpenAIRequest(jsonData)) {
          return { success: false, error: 'Invalid OpenAI request: missing model/messages' }
        }
        return this.converter.fromOpenAI(jsonData)

      case 'conversation':
        return this.converter.fromConversationMessages(jsonData as Array<Partial<ConversationMessage>>, {
          imported_from: 'file',
          detected_format: 'conversation'
        })

      default:
        return {
          success: false,
          error: `Unknown or unsupported data format. Detected: ${format}`
        }
    }
  }

  // 私有方法：准备导出数据
  private prepareExportData(data: StandardPromptData, format: 'standard' | 'openai' | 'template'): StandardPromptData | Record<string, unknown> {
    switch (format) {
      case 'standard':
        return data

      case 'openai': {
        const openaiResult = this.converter.toOpenAI(data)
        if (!openaiResult.success) {
          throw new Error(openaiResult.error)
        }
        if (!openaiResult.data) {
          throw new Error('Failed to convert to OpenAI format: missing result data')
        }
        return openaiResult.data as unknown as Record<string, unknown>
      }

      case 'template':
        return this.prepareTemplateExport(data)

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  // 私有方法：准备模板导出
  private prepareTemplateExport(data: StandardPromptData): {
    template: StandardPromptData
    variables: Record<string, string>
    export_info: {
      format: 'template'
      exported_at: string
      variable_count: number
    }
  } {
    // 提取变量
    const variables: Record<string, string> = {}
    
    // 扫描所有消息中的变量
    data.messages.forEach(message => {
      const found = scanVariableNames(message.content)
      for (const variableName of found) {
        if (!Object.prototype.hasOwnProperty.call(variables, variableName)) {
          variables[variableName] = `[${variableName}_placeholder]`
        }
      }
    })

    return {
      template: data,
      variables,
      export_info: {
        format: 'template',
        exported_at: new Date().toISOString(),
        variable_count: Object.keys(variables).length
      }
    }
  }

  // 私有方法：生成文件名
  private generateFilename(format: 'standard' | 'openai' | 'template'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const formatPrefix = {
      'standard': 'standard-prompt',
      'openai': 'openai-request', 
      'template': 'prompt-template'
    }[format]
    
    return `${formatPrefix}-${timestamp}.json`
  }

  // 私有方法：读取文件为文本
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('File reading failed'))
      }
      
      reader.readAsText(file, 'utf-8')
    })
  }

  // 私有方法：降级复制到剪贴板
  private fallbackCopyToClipboard(text: string): boolean {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      textarea.style.pointerEvents = 'none'
      
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      
      return success
    } catch {
      return false
    }
  }
}
