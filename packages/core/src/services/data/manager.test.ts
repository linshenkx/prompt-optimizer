import { DataManager } from './manager';
import { IHistoryManager, PromptRecord } from '../history/types';
import { IModelManager, ModelConfig } from '../model/types';
import { ITemplateManager, Template } from '../template/types';

// Define full mocks for the managers
const mockHistoryManager: jest.Mocked<IHistoryManager> = {
  getRecords: jest.fn(),
  clearHistory: jest.fn(),
  addRecord: jest.fn(),
  getRecord: jest.fn(),
  deleteRecord: jest.fn(),
  getIterationChain: jest.fn(),
  getAllChains: jest.fn(),
  createNewChain: jest.fn(),
  addIteration: jest.fn(),
};

const mockModelManager: jest.Mocked<IModelManager> = {
  getAllModels: jest.fn(),
  deleteModel: jest.fn(),
  addModel: jest.fn(),
  getModel: jest.fn(),
  updateModel: jest.fn(),
  enableModel: jest.fn(),
  disableModel: jest.fn(),
  getEnabledModels: jest.fn(),
};

const mockTemplateManager: jest.Mocked<ITemplateManager> = {
  listTemplates: jest.fn(),
  deleteTemplate: jest.fn(),
  saveTemplate: jest.fn(),
  getTemplate: jest.fn(),
  exportTemplate: jest.fn(),
  importTemplate: jest.fn(), // DataManager uses saveTemplate for its import logic
  clearCache: jest.fn(),
  listTemplatesByType: jest.fn(),
};

describe('DataManager', () => {
  let dataManager: DataManager;

  // Sample data for testing
  const sampleHistory: PromptRecord[] = [
    { id: 'h1', originalPrompt: 'History Prompt 1', optimizedPrompt: 'Opt HP1', type: 'optimize', chainId: 'c1', version: 1, timestamp: 1, modelKey: 'mk1', templateId: 'tId1' } as PromptRecord,
    { id: 'h2', originalPrompt: 'History Prompt 2', optimizedPrompt: 'Opt HP2', type: 'optimize', chainId: 'c2', version: 1, timestamp: 2, modelKey: 'mk2', templateId: 'tId2' } as PromptRecord,
  ];
  const sampleModels: Array<ModelConfig & { key: string }> = [
    { key: 'm1', name: 'Model One', baseURL: 'url1', models: ['m1v1'], defaultModel: 'm1v1', enabled: true, provider: 'custom' } as (ModelConfig & { key: string }),
    { key: 'm2', name: 'Model Two', baseURL: 'url2', models: ['m2v1'], defaultModel: 'm2v1', enabled: false, provider: 'custom' } as (ModelConfig & { key: string }),
  ];
  const sampleUserTemplates: Template[] = [
    { id: 't1', name: 'Template One', content: 'content1', metadata: { templateType: 'optimize', version: '1', lastModified: 1 }, isBuiltin: false } as Template,
  ];
  const sampleBuiltinTemplates: Template[] = [
    { id: 'b1', name: 'Built-in Template One', content: 'contentB1', metadata: { templateType: 'optimize', version: '1', lastModified: 1 }, isBuiltin: true } as Template,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    dataManager = new DataManager(mockHistoryManager, mockModelManager, mockTemplateManager);

    // Default mock implementations for "get" and "list" methods
    mockHistoryManager.getRecords.mockResolvedValue([]);
    mockModelManager.getAllModels.mockResolvedValue([]);
    mockTemplateManager.listTemplates.mockResolvedValue([]);

    // Default mock implementations for "clear", "delete", "add", "save" methods
    mockHistoryManager.clearHistory.mockResolvedValue(undefined);
    mockHistoryManager.addRecord.mockResolvedValue(undefined);
    mockModelManager.deleteModel.mockResolvedValue(undefined);
    mockModelManager.addModel.mockResolvedValue(undefined);
    mockTemplateManager.deleteTemplate.mockResolvedValue(undefined);
    mockTemplateManager.saveTemplate.mockResolvedValue(undefined);
  });

  describe('exportAllData', () => {
    it('should fetch data from all managers and serialize to JSON, filtering built-in templates', async () => {
      mockHistoryManager.getRecords.mockResolvedValue(sampleHistory);
      mockModelManager.getAllModels.mockResolvedValue(sampleModels);
      mockTemplateManager.listTemplates.mockResolvedValue([...sampleUserTemplates, ...sampleBuiltinTemplates]);

      const jsonResult = await dataManager.exportAllData();
      const expectedData = {
        history: sampleHistory,
        models: sampleModels,
        userTemplates: sampleUserTemplates, // Important: built-in templates should be filtered out
      };

      expect(JSON.parse(jsonResult)).toEqual(expectedData);
      expect(mockHistoryManager.getRecords).toHaveBeenCalledTimes(1);
      expect(mockModelManager.getAllModels).toHaveBeenCalledTimes(1);
      expect(mockTemplateManager.listTemplates).toHaveBeenCalledTimes(1);
    });

    it('should return empty arrays in JSON if all managers return empty data', async () => {
      // Default mocks already return empty arrays
      const jsonResult = await dataManager.exportAllData();
      const expectedData = {
        history: [],
        models: [],
        userTemplates: [],
      };
      expect(JSON.parse(jsonResult)).toEqual(expectedData);
    });
  });

  describe('importAllData', () => {
    const fullImportData = {
      history: sampleHistory,
      models: sampleModels,
      userTemplates: sampleUserTemplates,
    };
    const jsonData = JSON.stringify(fullImportData);

    it('should clear existing data and import new data correctly', async () => {
      // Setup mocks to return some "existing" data to ensure clear operations are called
      const existingModel = { key: 'oldM1', name: 'Old Model' } as (ModelConfig & {key: string});
      const existingUserTemplate = { id: 'oldT1', name: 'Old User Template', isBuiltin: false } as Template;
      const existingBuiltinTemplate = { id: 'oldB1', name: 'Old Built-in Template', isBuiltin: true } as Template;
      
      mockModelManager.getAllModels.mockResolvedValueOnce([existingModel]);
      mockTemplateManager.listTemplates.mockResolvedValueOnce([existingUserTemplate, existingBuiltinTemplate]);

      await dataManager.importAllData(jsonData);

      // Verify clear operations
      expect(mockHistoryManager.clearHistory).toHaveBeenCalledTimes(1);
      expect(mockModelManager.getAllModels).toHaveBeenCalledTimes(1); // Called once for clearing
      expect(mockModelManager.deleteModel).toHaveBeenCalledWith(existingModel.key);
      expect(mockTemplateManager.listTemplates).toHaveBeenCalledTimes(1); // Called once for clearing
      expect(mockTemplateManager.deleteTemplate).toHaveBeenCalledWith(existingUserTemplate.id);
      expect(mockTemplateManager.deleteTemplate).not.toHaveBeenCalledWith(existingBuiltinTemplate.id); // Built-ins not deleted

      // Verify add/save operations
      expect(mockHistoryManager.addRecord).toHaveBeenCalledTimes(sampleHistory.length);
      for (const record of sampleHistory) {
        expect(mockHistoryManager.addRecord).toHaveBeenCalledWith(record);
      }

      expect(mockModelManager.addModel).toHaveBeenCalledTimes(sampleModels.length);
      for (const model of sampleModels) {
        const { key, ...config } = model;
        expect(mockModelManager.addModel).toHaveBeenCalledWith(key, config);
      }

      expect(mockTemplateManager.saveTemplate).toHaveBeenCalledTimes(sampleUserTemplates.length);
      for (const template of sampleUserTemplates) {
        expect(mockTemplateManager.saveTemplate).toHaveBeenCalledWith(template);
      }
    });

    it('should throw an error for invalid JSON string', async () => {
      const invalidJson = "{ not: json, definitely: not json";
      await expect(dataManager.importAllData(invalidJson)).rejects.toThrow(/Invalid JSON format/);
    });

    it('should throw an error for null or non-object data', async () => {
        await expect(dataManager.importAllData("null")).rejects.toThrow('Invalid import data format: Expected an object.');
        await expect(dataManager.importAllData("[]")).rejects.toThrow('Invalid import data format: Expected an object.');
    });
    
    it('should throw an error if history is not an array', async () => {
      const invalidData = JSON.stringify({ history: "not-an-array" });
      await expect(dataManager.importAllData(invalidData)).rejects.toThrow('Invalid history data: Expected an array.');
    });

    it('should throw an error if models is not an array', async () => {
      const invalidData = JSON.stringify({ models: {} });
      await expect(dataManager.importAllData(invalidData)).rejects.toThrow('Invalid models data: Expected an array.');
    });

    it('should throw an error if userTemplates is not an array', async () => {
      const invalidData = JSON.stringify({ userTemplates: "incorrect type" });
      await expect(dataManager.importAllData(invalidData)).rejects.toThrow('Invalid userTemplates data: Expected an array.');
    });

    it('should successfully import partial data (only history)', async () => {
      const partialData = { history: sampleHistory };
      const partialJson = JSON.stringify(partialData);
      await dataManager.importAllData(partialJson);

      expect(mockHistoryManager.clearHistory).toHaveBeenCalled();
      expect(mockHistoryManager.addRecord).toHaveBeenCalledTimes(sampleHistory.length);
      expect(mockModelManager.deleteModel).not.toHaveBeenCalled(); // Since no models in import, getAllModels for clear might not run or return []
      expect(mockModelManager.addModel).not.toHaveBeenCalled();
      expect(mockTemplateManager.deleteTemplate).not.toHaveBeenCalled();
      expect(mockTemplateManager.saveTemplate).not.toHaveBeenCalled();
    });

    it('should continue importing other items if one item fails and logs a warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const problematicHistory = [
        sampleHistory[0], // This one will be fine
        { ...sampleHistory[1], id: 'h-error' } as PromptRecord, // This one will cause addRecord to throw
      ];
      const importDataWithError = { history: problematicHistory, models: [], userTemplates: [] };
      const jsonWithError = JSON.stringify(importDataWithError);

      mockHistoryManager.addRecord.mockImplementation(async (record: PromptRecord) => {
        if (record.id === 'h-error') {
          throw new Error("Simulated addRecord error");
        }
        return Promise.resolve();
      });

      await dataManager.importAllData(jsonWithError);

      expect(mockHistoryManager.addRecord).toHaveBeenCalledWith(problematicHistory[0]);
      expect(mockHistoryManager.addRecord).toHaveBeenCalledWith(problematicHistory[1]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping history record due to error: Simulated addRecord error"),
        problematicHistory[1]
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should correctly clear only user templates, not built-in ones', async () => {
        const existingUserTemplate = { id: 'userT1', name: 'User T1', isBuiltin: false } as Template;
        const existingBuiltinTemplate = { id: 'builtinT1', name: 'Builtin T1', isBuiltin: true } as Template;
        mockTemplateManager.listTemplates.mockResolvedValueOnce([existingUserTemplate, existingBuiltinTemplate]);

        const emptyImportData = JSON.stringify({ history: [], models: [], userTemplates: [] });
        await dataManager.importAllData(emptyImportData);

        expect(mockTemplateManager.deleteTemplate).toHaveBeenCalledWith(existingUserTemplate.id);
        expect(mockTemplateManager.deleteTemplate).not.toHaveBeenCalledWith(existingBuiltinTemplate.id);
    });
  });
});
