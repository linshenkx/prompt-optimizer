import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { ModelManager, HistoryManager, TemplateManager, PromptService } from '../../src'
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider'
import { createLLMService } from '../../src/services/llm/service'
import { createTemplateManager } from '../../src/services/template/manager'
import { createTemplateLanguageService } from '../../src/services/template/languageService'
import { createModelManager } from '../../src/services/model/manager'
import { createHistoryManager } from '../../src/services/history/manager'

/**
 * 真实API集成测试
 * 只有在相应的环境变量存在时才执行
 */
const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('Real API Integration Tests', () => {
  const hasOpenAIKey = !!process.env.VITE_OPENAI_API_KEY
  const hasCustomKey = !!process.env.VITE_CUSTOM_API_KEY && !!process.env.VITE_CUSTOM_BASE_URL
  const hasGeminiKey = !!process.env.VITE_GEMINI_API_KEY
  const hasDeepSeekKey = !!process.env.VITE_DEEPSEEK_API_KEY

  let storage: LocalStorageProvider
  let modelManager: ModelManager
  let historyManager: HistoryManager
  let templateManager: TemplateManager
  let promptService: PromptService

  beforeAll(() => {
    if (!hasOpenAIKey && !hasCustomKey && !hasGeminiKey && !hasDeepSeekKey) return
  })

  beforeEach(async () => {
    storage = new LocalStorageProvider()
    modelManager = createModelManager(storage)
    historyManager = createHistoryManager(storage)
    
    const languageService = createTemplateLanguageService(storage)
    templateManager = createTemplateManager(storage, languageService)

    
    const llmService = createLLMService(modelManager)
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager)

    // 清理存储
    await storage.clearAll()

    // 添加通用模板
    const template = {
      id: 'test-optimize',
      name: 'Test Optimize',
      content: 'Please optimize this prompt for better AI responses: {{input}}',
      metadata: {
        version: '1.0',
        lastModified: Date.now(),
        templateType: 'optimize' as const,
        language: 'zh' as const
      }
    }
    await templateManager.saveTemplate(template)
  })

  describe('OpenAI API 测试', () => {
    const runOpenAITests = hasOpenAIKey

    it.runIf(runOpenAITests)('应该能使用OpenAI API优化提示词', async () => {
      // 执行优化
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: '请优化这个提示词：写一个关于人工智能的故事',
        modelKey: 'openai'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // 验证历史记录已保存
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runOpenAITests)('跳过OpenAI测试 - 未设置API密钥', () => {
      expect(true).toBe(true)
    })
  })

  describe('Custom API 测试', () => {
    const runCustomTests = hasCustomKey

    it.runIf(runCustomTests)('应该能使用Custom API优化提示词', async () => {
      // 执行优化
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: '请优化这个提示词：写一个关于机器人的故事',
        modelKey: 'custom'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // 验证历史记录已保存
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runCustomTests)('跳过Custom API测试 - 未设置API密钥或基础URL', () => {
      expect(true).toBe(true)
    })
  })

  describe('Gemini API 测试', () => {
    const runGeminiTests = hasGeminiKey

    it.runIf(runGeminiTests)('应该能使用Gemini API优化提示词', async () => {
      // 执行优化
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: '请优化这个提示词：写一个关于太空探索的故事',
        modelKey: 'gemini'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // 模拟UI层保存历史记录
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: result,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      })

      // 验证历史记录已保存
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runGeminiTests)('跳过Gemini测试 - 未设置API密钥', () => {
      expect(true).toBe(true)
    })
  })

  describe('DeepSeek API 测试', () => {
    const runDeepSeekTests = hasDeepSeekKey

    it.runIf(runDeepSeekTests)('应该能使用DeepSeek API优化提示词', async () => {
      // 执行优化
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: '请优化这个提示词：写一个关于人工智能的故事',
        modelKey: 'deepseek'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // 模拟UI层保存历史记录
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: result,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      })

      // 验证历史记录已保存
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runDeepSeekTests)('跳过DeepSeek测试 - 未设置API密钥', () => {
      expect(true).toBe(true)
    })
  })

  describe('轻量级工作流测试', () => {
    const runWorkflowTests = hasOpenAIKey || (hasCustomKey && !!process.env.VITE_CUSTOM_BASE_URL)

    it.runIf(runWorkflowTests)('应该能完成基本的优化流程', async () => {
      // 选择可用的模型
      const modelKey = hasOpenAIKey ? 'openai' : 'custom'

      // 优化原始提示词
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: '写一个故事',
        modelKey: modelKey
      };
      const optimizeResult = await promptService.optimizePrompt(request)

      expect(typeof optimizeResult).toBe('string')
      expect(optimizeResult.length).toBeGreaterThan(0)

      // 模拟UI层保存历史记录
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: optimizeResult,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      })

      // 验证历史记录已保存
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')

    }, 60000) // 增加超时到60秒

    it.skipIf(!runWorkflowTests)('跳过工作流测试 - 未设置API密钥', () => {
      expect(true).toBe(true)
    })
  })

  describe('并发和错误处理测试', () => {
    const runStabilityTests = hasOpenAIKey || (hasCustomKey && !!process.env.VITE_CUSTOM_BASE_URL)

    it.runIf(runStabilityTests)('应该能正确处理API错误', async () => {
      const models = await modelManager.getAllModels()
      const baseModel = models.find(m => m.enabled && m.providerMeta?.requiresApiKey && m.providerMeta?.id !== 'custom')
      if (!baseModel) return

      // 添加一个有无效API密钥的模型（复用已启用模型的元数据，替换 apiKey）
      await modelManager.addModel('invalid-model', {
        ...baseModel,
        id: 'invalid-model',
        name: 'Invalid Model',
        enabled: true,
        connectionConfig: {
          ...(baseModel.connectionConfig ?? {}),
          apiKey: 'invalid-key'
        }
      })

      // 尝试优化应该失败
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: '测试提示词',
        modelKey: 'invalid-model'
      };
      await expect(promptService.optimizePrompt(request)).rejects.toThrow()

      // 验证没有创建无效的历史记录
      const records = await historyManager.getRecords()
      expect(records.length).toBe(0)
    }, 30000)

    it.skipIf(!runStabilityTests)('跳过稳定性测试 - 未设置API密钥', () => {
      expect(true).toBe(true)
    })
  })
}) 
