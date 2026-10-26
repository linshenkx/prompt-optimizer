import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HistoryManager } from '../../../src/services/history/manager';
import { PromptRecord } from '../../../src/services/history/types';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { ModelManager } from '../../../src/services/model/manager';

describe('HistoryManager Import/Export', () => {
  let historyManager: HistoryManager;
  let storageProvider: MemoryStorageProvider;
  let modelManager: ModelManager;

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider();
    modelManager = new ModelManager(storageProvider);
    await modelManager.ensureInitialized();
    historyManager = new HistoryManager(storageProvider, modelManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportData', () => {
    it('should export all history records', async () => {
      // 添加一些历史记录
      const record1: PromptRecord = {
        id: 'record-1',
        originalPrompt: 'Test prompt 1',
        optimizedPrompt: 'Test response 1',
        type: 'optimize',
        chainId: 'chain-1',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'openai',
        templateId: 'template-1'
      };

      const record2: PromptRecord = {
        id: 'record-2',
        originalPrompt: 'Test prompt 2',
        optimizedPrompt: 'Test response 2',
        type: 'iterate',
        chainId: 'chain-1',
        version: 2,
        timestamp: Date.now() + 1000,
        modelKey: 'anthropic',
        templateId: 'template-2',
        previousId: 'record-1'
      };

      await historyManager.addRecord(record1);
      await historyManager.addRecord(record2);

      // 导出数据
      const exportedData = await historyManager.exportData();

      // 验证导出的数据
      expect(Array.isArray(exportedData)).toBe(true);
      expect(exportedData.length).toBe(2);

      // 验证记录内容
      const exportedRecord1 = exportedData.find(record => record.id === 'record-1');
      const exportedRecord2 = exportedData.find(record => record.id === 'record-2');

      expect(exportedRecord1).toBeDefined();
      expect(exportedRecord1?.originalPrompt).toBe('Test prompt 1');
      expect(exportedRecord1?.optimizedPrompt).toBe('Test response 1');

      expect(exportedRecord2).toBeDefined();
      expect(exportedRecord2?.chainId).toBe('chain-1');
      expect(exportedRecord2?.previousId).toBe('record-1');
    });

    it('should export empty array when no records exist', async () => {
      const exportedData = await historyManager.exportData();
      expect(Array.isArray(exportedData)).toBe(true);
      expect(exportedData.length).toBe(0);
    });

    it('should handle export error gracefully', async () => {
      // 模拟getRecords错误
      vi.spyOn(historyManager, 'getRecords').mockRejectedValue(new Error('Storage error'));

      await expect(historyManager.exportData()).rejects.toThrow('Failed to export history data');
    });
  });

  describe('importData', () => {
    it('should replace existing history records', async () => {
      // 先添加一些现有记录
      const existingRecord: PromptRecord = {
        id: 'existing-record',
        originalPrompt: 'Existing prompt',
        optimizedPrompt: 'Existing response',
        type: 'optimize',
        chainId: 'existing-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'openai',
        templateId: 'template-1'
      };

      await historyManager.addRecord(existingRecord);

      // 验证记录存在
      const beforeImport = await historyManager.getRecords();
      expect(beforeImport.length).toBe(1);

      // 导入新记录
      const importData: PromptRecord[] = [
        {
          id: 'imported-record-1',
          originalPrompt: 'Imported prompt 1',
          optimizedPrompt: 'Imported response 1',
          type: 'optimize',
          chainId: 'imported-chain-1',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'anthropic',
          templateId: 'template-2'
        },
        {
          id: 'imported-record-2',
          originalPrompt: 'Imported prompt 2',
          optimizedPrompt: 'Imported response 2',
          type: 'iterate',
          chainId: 'imported-chain-1',
          version: 2,
          timestamp: Date.now() + 1000,
          modelKey: 'openai',
          templateId: 'template-3',
          previousId: 'imported-record-1'
        }
      ];

      await historyManager.importData(importData);

      // 验证替换模式：旧记录被删除，新记录被添加
      const afterImport = await historyManager.getRecords();
      expect(afterImport.length).toBe(2);
      
      expect(afterImport.find(r => r.id === 'existing-record')).toBeUndefined();
      expect(afterImport.find(r => r.id === 'imported-record-1')).toBeDefined();
      expect(afterImport.find(r => r.id === 'imported-record-2')).toBeDefined();
    });

    it('should preserve original IDs and maintain data relationships', async () => {
      // 导入有关联关系的记录
      const importData: PromptRecord[] = [
        {
          id: 'parent-record',
          originalPrompt: 'Parent prompt',
          optimizedPrompt: 'Parent response',
          type: 'optimize',
          chainId: 'test-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        },
        {
          id: 'child-record',
          originalPrompt: 'Child prompt',
          optimizedPrompt: 'Child response',
          type: 'iterate',
          chainId: 'test-chain',
          version: 2,
          timestamp: Date.now() + 1000,
          modelKey: 'openai',
          templateId: 'template-2',
          previousId: 'parent-record' // 引用父记录
        }
      ];

      await historyManager.importData(importData);

      // 验证ID和关联关系被保持
      const afterImport = await historyManager.getRecords();
      const parentRecord = afterImport.find(r => r.id === 'parent-record');
      const childRecord = afterImport.find(r => r.id === 'child-record');

      expect(parentRecord).toBeDefined();
      expect(childRecord).toBeDefined();
      expect(childRecord?.previousId).toBe('parent-record'); // 关联关系应该被保持
      expect(childRecord?.chainId).toBe('test-chain'); // 链ID应该被保持
    });

    it('should handle records with missing optional fields', async () => {
      const importData: PromptRecord[] = [
        {
          id: 'minimal-record',
          originalPrompt: 'Minimal prompt',
          optimizedPrompt: 'Minimal response',
          type: 'optimize',
          chainId: 'minimal-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
          // 没有previousId（因为是第一个版本）
        }
      ];

      await historyManager.importData(importData);

      const afterImport = await historyManager.getRecords();
      const importedRecord = afterImport.find(r => r.id === 'minimal-record');

      expect(importedRecord).toBeDefined();
      expect(importedRecord?.originalPrompt).toBe('Minimal prompt');
      expect(importedRecord?.chainId).toBe('minimal-chain');
      expect(importedRecord?.previousId).toBeUndefined();
    });

    it('should report a failed replacement write and retain the old history', async () => {
      const importData: PromptRecord[] = [
        {
          id: 'error-record',
          originalPrompt: 'Error prompt',
          optimizedPrompt: 'Error response',
          type: 'optimize',
          chainId: 'error-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        }
      ];

      await historyManager.addRecord({ ...importData[0], id: 'old-record' });
      const before = await historyManager.exportData();
      vi.spyOn(storageProvider, 'setItem').mockRejectedValueOnce(new Error('Storage write failed'));

      await expect(historyManager.importData(importData)).rejects.toThrow('Failed to import history data');
      expect(await historyManager.exportData()).toEqual(before);
    });

    it('should replace history in one write without clearing it first', async () => {
      // 添加现有记录
      const existingRecord: PromptRecord = {
        id: 'existing-record',
        originalPrompt: 'Existing prompt',
        optimizedPrompt: 'Existing response',
        type: 'optimize',
        chainId: 'existing-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'openai',
        templateId: 'template-1'
      };

      await historyManager.addRecord(existingRecord);

      // 验证clearHistory被调用
      const clearHistorySpy = vi.spyOn(historyManager, 'clearHistory');
      const writeSpy = vi.spyOn(storageProvider, 'setItem');

      const importData: PromptRecord[] = [
        {
          id: 'new-record',
          originalPrompt: 'New prompt',
          optimizedPrompt: 'New response',
          type: 'optimize',
          chainId: 'new-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'anthropic',
          templateId: 'template-2'
        }
      ];

      await historyManager.importData(importData);

      expect(clearHistorySpy).not.toHaveBeenCalled();
      expect(writeSpy.mock.calls.filter(([key]) => key === 'prompt_history')).toHaveLength(1);
    });
  });

  describe('validateData', () => {
    it('should validate correct history data', async () => {
      const validData: PromptRecord[] = [
        {
          id: 'test-record',
          originalPrompt: 'Test prompt',
          optimizedPrompt: 'Test response',
          type: 'optimize',
          chainId: 'test-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        }
      ];

      expect(await historyManager.validateData(validData)).toBe(true);
    });

    it('should validate records with optional fields', async () => {
      const validData: PromptRecord[] = [
        {
          id: 'test-record',
          originalPrompt: 'Test prompt',
          optimizedPrompt: 'Test response',
          type: 'iterate',
          chainId: 'test-chain',
          version: 2,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1',
          previousId: 'previous-record'
        }
      ];

      expect(await historyManager.validateData(validData)).toBe(true);
    });

    it('should reject invalid data formats', async () => {
      // 非数组
      expect(await historyManager.validateData({})).toBe(false);
      expect(await historyManager.validateData('string')).toBe(false);
      expect(await historyManager.validateData(null)).toBe(false);

      // 缺少必需字段
      expect(await historyManager.validateData([
        {
          originalPrompt: 'Test prompt',
          // 缺少id
          optimizedPrompt: 'Test response',
          timestamp: Date.now()
        }
      ])).toBe(false);

      // 字段类型错误
      expect(await historyManager.validateData([
        {
          id: 'test-record',
          originalPrompt: 123, // 应该是字符串
          optimizedPrompt: 'Test response',
          timestamp: Date.now()
        }
      ])).toBe(false);

      // timestamp类型错误
      expect(await historyManager.validateData([
        {
          id: 'test-record',
          originalPrompt: 'Test prompt',
          optimizedPrompt: 'Test response',
          timestamp: 'invalid-timestamp' // 应该是数字
        }
      ])).toBe(false);
    });

    it('should reject empty required content and duplicate IDs before replacing history', async () => {
      const record: PromptRecord = {
        id: 'kept', originalPrompt: 'original', optimizedPrompt: 'optimized', type: 'optimize',
        chainId: 'chain', version: 1, timestamp: 1, modelKey: 'openai', templateId: 'template',
      };
      await historyManager.addRecord(record);
      const before = await historyManager.exportData();

      for (const invalid of [[{ ...record, originalPrompt: '' }], [record, { ...record }]]) {
        expect(await historyManager.validateData(invalid)).toBe(false);
        await expect(historyManager.importData(invalid)).rejects.toThrow();
        expect(await historyManager.exportData()).toEqual(before);
      }
    });
  });

  describe('getDataType', () => {
    it('should return correct data type', async () => {
      expect(await historyManager.getDataType()).toBe('history');
    });
  });

  describe('data integrity', () => {
    const makeRecord = (index: number): PromptRecord => ({
      id: `record-${index}`,
      originalPrompt: `Prompt ${index}`,
      optimizedPrompt: `Response ${index}`,
      type: 'optimize',
      chainId: `chain-${index}`,
      version: 1,
      timestamp: 1000 + index,
      modelKey: 'openai',
      templateId: 'template-1'
    });

    it('should preserve record order through an export/import round trip', async () => {
      for (let index = 1; index <= 3; index++) {
        await historyManager.addRecord(makeRecord(index));
      }
      const backup = JSON.parse(JSON.stringify(await historyManager.exportData()));
      const originalIds = backup.map((record: PromptRecord) => record.id);

      await historyManager.importData(backup);

      expect((await historyManager.getRecords()).map(record => record.id)).toEqual(originalIds);
      expect(backup.map((record: PromptRecord) => record.id)).toEqual(originalIds);
    });

    it('should evict the oldest record after restoring a full history', async () => {
      for (let index = 1; index <= 50; index++) {
        await historyManager.addRecord(makeRecord(index));
      }
      const backup = JSON.parse(JSON.stringify(await historyManager.exportData()));

      await historyManager.importData(backup);
      await historyManager.addRecord(makeRecord(51));

      const records = await historyManager.getRecords();
      expect(records).toHaveLength(50);
      expect(records.map(record => record.id)).toContain('record-50');
      expect(records.map(record => record.id)).not.toContain('record-1');
    });

    it('should maintain chain relationships after import', async () => {
      // 创建一个完整的对话链
      const importData: PromptRecord[] = [
        {
          id: 'chain-start',
          originalPrompt: 'Initial prompt',
          optimizedPrompt: 'Initial response',
          type: 'optimize',
          chainId: 'conversation-1',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        },
        {
          id: 'chain-middle',
          originalPrompt: 'Follow-up prompt',
          optimizedPrompt: 'Follow-up response',
          type: 'iterate',
          chainId: 'conversation-1',
          version: 2,
          timestamp: Date.now() + 1000,
          modelKey: 'openai',
          templateId: 'template-2',
          previousId: 'chain-start'
        },
        {
          id: 'chain-end',
          originalPrompt: 'Final prompt',
          optimizedPrompt: 'Final response',
          type: 'iterate',
          chainId: 'conversation-1',
          version: 3,
          timestamp: Date.now() + 2000,
          modelKey: 'openai',
          templateId: 'template-3',
          previousId: 'chain-middle'
        }
      ];

      await historyManager.importData(importData);

      // 验证链关系完整性
      const afterImport = await historyManager.getRecords();
      const startRecord = afterImport.find(r => r.id === 'chain-start');
      const middleRecord = afterImport.find(r => r.id === 'chain-middle');
      const endRecord = afterImport.find(r => r.id === 'chain-end');

      expect(startRecord?.chainId).toBe('conversation-1');
      expect(startRecord?.previousId).toBeUndefined();

      expect(middleRecord?.chainId).toBe('conversation-1');
      expect(middleRecord?.previousId).toBe('chain-start');

      expect(endRecord?.chainId).toBe('conversation-1');
      expect(endRecord?.previousId).toBe('chain-middle');
    });
  });
});
