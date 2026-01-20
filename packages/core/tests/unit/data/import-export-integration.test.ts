import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataManager } from '../../../src/services/data/manager';
import { ModelManager } from '../../../src/services/model/manager';
import { TemplateManager } from '../../../src/services/template/manager';
import { HistoryManager } from '../../../src/services/history/manager';
import { PreferenceService } from '../../../src/services/preference/service';
import { TemplateLanguageService } from '../../../src/services/template/languageService';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { TextModelConfig } from '../../../src/services/model/types';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import { Template } from '../../../src/services/template/types';
import { PromptRecord } from '../../../src/services/history/types';
import { ContextRepo } from '../../../src/services/context/types';
import { DATA_ERROR_CODES } from '../../../src/constants/error-codes';

describe('DataManager Import/Export Integration', () => {
  let dataManager: DataManager;
  let modelManager: ModelManager;
  let templateManager: TemplateManager;
  let historyManager: HistoryManager;
  let preferenceService: PreferenceService;
  let mockContextRepo: ContextRepo;
  let storageProvider: MemoryStorageProvider;
  let registry: TextAdapterRegistry;

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider();
    await storageProvider.clearAll();

    // 创建真实的服务实例
    registry = new TextAdapterRegistry();
    preferenceService = new PreferenceService(storageProvider);
    modelManager = new ModelManager(storageProvider, registry);
    await modelManager.ensureInitialized();

    const languageService = new TemplateLanguageService(storageProvider, preferenceService);
    await languageService.initialize();
    templateManager = new TemplateManager(storageProvider, languageService);

    historyManager = new HistoryManager(storageProvider, modelManager);

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

    dataManager = new DataManager(modelManager, templateManager, historyManager, preferenceService, mockContextRepo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Import/Export Cycle', () => {
    it('should export and import all data correctly', async () => {
      // 1. 准备测试数据

      // 添加模型
      const adapter = registry.getAdapter('openai');
      const testModel: TextModelConfig = {
        id: 'test-model-key',
        name: 'Test Model',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.buildDefaultModel('test-model'),
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.test.com/v1'
        },
        paramOverrides: {}
      };
      await modelManager.addModel('test-model-key', testModel);

      // 添加模板
      const testTemplate: Template = {
        id: 'test-template',
        name: 'Test Template',
        content: 'Test template content: {{input}}',
        isBuiltin: false,
        metadata: {
          version: '1.0.0',
          lastModified: Date.now(),
          templateType: 'optimize',
          author: 'Test User'
        }
      };
      await templateManager.saveTemplate(testTemplate);

      // 添加历史记录
      const testRecord: PromptRecord = {
        id: 'test-record',
        originalPrompt: 'Test prompt',
        optimizedPrompt: 'Test response',
        type: 'optimize',
        chainId: 'test-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'test-model-key',
        templateId: 'test-template'
      };
      await historyManager.addRecord(testRecord);

      // 添加偏好设置
      await preferenceService.set('app:settings:ui:theme-id', 'dark');
      await preferenceService.set('app:selected-optimize-model', 'test-model-key');

      // 2. 导出数据
      const exportedDataString = await dataManager.exportAllData();
      expect(typeof exportedDataString).toBe('string');

      const exportedData = JSON.parse(exportedDataString);
      expect(exportedData).toHaveProperty('version', 1);
      expect(exportedData).toHaveProperty('data');

      // 验证导出的数据结构
      expect(exportedData.data).toHaveProperty('models');
      expect(exportedData.data).toHaveProperty('userTemplates');
      expect(exportedData.data).toHaveProperty('history');
      expect(exportedData.data).toHaveProperty('userSettings');

      // 验证导出的具体内容
      const exportedModel = exportedData.data.models.find((m: any) => m.id === 'test-model-key');
      expect(exportedModel).toBeDefined();
      expect(exportedModel.name).toBe('Test Model');

      const exportedTemplate = exportedData.data.userTemplates.find((t: any) => t.id === 'test-template');
      expect(exportedTemplate).toBeDefined();
      expect(exportedTemplate.name).toBe('Test Template');

      const exportedRecord = exportedData.data.history.find((r: any) => r.id === 'test-record');
      expect(exportedRecord).toBeDefined();
      expect(exportedRecord.originalPrompt).toBe('Test prompt');

      expect(exportedData.data.userSettings['app:settings:ui:theme-id']).toBe('dark');

      // 3. 清空数据
      await historyManager.clearHistory();
      await preferenceService.clear();
      // 注意：模型和模板的清空需要通过删除操作

      // 4. 导入数据
      await dataManager.importAllData(exportedDataString);

      // 5. 验证导入结果
      
      // 验证模型
      const importedModel = await modelManager.getModel('test-model-key');
      expect(importedModel).toBeDefined();
      expect(importedModel?.name).toBe('Test Model');
      expect(importedModel?.enabled).toBe(true);

      // 验证模板
      const importedTemplates = await templateManager.listTemplates();
      const importedTemplate = importedTemplates.find(t => t.id === 'test-template');
      expect(importedTemplate).toBeDefined();
      expect(importedTemplate?.name).toBe('Test Template');

      // 验证历史记录
      const importedRecords = await historyManager.getRecords();
      const importedRecord = importedRecords.find(r => r.id === 'test-record');
      expect(importedRecord).toBeDefined();
      expect(importedRecord?.originalPrompt).toBe('Test prompt');

      // 验证偏好设置
      const importedTheme = await preferenceService.get('app:settings:ui:theme-id', null);
      const importedModel2 = await preferenceService.get('app:selected-optimize-model', null);
      expect(importedTheme).toBe('dark');
      expect(importedModel2).toBe('test-model-key');
    });

    it('should handle legacy data format', async () => {
      // 测试旧版本数据格式的兼容性
      const legacyData = {
        // 没有version字段的旧格式
        models: [
          {
            key: 'legacy-model',
            name: 'Legacy Model',
            baseURL: 'https://api.legacy.com/v1',
            models: ['legacy'],
            defaultModel: 'legacy',
            provider: 'legacy',
            enabled: false
          }
        ],
        userTemplates: [
          {
            id: 'legacy-template',
            name: 'Legacy Template',
            content: 'Legacy content',
            isBuiltin: false,
            metadata: {
              version: '1.0.0',
              lastModified: Date.now(),
              templateType: 'optimize',
              author: 'Legacy User'
            }
          }
        ],
        history: [
          {
            id: 'legacy-record',
            originalPrompt: 'Legacy prompt',
            optimizedPrompt: 'Legacy response',
            type: 'optimize',
            chainId: 'legacy-chain',
            version: 1,
            timestamp: Date.now(),
            modelKey: 'legacy-model',
            templateId: 'legacy-template'
          }
        ],
        userSettings: {
          'theme-id': 'light', // 旧版本键名
          'preferred-language': 'en-US' // 旧版本键名
        }
      };

      const legacyDataString = JSON.stringify(legacyData);

      // 导入旧版本数据
      await dataManager.importAllData(legacyDataString);

      // 验证导入结果
      const importedModel = await modelManager.getModel('legacy-model');
      expect(importedModel).toBeDefined();
      expect(importedModel?.enabled).toBe(false);

      const importedTemplates = await templateManager.listTemplates();
      const importedTemplate = importedTemplates.find(t => t.id === 'legacy-template');
      expect(importedTemplate).toBeDefined();

      const importedRecords = await historyManager.getRecords();
      const importedRecord = importedRecords.find(r => r.id === 'legacy-record');
      expect(importedRecord).toBeDefined();

      // 验证旧版本键名转换
      const theme = await preferenceService.get('app:settings:ui:theme-id', null);
      const language = await preferenceService.get('app:settings:ui:preferred-language', null);
      expect(theme).toBe('light');
      expect(language).toBe('en-US');
    });

    it('should handle partial import failures gracefully', async () => {
      // 准备部分有效、部分无效的数据
      const mixedData = {
        version: 1,
        data: {
          models: [
            {
              // 有效模型
              key: 'valid-model',
              name: 'Valid Model',
              baseURL: 'https://api.valid.com/v1',
              models: ['valid'],
              defaultModel: 'valid',
              provider: 'valid',
              enabled: true
            },
            {
              // 无效模型（缺少key）
              name: 'Invalid Model',
              baseURL: 'https://api.invalid.com/v1',
              models: ['invalid'],
              defaultModel: 'invalid',
              provider: 'invalid',
              enabled: true
            }
          ],
          userTemplates: [
            {
              // 有效模板
              id: 'valid-template',
              name: 'Valid Template',
              content: 'Valid content',
              isBuiltin: false,
              metadata: {
                version: '1.0.0',
                lastModified: Date.now(),
                templateType: 'optimize',
                author: 'User'
              }
            }
          ],
          history: [
            {
              // 有效记录
              id: 'valid-record',
              originalPrompt: 'Valid prompt',
              optimizedPrompt: 'Valid response',
              type: 'optimize',
              chainId: 'valid-chain',
              version: 1,
              timestamp: Date.now(),
              modelKey: 'valid-model',
              templateId: 'valid-template'
            }
          ],
          userSettings: {
            'app:settings:ui:theme-id': 'dark', // 有效设置
            'malicious-key': 'malicious-value' // 无效设置
          }
        }
      };

      const mixedDataString = JSON.stringify(mixedData);

      // 导入混合数据，应该不抛出错误
      await expect(dataManager.importAllData(mixedDataString)).resolves.not.toThrow();

      // 验证有效数据被导入
      const validModel = await modelManager.getModel('valid-model');
      expect(validModel).toBeDefined();

      const templates = await templateManager.listTemplates();
      const validTemplate = templates.find(t => t.id === 'valid-template');
      expect(validTemplate).toBeDefined();

      const records = await historyManager.getRecords();
      const validRecord = records.find(r => r.id === 'valid-record');
      expect(validRecord).toBeDefined();

      const theme = await preferenceService.get('app:settings:ui:theme-id', null);
      expect(theme).toBe('dark');

      // 验证无效数据被跳过
      const maliciousValue = await preferenceService.get('malicious-key', null);
      expect(maliciousValue).toBe(null);
    });

    it('should handle invalid JSON format', async () => {
      const invalidJson = 'invalid json string';

      await expect(dataManager.importAllData(invalidJson))
        .rejects.toMatchObject({ code: DATA_ERROR_CODES.INVALID_JSON });
    });

    it('should handle invalid data structure', async () => {
      const invalidData = JSON.stringify('string instead of object');

      await expect(dataManager.importAllData(invalidData))
        .rejects.toMatchObject({ code: DATA_ERROR_CODES.INVALID_FORMAT });
    });
  });

  describe('Service Coordination', () => {
    it('should call each service exportData method', async () => {
      // 监视各个服务的exportData方法
      const modelExportSpy = vi.spyOn(modelManager, 'exportData');
      const templateExportSpy = vi.spyOn(templateManager, 'exportData');
      const historyExportSpy = vi.spyOn(historyManager, 'exportData');
      const preferenceExportSpy = vi.spyOn(preferenceService, 'exportData');

      await dataManager.exportAllData();

      expect(modelExportSpy).toHaveBeenCalledOnce();
      expect(templateExportSpy).toHaveBeenCalledOnce();
      expect(historyExportSpy).toHaveBeenCalledOnce();
      expect(preferenceExportSpy).toHaveBeenCalledOnce();
    });

    it('should call each service importData method', async () => {
      const testData = {
        version: 1,
        data: {
          models: [],
          userTemplates: [],
          history: [],
          userSettings: {}
        }
      };

      // 监视各个服务的importData方法
      const modelImportSpy = vi.spyOn(modelManager, 'importData');
      const templateImportSpy = vi.spyOn(templateManager, 'importData');
      const historyImportSpy = vi.spyOn(historyManager, 'importData');
      const preferenceImportSpy = vi.spyOn(preferenceService, 'importData');

      await dataManager.importAllData(JSON.stringify(testData));

      expect(modelImportSpy).toHaveBeenCalledWith([]);
      expect(templateImportSpy).toHaveBeenCalledWith([]);
      expect(historyImportSpy).toHaveBeenCalledWith([]);
      expect(preferenceImportSpy).toHaveBeenCalledWith({});
    });
  });
});
