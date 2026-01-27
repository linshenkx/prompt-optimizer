import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useVariableDetection } from '../../../src/components/variable-extraction/useVariableDetection'

const refRecord = (initial: Record<string, string> = {}) => ref<Record<string, string>>(initial)

describe('useVariableDetection', () => {
  describe('基础变量提取功能', () => {
    it('应该提取单个变量', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
      expect(variables[0].from).toBe(6)
      expect(variables[0].to).toBe(14)
    })

    it('应该提取多个变量', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{name}}, you are {{age}} years old'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(2)
      expect(variables[0].name).toBe('name')
      expect(variables[1].name).toBe('age')
    })

    it('应该提取嵌套文本中的变量', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'User: {{user}}\nEmail: {{email}}\nPhone: {{phone}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(3)
      expect(variables.map(v => v.name)).toEqual(['user', 'email', 'phone'])
    })

    it('应该正确处理相同变量的多次出现', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{name}} is {{name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(2)
      expect(variables[0].name).toBe('name')
      expect(variables[1].name).toBe('name')
      expect(variables[0].from).toBe(0)
      expect(variables[1].from).toBe(12)
    })

    it('应该支持 {{ foo }} 这种带空格的占位符', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{ name }}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
      expect(text.substring(variables[0].from, variables[0].to)).toBe('{{ name }}')
    })
  })

  describe('变量分类逻辑', () => {
    it('应该识别全局变量', () => {
      const globalVariables = refRecord({ username: 'John' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{username}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('global')
      expect(variables[0].value).toBe('John')
    })

    it('应该识别临时变量', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord({ tempVar: 'temp value' })
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Test {{tempVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('temporary')
      expect(variables[0].value).toBe('temp value')
    })

    it('应该识别预定义变量', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord({ systemVar: 'system value' })

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'System {{systemVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('predefined')
      expect(variables[0].value).toBe('system value')
    })

    it('应该识别缺失变量', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Missing {{unknownVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('missing')
      expect(variables[0].value).toBe('')
    })

    it('应该按优先级分类变量 (预定义 > 全局 > 临时)', () => {
      const globalVariables = refRecord({ var1: 'global' })
      const temporaryVariables = refRecord({ var1: 'temporary', var2: 'temp' })
      const predefinedVariables = refRecord({ var1: 'predefined', var2: 'predef', var3: 'system' })

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{var1}} {{var2}} {{var3}} {{var4}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('predefined') // var1: 预定义优先
      expect(variables[1].source).toBe('predefined') // var2: 预定义优先
      expect(variables[2].source).toBe('predefined') // var3: 仅预定义
      expect(variables[3].source).toBe('missing')    // var4: 缺失
    })

    it('应该正确处理空值变量', () => {
      const globalVariables = refRecord({ emptyVar: '' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{emptyVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('global')
      expect(variables[0].value).toBe('')
    })
  })

  describe('边界情况处理', () => {
    it('应该处理空字符串', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const variables = extractVariables('')
      expect(variables).toHaveLength(0)
    })

    it('应该处理无变量的文本', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'This is plain text without variables'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(0)
    })

    it('应该忽略不完整的占位符', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{incomplete or {{name}}'
      const variables = extractVariables(text)

      // 只应该提取完整的 {{name}}
      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
    })

    it('应该过滤 Mustache 控制标签', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{#if}} {{name}} {{/if}} {{^else}} {{!comment}} {{>partial}}'
      const variables = extractVariables(text)

      // 只应该提取 {{name}}
      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
    })

    it('应该支持变量名包含连字符', () => {
      const globalVariables = refRecord({ 'user-name': 'John' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{user-name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('user-name')
      expect(variables[0].source).toBe('global')
    })

    it('应该支持变量名包含点号', () => {
      const globalVariables = refRecord({ 'user.email': 'john@example.com' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{user.email}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('user.email')
      expect(variables[0].source).toBe('global')
    })

    it('应该支持变量名包含下划线', () => {
      const globalVariables = refRecord({ user_id: '123' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{user_id}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('user_id')
      expect(variables[0].source).toBe('global')
    })

    it('应该支持 Unicode 字符变量名', () => {
      const globalVariables = refRecord({ '用户名': '张三' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{用户名}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('用户名')
      expect(variables[0].source).toBe('global')
    })
  })

  describe('位置信息准确性', () => {
    it('应该返回正确的 from/to 位置', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Start {{var1}} middle {{var2}} end'
      const variables = extractVariables(text)

      expect(variables[0].from).toBe(6)
      expect(variables[0].to).toBe(14)
      expect(variables[1].from).toBe(22)
      expect(variables[1].to).toBe(30)

      // 验证位置对应的文本
      expect(text.substring(variables[0].from, variables[0].to)).toBe('{{var1}}')
      expect(text.substring(variables[1].from, variables[1].to)).toBe('{{var2}}')
    })

    it('应该为多个相同变量返回独立的位置', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{name}} and {{name}} and {{name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(3)
      expect(variables[0].from).toBe(0)
      expect(variables[1].from).toBe(13)
      expect(variables[2].from).toBe(26)

      // 每个位置都应该不同
      expect(variables[0].from).not.toBe(variables[1].from)
      expect(variables[1].from).not.toBe(variables[2].from)
    })
  })

  describe('辅助方法', () => {
    it('missingVariables 应该正确过滤缺失变量', () => {
      const globalVariables = refRecord({ global1: 'value1' })
      const temporaryVariables = refRecord({ temp1: 'value2' })
      const predefinedVariables = refRecord({ predef1: 'value3' })

      const { missingVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{global1}} {{temp1}} {{predef1}} {{missing1}} {{missing2}}'
      const missing = missingVariables.value(text)

      expect(missing).toHaveLength(2)
      expect(missing[0].name).toBe('missing1')
      expect(missing[1].name).toBe('missing2')
    })

    it('getVariableStats 应该返回正确的统计信息', () => {
      const globalVariables = refRecord({ global1: 'v1', global2: 'v2' })
      const temporaryVariables = refRecord({ temp1: 'v3' })
      const predefinedVariables = refRecord({ predef1: 'v4' })

      const { getVariableStats } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{global1}} {{global2}} {{temp1}} {{predef1}} {{missing1}} {{missing2}}'
      const stats = getVariableStats(text)

      expect(stats.total).toBe(6)
      expect(stats.global).toBe(2)
      expect(stats.temporary).toBe(1)
      expect(stats.predefined).toBe(1)
      expect(stats.missing).toBe(2)
    })

    it('getVariableStats 应该处理空文本', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { getVariableStats } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const stats = getVariableStats('')

      expect(stats.total).toBe(0)
      expect(stats.global).toBe(0)
      expect(stats.temporary).toBe(0)
      expect(stats.predefined).toBe(0)
      expect(stats.missing).toBe(0)
    })
  })

  describe('响应式更新', () => {
    it('应该响应变量数据的变化', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{dynamicVar}}'

      // 初始状态: 缺失变量
      let variables = extractVariables(text)
      expect(variables[0].source).toBe('missing')

      // 添加到全局变量
      globalVariables.value = { dynamicVar: 'new value' }
      variables = extractVariables(text)
      expect(variables[0].source).toBe('global')
      expect(variables[0].value).toBe('new value')

      // 添加到预定义变量 (优先级更高)
      predefinedVariables.value = { dynamicVar: 'predefined value' }
      variables = extractVariables(text)
      expect(variables[0].source).toBe('predefined')
      expect(variables[0].value).toBe('predefined value')
    })
  })
})
