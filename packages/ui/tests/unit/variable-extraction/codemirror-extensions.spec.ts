import { describe, it, expect, vi } from 'vitest'
import {
  variableHighlighter,
  variableAutocompletion,
  missingVariableTooltip,
  createThemeExtension,
  createVariableCompletionOption,
  type VariableDetectionLabels
} from '../../../src/components/variable-extraction/codemirror-extensions'
import type { DetectedVariable } from '../../../src/components/variable-extraction/useVariableDetection'

describe('codemirror-extensions', () => {
  describe('variableHighlighter', () => {
    it('应该创建高亮装饰器插件', () => {
      const getVariables = vi.fn().mockReturnValue([])
      const plugin = variableHighlighter(getVariables)

      expect(plugin).toBeDefined()
      expect(typeof plugin).toBe('object')
    })

    it('创建插件时不应立即调用 getVariables', () => {
      const mockVariables: DetectedVariable[] = [
        { name: 'var1', source: 'global', value: 'value1', from: 0, to: 8 }
      ]

      const getVariables = vi.fn().mockReturnValue(mockVariables)
      variableHighlighter(getVariables)

      expect(getVariables).not.toHaveBeenCalled()
    })

    it('应该为不同来源的变量创建插件', () => {
      const sources: Array<DetectedVariable['source']> = ['global', 'temporary', 'predefined', 'missing']

      sources.forEach(source => {
        const mockVariables: DetectedVariable[] = [
          { name: 'test', source, value: 'value', from: 0, to: 8 }
        ]

        const getVariables = vi.fn().mockReturnValue(mockVariables)
        const plugin = variableHighlighter(getVariables)

        expect(plugin).toBeDefined()
      })
    })
  })

  describe('variableAutocompletion', () => {
    const mockLabels: VariableDetectionLabels = {
      sourceGlobal: '全局变量',
      sourceTemporary: '临时变量',
      sourcePredefined: '预定义变量',
      missingVariable: '缺失变量',
      addToTemporary: '添加到临时变量',
      emptyValue: '(空)',
      valuePreview: (value: string) => `值: ${value}`
    }

    it('应该创建自动完成扩展', () => {
      const extension = variableAutocompletion({}, {}, {}, mockLabels)

      expect(extension).toBeDefined()
      expect(typeof extension).toBe('object')
    })

    it('应该能处理带有变量的配置', () => {
      const globalVariables = { username: 'John', email: 'john@example.com' }
      const temporaryVariables = { tempVar1: 'temp value 1' }
      const predefinedVariables = { lastOptimizedPrompt: 'system value' }

      const extension = variableAutocompletion(
        globalVariables,
        temporaryVariables,
        predefinedVariables,
        mockLabels
      )

      expect(extension).toBeDefined()
    })

    it('应该处理空变量集合', () => {
      const extension = variableAutocompletion({}, {}, {}, mockLabels)

      expect(extension).toBeDefined()
    })
  })

  describe('createVariableCompletionOption', () => {
    it('应该创建包含正确属性的补全选项', () => {
      const option = createVariableCompletionOption({
        name: 'testVar',
        source: 'global',
        valuePreview: 'preview value',
        boost: 2
      })

      expect(option.label).toBe('testVar')
      expect(option.boost).toBe(2)
      expect((option as any).displayLabel).toBe('testVar: preview value')
      expect((option as any).sourceType).toBe('global')
    })

    it('应该为不同来源设置正确的补全选项', () => {
      const sources: Array<'global' | 'temporary' | 'predefined'> = ['global', 'temporary', 'predefined']

      sources.forEach(source => {
        const option = createVariableCompletionOption({
          name: 'var',
          source,
          valuePreview: 'value',
          boost: 1
        })

        expect(option).toBeDefined()
        expect((option as any).sourceType).toBe(source)
      })
    })

    it('apply 函数应该存在', () => {
      const option = createVariableCompletionOption({
        name: 'testVar',
        source: 'global',
        valuePreview: 'value',
        boost: 1
      })

      expect(option.apply).toBeDefined()
      expect(typeof option.apply).toBe('function')
    })
  })

  describe('missingVariableTooltip', () => {
    const mockLabels: VariableDetectionLabels = {
      sourceGlobal: '全局变量',
      sourceTemporary: '临时变量',
      sourcePredefined: '预定义变量',
      missingVariable: '该变量尚未定义',
      addToTemporary: '添加到临时变量',
      emptyValue: '(空)',
      valuePreview: (value: string) => `值: ${value}`
    }

    it('应该创建悬浮提示扩展', () => {
      const onAddVariable = vi.fn()
      const extension = missingVariableTooltip(onAddVariable, mockLabels)

      expect(extension).toBeDefined()
      expect(typeof extension).toBe('object')
    })

    it('应该接受自定义主题配置', () => {
      const onAddVariable = vi.fn()
      const customTheme = {
        backgroundColor: '#ffffff',
        borderColor: '#cccccc',
        borderRadius: '8px',
        textColor: '#333333',
        primaryColor: '#007bff',
        primaryColorHover: '#0056b3'
      }

      const extension = missingVariableTooltip(onAddVariable, mockLabels, customTheme)

      expect(extension).toBeDefined()
    })

    it('创建扩展时不应调用回调函数', () => {
      const onAddVariable = vi.fn()
      missingVariableTooltip(onAddVariable, mockLabels)

      expect(onAddVariable).not.toHaveBeenCalled()
    })
  })

  describe('createThemeExtension', () => {
    const mockThemeVars = {
      cardColor: '#ffffff',
      textColor1: '#333333',
      textColor3: '#999999',
      primaryColor: '#18a058',
      primaryColorSuppl: '#36ad6a',
      hoverColor: '#f5f5f5'
    }

    it('应该创建主题扩展', () => {
      const extension = createThemeExtension(mockThemeVars)

      expect(extension).toBeDefined()
      expect(typeof extension).toBe('object')
    })

    it('应该使用自定义主题变量', () => {
      const customThemeVars = {
        ...mockThemeVars,
        primaryColor: '#ff0000',
        cardColor: '#000000'
      }

      const extension = createThemeExtension(customThemeVars)

      expect(extension).toBeDefined()
    })
  })

  describe('集成测试', () => {
    it('所有扩展工厂函数应该能够被调用而不抛出错误', () => {
      const mockLabels: VariableDetectionLabels = {
        sourceGlobal: '全局变量',
        sourceTemporary: '临时变量',
        sourcePredefined: '预定义变量',
        missingVariable: '缺失变量',
        addToTemporary: '添加到临时变量',
        emptyValue: '(空)',
        valuePreview: (value: string) => `值: ${value}`
      }

      const mockThemeVars = {
        cardColor: '#ffffff',
        textColor1: '#333333',
        textColor3: '#999999',
        primaryColor: '#18a058',
        primaryColorSuppl: '#36ad6a',
        hoverColor: '#f5f5f5'
      }

      const getVariables = vi.fn().mockReturnValue([])
      const onAddVariable = vi.fn()

      // 验证所有工厂函数都能正常工作
      expect(() => variableHighlighter(getVariables)).not.toThrow()
      expect(() => variableAutocompletion({}, {}, {}, mockLabels)).not.toThrow()
      expect(() => missingVariableTooltip(onAddVariable, mockLabels)).not.toThrow()
      expect(() => createThemeExtension(mockThemeVars)).not.toThrow()
    })
  })
})
