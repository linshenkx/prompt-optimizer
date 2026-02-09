import { describe, it, expect } from 'vitest'

import { EvaluationService } from '../../../src/services/evaluation/service'
import type { PromptIterateEvaluationRequest } from '../../../src/services/evaluation/types'

import type {
  ILLMService,
  LLMResponse,
  Message,
  ModelOption,
  StreamHandlers,
  ToolDefinition,
} from '../../../src/services/llm/types'
import type { IModelManager, TextModelConfig } from '../../../src/services/model/types'

import { TemplateManager } from '../../../src/services/template/manager'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import type {
  BuiltinTemplateLanguage,
  ITemplateLanguageService,
} from '../../../src/services/template/languageService'

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

class StubModelManager implements IModelManager {
  constructor(private models: Record<string, TextModelConfig>) {}

  async ensureInitialized(): Promise<void> {}
  async isInitialized(): Promise<boolean> {
    return true
  }

  async getAllModels(): Promise<TextModelConfig[]> {
    return Object.values(this.models)
  }

  async getModel(key: string): Promise<TextModelConfig | undefined> {
    return this.models[key]
  }

  async addModel(key: string, config: TextModelConfig): Promise<void> {
    this.models[key] = config
  }

  async updateModel(key: string, config: Partial<TextModelConfig>): Promise<void> {
    const current = this.models[key]
    if (!current) return
    this.models[key] = { ...current, ...config }
  }

  async deleteModel(key: string): Promise<void> {
    delete this.models[key]
  }

  async enableModel(key: string): Promise<void> {
    const current = this.models[key]
    if (!current) return
    this.models[key] = { ...current, enabled: true }
  }

  async disableModel(key: string): Promise<void> {
    const current = this.models[key]
    if (!current) return
    this.models[key] = { ...current, enabled: false }
  }

  async getEnabledModels(): Promise<TextModelConfig[]> {
    return Object.values(this.models).filter((m) => m.enabled)
  }

  // IImportExportable
  async exportData(): Promise<any> {
    return []
  }
  async importData(_data: any): Promise<void> {}
  async getDataType(): Promise<string> {
    return 'models'
  }
  async validateData(_data: any): Promise<boolean> {
    return true
  }
}

/**
 * Deterministic evaluator stub.
 *
 * The goal is NOT to test LLM reasoning. Instead, this is a regression test
 * ensuring our prompt-iterate templates carry the disambiguation rules that
 * steer ambiguous feedback like "要简化输出结构" toward OutputFormat/Workflows
 * rather than deleting prompt sections (Profile/Skills/Rules).
 */
class RuleBasedEvaluationLLM implements ILLMService {
  public lastMessages: Message[] = []

  async sendMessage(messages: Message[], _provider: string): Promise<string> {
    this.lastMessages = messages
    const text = messages.map((m) => m.content).join('\n\n')

    const hasDisambiguationRule =
      text.includes('用户反馈解释规则（重要）') &&
      text.includes('最终输出') &&
      text.includes('OutputFormat') &&
      text.includes('Profile/Skills/Rules')

    const improvements = hasDisambiguationRule
      ? [
          '优先收紧 OutputFormat：默认只输出标题+正文；除非用户明确要求，否则不输出赏析/解释。',
          '在 Workflows/默认输出规则中明确：当用户反馈提到“输出/格式/示例”但未提到提示词结构时，按最终输出格式处理。'
        ]
      : [
          '建议简化提示词结构：删掉 Profile/Skills/Rules 等章节，只保留最短指令。'
        ]

    return JSON.stringify({
      score: {
        overall: 90,
        dimensions: [
          { key: 'structureClarity', label: '结构清晰度', score: 90 },
          { key: 'intentExpression', label: '意图表达', score: 90 },
          { key: 'constraintCompleteness', label: '约束完整性', score: 90 },
          { key: 'improvementDegree', label: '改进程度', score: 90 },
        ],
      },
      improvements,
      patchPlan: [],
      summary: hasDisambiguationRule ? '聚焦输出格式' : '误解为删结构',
    })
  }

  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    return { content: await this.sendMessage(messages, provider) }
  }

  async sendMessageStream(_messages: Message[], _provider: string, callbacks: StreamHandlers): Promise<void> {
    callbacks.onError(new Error('RuleBasedEvaluationLLM.sendMessageStream is not used in this test'))
  }

  async sendMessageStreamWithTools(
    _messages: Message[],
    _provider: string,
    _tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    callbacks.onError(new Error('RuleBasedEvaluationLLM.sendMessageStreamWithTools is not used in this test'))
  }

  async testConnection(_provider: string): Promise<void> {
    throw new Error('RuleBasedEvaluationLLM.testConnection is not used in this test')
  }

  async fetchModelList(_provider: string, _customConfig?: any): Promise<ModelOption[]> {
    return []
  }
}

describe('Prompt-iterate ambiguous feedback behavior (contract)', () => {
  it('interprets "要简化输出结构" as final output format and avoids deleting prompt sections', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('zh-CN')
    )

    const modelKey = 'test-model'
    const modelManager = new StubModelManager({
      [modelKey]: {
        id: modelKey,
        name: 'Test Model',
        enabled: true,
        providerMeta: {
          id: 'test',
          name: 'Test',
          requiresApiKey: false,
          defaultBaseURL: 'https://example.com',
          supportsDynamicModels: false,
        },
        modelMeta: {
          id: modelKey,
          name: 'Test Model',
          providerId: 'test',
          capabilities: { supportsTools: false },
          parameterDefinitions: [],
        },
        connectionConfig: {},
        paramOverrides: {},
      }
    })

    const llm = new RuleBasedEvaluationLLM()
    const service = new EvaluationService(llm, modelManager, templateManager)

    const request: PromptIterateEvaluationRequest = {
      type: 'prompt-iterate',
      evaluationModelKey: modelKey,
      mode: { functionMode: 'basic', subMode: 'system' },
      originalPrompt: '旧版本（不重要）',
      optimizedPrompt: '# Profile\n...\n\n# Workflows\n...\n\n# OutputFormat\n默认只输出标题+正文',
      iterateRequirement: '背景：用户进徽章主要想看分析结果；需要简化最终输出结构（非提示词章节结构）。',
      userFeedback: '要简化输出结构',
      testContent: '',
    }

    const result = await service.evaluate(request)

    const promptText = llm.lastMessages.map((m) => m.content).join('\n\n')
    expect(promptText).toContain('用户反馈解释规则（重要）')
    expect(promptText).toContain('OutputFormat')
    expect(promptText).toContain('Profile/Skills/Rules')
    expect(promptText).toContain('要简化输出结构')
    expect(promptText).toContain('用户进徽章主要想看分析结果')

    const improvementsText = result.improvements.join('\n')
    expect(improvementsText).toContain('OutputFormat')
    expect(improvementsText).not.toContain('Profile/Skills/Rules')
    expect(improvementsText).not.toContain('删掉')
    expect(improvementsText).not.toContain('删除')
  })
})
