import { describe, expect, it } from 'vitest'

import { TemplateManager } from '../../../src/services/template/manager'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { TemplateProcessor } from '../../../src/services/template/processor'
import type {
  BuiltinTemplateLanguage,
  ITemplateLanguageService,
} from '../../../src/services/template/languageService'
import type { MessageTemplate, Template } from '../../../src/services/template/types'

class StubTemplateLanguageService implements ITemplateLanguageService {
  private lang: BuiltinTemplateLanguage

  constructor(lang: BuiltinTemplateLanguage) {
    this.lang = lang
  }

  async initialize() {}
  async getCurrentLanguage() {
    return this.lang
  }
  async setLanguage(language: BuiltinTemplateLanguage) {
    this.lang = language
  }
  async toggleLanguage() {
    this.lang = this.lang === 'zh-CN' ? 'en-US' : 'zh-CN'
    return this.lang
  }
  async isValidLanguage(language: string) {
    return language === 'zh-CN' || language === 'en-US'
  }
  async getSupportedLanguages() {
    return ['zh-CN', 'en-US'] as BuiltinTemplateLanguage[]
  }
  getLanguageDisplayName(language: BuiltinTemplateLanguage) {
    return language
  }
  isInitialized() {
    return true
  }
}

function getFirstMessageContent(template: Template, role: MessageTemplate['role']): string {
  if (typeof template.content === 'string') {
    throw new Error(`Expected template.content to be MessageTemplate[], got string for: ${template.id}`)
  }

  const message = template.content.find((item) => item.role === role)
  if (!message) {
    throw new Error(`Missing role=${role} message in template: ${template.id}`)
  }

  return message.content
}

function getRenderedFirstMessageContent(template: Template, role: MessageTemplate['role']): string {
  const messages = TemplateProcessor.processTemplate(template, {
    originalPrompt: '生成 {{subject_name}} 在 {{scene}} 中的图像，保持 {{style_hint}} 风格',
    lastOptimizedPrompt: '城市线描海报，地点为 {{location_theme}}，标题为 {{title_text}}',
    iterateInput: '强化 {{visual_mood}} 并补充 {{local_clues}}',
    promptContent: '请根据 {{location_theme}} 生成标题为 {{title_text}} 的海报',
    inputImageCount: 2,
  })
  const message = messages.find((item) => item.role === role)
  if (!message) {
    throw new Error(`Missing rendered role=${role} message in template: ${template.id}`)
  }
  return message.content
}

describe('Image JSON structure preservation guardrails', () => {
  const legacyZhTemplateIds = [
    'image-general-optimize',
    'image-chinese-optimize',
    'image-photography-optimize',
    'image-creative-text2image',
  ]

  const legacyEnTemplateIds = [
    'image-general-optimize-en',
    'image-chinese-optimize-en',
    'image-photography-optimize-en',
    'image-creative-text2image-en',
  ]

  it('zh-CN legacy text2image optimize templates preserve JSON mode and placeholders when input is structured', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )

    for (const templateId of legacyZhTemplateIds) {
      const template = await templateManager.getTemplate(templateId)
      const system = getFirstMessageContent(template, 'system')
      const renderedSystem = getRenderedFirstMessageContent(template, 'system')

      expect(system).toContain('待优化内容本身是 JSON 对象、JSON 数组、JSON 风格对象')
      expect(system).toContain('保留所有原始占位符')
      expect(system).toContain('不要把自然语言输入包装成')
      expect(renderedSystem).toContain('缺少任意一个')
      expect(renderedSystem).toContain('{{placeholder}}')
      expect(renderedSystem).toContain('"{{subject}}"')
    }
  })

  it('en-US legacy text2image optimize templates preserve JSON mode and placeholders when input is structured', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    for (const templateId of legacyEnTemplateIds) {
      const template = await templateManager.getTemplate(templateId)
      const system = getFirstMessageContent(template, 'system')
      const renderedSystem = getRenderedFirstMessageContent(template, 'system')

      expect(system).toContain('content being optimized itself is a JSON object')
      expect(system).toContain('Preserve every')
      expect(system).toContain('token exactly')
      expect(system).toContain('Do not wrap natural-language input as')
      expect(renderedSystem).toMatch(/missing any (placeholder|one)/)
      expect(renderedSystem).toContain('{{placeholder}}')
      expect(renderedSystem).toContain('"{{subject}}"')
    }
  })

  it('default text2image optimizer keeps hard-constraint preservation guidance in zh-CN and en-US', async () => {
    const zhTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )
    const enTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const zhTemplate = await zhTemplateManager.getTemplate('image-general-optimize')
    const enTemplate = await enTemplateManager.getTemplate('image-general-optimize-en')
    const zhSystem = getFirstMessageContent(zhTemplate, 'system')
    const enSystem = getFirstMessageContent(enTemplate, 'system')
    const zhUser = getRenderedFirstMessageContent(zhTemplate, 'user')
    const enUser = getRenderedFirstMessageContent(enTemplate, 'user')

    expect(zhSystem).toContain('硬约束保真优先级')
    expect(zhSystem).toContain('输出前保真自检')
    expect(zhSystem).toContain('条件分支与显式短语保留')
    expect(zhSystem).toContain('可验证短语保留')
    expect(zhUser).toContain('缺少任意一个占位符都算失败')
    expect(zhUser).toContain('硬约束短语尽量原词复用')
    expect(zhUser).toContain('{{...}}')

    expect(enSystem).toContain('Hard-Constraint Preservation Priority')
    expect(enSystem).toContain('Final Preservation Check')
    expect(enSystem).toContain('Conditional Branch and Explicit Phrase Preservation')
    expect(enSystem).toContain('Verifiable Phrase Preservation')
    expect(enUser).toContain('missing any one of them is a failure')
    expect(enUser).toContain('reuse hard-constraint phrases where practical')
    expect(enUser).toContain('{{...}}')
  })

  it('zh-CN json-structured optimize template preserves schema and placeholder tokens exactly', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )

    const template = await templateManager.getTemplate('image-json-structured-optimize')
    const system = getFirstMessageContent(template, 'system')
    const renderedSystem = getRenderedFirstMessageContent(template, 'system')

    expect(system).toContain('优先沿用原有 JSON 结构')
    expect(system).toContain('保留所有原始占位符')
    expect(system).toContain('不要把占位符替换成泛化名词')
    expect(system).toContain('不要为了“更完整”而随意重命名字段或新增顶层字段')
    expect(system).toContain('默认保持原有顶层字段集合不变')
    expect(system).toContain('输出的顶层 key 集合必须与输入保持一致')
    expect(renderedSystem).toContain('{{subject}}')
    expect(renderedSystem).toContain('{{title_text}}')
  })

  it('en-US json-structured optimize template preserves schema and placeholder tokens exactly', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const template = await templateManager.getTemplate('image-json-structured-optimize-en')
    const system = getFirstMessageContent(template, 'system')
    const renderedSystem = getRenderedFirstMessageContent(template, 'system')

    expect(system).toContain('Prefer to keep the existing JSON structure')
    expect(system).toContain('Preserve all original placeholder tokens exactly')
    expect(system).toContain('Do not replace placeholders with generic nouns')
    expect(system).toContain('do not rename fields or add top-level keys just to make it look more complete')
    expect(system).toContain('keep the original top-level key set by default')
    expect(system).toContain('the output top-level key set must match the input exactly')
    expect(renderedSystem).toContain('{{subject}}')
    expect(renderedSystem).toContain('{{title_text}}')
  })

  it('zh-CN image iterate template follows lastOptimizedPrompt structure instead of iterateInput phrasing', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )

    const template = await templateManager.getTemplate('image-iterate-general')
    const system = getFirstMessageContent(template, 'system')

    expect(system).toContain('以 lastOptimizedPrompt 本身的结构为准')
    expect(system).toContain('即使 iterateInput 没有提到 JSON，也要保持已有结构化 JSON 输出')
    expect(system).toContain('保留所有原始占位符')
  })

  it('en-US image iterate template follows lastOptimizedPrompt structure instead of iterateInput phrasing', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const template = await templateManager.getTemplate('image-iterate-general-en')
    const system = getFirstMessageContent(template, 'system')

    expect(system).toContain('Follow the structure of lastOptimizedPrompt itself first')
    expect(system).toContain('Keep existing structured JSON output even if iterateInput does not mention JSON explicitly')
    expect(system).toContain('Preserve all original placeholder tokens exactly')
  })

  it('image optimize templates render literal double-curly placeholder examples in non-text2image modes', async () => {
    const zhTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )
    const enTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const cases = [
      {
        manager: zhTemplateManager,
        templateId: 'image-iterate-general',
        role: 'system' as const,
        expected: '{{location_theme}}',
      },
      {
        manager: zhTemplateManager,
        templateId: 'image2image-general-optimize',
        role: 'user' as const,
        expected: '{{subject}}',
      },
      {
        manager: zhTemplateManager,
        templateId: 'image2image-design-text-edit-optimize',
        role: 'user' as const,
        expected: '{{headline_text}}',
      },
      {
        manager: zhTemplateManager,
        templateId: 'multiimage-optimize',
        role: 'user' as const,
        expected: '{{reference_style}}',
      },
      {
        manager: enTemplateManager,
        templateId: 'image-iterate-general-en',
        role: 'system' as const,
        expected: '{{location_theme}}',
      },
      {
        manager: enTemplateManager,
        templateId: 'image2image-general-optimize-en',
        role: 'user' as const,
        expected: '{{subject}}',
      },
      {
        manager: enTemplateManager,
        templateId: 'image2image-design-text-edit-optimize-en',
        role: 'user' as const,
        expected: '{{headline_text}}',
      },
      {
        manager: enTemplateManager,
        templateId: 'multiimage-optimize-en',
        role: 'user' as const,
        expected: '{{reference_style}}',
      },
    ]

    for (const { manager, templateId, role, expected } of cases) {
      const template = await manager.getTemplate(templateId)
      const rendered = getRenderedFirstMessageContent(template, role)

      expect(rendered).toContain(expected)
      expect(rendered).toMatch(/缺少任意一个|missing any one/)
      expect(rendered).not.toContain('{{=<% %>=}}')
      expect(rendered).not.toContain('<%={{ }}=%>')
    }
  })

  it('context optimize templates render literal double-curly placeholder examples', async () => {
    const zhTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )
    const enTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const cases = [
      { manager: zhTemplateManager, templateId: 'context-message-optimize' },
      { manager: zhTemplateManager, templateId: 'context-analytical-optimize' },
      { manager: zhTemplateManager, templateId: 'context-output-format-optimize' },
      { manager: enTemplateManager, templateId: 'context-message-optimize-en' },
      { manager: enTemplateManager, templateId: 'context-analytical-optimize-en' },
      { manager: enTemplateManager, templateId: 'context-output-format-optimize-en' },
    ]

    for (const { manager, templateId } of cases) {
      const template = await manager.getTemplate(templateId)
      const renderedSystem = getRenderedFirstMessageContent(template, 'system')

      expect(renderedSystem).toContain('{{name}}')
      expect(renderedSystem).not.toContain('{{=<% %>=}}')
      expect(renderedSystem).not.toContain('<%={{ }}=%>')
    }
  })

  it('variable extraction and contextual user templates render literal double-curly placeholder examples', async () => {
    const zhTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )
    const enTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const zhVariableExtraction = await zhTemplateManager.getTemplate('variable-extraction')
    const enVariableExtraction = await enTemplateManager.getTemplate('variable-extraction')
    expect(getRenderedFirstMessageContent(zhVariableExtraction, 'system')).toContain('{{变量}}')
    expect(getRenderedFirstMessageContent(enVariableExtraction, 'system')).toContain('{{variable}}')

    const cases = [
      { manager: zhTemplateManager, templateId: 'context-user-prompt-basic' },
      { manager: zhTemplateManager, templateId: 'context-user-prompt-planning' },
      { manager: zhTemplateManager, templateId: 'context-user-prompt-professional' },
      { manager: enTemplateManager, templateId: 'context-user-prompt-basic' },
      { manager: enTemplateManager, templateId: 'context-user-prompt-planning' },
      { manager: enTemplateManager, templateId: 'context-user-prompt-professional' },
    ]

    for (const { manager, templateId } of cases) {
      const template = await manager.getTemplate(templateId)
      const renderedSystem = getRenderedFirstMessageContent(template, 'system')

      expect(renderedSystem).toContain('{{location_theme}}')
      expect(renderedSystem).toContain('{{title_text}}')
      expect(renderedSystem).toMatch(/缺少任意一个|missing any one/)
      expect(renderedSystem).not.toContain('{{=<% %>=}}')
      expect(renderedSystem).not.toContain('<%={{ }}=%>')
    }
  })

  it('non-image prompt optimization templates render or retain literal variable placeholder examples', async () => {
    const zhTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )
    const enTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const renderedCases = [
      { manager: zhTemplateManager, templateId: 'iterate', expected: '{{location_theme}}' },
      { manager: enTemplateManager, templateId: 'iterate', expected: '{{location_theme}}' },
      { manager: zhTemplateManager, templateId: 'user-prompt-professional', expected: '{{location_theme}}' },
      { manager: enTemplateManager, templateId: 'user-prompt-professional', expected: '{{location_theme}}' },
      { manager: zhTemplateManager, templateId: 'user-prompt-planning', expected: '{{location_theme}}' },
      { manager: enTemplateManager, templateId: 'user-prompt-planning', expected: '{{location_theme}}' },
      { manager: zhTemplateManager, templateId: 'analytical-optimize', expected: '{{variable_name}}' },
      { manager: enTemplateManager, templateId: 'analytical-optimize', expected: '{{variable_name}}' },
    ]

    for (const { manager, templateId, expected } of renderedCases) {
      const template = await manager.getTemplate(templateId)
      const renderedSystem = getRenderedFirstMessageContent(template, 'system')

      expect(renderedSystem).toContain(expected)
      if (templateId === 'iterate' || templateId.startsWith('user-prompt-')) {
        expect(renderedSystem).toMatch(/缺少任意一个|missing any one/)
      }
      expect(renderedSystem).not.toContain('{{=<% %>=}}')
      expect(renderedSystem).not.toContain('<%={{ }}=%>')
    }

    const simpleTemplateIds = ['general-optimize', 'output-format-optimize']
    for (const templateId of simpleTemplateIds) {
      const zhTemplate = await zhTemplateManager.getTemplate(templateId)
      const enTemplate = await enTemplateManager.getTemplate(templateId)

      expect(getRenderedFirstMessageContent(zhTemplate, 'system')).toContain('{{variable_name}}')
      expect(getRenderedFirstMessageContent(enTemplate, 'system')).toContain('{{variable_name}}')
    }
  })

  it('image2image JSON structured templates preserve input variables without introducing example variables', async () => {
    const zhTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )
    const enTemplateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const zhTemplate = await zhTemplateManager.getTemplate('image2image-json-structured-optimize')
    const enTemplate = await enTemplateManager.getTemplate('image2image-json-structured-optimize-en')

    const originalPrompt = '编辑 "{{subject_name}}"，保留 {{style_hint}} 风格。\n背景为 {{scene}}。'
    const expectedVariables = ['{{scene}}', '{{style_hint}}', '{{subject_name}}']

    for (const template of [zhTemplate, enTemplate]) {
      const messages = TemplateProcessor.processTemplate(template, {
        originalPrompt,
        inputImageCount: 1,
      })
      const userMessage = messages.find((message) => message.role === 'user')!.content
      const wrappedValue = userMessage.match(/\{\s*"originalPrompt"\s*:\s*("(?:\\.|[^"\\])*")\s*\}/)

      expect(wrappedValue).not.toBeNull()
      expect(JSON.parse(wrappedValue![1])).toBe(originalPrompt)

      const renderedVariables = new Set(
        messages.flatMap((message) => message.content.match(/\{\{[^{}]+\}\}/g) ?? [])
      )
      expect([...renderedVariables].sort()).toEqual(expectedVariables)
    }
  })
})
