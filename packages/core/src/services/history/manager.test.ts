import { HistoryManager } from './manager';
import { IStorageProvider } from '../storage/types';
import { PromptRecord, PromptRecordChain, PromptRecordType } from './types';
import { RecordNotFoundError, RecordValidationError, StorageError } from './errors';
import { v4 as uuidv4 } from 'uuid';
import { modelManager } from '../model/manager';

// Mock 'uuid'
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

// Mock '../model/manager'
// Adjusted path might be needed if the test file is in a different relative location
// For 'packages/core/src/services/history/manager.test.ts', this path should be correct.
jest.mock('../model/manager', () => ({
  modelManager: {
    getModel: jest.fn(),
  },
}));

describe('HistoryManager', () => {
  let historyManager: HistoryManager;
  let mockStorage: jest.Mocked<IStorageProvider>;

  // Helper to create mock PromptRecord objects
  const mockPromptRecord = (
    id: string,
    chainId: string,
    version: number,
    previousId?: string,
    data?: Partial<PromptRecord>
  ): PromptRecord => ({
    id,
    originalPrompt: 'Original prompt content',
    optimizedPrompt: 'Optimized prompt content',
    type: 'optimize' as PromptRecordType,
    chainId,
    version,
    previousId,
    timestamp: Date.now() - Math.random() * 10000, // Ensure somewhat unique timestamps for sorting tests
    modelKey: 'test-model-key',
    modelName: 'Test Model Name',
    templateId: 'test-template-id',
    iterationNote: version > 1 ? 'Iteration note' : undefined,
    metadata: { some: 'data' },
    ...data,
  });

  beforeEach(() => {
    // Reset mocks for storage provider
    mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clearAll: jest.fn(), // Assuming IStorageProvider has clearAll
    };

    historyManager = new HistoryManager(mockStorage);

    // Clear mocks for uuid and modelManager
    (uuidv4 as jest.Mock).mockClear();
    (modelManager.getModel as jest.Mock).mockClear();

    // Default mock implementations for storage
    mockStorage.getItem.mockResolvedValue(null); // Default to empty storage
    mockStorage.setItem.mockResolvedValue(undefined); // Default to successful set
    mockStorage.removeItem.mockResolvedValue(undefined); // Default to successful remove
    mockStorage.clearAll.mockResolvedValue(undefined); // Default to successful clearAll

    // Default mock implementation for modelManager.getModel
    (modelManager.getModel as jest.Mock).mockReturnValue({
      name: 'Default Mock Model',
      defaultModel: 'default-mock-model-variant', // This is what getModelNameByKey uses
      // ... other ModelConfig properties if needed by the code under test
    });
  });

  describe('addRecord', () => {
    it('should add a valid record and save to storage', async () => {
      const record = mockPromptRecord('id1', 'chain1', 1);
      await historyManager.addRecord(record);

      expect(mockStorage.getItem).toHaveBeenCalledWith('prompt_history');
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'prompt_history',
        JSON.stringify([record])
      );
    });

    it('should add a record and fetch modelName if not provided and modelKey exists', async () => {
      const recordWithoutModelName = mockPromptRecord('id1', 'chain1', 1);
      delete recordWithoutModelName.modelName; // Ensure modelName is not set

      (modelManager.getModel as jest.Mock).mockReturnValue({
        defaultModel: 'Fetched Model Name',
      });

      await historyManager.addRecord(recordWithoutModelName);

      expect(modelManager.getModel).toHaveBeenCalledWith('test-model-key');
      const storedRecords = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(storedRecords[0].modelName).toBe('Fetched Model Name');
    });
    
    it('should not fetch modelName if modelKey does not exist', async () => {
        const recordWithoutModelNameAndKey = mockPromptRecord('id1', 'chain1', 1);
        delete recordWithoutModelNameAndKey.modelName;
        delete (recordWithoutModelNameAndKey as any).modelKey; // Cast to any to delete readonly/required
  
        await historyManager.addRecord(recordWithoutModelNameAndKey);
  
        expect(modelManager.getModel).not.toHaveBeenCalled();
        const storedRecords = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
        expect(storedRecords[0].modelName).toBeUndefined();
      });

    it('should throw RecordValidationError for an invalid record (e.g., missing originalPrompt)', async () => {
      const invalidRecord = {
        ...mockPromptRecord('id1', 'chain1', 1),
        originalPrompt: '', // Invalid
      } as PromptRecord;
      await expect(historyManager.addRecord(invalidRecord)).rejects.toThrow(
        RecordValidationError
      );
    });

    it('should not exceed maxRecords', async () => {
      const maxRecords = 50; // As defined in HistoryManager
      const existingRecords: PromptRecord[] = [];
      for (let i = 0; i < maxRecords; i++) {
        existingRecords.push(mockPromptRecord(`id${i}`, 'chain1', i + 1));
      }
      mockStorage.getItem.mockResolvedValue(JSON.stringify(existingRecords));

      const newRecord = mockPromptRecord('newId', 'chain1', maxRecords + 1);
      await historyManager.addRecord(newRecord);

      const storedRecordsArg = mockStorage.setItem.mock.calls[0][1];
      const storedRecords: PromptRecord[] = JSON.parse(storedRecordsArg);
      
      expect(storedRecords.length).toBe(maxRecords);
      expect(storedRecords[0].id).toBe('newId'); // Newest record is at the start
      expect(storedRecords[maxRecords - 1].id).toBe('id1'); // Oldest (after new one was added)
    });
    
    it('should throw StorageError if storageProvider.getItem fails', async () => {
        mockStorage.getItem.mockRejectedValue(new Error('Get failed'));
        const record = mockPromptRecord('id1', 'chain1', 1);
        await expect(historyManager.addRecord(record)).rejects.toThrow(StorageError);
        await expect(historyManager.addRecord(record)).rejects.toThrow('添加记录失败');
      });
  
      it('should throw StorageError if storageProvider.setItem fails', async () => {
        mockStorage.setItem.mockRejectedValue(new Error('Set failed'));
        const record = mockPromptRecord('id1', 'chain1', 1);
        await expect(historyManager.addRecord(record)).rejects.toThrow(StorageError);
        await expect(historyManager.addRecord(record)).rejects.toThrow('添加记录失败');
      });
  });

  describe('getRecords', () => {
    it('should return empty array if storage is empty or item is null', async () => {
      mockStorage.getItem.mockResolvedValue(null);
      const records = await historyManager.getRecords();
      expect(records).toEqual([]);
    });

    it('should return parsed records from storage', async () => {
      const rec1 = mockPromptRecord('id1', 'chain1', 1);
      mockStorage.getItem.mockResolvedValue(JSON.stringify([rec1]));
      const records = await historyManager.getRecords();
      expect(records).toEqual([rec1]);
    });

    it('should throw StorageError if getItem fails', async () => {
      mockStorage.getItem.mockRejectedValue(new Error('Storage failed'));
      await expect(historyManager.getRecords()).rejects.toThrow(StorageError);
      await expect(historyManager.getRecords()).rejects.toThrow('获取历史记录失败');
    });
  });

  describe('getRecord', () => {
    it('should return the correct record if found', async () => {
      const rec1 = mockPromptRecord('id1', 'chain1', 1);
      const rec2 = mockPromptRecord('id2', 'chain1', 2, 'id1');
      mockStorage.getItem.mockResolvedValue(JSON.stringify([rec1, rec2]));
      
      const foundRecord = await historyManager.getRecord('id1');
      expect(foundRecord).toEqual(rec1);
    });

    it('should throw RecordNotFoundError if record is not found', async () => {
      const rec1 = mockPromptRecord('id1', 'chain1', 1);
      mockStorage.getItem.mockResolvedValue(JSON.stringify([rec1]));
      
      await expect(historyManager.getRecord('nonExistentId')).rejects.toThrow(RecordNotFoundError);
    });
  });

  describe('deleteRecord', () => {
    it('should delete an existing record and save updated list', async () => {
      const rec1 = mockPromptRecord('id1', 'chain1', 1);
      const rec2 = mockPromptRecord('id2', 'chain1', 2, 'id1');
      mockStorage.getItem.mockResolvedValue(JSON.stringify([rec1, rec2]));

      await historyManager.deleteRecord('id1');

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'prompt_history',
        JSON.stringify([rec2]) // Only rec2 should remain
      );
    });

    it('should throw RecordNotFoundError if record to delete is not found', async () => {
      const rec1 = mockPromptRecord('id1', 'chain1', 1);
      mockStorage.getItem.mockResolvedValue(JSON.stringify([rec1]));
      
      await expect(historyManager.deleteRecord('nonExistentId')).rejects.toThrow(RecordNotFoundError);
    });

    it('should throw StorageError if setItem fails during delete', async () => {
        const rec1 = mockPromptRecord('id1', 'chain1', 1);
        mockStorage.getItem.mockResolvedValue(JSON.stringify([rec1]));
        mockStorage.setItem.mockRejectedValue(new Error('Set failed'));
  
        await expect(historyManager.deleteRecord('id1')).rejects.toThrow(StorageError);
        await expect(historyManager.deleteRecord('id1')).rejects.toThrow('删除记录失败');
      });
  });

  describe('clearHistory', () => {
    it('should call storageProvider.removeItem with the correct key', async () => {
      await historyManager.clearHistory();
      expect(mockStorage.removeItem).toHaveBeenCalledWith('prompt_history');
    });

    it('should throw StorageError if removeItem fails', async () => {
      mockStorage.removeItem.mockRejectedValue(new Error('Remove failed'));
      await expect(historyManager.clearHistory()).rejects.toThrow(StorageError);
      await expect(historyManager.clearHistory()).rejects.toThrow('清除历史记录失败');
    });
  });

  describe('createNewChain', () => {
    it('should create a new chain, add a record with a new chainId and version 1, and return the chain', async () => {
      const chainUuid = 'new-chain-uuid';
      (uuidv4 as jest.Mock).mockReturnValue(chainUuid); // For chainId

      const initialRecordData = {
        originalPrompt: 'initial prompt',
        optimizedPrompt: 'optimized initial prompt',
        type: 'optimize' as PromptRecordType,
        timestamp: Date.now(),
        modelKey: 'test-model-key',
        templateId: 'test-template-id',
        // Note: HistoryManager.createNewChain internally generates the 'id' for the record,
        // so we don't pass it here. The mockPromptRecord helper adds an 'id'.
        // The actual implementation of createNewChain will generate its own id for the record.
      };
      
      // Mock getModel to provide modelName
      (modelManager.getModel as jest.Mock).mockReturnValue({ defaultModel: 'Test Model For Chain' });

      const chain = await historyManager.createNewChain(initialRecordData);

      expect(uuidv4).toHaveBeenCalledTimes(1); // For chainId
      expect(chain.chainId).toBe(chainUuid);
      expect(chain.rootRecord.id).toBeDefined(); // id is generated by addRecord internally
      expect(chain.rootRecord.chainId).toBe(chainUuid);
      expect(chain.rootRecord.version).toBe(1);
      expect(chain.rootRecord.previousId).toBeUndefined();
      expect(chain.rootRecord.modelName).toBe('Test Model For Chain');
      
      // Check that addRecord was called, which implies setItem was called
      expect(mockStorage.setItem).toHaveBeenCalled();
      const storedRecords = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(storedRecords[0].chainId).toBe(chainUuid);
      expect(storedRecords[0].originalPrompt).toBe('initial prompt');
    });
  });

  describe('addIteration', () => {
    it('should add an iteration to an existing chain with incremented version and correct previousId', async () => {
      const chainId = 'existingChainId';
      const recordId1 = 'recordId1';
      const recordId2 = 'recordId2-iteration';
      
      const initialRecord = mockPromptRecord(recordId1, chainId, 1);
      mockStorage.getItem.mockResolvedValue(JSON.stringify([initialRecord]));
      
      (uuidv4 as jest.Mock).mockReturnValue(recordId2); // For the new iteration's record ID

      const iterationParams = {
        chainId,
        originalPrompt: 'iterated original',
        optimizedPrompt: 'iterated optimized',
        iterationNote: 'This is an iteration',
        modelKey: 'iter-model-key',
        templateId: 'iter-template-id',
      };
      
      (modelManager.getModel as jest.Mock).mockReturnValue({ defaultModel: 'Iter Model' });

      const chain = await historyManager.addIteration(iterationParams);

      expect(uuidv4).toHaveBeenCalledTimes(1); // For the new record's ID
      expect(chain.currentRecord.id).toBe(recordId2);
      expect(chain.currentRecord.chainId).toBe(chainId);
      expect(chain.currentRecord.version).toBe(2);
      expect(chain.currentRecord.previousId).toBe(recordId1);
      expect(chain.currentRecord.modelName).toBe('Iter Model');
      expect(chain.currentRecord.iterationNote).toBe('This is an iteration');
      expect(chain.versions.length).toBe(2);

      expect(mockStorage.setItem).toHaveBeenCalled();
      const storedRecords = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(storedRecords.length).toBe(2);
      expect(storedRecords[0].id).toBe(recordId2); // Newest first
      expect(storedRecords[1].id).toBe(recordId1);
    });

    it('should throw RecordNotFoundError if chain does not exist when adding iteration', async () => {
        mockStorage.getItem.mockResolvedValue(JSON.stringify([])); // No existing records
        (uuidv4 as jest.Mock).mockReturnValue('newRecordId');
  
        const iterationParams = {
          chainId: 'nonExistentChainId',
          originalPrompt: 'iterated original',
          optimizedPrompt: 'iterated optimized',
          modelKey: 'iter-model-key',
          templateId: 'iter-template-id',
        };
  
        await expect(historyManager.addIteration(iterationParams)).rejects.toThrow(RecordNotFoundError);
      });
  });
  
  describe('getIterationChain (for getChain/getAllChains indirectly)', () => {
    // getIterationChain is used by getChain. getChain is used by addIteration and createNewChain.
    // Direct tests for getChain and getAllChains ensure they correctly process the records list.
    it('getIterationChain should return records in ascending order of presence in chain', async () => {
        const r1 = mockPromptRecord('id1', 'chainA', 1);
        const r2 = mockPromptRecord('id2', 'chainA', 2, 'id1');
        const r3 = mockPromptRecord('id3', 'chainA', 3, 'id2');
        mockStorage.getItem.mockResolvedValue(JSON.stringify([r1, r2, r3])); // Stored in addRecord order (newest first)

        const iterationChain = await historyManager.getIterationChain('id3');
        expect(iterationChain.map(r => r.id)).toEqual(['id1', 'id2', 'id3']);
    });
  });


  describe('getChain', () => {
    it('should retrieve a specific chain sorted by version', async () => {
      const chainId = 'targetChain';
      const rec1 = mockPromptRecord('id1', chainId, 1);
      const rec3 = mockPromptRecord('id3', chainId, 3, 'id2'); // out of order version-wise in array
      const rec2 = mockPromptRecord('id2', chainId, 2, 'id1');
      const otherChainRec = mockPromptRecord('idX', 'otherChain', 1);
      mockStorage.getItem.mockResolvedValue(JSON.stringify([otherChainRec, rec3, rec2, rec1]));

      const chain = await historyManager.getChain(chainId);
      expect(chain.chainId).toBe(chainId);
      expect(chain.rootRecord.id).toBe('id1');
      expect(chain.currentRecord.id).toBe('id3');
      expect(chain.versions.map(v => v.id)).toEqual(['id1', 'id2', 'id3']);
    });

    it('should throw RecordNotFoundError if chain does not exist', async () => {
      mockStorage.getItem.mockResolvedValue(JSON.stringify([]));
      await expect(historyManager.getChain('nonExistentChain')).rejects.toThrow(RecordNotFoundError);
    });
  });

  describe('getAllChains', () => {
    it('should retrieve all chains, sorted by chainId and then by version', async () => {
      const recA1 = mockPromptRecord('a1', 'chainA', 1);
      const recA2 = mockPromptRecord('a2', 'chainA', 2, 'a1');
      const recB1 = mockPromptRecord('b1', 'chainB', 1);
      const recB2 = mockPromptRecord('b2', 'chainB', 2, 'b1');
      // Store them in a mixed up order to test sorting
      mockStorage.getItem.mockResolvedValue(JSON.stringify([recB2, recA1, recB1, recA2]));

      const chains = await historyManager.getAllChains();
      
      expect(chains.length).toBe(2);
      expect(chains[0].chainId).toBe('chainA');
      expect(chains[0].versions.map(v => v.id)).toEqual(['a1', 'a2']);
      expect(chains[1].chainId).toBe('chainB');
      expect(chains[1].versions.map(v => v.id)).toEqual(['b1', 'b2']);
    });

    it('should return empty array if no history exists', async () => {
      mockStorage.getItem.mockResolvedValue(JSON.stringify([]));
      const chains = await historyManager.getAllChains();
      expect(chains).toEqual([]);
    });
  });
});
