import { describe, it, expect } from 'vitest'

import { TemplateManager } from '../../../src/services/template/manager'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
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

  const msg = template.content.find((m) => m.role === role)
  if (!msg) {
    throw new Error(`Missing role=${role} message in template: ${template.id}`)
  }
  return msg.content
}

const PROMPT_ITERATE_TEMPLATE_IDS = [
  'evaluation-basic-system-prompt-iterate',
  'evaluation-basic-user-prompt-iterate',
  'evaluation-pro-multi-prompt-iterate',
  'evaluation-pro-variable-prompt-iterate',
] as const

describe('Prompt-iterate evaluation templates', () => {
  it('zh-CN built-ins contain explicit user-feedback interpretation rules', async () => {
    const tm = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )

    for (const id of PROMPT_ITERATE_TEMPLATE_IDS) {
      const template = await tm.getTemplate(id)
      const system = getFirstMessageContent(template, 'system')
      const user = getFirstMessageContent(template, 'user')

      expect(system).toContain('用户反馈解释规则（重要）')
      // Some templates phrase it as "assistant 最终输出"; keep the check semantic.
      expect(system).toContain('最终输出')
      expect(system).toContain('输出/格式/示例')

      // Ensure the user-side hint exists too (models often key off headings).
      expect(user).toContain('用户反馈（优先关注')
      expect(user).toContain('默认指')
      expect(user).toContain('最终输出格式')
    }
  })

  it('en-US built-ins contain explicit user-feedback interpretation rules', async () => {
    const tm = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    for (const id of PROMPT_ITERATE_TEMPLATE_IDS) {
      const template = await tm.getTemplate(id)
      const system = getFirstMessageContent(template, 'system')
      const user = getFirstMessageContent(template, 'user')

      expect(system).toContain('How to Interpret User Feedback (Important)')
      expect(system).toContain('FINAL OUTPUT FORMAT')
      expect(system).toContain('output/format/examples')

      expect(user).toContain('User Feedback (Priority')
      expect(user).toContain('FINAL OUTPUT FORMAT')
    }
  })
})
