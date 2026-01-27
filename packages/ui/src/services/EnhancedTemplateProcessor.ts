/**
 * 增强的模板处理器实现
 */

import type {
  TemplateProcessor,
  StandardPromptData,
  StandardMessage
} from '../types'
import type {
  VariablePrimitiveType,
  VariableDefaultValue,
  VariableDefinition,
  VariableAnalysis,
  VariableUsageStats
} from '../types/template'

export class EnhancedTemplateProcessor implements TemplateProcessor {
  /**
   * 将StandardPromptData转换为模板+变量形式
   */
  toTemplate(data: StandardPromptData): {
    template: StandardPromptData
    variables: Record<string, string>
    variableDefinitions: VariableDefinition[]
  } {
    const variables: Record<string, string> = {}
    const variableDefinitions: VariableDefinition[] = []

    // 从现有metadata中获取变量
    if (data.metadata?.variables) {
      Object.assign(variables, data.metadata.variables)
    }

    // 扫描消息中的所有变量
    const allVariables = new Set<string>()
    const templateMessages: StandardMessage[] = data.messages.map(message => {
      const scannedVars = this.scanVariablesInContent(message.content)
      scannedVars.forEach(varInfo => allVariables.add(varInfo.name))
      
      return {
        ...message,
        content: message.content // 保持原有的变量占位符
      }
    })

    // 为所有发现的变量创建定义
    allVariables.forEach(varName => {
      if (!variables[varName]) {
        variables[varName] = `[${varName}_placeholder]`
      }

      // 分析变量类型和特征
      const varAnalysis = this.analyzeVariable(varName, data.messages)
      variableDefinitions.push({
        name: varName,
        type: varAnalysis.type,
        description: varAnalysis.description,
        defaultValue: varAnalysis.defaultValue,
        required: varAnalysis.required
      })
    })

    const template: StandardPromptData = {
      ...data,
      messages: templateMessages,
      metadata: {
        ...data.metadata,
        template_info: {
          ...data.metadata?.template_info,
          name: data.metadata?.template_info?.name,
          version: data.metadata?.template_info?.version,
          variables: Array.from(allVariables),
          created_at: new Date().toISOString()
        }
      }
    }

    return {
      template,
      variables,
      variableDefinitions
    }
  }

  /**
   * 从模板+变量生成完整的StandardPromptData
   */
  fromTemplate(
    template: StandardPromptData, 
    variables: Record<string, string>
  ): StandardPromptData {
    const processedMessages: StandardMessage[] = template.messages.map(message => ({
      ...message,
      content: this.replaceVariables(message.content, variables)
    }))

    return {
      ...template,
      messages: processedMessages,
      metadata: {
        ...template.metadata,
        source: 'manual',
        variables_applied: variables,
        processed_at: new Date().toISOString()
      }
    }
  }

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
  } {
    const requiredVariables = new Set<string>()
    const providedVariables = new Set(Object.keys(variables))

    // 扫描模板中需要的所有变量
    template.messages.forEach(message => {
      const scannedVars = this.scanVariablesInContent(message.content)
      scannedVars.forEach(varInfo => requiredVariables.add(varInfo.name))
    })

    // 检查缺失的变量
    const missingVariables = Array.from(requiredVariables).filter(
      varName => !providedVariables.has(varName)
    )

    // 检查未使用的变量
    const unusedVariables = Array.from(providedVariables).filter(
      varName => !requiredVariables.has(varName)
    )

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
      unusedVariables
    }
  }

  /**
   * 替换变量为实际值
   */
  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content

    // 支持多种变量格式
    for (const [name, value] of Object.entries(variables)) {
      // 标准格式 {{variableName}}
      const standardPattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(name)}\\s*\\}\\}`, 'g')
      result = result.replace(standardPattern, value)

      // 条件格式（未来扩展）
      // {% if variableName %} ... {% endif %}
      // 循环格式（未来扩展）
      // {% for item in variableName %} ... {% endfor %}
    }

    return result
  }

  /**
   * 扫描内容中的变量占位符
   */
  scanVariablesInContent(content: string): Array<{
    name: string
    placeholder: string
    positions: Array<{start: number, end: number}>
  }> {
    const variables = new Map<string, {
      placeholder: string
      positions: Array<{start: number, end: number}>
    }>()

    // 匹配标准变量格式：允许两侧空格，但变量名内部不允许空白
    const standardPattern = /\{\{\s*([^{}\s]+)\s*\}\}/g
    let match: RegExpExecArray | null

    while ((match = standardPattern.exec(content)) !== null) {
      const fullMatch = match[0]
      const variableName = match[1].trim()
      const start = match.index
      const end = match.index + fullMatch.length

      if (!variables.has(variableName)) {
        variables.set(variableName, {
          placeholder: fullMatch,
          positions: []
        })
      }

      variables.get(variableName)!.positions.push({ start, end })
    }

    // 转换为数组格式
    return Array.from(variables.entries()).map(([name, data]) => ({
      name,
      placeholder: data.placeholder,
      positions: data.positions
    }))
  }

  /**
   * 预览变量替换效果
   */
  previewReplacement(
    content: string, 
    variables: Record<string, string>,
    highlightVariables: boolean = true
  ): {
    original: string
    processed: string
    replacements: Array<{
      variable: string
      originalText: string
      replacedText: string
      positions: Array<{start: number, end: number}>
    }>
  } {
    const replacements: Array<{
      variable: string
      originalText: string
      replacedText: string
      positions: Array<{start: number, end: number}>
    }> = []

    let processed = content

    // 记录替换信息
    for (const [name, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(name)}\\s*\\}\\}`, 'g')
      let match: RegExpExecArray | null

      while ((match = pattern.exec(content)) !== null) {
        replacements.push({
          variable: name,
          originalText: match[0],
          replacedText: value,
          positions: [{ start: match.index, end: match.index + match[0].length }]
        })
      }

      // 执行替换
      processed = processed.replace(pattern, highlightVariables ? `[${value}]` : value)
    }

    return {
      original: content,
      processed,
      replacements
    }
  }

  /**
   * 智能变量建议（基于使用模式）
   */
  suggestOptimizations(template: StandardPromptData): Array<{
    type: 'merge' | 'split' | 'rename' | 'extract'
    description: string
    variables: string[]
    confidence: number
  }> {
    const suggestions: Array<{
      type: 'merge' | 'split' | 'rename' | 'extract'
      description: string
      variables: string[]
      confidence: number
    }> = []

    const variableUsage = this.analyzeVariableUsage(template)

    // 建议合并相似变量
    const similarVariables = this.findSimilarVariables(variableUsage)
    similarVariables.forEach(group => {
      if (group.length > 1) {
        suggestions.push({
          type: 'merge',
          description: `考虑合并相似的变量: ${group.join(', ')}`,
          variables: group,
          confidence: 0.7
        })
      }
    })

    // 建议拆分复杂变量
    Object.entries(variableUsage).forEach(([varName, usage]) => {
      if (usage.avgLength > 1000 && usage.complexity > 0.8) {
        suggestions.push({
          type: 'split',
          description: `变量 ${varName} 内容过于复杂，建议拆分`,
          variables: [varName],
          confidence: 0.8
        })
      }
    })

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  // 私有方法：分析变量特征
  private analyzeVariable(
    varName: string,
    messages: StandardMessage[]
  ): VariableAnalysis {
    // 基于变量名推断类型和用途
    const nameLower = varName.toLowerCase()
    
    let type: VariablePrimitiveType = 'string'
    let description = ''

    if (nameLower.includes('count') || nameLower.includes('number') || nameLower.includes('num')) {
      type = 'number'
      description = '数值型变量'
    } else if (nameLower.includes('is_') || nameLower.includes('has_') || nameLower.includes('enable')) {
      type = 'boolean'
      description = '布尔型变量'
    } else if (nameLower.includes('list') || nameLower.includes('array') || nameLower.includes('items')) {
      type = 'array'
      description = '数组型变量'
    } else if (nameLower.includes('config') || nameLower.includes('settings') || nameLower.includes('data')) {
      type = 'object'
      description = '对象型变量'
    }

    // 检查是否为必需变量（出现在多个消息中）
    let usageCount = 0
    messages.forEach(message => {
      const pattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(varName)}\\s*\\}\\}`, 'g')
      if (pattern.test(message.content)) {
        usageCount++
      }
    })

    return {
      type,
      description: description || `${varName} 变量`,
      defaultValue: this.getDefaultValueForType(type),
      required: usageCount > 1
    }
  }

  // 私有方法：获取类型的默认值
  private getDefaultValueForType(type: VariablePrimitiveType): VariableDefaultValue {
    switch (type) {
      case 'string': return ''
      case 'number': return 0
      case 'boolean': return false
      case 'object': return {}
      case 'array': return []
      default: return ''
    }
  }

  // 私有方法：分析变量使用情况
  private analyzeVariableUsage(template: StandardPromptData): Record<string, VariableUsageStats> {
    const usage: Record<string, VariableUsageStats> = {}

    template.messages.forEach(message => {
      const variables = this.scanVariablesInContent(message.content)
      variables.forEach(varInfo => {
        if (!usage[varInfo.name]) {
          usage[varInfo.name] = {
            count: 0,
            avgLength: 0,
            complexity: 0,
            contexts: []
          }
        }
        
        usage[varInfo.name].count += varInfo.positions.length
        usage[varInfo.name].contexts.push(message.role)
      })
    })

    return usage
  }

  // 私有方法：查找相似变量
  private findSimilarVariables(usage: Record<string, VariableUsageStats>): string[][] {
    const variables = Object.keys(usage)
    const groups: string[][] = []
    
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const similarity = this.calculateSimilarity(variables[i], variables[j])
        if (similarity > 0.7) {
          // 找到或创建组
          const foundGroup = groups.find(group => 
            group.includes(variables[i]) || group.includes(variables[j])
          )
          
          if (foundGroup) {
            if (!foundGroup.includes(variables[i])) foundGroup.push(variables[i])
            if (!foundGroup.includes(variables[j])) foundGroup.push(variables[j])
          } else {
            groups.push([variables[i], variables[j]])
          }
        }
      }
    }
    
    return groups
  }

  // 私有方法：计算变量名相似度
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  // 私有方法：计算编辑距离
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  // 私有方法：转义正则表达式特殊字符
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
