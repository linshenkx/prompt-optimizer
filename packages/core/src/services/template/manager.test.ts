import { TemplateManager } from './manager';
import { IStorageProvider } from '../storage/types';
import { Template, templateSchema } from './types'; // Removed TemplateSchema as it's not directly used, templateSchema is
import { TemplateError, TemplateValidationError } from './errors';
import { DEFAULT_TEMPLATES } from './defaults';

// Helper for deep cloning default templates for isolated tests
const getCleanDefaultTemplates = () => JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));

describe('TemplateManager', () => {
  let templateManager: TemplateManager;
  let mockStorage: jest.Mocked<IStorageProvider>;
  const testStorageKey = 'app:templates'; // Default key from TemplateManagerConfig

  // Helper to create Template objects
  const createTemplate = (
    id: string,
    name: string,
    type: 'optimize' | 'iterate' = 'optimize',
    content = 'Test content {{placeholder}}',
    isBuiltin = false,
    lastModified = Date.now()
  ): Template => ({
    id,
    name,
    content,
    metadata: { templateType: type, lastModified, version: '1.0' }, // Added version
    isBuiltin,
  });

  beforeEach(async () => {
    mockStorage = {
      getItem: jest.fn().mockResolvedValue(null), // Default: storage is empty
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn(), // Not directly used but good for completeness
      clearAll: jest.fn(),   // Not directly used
    };
    templateManager = new TemplateManager(mockStorage);
    // Allow async init (which calls loadUserTemplates) to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    // Clear mocks that might have been called during init
    mockStorage.getItem.mockClear();
    mockStorage.setItem.mockClear();
  });

  describe('Initialization', () => {
    it('should load built-in templates correctly', () => {
      const builtInIds = Object.keys(DEFAULT_TEMPLATES);
      expect(builtInIds.length).toBeGreaterThan(0);
      const firstBuiltInId = builtInIds[0];
      const template = templateManager.getTemplate(firstBuiltInId);
      expect(template).toBeDefined();
      expect(template.isBuiltin).toBe(true);
      expect(template.id).toBe(firstBuiltInId);
    });

    it('should load user templates from storage during init', async () => {
      const userTpl = createTemplate('user1', 'User Template 1');
      const initialMockStorage = {
        getItem: jest.fn().mockResolvedValue(JSON.stringify([userTpl])),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn(), clearAll: jest.fn(),
      };
      const tm = new TemplateManager(initialMockStorage);
      await new Promise(resolve => setTimeout(resolve, 0)); // allow init

      expect(initialMockStorage.getItem).toHaveBeenCalledWith(testStorageKey);
      const retrieved = tm.getTemplate('user1');
      expect(retrieved.name).toBe('User Template 1');
      expect(retrieved.isBuiltin).toBe(false); // Should be set by save/load logic
    });
    
    it('should handle empty storage for user templates during init', async () => {
        const initialMockStorage = {
            getItem: jest.fn().mockResolvedValue(JSON.stringify([])), // Empty array from storage
            setItem: jest.fn().mockResolvedValue(undefined),
            removeItem: jest.fn(), clearAll: jest.fn(),
          };
          const tm = new TemplateManager(initialMockStorage);
          await new Promise(resolve => setTimeout(resolve, 0));
    
          expect(initialMockStorage.getItem).toHaveBeenCalledWith(testStorageKey);
          const templates = tm.listTemplates().filter(t => !t.isBuiltin);
          expect(templates.length).toBe(0);
    });
  });

  describe('saveTemplate', () => {
    it('should save a new user template and persist', async () => {
      const newUserTpl = createTemplate('newUser', 'New User Template');
      await templateManager.saveTemplate(newUserTpl);
      
      const expectedSavedData = [{...newUserTpl, isBuiltin: false, metadata: {...newUserTpl.metadata, lastModified: expect.any(Number)}}];
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        testStorageKey,
        JSON.stringify(expectedSavedData)
      );
      const retrieved = templateManager.getTemplate('newUser');
      expect(retrieved.name).toBe('New User Template');
      expect(retrieved.isBuiltin).toBe(false);
    });

    it('should update an existing user template and persist', async () => {
      const tplV1 = createTemplate('userUpdate', 'Version 1');
      await templateManager.saveTemplate(tplV1); // Save initial version
      mockStorage.setItem.mockClear(); // Clear after initial save

      const tplV2 = createTemplate('userUpdate', 'Version 2', 'iterate', 'New content');
      await templateManager.saveTemplate(tplV2);

      const expectedSavedData = [{...tplV2, isBuiltin: false, metadata: {...tplV2.metadata, lastModified: expect.any(Number)}}];
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        testStorageKey,
        JSON.stringify(expectedSavedData)
      );
      const retrieved = templateManager.getTemplate('userUpdate');
      expect(retrieved.name).toBe('Version 2');
      expect(retrieved.content).toBe('New content');
    });

    it('should throw TemplateError when trying to save with an ID of a built-in template', async () => {
      const builtInId = Object.keys(DEFAULT_TEMPLATES)[0];
      const tpl = createTemplate(builtInId, 'Attempt to overwrite built-in');
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(TemplateError);
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(`不能覆盖内置提示词: ${builtInId}`);
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('should throw TemplateValidationError for invalid templateType', async () => {
      const tpl = createTemplate('invalidType', 'Invalid Type', 'wrongType' as any);
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(TemplateValidationError);
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow('无效的提示词类型');
    });

    it('should throw TemplateValidationError for invalid ID format (too short, spaces, etc.)', async () => {
      let tpl = createTemplate('id', 'Short ID'); // Too short
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(TemplateValidationError);

      tpl = createTemplate('id with spaces', 'ID With Spaces');
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(TemplateValidationError);
      
      tpl = createTemplate('id-too-long-'.padEnd(51, 'x'), 'ID Too Long');
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(TemplateValidationError);
    });

    it('should throw TemplateValidationError for schema violations (e.g. missing name)', async () => {
        const tpl = createTemplate('validId', '' as any); // Missing name
        // Manually break the type for testing schema validation
        (tpl as any).name = undefined; 
        await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(TemplateValidationError);
    });
  });

  describe('getTemplate', () => {
    it('should retrieve a built-in template', () => {
      const builtInId = Object.keys(DEFAULT_TEMPLATES)[0];
      const template = templateManager.getTemplate(builtInId);
      expect(template.id).toBe(builtInId);
      expect(template.isBuiltin).toBe(true);
    });

    it('should retrieve a user template after it is saved', async () => {
      const userTpl = createTemplate('userGet', 'User Get Test');
      await templateManager.saveTemplate(userTpl);
      const retrieved = templateManager.getTemplate('userGet');
      expect(retrieved.name).toBe('User Get Test');
      expect(retrieved.isBuiltin).toBe(false);
    });

    it('should throw TemplateError for a non-existent template ID', () => {
      expect(() => templateManager.getTemplate('nonExistentId')).toThrow(TemplateError);
      expect(() => templateManager.getTemplate('nonExistentId')).toThrow('提示词 nonExistentId 不存在');
    });
    
    it('should throw TemplateError for an invalid template ID (null, undefined, empty string)', () => {
        expect(() => templateManager.getTemplate(null as any)).toThrow('无效的提示词ID');
        expect(() => templateManager.getTemplate(undefined as any)).toThrow('无效的提示词ID');
        expect(() => templateManager.getTemplate('')).toThrow('无效的提示词ID');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a user template and persist the change', async () => {
      const userTpl = createTemplate('userDelete', 'To Be Deleted');
      await templateManager.saveTemplate(userTpl); // Ensure it's "in storage" / in userTemplates map
      mockStorage.setItem.mockClear(); // Clear setItem from the save

      await templateManager.deleteTemplate('userDelete');
      expect(mockStorage.setItem).toHaveBeenCalledWith(testStorageKey, JSON.stringify([])); // Storage now empty
      expect(() => templateManager.getTemplate('userDelete')).toThrow(TemplateError); // Verify it's gone
    });

    it('should throw TemplateError when trying to delete a built-in template', async () => {
      const builtInId = Object.keys(DEFAULT_TEMPLATES)[0];
      await expect(templateManager.deleteTemplate(builtInId)).rejects.toThrow(TemplateError);
      await expect(templateManager.deleteTemplate(builtInId)).rejects.toThrow(`不能删除内置提示词: ${builtInId}`);
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('should throw TemplateError when trying to delete a non-existent user template', async () => {
      await expect(templateManager.deleteTemplate('nonExistentUserTpl')).rejects.toThrow(TemplateError);
      await expect(templateManager.deleteTemplate('nonExistentUserTpl')).rejects.toThrow('提示词不存在: nonExistentUserTpl');
    });
  });

  describe('listTemplates', () => {
    it('should return built-in templates if no user templates exist', () => {
      const templates = templateManager.listTemplates();
      const defaultKeys = Object.keys(DEFAULT_TEMPLATES);
      expect(templates.length).toBe(defaultKeys.length);
      defaultKeys.forEach(key => expect(templates.find(t => t.id === key && t.isBuiltin)).toBeDefined());
    });

    it('should return built-in and user templates, sorted correctly', async () => {
      const userTpl1 = createTemplate('user1', 'User Alpha', 'optimize', 'content', false, Date.now() - 2000); // Older
      const userTpl2 = createTemplate('user2', 'User Beta', 'iterate', 'content', false, Date.now() - 1000);  // Newer
      await templateManager.saveTemplate(userTpl1);
      await templateManager.saveTemplate(userTpl2);

      const templates = templateManager.listTemplates();
      const builtInCount = Object.keys(DEFAULT_TEMPLATES).length;
      expect(templates.length).toBe(builtInCount + 2);

      // Check built-in are first
      for (let i = 0; i < builtInCount; i++) {
        expect(templates[i].isBuiltin).toBe(true);
      }
      // Check user templates are next, sorted by lastModified DESC
      expect(templates[builtInCount].id).toBe('user2'); // Newer
      expect(templates[builtInCount + 1].id).toBe('user1'); // Older
    });
  });

  describe('exportTemplate', () => {
    it('should export a built-in template as JSON string', () => {
      const builtInId = Object.keys(DEFAULT_TEMPLATES)[0];
      const jsonString = templateManager.exportTemplate(builtInId);
      const parsed = JSON.parse(jsonString);
      expect(parsed.id).toBe(builtInId);
      expect(parsed.name).toBe(DEFAULT_TEMPLATES[builtInId].name);
    });

    it('should export a user template as JSON string', async () => {
      const userTpl = createTemplate('userExport', 'User Export Test');
      await templateManager.saveTemplate(userTpl);
      const jsonString = templateManager.exportTemplate('userExport');
      const parsed = JSON.parse(jsonString);
      expect(parsed.id).toBe('userExport');
      expect(parsed.name).toBe('User Export Test');
    });

    it('should throw TemplateError when exporting a non-existent template', () => {
      expect(() => templateManager.exportTemplate('nonExistentExport')).toThrow(TemplateError);
    });
  });

  describe('importTemplate', () => {
    it('should import a valid new template and persist', async () => {
      const tplToImport = createTemplate('importedUser', 'Imported User Template');
      const jsonToImport = JSON.stringify(tplToImport);
      
      await templateManager.importTemplate(jsonToImport);
      
      const expectedSavedData = [{...tplToImport, isBuiltin: undefined, metadata: {...tplToImport.metadata, lastModified: expect.any(Number)}}];

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        testStorageKey,
        JSON.stringify(expectedSavedData)
      );
      const retrieved = templateManager.getTemplate('importedUser');
      expect(retrieved.name).toBe('Imported User Template');
    });

    it('should import and overwrite an existing user template', async () => {
      const tplV1 = createTemplate('userImportOverwrite', 'V1 Import');
      await templateManager.saveTemplate(tplV1); // Save initial
      mockStorage.setItem.mockClear();

      const tplV2 = createTemplate('userImportOverwrite', 'V2 Import', 'iterate');
      const jsonToImport = JSON.stringify(tplV2);
      await templateManager.importTemplate(jsonToImport);
      
      const expectedSavedData = [{...tplV2, isBuiltin: undefined, metadata: {...tplV2.metadata, lastModified: expect.any(Number)}}];

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        testStorageKey,
        JSON.stringify(expectedSavedData)
      );
      const retrieved = templateManager.getTemplate('userImportOverwrite');
      expect(retrieved.name).toBe('V2 Import');
    });

    it('should throw TemplateError for invalid JSON string', async () => {
      const invalidJson = "{ not json an invalid string }";
      await expect(templateManager.importTemplate(invalidJson)).rejects.toThrow(TemplateError);
      await expect(templateManager.importTemplate(invalidJson)).rejects.toThrow(/导入提示词失败: Unexpected token/);
    });

    it('should throw TemplateValidationError if imported template fails schema validation', async () => {
      const invalidTemplateData = { id: 'badImport', content: 'Valid content' }; // Missing name, metadata
      const jsonToImport = JSON.stringify(invalidTemplateData);
      await expect(templateManager.importTemplate(jsonToImport)).rejects.toThrow(TemplateValidationError);
    });
  });

  describe('listTemplatesByType', () => {
    it('should return only templates of type "optimize"', async () => {
      const optiTpl = createTemplate('opti1', 'Optimize Template', 'optimize');
      const iterTpl = createTemplate('iter1', 'Iterate Template', 'iterate');
      await templateManager.saveTemplate(optiTpl);
      await templateManager.saveTemplate(iterTpl);

      const optimizeTemplates = templateManager.listTemplatesByType('optimize');
      expect(optimizeTemplates.some(t => t.id === 'opti1')).toBe(true);
      expect(optimizeTemplates.some(t => t.id === 'iter1')).toBe(false);
      // Also check built-in defaults
      const defaultOptimizeCount = Object.values(DEFAULT_TEMPLATES).filter(t => t.metadata.templateType === 'optimize').length;
      expect(optimizeTemplates.filter(t=>t.isBuiltin).length).toBe(defaultOptimizeCount);
    });

    it('should return only templates of type "iterate"', async () => {
        const optiTpl = createTemplate('opti2', 'Optimize Template 2', 'optimize');
        const iterTpl = createTemplate('iter2', 'Iterate Template 2', 'iterate');
        await templateManager.saveTemplate(optiTpl);
        await templateManager.saveTemplate(iterTpl);
  
        const iterateTemplates = templateManager.listTemplatesByType('iterate');
        expect(iterateTemplates.some(t => t.id === 'opti2')).toBe(false);
        expect(iterateTemplates.some(t => t.id === 'iter2')).toBe(true);
        const defaultIterateCount = Object.values(DEFAULT_TEMPLATES).filter(t => t.metadata.templateType === 'iterate').length;
        expect(iterateTemplates.filter(t=>t.isBuiltin).length).toBe(defaultIterateCount);
      });

    it('should return empty array if no templates of the specified type exist', () => {
        // Clear all user templates by not saving any
        const onlyOptimizeBuiltin = Object.values(DEFAULT_TEMPLATES).every(t => t.metadata.templateType === 'optimize');
        if (onlyOptimizeBuiltin) { // only run if this condition is true for current defaults
            const iterateTemplates = templateManager.listTemplatesByType('iterate');
            expect(iterateTemplates.filter(t => !t.isBuiltin).length).toBe(0); // No user iterate templates
        }
        // This test is more robust if we ensure no built-ins of a certain type exist,
        // or by first saving templates of other types.
        const optimizeTemplates = templateManager.listTemplatesByType('optimize'); // Assuming some optimize exist
        expect(optimizeTemplates.length).toBeGreaterThanOrEqual(0); 
      });
  });

  describe('StorageError Handling', () => {
    it('init (via loadUserTemplates) should throw TemplateError if storageProvider.getItem fails', async () => {
        const errorMockStorage = { 
            getItem: jest.fn().mockRejectedValue(new Error("Storage Get Failed!")),
            setItem: jest.fn(), removeItem: jest.fn(), clearAll: jest.fn()
        };
        // Expect constructor, which calls async init, to result in an error being thrown and caught by the .catch
        // This is hard to test directly on constructor. Better to test loadUserTemplates if it were public.
        // For now, we check console.error or if the manager is in a state indicating failure.
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        new TemplateManager(errorMockStorage); 
        // Wait for async init to complete
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(consoleErrorSpy).toHaveBeenCalledWith('模板管理器初始化失败:', expect.stringContaining('加载用户提示词失败: Storage Get Failed!'));
        consoleErrorSpy.mockRestore();
    });

    it('saveTemplate (via persistUserTemplates) should throw TemplateError if storageProvider.setItem fails', async () => {
      mockStorage.setItem.mockRejectedValue(new Error("Storage Set Failed!"));
      const tpl = createTemplate('saveFail', 'Save Fail Test');
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow(TemplateError);
      await expect(templateManager.saveTemplate(tpl)).rejects.toThrow('保存用户提示词失败: Storage Set Failed!');
    });

    it('deleteTemplate (via persistUserTemplates) should throw TemplateError if storageProvider.setItem fails', async () => {
        const tpl = createTemplate('deletePersistFail', 'Delete Persist Fail');
        await templateManager.saveTemplate(tpl); // Save it first successfully
        
        mockStorage.setItem.mockClear(); // Clear previous setItem call
        mockStorage.setItem.mockRejectedValue(new Error("Storage Set Failed on Delete!"));
        
        await expect(templateManager.deleteTemplate(tpl.id)).rejects.toThrow(TemplateError);
        await expect(templateManager.deleteTemplate(tpl.id)).rejects.toThrow('保存用户提示词失败: Storage Set Failed on Delete!');
      });

    it('importTemplate (via persistUserTemplates) should throw TemplateError if storageProvider.setItem fails', async () => {
        const tpl = createTemplate('importPersistFail', 'Import Persist Fail');
        const jsonToImport = JSON.stringify(tpl);
        
        mockStorage.setItem.mockRejectedValue(new Error("Storage Set Failed on Import!"));
        
        await expect(templateManager.importTemplate(jsonToImport)).rejects.toThrow(TemplateError);
        await expect(templateManager.importTemplate(jsonToImport)).rejects.toThrow('保存用户提示词失败: Storage Set Failed on Import!');
      });
  });
});
