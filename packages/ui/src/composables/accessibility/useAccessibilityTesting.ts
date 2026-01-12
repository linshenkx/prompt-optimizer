import { ref, computed } from 'vue'

export interface TestRuleResult {
  passed: boolean
  message?: string
  suggestion?: string
}

export interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info'
  rule: string
  element: HTMLElement
  message: string
  suggestion: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  wcagLevel: 'A' | 'AA' | 'AAA'
  xpath?: string
}

export interface AccessibilityTestResult {
  passed: boolean
  score: number
  issues: AccessibilityIssue[]
  summary: {
    total: number
    errors: number
    warnings: number
    info: number
    byLevel: Record<string, number>
  }
  performance: {
    startTime: number
    endTime: number
    duration: number
  }
}

export interface TestOptions {
  /** 测试范围 */
  scope?: HTMLElement | string
  /** 包含的规则 */
  includeRules?: string[]
  /** 排除的规则 */
  excludeRules?: string[]
  /** WCAG级别 */
  wcagLevel?: 'A' | 'AA' | 'AAA'
  /** 是否包含性能测试 */
  includePerformance?: boolean
}

export function useAccessibilityTesting() {
  const testResults = ref<AccessibilityTestResult | null>(null)
  const isRunning = ref(false)
  const lastTestTime = ref<number | null>(null)
  
  // 测试规则定义
  const testRules = {
    // 图片替代文本
    'img-alt': {
      name: '图片替代文本',
      wcagLevel: 'A' as const,
      severity: 'critical' as const,
      test: (element: HTMLImageElement) => {
        if (!element.alt && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
          return {
            passed: false,
            message: '图片缺少替代文本',
            suggestion: '为图片添加 alt 属性或 aria-label 属性'
          }
        }
        return { passed: true }
      }
    },
    
    // 表单标签
    'form-label': {
      name: '表单标签',
      wcagLevel: 'A' as const,
      severity: 'critical' as const,
      test: (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
        const hasLabel = element.labels && element.labels.length > 0
        const hasAriaLabel = element.getAttribute('aria-label')
        const hasAriaLabelledby = element.getAttribute('aria-labelledby')
        
        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
          return {
            passed: false,
            message: '表单控件缺少标签',
            suggestion: '为表单控件添加 <label> 元素或 aria-label 属性'
          }
        }
        return { passed: true }
      }
    },
    
    // 链接文本
    'link-text': {
      name: '链接文本',
      wcagLevel: 'A' as const,
      severity: 'serious' as const,
      test: (element: HTMLAnchorElement) => {
        const text = element.textContent?.trim()
        const ariaLabel = element.getAttribute('aria-label')
        const title = element.getAttribute('title')
        
        if (!text && !ariaLabel && !title) {
          return {
            passed: false,
            message: '链接缺少描述文本',
            suggestion: '为链接添加描述性文本或 aria-label 属性'
          }
        }
        
        // 检查无意义的链接文本
        const meaninglessText = ['click here', 'read more', 'more', 'link', '点击这里', '更多', '链接']
        if (text && meaninglessText.includes(text.toLowerCase())) {
          return {
            passed: false,
            message: '链接文本不够描述性',
            suggestion: '使用更具描述性的链接文本，说明链接的目的或目标'
          }
        }
        
        return { passed: true }
      }
    },
    
    // 按钮文本
    'button-text': {
      name: '按钮文本',
      wcagLevel: 'A' as const,
      severity: 'critical' as const,
      test: (element: HTMLButtonElement) => {
        const text = element.textContent?.trim()
        const ariaLabel = element.getAttribute('aria-label')
        const ariaLabelledby = element.getAttribute('aria-labelledby')
        
        if (!text && !ariaLabel && !ariaLabelledby) {
          return {
            passed: false,
            message: '按钮缺少文本标签',
            suggestion: '为按钮添加文本内容或 aria-label 属性'
          }
        }
        return { passed: true }
      }
    },
    
    // 颜色对比度
    'color-contrast': {
      name: '颜色对比度',
      wcagLevel: 'AA' as const,
      severity: 'serious' as const,
      test: (element: HTMLElement) => {
        const style = window.getComputedStyle(element)
        const fontSize = parseFloat(style.fontSize)
        const fontWeight = style.fontWeight
        
        // 简化的对比度检查（实际应用需要更复杂的算法）
        const backgroundColor = style.backgroundColor
        const color = style.color
        
        // 如果是透明或继承的颜色，跳过检查
        if (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)' ||
            color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
          return { passed: true }
        }
        
        // 这里应该实现真正的对比度计算
        // 现在只是一个占位符
        return { passed: true }
      }
    },
    
    // 焦点指示器
    'focus-indicator': {
      name: '焦点指示器',
      wcagLevel: 'AA' as const,
      severity: 'serious' as const,
      test: (element: HTMLElement) => {
        if (!element.matches(':focusable')) return { passed: true }
        
        const style = window.getComputedStyle(element, ':focus-visible')
        const outline = style.outline
        const boxShadow = style.boxShadow
        
        if (outline === 'none' && !boxShadow.includes('0 0 0')) {
          return {
            passed: false,
            message: '可焦点元素缺少焦点指示器',
            suggestion: '为可焦点元素添加 :focus-visible 样式'
          }
        }
        
        return { passed: true }
      }
    },
    
    // 标题层级
    'heading-hierarchy': {
      name: '标题层级',
      wcagLevel: 'A' as const,
      severity: 'moderate' as const,
      test: (element: HTMLHeadingElement, context: { lastHeadingLevel?: number }) => {
        const level = parseInt(element.tagName.charAt(1))
        
        if (context.lastHeadingLevel && level > context.lastHeadingLevel + 1) {
          return {
            passed: false,
            message: '标题层级跳跃过大',
            suggestion: '确保标题层级是递进的，不要跳过级别'
          }
        }
        
        context.lastHeadingLevel = level
        return { passed: true }
      }
    },
    
    // 语言属性
    'lang-attribute': {
      name: '语言属性',
      wcagLevel: 'A' as const,
      severity: 'moderate' as const,
      test: (element: HTMLHtmlElement) => {
        const lang = element.getAttribute('lang')
        
        if (!lang) {
          return {
            passed: false,
            message: 'HTML 元素缺少 lang 属性',
            suggestion: '为 <html> 元素添加 lang 属性，如 lang="zh-CN"'
          }
        }
        
        return { passed: true }
      }
    },
    
    // ARIA 使用
    'aria-usage': {
      name: 'ARIA 使用',
      wcagLevel: 'A' as const,
      severity: 'serious' as const,
      test: (element: HTMLElement) => {
        const ariaAttributes = Array.from(element.attributes)
          .filter(attr => attr.name.startsWith('aria-'))
        
        if (ariaAttributes.length === 0) return { passed: true }
        
        // 检查常见的 ARIA 错误
        const ariaLabel = element.getAttribute('aria-label')
        const ariaLabelledby = element.getAttribute('aria-labelledby')
        
        if (ariaLabelledby) {
          const labelElement = document.getElementById(ariaLabelledby)
          if (!labelElement) {
            return {
              passed: false,
              message: 'aria-labelledby 引用的元素不存在',
              suggestion: '确保 aria-labelledby 引用的 ID 对应的元素存在'
            }
          }
        }
        
        return { passed: true }
      }
    }
  }
  
  // 获取元素的XPath
  const getElementXPath = (element: HTMLElement): string => {
    if (element.id !== '') {
      return `//*[@id="${element.id}"]`
    }
    
    if (element === document.body) {
      return '/html/body'
    }
    
    const siblings = Array.from(element.parentNode?.children || [])
    const index = siblings.indexOf(element) + 1
    const tagName = element.tagName.toLowerCase()
    
    return `${getElementXPath(element.parentElement!)}/${tagName}[${index}]`
  }
  
  // 运行单个测试规则
  const runRule = (
    rule: typeof testRules[keyof typeof testRules],
    elements: HTMLElement[],
    context: Record<string, unknown> = {}
  ): AccessibilityIssue[] => {
    const issues: AccessibilityIssue[] = []
    
    elements.forEach(element => {
      try {
        const testFn = rule.test as (el: HTMLElement, ctx: Record<string, unknown>) => TestRuleResult
        const result = testFn(element, context)
        if (!result.passed) {
          const ruleResult = result as TestRuleResult
          issues.push({
            type: rule.severity === 'critical' ? 'error' : rule.severity === 'serious' ? 'warning' : 'info',
            rule: rule.name,
            element,
            message: ruleResult.message || '无障碍测试失败',
            suggestion: ruleResult.suggestion || '请检查元素的无障碍属性',
            severity: rule.severity,
            wcagLevel: rule.wcagLevel,
            xpath: getElementXPath(element)
          })
        }
      } catch (error) {
        console.warn(`Error running rule ${rule.name}:`, error)
      }
    })
    
    return issues
  }
  
  // 获取测试范围
  const getTestScope = (scope?: HTMLElement | string): HTMLElement => {
    if (!scope) return document.body
    
    if (typeof scope === 'string') {
      const element = document.querySelector(scope) as HTMLElement
      return element || document.body
    }
    
    return scope
  }
  
  // 运行可访问性测试
  const runTest = async (options: TestOptions = {}): Promise<AccessibilityTestResult> => {
    isRunning.value = true
    const startTime = performance.now()
    
    try {
      const scope = getTestScope(options.scope)
      const issues: AccessibilityIssue[] = []
      const context: Record<string, unknown> = {}
      
      // 选择要运行的规则
      const rulesToRun = Object.entries(testRules).filter(([ruleName, rule]) => {
        if (options.includeRules && !options.includeRules.includes(ruleName)) return false
        if (options.excludeRules && options.excludeRules.includes(ruleName)) return false
        if (options.wcagLevel) {
          const levels = ['A', 'AA', 'AAA']
          const maxLevel = levels.indexOf(options.wcagLevel)
          const ruleLevel = levels.indexOf(rule.wcagLevel)
          if (ruleLevel > maxLevel) return false
        }
        return true
      })
      
      // 运行测试
      for (const [ruleName, rule] of rulesToRun) {
        let elements: HTMLElement[] = []
        
        switch (ruleName) {
          case 'img-alt':
            elements = Array.from(scope.querySelectorAll('img')) as HTMLElement[]
            break
          case 'form-label':
            elements = Array.from(scope.querySelectorAll('input, textarea, select')) as HTMLElement[]
            break
          case 'link-text':
            elements = Array.from(scope.querySelectorAll('a[href]')) as HTMLElement[]
            break
          case 'button-text':
            elements = Array.from(scope.querySelectorAll('button')) as HTMLElement[]
            break
          case 'color-contrast':
            elements = Array.from(scope.querySelectorAll('*')).filter(el => {
              const text = el.textContent?.trim()
              return text && text.length > 0
            }) as HTMLElement[]
            break
          case 'focus-indicator':
            elements = Array.from(scope.querySelectorAll(
              'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
            )) as HTMLElement[]
            break
          case 'heading-hierarchy':
            elements = Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
            break
          case 'lang-attribute':
            elements = [document.documentElement] as HTMLElement[]
            break
          case 'aria-usage':
            elements = Array.from(scope.querySelectorAll('[aria-label], [aria-labelledby], [role]')) as HTMLElement[]
            break
          default:
            elements = [scope]
        }
        
        const ruleIssues = runRule(rule, elements, context)
        issues.push(...ruleIssues)
      }
      
      const endTime = performance.now()
      
      // 生成测试报告
      const summary = {
        total: issues.length,
        errors: issues.filter(i => i.type === 'error').length,
        warnings: issues.filter(i => i.type === 'warning').length,
        info: issues.filter(i => i.type === 'info').length,
        byLevel: {
          A: issues.filter(i => i.wcagLevel === 'A').length,
          AA: issues.filter(i => i.wcagLevel === 'AA').length,
          AAA: issues.filter(i => i.wcagLevel === 'AAA').length
        }
      }
      
      // 计算分数（100分制）
      const maxPoints = 100
      const errorDeduction = summary.errors * 20
      const warningDeduction = summary.warnings * 10
      const infoDeduction = summary.info * 2
      
      const score = Math.max(0, maxPoints - errorDeduction - warningDeduction - infoDeduction)
      
      const result: AccessibilityTestResult = {
        passed: summary.errors === 0,
        score,
        issues,
        summary,
        performance: {
          startTime,
          endTime,
          duration: endTime - startTime
        }
      }
      
      testResults.value = result
      lastTestTime.value = Date.now()
      
      return result
      
    } finally {
      isRunning.value = false
    }
  }
  
  // 生成测试报告
  const generateReport = (result?: AccessibilityTestResult) => {
    const data = result || testResults.value
    if (!data) return null
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: data.passed,
        score: data.score,
        issues: data.summary
      },
      details: data.issues.map(issue => ({
        type: issue.type,
        rule: issue.rule,
        message: issue.message,
        suggestion: issue.suggestion,
        severity: issue.severity,
        wcagLevel: issue.wcagLevel,
        xpath: issue.xpath
      })),
      performance: data.performance
    }
    
    return report
  }
  
  // 导出报告
  const exportReport = (format: 'json' | 'csv' | 'html' = 'json') => {
    const report = generateReport()
    if (!report) return null
    
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2)
        
      case 'csv': {
        const headers = ['Type', 'Rule', 'Message', 'Suggestion', 'Severity', 'WCAG Level', 'XPath']
        const rows = report.details.map(issue => [
          issue.type,
          issue.rule,
          issue.message,
          issue.suggestion,
          issue.severity,
          issue.wcagLevel,
          issue.xpath || ''
        ])

        return [headers, ...rows].map(row =>
          row.map(cell => `"${cell?.toString().replace(/"/g, '""') || ''}"`).join(',')
        ).join('\n')
      }

      case 'html': {
        return `
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head>
            <meta charset="UTF-8">
            <title>可访问性测试报告</title>
            <style>
              body { font-family: sans-serif; margin: 20px; }
              .score { font-size: 24px; font-weight: bold; margin: 20px 0; }
              .score.passed { color: green; }
              .score.failed { color: red; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .error { color: red; }
              .warning { color: orange; }
              .info { color: blue; }
            </style>
          </head>
          <body>
            <h1>可访问性测试报告</h1>
            <p>测试时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}</p>
            <div class="score ${report.summary.passed ? 'passed' : 'failed'}">
              测试分数: ${report.summary.score}/100 ${report.summary.passed ? '(通过)' : '(未通过)'}
            </div>
            <h2>问题汇总</h2>
            <p>总计: ${report.summary.issues.total} | 错误: ${report.summary.issues.errors} | 警告: ${report.summary.issues.warnings} | 信息: ${report.summary.issues.info}</p>
            <h2>问题详情</h2>
            <table>
              <tr>
                <th>类型</th>
                <th>规则</th>
                <th>消息</th>
                <th>建议</th>
                <th>严重程度</th>
                <th>WCAG级别</th>
              </tr>
              ${report.details.map(issue => `
                <tr>
                  <td class="${issue.type}">${issue.type}</td>
                  <td>${issue.rule}</td>
                  <td>${issue.message}</td>
                  <td>${issue.suggestion}</td>
                  <td>${issue.severity}</td>
                  <td>${issue.wcagLevel}</td>
                </tr>
              `).join('')}
            </table>
          </body>
          </html>
        `
      }
    }
  }
  
  // 计算属性
  const hasResults = computed(() => testResults.value !== null)
  const lastScore = computed(() => testResults.value?.score || 0)
  const lastPassed = computed(() => testResults.value?.passed || false)
  
  return {
    // 状态
    testResults,
    isRunning,
    lastTestTime,
    hasResults,
    lastScore,
    lastPassed,
    
    // 方法
    runTest,
    generateReport,
    exportReport
  }
}
