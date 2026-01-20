import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataManager } from '../../../src/services/data/manager';
import { IHistoryManager } from '../../../src/services/history/types';
import { IModelManager } from '../../../src/services/model/types';
import { ITemplateManager, Template } from '../../../src/services/template/types';
import { IPreferenceService } from '../../../src/services/preference/types';
import { ContextRepo } from '../../../src/services/context/types';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { DATA_ERROR_CODES } from '../../../src/constants/error-codes';

describe('DataManager', () => {
  let dataManager: DataManager;
  let mockModelManager: IModelManager;
  let mockTemplateManager: ITemplateManager;
  let mockHistoryManager: IHistoryManager;
  let mockPreferenceService: IPreferenceService;
  let mockContextRepo: ContextRepo;
  let mockStorageProvider: MemoryStorageProvider;

  beforeEach(() => {
    // 1. 创建存储提供者的mock
    mockStorageProvider = new MemoryStorageProvider();

    // 2. 创建PreferenceService的mock
    mockPreferenceService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue({}),
      exportData: vi.fn().mockResolvedValue({}),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockReturnValue('userSettings'),
      validateData: vi.fn().mockReturnValue(true),
    };

    // 3. 为每个管理器创建全面的模拟对象
    mockModelManager = {
      getAllModels: vi.fn().mockResolvedValue([]),
      addModel: vi.fn().mockResolvedValue(undefined),
      updateModel: vi.fn().mockResolvedValue(undefined),
      deleteModel: vi.fn().mockResolvedValue(undefined),
      enableModel: vi.fn().mockResolvedValue(undefined),
      disableModel: vi.fn().mockResolvedValue(undefined),
      getModel: vi.fn().mockResolvedValue(null),
      getEnabledModels: vi.fn().mockResolvedValue([]),
      getDefaultModel: vi.fn().mockResolvedValue(null),
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockResolvedValue(true),
      exportData: vi.fn(),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockResolvedValue('models'),
      validateData: vi.fn().mockReturnValue(true),
    };

    mockTemplateManager = {
      listTemplates: vi.fn().mockReturnValue([]),
      saveTemplate: vi.fn().mockResolvedValue(undefined),
      getTemplate: vi.fn(),
      deleteTemplate: vi.fn().mockResolvedValue(undefined),
      exportTemplate: vi.fn(),
      importTemplate: vi.fn().mockResolvedValue(undefined),
      changeBuiltinTemplateLanguage: vi.fn().mockResolvedValue(undefined),
      getCurrentBuiltinTemplateLanguage: vi.fn().mockReturnValue('en-US'),
      getSupportedBuiltinTemplateLanguages: vi.fn().mockReturnValue(['en-US', 'zh-CN']),
      reloadBuiltinTemplates: vi.fn().mockResolvedValue(undefined),
      listTemplatesByType: vi.fn().mockReturnValue([]),
      addTemplate: vi.fn().mockResolvedValue(undefined),
      exportData: vi.fn(),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockResolvedValue('userTemplates'),
      validateData: vi.fn().mockReturnValue(true),
    };

    mockHistoryManager = {
      getRecords: vi.fn().mockResolvedValue([]),
      addRecord: vi.fn().mockResolvedValue(undefined),
      clearHistory: vi.fn().mockResolvedValue(undefined),
      getRecord: vi.fn().mockResolvedValue(null),
      updateRecord: vi.fn().mockResolvedValue(undefined),
      deleteRecord: vi.fn().mockResolvedValue(undefined),
      getChain: vi.fn().mockResolvedValue(null),
      getAllChains: vi.fn().mockResolvedValue([]),
      deleteChain: vi.fn().mockResolvedValue(undefined),
      getIterationChain: vi.fn().mockResolvedValue([]),
      createNewChain: vi.fn().mockResolvedValue({}),
      addIteration: vi.fn().mockResolvedValue({}),
      exportData: vi.fn(),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockReturnValue('history'),
      validateData: vi.fn().mockReturnValue(true),
    };

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

    // 4. 使用正确的参数顺序实例化 DataManager
    dataManager = new DataManager(
      mockModelManager,
      mockTemplateManager,
      mockHistoryManager,
      mockPreferenceService,
      mockContextRepo
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportAllData', () => {
    it('should fetch data from all managers and return a JSON string', async () => {
      const models = [{ id: 'model1', name: 'Test Model' }];
      const templates: Template[] = [{ id: 'tpl1', name: 'Test Template', content: 'c', isBuiltin: false, metadata: { templateType: 'optimize', version: '1.0', lastModified: 0 } }];
      const history = [{
        id: 'hist1',
        originalPrompt: 'Test Prompt',
        optimizedPrompt: 'Test Response',
        type: 'optimize',
        chainId: 'chain-hist1',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'test-model',
        templateId: 'test-template'
      }];
      
      (mockModelManager.exportData as vi.Mock).mockResolvedValue(models);
      (mockTemplateManager.exportData as vi.Mock).mockResolvedValue(templates.filter(t => !t.isBuiltin));
      (mockHistoryManager.exportData as vi.Mock).mockResolvedValue(history as any);
      (mockPreferenceService.exportData as vi.Mock).mockResolvedValue({});

      const jsonString = await dataManager.exportAllData();
      const data = JSON.parse(jsonString);

      expect(data.version).toBe(1);
      expect(data.data.models).toEqual(models);
      expect(data.data.userTemplates).toEqual(templates.filter(t => !t.isBuiltin));
      expect(data.data.history).toEqual(history);
    });
  });

  describe('importAllData', () => {
    const importData = {
      version: 1,
      data: {
        models: [{ key: 'imp-model1', id: 'imp-model1', name: 'Imported Model' }],
        userTemplates: [{ id: 'imp-tpl1', name: 'Imported Template', content: 'test content', isBuiltin: false, metadata: { templateType: 'optimize', version: '1.0', lastModified: 0 } }],
        history: [{
          id: 'imp-hist1',
          originalPrompt: 'Imported Prompt',
          optimizedPrompt: 'Optimized Response',
          type: 'optimize',
          chainId: 'chain-imp-hist1',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'test-model',
          templateId: 'test-template'
        }],
        userSettings: { 'app:settings:ui:theme-id': 'dark' },
      },
    };

    it('should clear existing data and import new data', async () => {
      await dataManager.importAllData(JSON.stringify(importData));

      expect(mockModelManager.importData).toHaveBeenCalledWith(importData.data.models);
      expect(mockTemplateManager.importData).toHaveBeenCalledWith(importData.data.userTemplates);
      expect(mockHistoryManager.importData).toHaveBeenCalledWith(importData.data.history);
      expect(mockPreferenceService.importData).toHaveBeenCalledWith(importData.data.userSettings);
    });

    it('should throw an error for invalid JSON string', async () => {
      await expect(dataManager.importAllData('invalid-json'))
        .rejects.toMatchObject({ code: DATA_ERROR_CODES.INVALID_JSON });
    });

    it('should throw an error for data without a "data" property in new format', async () => {
      await expect(dataManager.importAllData(JSON.stringify({ version: 1 })))
        .rejects.toMatchObject({ code: DATA_ERROR_CODES.INVALID_FORMAT });
    });

    it('should support old format for backward compatibility', async () => {
      const oldFormatData = {
        history: [{
          id: 'old-hist1',
          originalPrompt: 'Old Format Prompt',
          optimizedPrompt: 'Old Format Response',
          type: 'optimize',
          chainId: 'chain-old-hist1',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'old-model',
          templateId: 'old-template'
        }],
        models: [{ key: 'old-model1', name: 'Old Format Model' }],
        userTemplates: [{ id: 'old-tpl1', name: 'Old Format Template', content: 'old content', isBuiltin: false, metadata: { templateType: 'optimize', version: '1.0', lastModified: 0 } }],
        userSettings: { 'app:settings:ui:theme-id': 'light' },
      };
      
      await expect(dataManager.importAllData(JSON.stringify(oldFormatData))).resolves.not.toThrow();
      expect(mockModelManager.importData).toHaveBeenCalled();
      expect(mockTemplateManager.importData).toHaveBeenCalled();
      expect(mockHistoryManager.importData).toHaveBeenCalled();
      expect(mockPreferenceService.importData).toHaveBeenCalled();
    });
    
    it('should not throw error if parts of data are missing', async () => {
        const partialData = { version: 1, data: { models: [{ key: 'm1', name: 'Model 1' }] } };
        await expect(dataManager.importAllData(JSON.stringify(partialData))).resolves.not.toThrow();
        expect(mockModelManager.importData).toHaveBeenCalled();
        expect(mockTemplateManager.importData).not.toHaveBeenCalled();
    });

    it('should only import whitelisted UI settings', async () => {
      const securityTestPayload = {
        version: 1,
        data: {
          userSettings: {
            'app:settings:ui:theme-id': 'dark',
            'app:settings:ui:malicious-key': 'value', // This should be ignored
          },
        },
      };
      await dataManager.importAllData(JSON.stringify(securityTestPayload));
      expect(mockPreferenceService.importData).toHaveBeenCalledWith(securityTestPayload.data.userSettings);
    });

    it('should handle legacy UI setting keys with backward compatibility', async () => {
      const legacyTestPayload = {
        version: 1,
        data: {
          userSettings: {
            // 旧版本的简短键名
            'theme-id': 'dark',
            'preferred-language': 'en',
            'builtin-template-language': 'zh',
            // 新版本的完整键名
            'app:selected-optimize-model': 'gemini',
            // 无效的键名
            'invalid-key': 'should-be-ignored'
          },
        },
      };

      await dataManager.importAllData(JSON.stringify(legacyTestPayload));

      // 验证 PreferenceService 的 importData 被调用
      expect(mockPreferenceService.importData).toHaveBeenCalledWith(legacyTestPayload.data.userSettings);
    });
  });
});
