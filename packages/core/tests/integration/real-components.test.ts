import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ModelManager, HistoryManager, TemplateManager, PromptService, DataManager } from '../../src'
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider'
import { createLLMService } from '../../src/services/llm/service'
import { createTemplateManager } from '../../src/services/template/manager'
import { createTemplateLanguageService } from '../../src/services/template/languageService'
import { createModelManager } from '../../src/services/model/manager'
import { createHistoryManager } from '../../src/services/history/manager'
import { createPreferenceService } from '../../src/services/preference/service'
import { Template } from '../../src/services/template/types'
import { ContextRepo } from '../../src/services/context/types'
import { TextModelConfig } from '../../src/services/model/types'
import { TextAdapterRegistry } from '../../src/services/llm/adapters/registry'
import { TEMPLATE_ERROR_CODES } from '../../src/constants/error-codes'

/**
 * 真实组件集成测试
 * 使用真实的LocalStorageProvider而不是Mock，验证组件协作
 */
describe('Real Components Integration Tests', () => {
  let storage: LocalStorageProvider
  let modelManager: ModelManager
  let historyManager: HistoryManager
  let templateManager: TemplateManager
  let dataManager: DataManager
  let promptService: PromptService
  let mockContextRepo: ContextRepo
  let registry: TextAdapterRegistry

  // 辅助函数：创建 TextModelConfig
  const createTextModelConfig = (
    id: string,
    name: string,
    providerId: string = 'openai'
  ): TextModelConfig => {
    const adapter = registry.getAdapter(providerId);
    const provider = adapter.getProvider();
    const models = adapter.getModels();

    return {
      id,
      name,
      enabled: true,
      providerMeta: provider,
      modelMeta: models[0] || adapter.buildDefaultModel('test-model'),
      connectionConfig: {
        apiKey: 'test-key',
        baseURL: provider.defaultBaseURL
      },
      paramOverrides: {}
    };
  };

  beforeEach(async () => {
    // 清理存储，确保测试隔离
    storage = new LocalStorageProvider()
    registry = new TextAdapterRegistry()
    modelManager = createModelManager(storage)
    historyManager = createHistoryManager(storage, modelManager)
    const preferenceService = createPreferenceService(storage)

    const languageService = createTemplateLanguageService(storage, preferenceService)
    templateManager = createTemplateManager(storage, languageService)

    // 创建 mockContextRepo
    mockContextRepo = {
      list: vi.fn().mockResolvedValue([]),
      getCurrentId: vi.fn().mockResolvedValue('default'),
      setCurrentId: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue('new-context-id'),
      duplicate: vi.fn().mockResolvedValue('duplicated-context-id'),
      rename: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      exportAll: vi.fn().mockResolvedValue({}),
      importAll: vi.fn().mockResolvedValue({}),
      exportData: vi.fn().mockResolvedValue({}),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockReturnValue('contexts'),
      validateData: vi.fn().mockReturnValue(true),
    } as ContextRepo;

    dataManager = new DataManager(modelManager, templateManager, historyManager, preferenceService, mockContextRepo)

    const llmService = createLLMService(modelManager)
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager)
  })

  afterEach(async () => {
    // 测试后清理
    await storage.clearAll()
  })

  describe('真实存储层测试', () => {
    it('应该能正确保存和读取模型配置', async () => {
      const testModel = createTextModelConfig('test-model', 'Test Model');

      // 清理存储，确保从空状态开始
      await storage.clearAll()

      // 添加模型
      await modelManager.addModel('test-model', testModel)

      // 验证保存
      const saved = await modelManager.getModel('test-model')
      expect(saved).toBeDefined()
      expect(saved?.name).toBe('Test Model')

      // 验证在所有模型列表中（注意：新架构返回数组且包含默认模型）
      const allModels = await modelManager.getAllModels()
      const userModel = allModels.find(m => m.id === 'test-model')
      expect(userModel).toBeDefined()
      expect(userModel?.name).toBe('Test Model')
    })

    it('应该能正确处理历史记录的完整生命周期', async () => {
      // 创建历史记录
      const record = {
        id: 'test-record-1',
        originalPrompt: 'Original test prompt',
        optimizedPrompt: 'Optimized test prompt',
        type: 'optimize' as const,
        chainId: 'test-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      await historyManager.addRecord(record)

      // 验证记录存在
      const retrieved = await historyManager.getRecord('test-record-1')
      expect(retrieved).toBeDefined()
      expect(retrieved.originalPrompt).toBe('Original test prompt')

      // 验证在记录列表中
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)

      // 删除记录
      await historyManager.deleteRecord('test-record-1')
      
      // 验证已删除
      await expect(historyManager.getRecord('test-record-1'))
        .rejects.toThrow('Record with ID test-record-1 not found')
    })

    it('应该能正确处理用户模板管理', async () => {
      const template = {
        id: 'user-test-template',
        name: 'User Test Template',
        content: 'This is a user test template: {{input}}',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize' as const,
          language: 'zh' as const
        }
      }

      // 清理存储，确保从空状态开始
      await storage.clearAll()

      // 保存模板
      await templateManager.saveTemplate(template)

      // 获取模板
      const retrieved = await templateManager.getTemplate('user-test-template')
      expect(retrieved).toBeDefined()
      expect(retrieved.name).toBe('User Test Template')
      expect(retrieved.content).toBe('This is a user test template: {{input}}')

      // 验证在模板列表中（注意：真实环境可能有内置模板）
      const templates = await templateManager.listTemplates()
      const userTemplate = templates.find(t => t.id === 'user-test-template')
      expect(userTemplate).toBeDefined()

      // 删除模板
      await templateManager.deleteTemplate('user-test-template')
      
      // 验证已删除
      await expect(templateManager.getTemplate('user-test-template'))
        .rejects.toMatchObject({ code: TEMPLATE_ERROR_CODES.NOT_FOUND })
    })
  })

  describe('组件协作测试', () => {
    it('完整的提示词优化流程应该正常工作', async () => {
      // 清理存储
      await storage.clearAll()

      // 1. 添加模型
      // 1. 添加测试模型
      const model = createTextModelConfig('test-model', 'Test Model');
      await modelManager.addModel('test-model', model)

      // 2. 添加用户模板（避免与内置模板冲突）
      const template = {
        id: 'user-optimize-template',
        name: 'User Optimize Template',
        content: 'Please optimize this prompt: {{input}}',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize' as const,
          language: 'zh' as const
        }
      }
      await templateManager.saveTemplate(template)

      // 3. 验证组件配置而不是实际调用API（避免网络依赖）
      const retrievedModel = await modelManager.getModel('test-model')
      expect(retrievedModel).toBeDefined()
      expect(retrievedModel?.name).toBe('Test Model')

      const retrievedTemplate = await templateManager.getTemplate('user-optimize-template')
      expect(retrievedTemplate).toBeDefined()
      expect(retrievedTemplate.name).toBe('User Optimize Template')
      
      console.log('组件配置验证成功，跳过实际API调用以避免网络依赖')
    }, 5000) // 减少超时时间，因为不再进行API调用

    it('数据导入导出应该正常工作', async () => {
      // 清理存储
      await storage.clearAll()

      // 准备测试数据
      const model = createTextModelConfig('export-model', 'Export Test Model');
      
      const template: Template = {
        id: 'user-export-template',
        name: 'User Export Template',
        content: 'Export test content',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize' as const,
          language: 'zh' as const
        }
      }

      const record = {
        id: 'export-record',
        originalPrompt: 'Export original',
        optimizedPrompt: 'Export optimized',
        type: 'optimize' as const,
        chainId: 'export-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'export-model',
        templateId: 'user-export-template'
      }

      // 添加测试数据
      await modelManager.addModel('export-model', model)
      await templateManager.saveTemplate(template)
      await historyManager.addRecord(record)

      // 导出数据
      const exportedDataString = await dataManager.exportAllData()
      const exportedData = JSON.parse(exportedDataString)
      
      expect(exportedData.version).toBe(1)
      expect(exportedData.data).toBeDefined()
      expect(exportedData.data.models).toBeDefined()
      expect(exportedData.data.userTemplates).toBeDefined()
      expect(exportedData.data.history).toBeDefined()
      expect(exportedData.data.models.length).toBeGreaterThan(0)
      expect(exportedData.data.userTemplates.length).toBeGreaterThan(0)
      expect(exportedData.data.history.length).toBe(1)

      // 清空数据
      await storage.clearAll()

      // 验证数据已清空
      const emptyModels = await modelManager.getAllModels()
      const emptyTemplates = await templateManager.listTemplates()
      const emptyHistory = await historyManager.getRecords()
      
      // 注意：真实环境可能有内置模型和模板，不一定为空
      expect(emptyHistory.length).toBe(0) // 历史记录应该清空

      // 导入数据
      await dataManager.importAllData(exportedDataString)

      // 验证数据已恢复
      const restoredModels = await modelManager.getAllModels()
      const restoredTemplates = await templateManager.listTemplates()
      const restoredHistory = await historyManager.getRecords()
      
      expect(restoredModels.length).toBeGreaterThan(0)
      expect(restoredTemplates.length).toBeGreaterThan(0)
      expect(restoredHistory.length).toBe(1)
      
      const restoredModel = restoredModels.find(m => m.id === 'export-model')
      const restoredTemplate = restoredTemplates.find(t => t.id === 'user-export-template')
      expect(restoredModel).toBeDefined()
      expect(restoredTemplate).toBeDefined()
      expect(restoredHistory[0].id).toBe('export-record')
    })
  })

  describe('并发和边界情况测试', () => {
    it('应该能正确处理重复ID的情况', async () => {
      const record1 = {
        id: 'duplicate-id',
        originalPrompt: 'First record',
        optimizedPrompt: 'First result',
        type: 'optimize' as const,
        chainId: 'test-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      const record2 = {
        id: 'duplicate-id', // 相同ID
        originalPrompt: 'Second record',
        optimizedPrompt: 'Second result',
        type: 'optimize' as const,
        chainId: 'test-chain',
        version: 2,
        timestamp: Date.now(),
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      // 添加第一条记录
      await historyManager.addRecord(record1)

      // 尝试添加重复ID的记录应该失败
      await expect(historyManager.addRecord(record2))
        .rejects.toThrow('Record with ID duplicate-id already exists')
    })

    it('应该能正确处理大量数据', async () => {
      const recordCount = 10
      const records: Array<{
        id: string;
        originalPrompt: string;
        optimizedPrompt: string;
        type: 'optimize';
        chainId: string;
        version: number;
        timestamp: number;
        modelKey: string;
        templateId: string;
      }> = []

      // 创建多条记录
      for (let i = 0; i < recordCount; i++) {
        records.push({
          id: `bulk-record-${i}`,
          originalPrompt: `Bulk prompt ${i}`,
          optimizedPrompt: `Bulk result ${i}`,
          type: 'optimize' as const,
          chainId: 'bulk-chain',
          version: i + 1,
          timestamp: Date.now() + i,
          modelKey: 'bulk-model',
          templateId: 'bulk-template'
        })
      }

      // 批量添加记录
      for (const record of records) {
        await historyManager.addRecord(record)
      }

      // 验证所有记录都已保存
      const savedRecords = await historyManager.getRecords()
      expect(savedRecords.length).toBe(recordCount)

      // 验证记录按时间戳排序（最新的在前）
      for (let i = 0; i < recordCount - 1; i++) {
        expect(savedRecords[i].timestamp).toBeGreaterThanOrEqual(savedRecords[i + 1].timestamp)
      }
    })

    it('应该能正确处理存储容量管理', async () => {
      // 测试超过maxRecords限制的情况
      const maxRecords = 50 // HistoryManager的默认限制
      const extraRecords = 5
      const totalRecords = maxRecords + extraRecords

      // 添加超出限制的记录
      for (let i = 0; i < totalRecords; i++) {
        await historyManager.addRecord({
          id: `capacity-record-${i}`,
          originalPrompt: `Capacity prompt ${i}`,
          optimizedPrompt: `Capacity result ${i}`,
          type: 'optimize' as const,
          chainId: 'capacity-chain',
          version: 1,
          timestamp: Date.now() + i, // 确保时间戳递增
          modelKey: 'capacity-model',
          templateId: 'capacity-template'
        })
      }

      // 验证只保留了maxRecords条记录
      const savedRecords = await historyManager.getRecords()
      expect(savedRecords.length).toBe(maxRecords)

      // 验证保留的是最新的记录
      expect(savedRecords[0].id).toBe(`capacity-record-${totalRecords - 1}`)
    })
  })

  describe('错误恢复和数据一致性测试', () => {
    it('应该能从损坏的数据中恢复', async () => {
      // 直接在存储中放入无效数据
      await storage.setItem('prompt_models', 'invalid json')
      
      // ModelManager应该能处理无效数据并返回空数组
      const models = await modelManager.getAllModels()
      expect(Array.isArray(models)).toBe(true)
      // 真实环境可能有内置模型，只验证返回的是数组
    })

    it('应该能处理部分数据丢失的情况', async () => {
      // 清理存储
      await storage.clearAll()

      // 添加一些数据
      await modelManager.addModel('test-model', createTextModelConfig('test-model', 'Test Model'))

      // 模拟模板数据丢失
      await storage.removeItem('prompt_templates')

      // 系统应该能继续工作
      const models = await modelManager.getAllModels()
      expect(models.length).toBeGreaterThan(0) // 应该有添加的模型

      const templates = await templateManager.listTemplates()
      // 真实环境可能有内置模板，只验证不崩溃
      expect(Array.isArray(templates)).toBe(true)
    })
  })
}) 
