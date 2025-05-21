import { ModelManager } from './manager';
import { IStorageProvider } from '../storage/types';
import { ModelConfig } from './types';
import { ModelConfigError, StorageError } from '../llm/errors'; // Assuming StorageError is also in llm/errors or similar
import { defaultModels } from './defaults';

// Helper to create a deep copy of defaultModels for isolated tests
const getCleanDefaultModels = () => JSON.parse(JSON.stringify(defaultModels));

describe('ModelManager', () => {
  let modelManager: ModelManager;
  let mockStorage: jest.Mocked<IStorageProvider>;
  const testStorageKey = 'models'; // Matches manager's storageKey

  const createModelConfig = (name: string, enabled = true, apiKey = 'test_api_key', models = ['model1', 'model2'], defaultModel = 'model1', provider = 'custom'): ModelConfig => ({
    name,
    baseURL: `http://localhost/${name}/v1`,
    models,
    defaultModel,
    apiKey,
    enabled,
    provider,
  });

  beforeEach(async () => { // Make beforeEach async to await init if needed
    mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(), // Not directly used by ModelManager but good to have
      clearAll: jest.fn(),   // Not directly used by ModelManager
    };
    
    // Default: storage is empty. This is crucial for init tests.
    mockStorage.getItem.mockResolvedValue(null); 
    mockStorage.setItem.mockResolvedValue(undefined);
    
    modelManager = new ModelManager(mockStorage);
    // Allow the async init() in the constructor to complete.
    // Jest runs promises in `beforeEach` to completion before tests.
    // For explicit control or if init wasn't called in constructor, you might need:
    // await new Promise(resolve => setTimeout(resolve, 0)); 

    // Clear mocks for getItem/setItem that might have been called during init
    // (or by the time tests run if init is awaited/completed)
    mockStorage.getItem.mockClear();
    mockStorage.setItem.mockClear();
  });

  describe('Initialization', () => {
    it('should load default models and save them if storage is initially empty', async () => {
      // This test relies on a fresh ModelManager instance where init was called
      // with mockStorage.getItem resolving to null.
      const newMockStorage = { 
        getItem: jest.fn().mockResolvedValue(null), 
        setItem: jest.fn().mockResolvedValue(undefined), 
        removeItem: jest.fn(), clearAll: jest.fn() 
      };
      const newManager = new ModelManager(newMockStorage);
      // Wait for the init promise chain to resolve
      await new Promise(resolve => setTimeout(resolve, 0)); 

      expect(newMockStorage.getItem).toHaveBeenCalledWith(testStorageKey);
      // Check if setItem was called to save default models
      expect(newMockStorage.setItem).toHaveBeenCalledWith(testStorageKey, JSON.stringify(defaultModels));
    });
    
    it('should load models from storage and merge missing defaults if storage is partially populated', async () => {
        const storedModels = {
          'userModel1': createModelConfig('UserModel1'),
          // Missing some default models, e.g., defaultModels.deepseek
        };
        const expectedMergedModels = { ...defaultModels, ...storedModels };
  
        const newMockStorage = { 
          getItem: jest.fn().mockResolvedValue(JSON.stringify(storedModels)), 
          setItem: jest.fn().mockResolvedValue(undefined),
          removeItem: jest.fn(), clearAll: jest.fn() 
        };
        const newManager = new ModelManager(newMockStorage);
        await new Promise(resolve => setTimeout(resolve, 0));
  
        expect(newMockStorage.getItem).toHaveBeenCalledWith(testStorageKey);
        // setItem should be called because default models were merged
        expect(newMockStorage.setItem).toHaveBeenCalledWith(testStorageKey, JSON.stringify(expectedMergedModels));
      });

    it('should load models from storage and not call setItem if all defaults are present', async () => {
        const storedUserModels = {
            'userModel1': createModelConfig('UserModel1'),
            ...getCleanDefaultModels() // Ensure all defaults are included
        };
        const newMockStorage = { 
            getItem: jest.fn().mockResolvedValue(JSON.stringify(storedUserModels)), 
            setItem: jest.fn().mockResolvedValue(undefined),
            removeItem: jest.fn(), clearAll: jest.fn()
         };
        const newManager = new ModelManager(newMockStorage);
        await new Promise(resolve => setTimeout(resolve, 0)); 

        expect(newMockStorage.getItem).toHaveBeenCalledWith(testStorageKey);
        expect(newMockStorage.setItem).not.toHaveBeenCalled(); 
    });
  });

  describe('addModel', () => {
    it('should add a new model and save', async () => {
      mockStorage.getItem.mockResolvedValue(JSON.stringify({})); // Start with empty models from storage
      const newModel = createModelConfig('NewModel');
      await modelManager.addModel('newKey', newModel);
      
      expect(mockStorage.getItem).toHaveBeenCalledWith(testStorageKey); // Called by addModel
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        testStorageKey,
        JSON.stringify({ newKey: newModel })
      );
    });

    it('should throw ModelConfigError when adding a model with an existing key', async () => {
      const existingModels = { 'existingKey': createModelConfig('ExistingModel') };
      mockStorage.getItem.mockResolvedValue(JSON.stringify(existingModels));
      const newModel = createModelConfig('NewModel');
      
      await expect(modelManager.addModel('existingKey', newModel)).rejects.toThrow(ModelConfigError);
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('should throw ModelConfigError when adding a model with invalid config (e.g. missing name)', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify({}));
        const invalidModel = { ...createModelConfig('Invalid'), name: '' };
        
        await expect(modelManager.addModel('invalidKey', invalidModel)).rejects.toThrow(ModelConfigError);
        expect(mockStorage.setItem).not.toHaveBeenCalled();
      });
  });
  
  describe('getAllModels', () => {
    it('should return all models including their keys', async () => {
        const modelsInStorage = { 'key1': createModelConfig('Model1') };
        mockStorage.getItem.mockResolvedValue(JSON.stringify(modelsInStorage));
        
        const result = await modelManager.getAllModels();
        expect(result.length).toBe(1);
        expect(result[0].key).toBe('key1');
        expect(result[0].name).toBe('Model1');
    });

    it('should return default models if storage was initially empty (after init)', async () => {
        // This state is after constructor's init has run with empty storage
        const newMockStorage = { 
            getItem: jest.fn().mockResolvedValue(null), // First init call sees null
            setItem: jest.fn().mockResolvedValue(undefined),
            removeItem: jest.fn(), clearAll: jest.fn()
        };
        const newManager = new ModelManager(newMockStorage);
        await new Promise(resolve => setTimeout(resolve, 0)); // allow init
        
        // Now, when getAllModels is called, it should see the defaults that were just saved
        newMockStorage.getItem.mockResolvedValue(JSON.stringify(defaultModels)); 
        
        const result = await newManager.getAllModels();
        expect(result.length).toBe(Object.keys(defaultModels).length);
        // Check for a known default model key
        const deepseekDefaultKey = Object.keys(defaultModels).find(k => k.includes('deepseek'));
        expect(result.find(m => m.key === deepseekDefaultKey)).toBeDefined();
    });
  });

  describe('getModel', () => {
    it('should retrieve an existing model by key', async () => {
        const model = createModelConfig('MyModel');
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 'myKey': model }));
        
        const result = await modelManager.getModel('myKey');
        expect(result).toEqual(model);
    });

    it('should return undefined for a non-existent model key', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify({}));
        const result = await modelManager.getModel('nonExistentKey');
        expect(result).toBeUndefined();
    });
  });

  describe('updateModel', () => {
    it('should update an existing model and save', async () => {
        const originalModel = createModelConfig('OriginalName');
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 'updateKey': originalModel }));
        
        const updates: Partial<ModelConfig> = { name: 'UpdatedName', apiKey: 'new_api_key' };
        await modelManager.updateModel('updateKey', updates);
        
        const expectedModel = { ...originalModel, ...updates };
        expect(mockStorage.setItem).toHaveBeenCalledWith(
            testStorageKey,
            JSON.stringify({ 'updateKey': expectedModel })
        );
    });

    it('should throw ModelConfigError when updating a non-existent model', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify({}));
        await expect(modelManager.updateModel('nonExistentKey', { name: 'Update' })).rejects.toThrow(ModelConfigError);
    });

    it('should validate config if critical fields are updated (e.g. name to empty)', async () => {
        const originalModel = createModelConfig('OriginalName');
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 'updateKey': originalModel }));
        
        await expect(modelManager.updateModel('updateKey', { name: '' })).rejects.toThrow(ModelConfigError);
    });
  });

  describe('deleteModel', () => {
    it('should delete an existing model and save', async () => {
        const modelToDelete = createModelConfig('ToDelete');
        const otherModel = createModelConfig('Other');
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 'deleteKey': modelToDelete, 'otherKey': otherModel }));
        
        await modelManager.deleteModel('deleteKey');
        
        expect(mockStorage.setItem).toHaveBeenCalledWith(
            testStorageKey,
            JSON.stringify({ 'otherKey': otherModel }) // Only otherModel remains
        );
    });

    it('should throw ModelConfigError when deleting a non-existent model', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify({}));
        await expect(modelManager.deleteModel('nonExistentKey')).rejects.toThrow(ModelConfigError);
    });
  });

  describe('enableModel / disableModel', () => {
    it('should enable a model and save', async () => {
        const model = createModelConfig('ToEnable', false); // Initially disabled
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 'testKey': model }));
        
        await modelManager.enableModel('testKey');
        
        const expectedModel = { ...model, enabled: true };
        expect(mockStorage.setItem).toHaveBeenCalledWith(
            testStorageKey,
            JSON.stringify({ 'testKey': expectedModel })
        );
    });

    it('should disable a model and save', async () => {
        const model = createModelConfig('ToDisable', true); // Initially enabled
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 'testKey': model }));
        
        await modelManager.disableModel('testKey');
        
        const expectedModel = { ...model, enabled: false };
        expect(mockStorage.setItem).toHaveBeenCalledWith(
            testStorageKey,
            JSON.stringify({ 'testKey': expectedModel })
        );
    });

    it('should throw ModelConfigError if trying to enable a model with no API key', async () => {
        const modelWithoutApiKey = createModelConfig('TestModel', false, ''); // API key is empty
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 'testKey': modelWithoutApiKey }));
        
        await expect(modelManager.enableModel('testKey')).rejects.toThrow(ModelConfigError);
        expect(mockStorage.setItem).not.toHaveBeenCalled();
    });
    
    it('should throw ModelConfigError when enabling a non-existent model', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify({}));
        await expect(modelManager.enableModel('nonExistentKey')).rejects.toThrow(ModelConfigError);
    });

    it('should throw ModelConfigError when disabling a non-existent model', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify({}));
        await expect(modelManager.disableModel('nonExistentKey')).rejects.toThrow(ModelConfigError);
    });
  });

  describe('getEnabledModels', () => {
    it('should return only enabled models', async () => {
        const enabledModel = createModelConfig('EnabledModel', true);
        const disabledModel = createModelConfig('DisabledModel', false);
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 
            'enabledKey': enabledModel, 
            'disabledKey': disabledModel 
        }));
        
        const result = await modelManager.getEnabledModels();
        expect(result.length).toBe(1);
        expect(result[0].key).toBe('enabledKey');
        expect(result[0].name).toBe('EnabledModel');
    });

    it('should return empty array if no models are enabled', async () => {
        const disabledModel1 = createModelConfig('Disabled1', false);
        const disabledModel2 = createModelConfig('Disabled2', false);
        mockStorage.getItem.mockResolvedValue(JSON.stringify({ 
            'key1': disabledModel1, 
            'key2': disabledModel2 
        }));
        
        const result = await modelManager.getEnabledModels();
        expect(result).toEqual([]);
    });
  });
  
  describe('StorageError Handling', () => {
    const dummyConfig = createModelConfig('Dummy');
    const dummyKey = 'dummyKey';

    it('init should log error if getItem fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const newMockStorage = { 
            getItem: jest.fn().mockRejectedValue(new Error("Storage unavailable")), 
            setItem: jest.fn(), removeItem: jest.fn(), clearAll: jest.fn() 
        };
        // Instantiation calls init
        const _ = new ModelManager(newMockStorage);
        await new Promise(resolve => setTimeout(resolve, 0)); // allow async init to try
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('初始化模型管理器失败:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    it('getAllModels should log error and return current in-memory if getItem fails', async () => {
        // Populate in-memory models first (e.g., via init with defaults)
        const initialModels = getCleanDefaultModels();
        mockStorage.getItem.mockResolvedValueOnce(JSON.stringify(initialModels)); // For init
        await modelManager.init(); // Re-run init logic if needed, or assume constructor did it.
                                     // Here, modelManager already exists, so init has run.
                                     // We need to ensure `this.models` in manager is populated.
        
        // To ensure this.models is populated as expected for the test condition:
        (modelManager as any).models = JSON.parse(JSON.stringify(initialModels));


        mockStorage.getItem.mockClear(); // Clear init calls
        mockStorage.getItem.mockRejectedValue(new Error("Storage unavailable")); // Simulate failure for getAllModels
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        const result = await modelManager.getAllModels();
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('解析模型配置失败:', expect.any(Error));
        // Should still return the in-memory models (defaults in this case)
        expect(result.length).toBe(Object.keys(initialModels).length); 
        consoleErrorSpy.mockRestore();
    });

    it('addModel should still throw ModelConfigError for duplicate even if getItem fails to load current', async () => {
        // Simulate that 'this.models' is already populated (e.g. from a successful init)
        (modelManager as any).models = { 'existingKey': createModelConfig('Existing') };
        mockStorage.getItem.mockRejectedValue(new Error("Cannot read storage for addModel")); // getItem fails
        
        const newModel = createModelConfig('NewModel');
        // Even if it can't refresh from storage, it should check its in-memory `this.models`.
        await expect(modelManager.addModel('existingKey', newModel)).rejects.toThrow(ModelConfigError);
    });
    
    it('saveToStorage (called by add, update, delete, enable, disable) should log error if setItem fails', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify({})); // Start empty
        mockStorage.setItem.mockRejectedValue(new Error("Cannot write to storage"));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Any operation that calls saveToStorage
        await modelManager.addModel(dummyKey, dummyConfig); 
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('保存模型配置失败:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });
  });
});
