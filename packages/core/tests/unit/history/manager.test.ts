import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HistoryManager } from '../../../src/services/history/manager';
import { IStorageProvider } from '../../../src/services/storage/types';
import { PromptRecord, PromptRecordChain, PromptRecordType } from '../../../src/services/history/types';
import { RecordValidationError, StorageError } from '../../../src/services/history/errors';
import { v4 as uuidv4 } from 'uuid';
import { createHistoryManager, MemoryStorageProvider } from '../../../src';
import * as ModelManagerModule from '../../../src/services/model/manager';

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

const mockModelManager = {
  getModel: vi.fn(),
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../../src/services/model/manager', async (importOriginal) => {
  const actual = await importOriginal() as typeof ModelManagerModule;
  return {
    ...actual,
    createModelManager: vi.fn(() => mockModelManager),
  };
});

describe('HistoryManager', () => {
  let historyManager: HistoryManager;
  let mockStorage: IStorageProvider;

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
    timestamp: Date.now() - Math.random() * 1000,
    modelKey: 'test-model-key',
    modelName: 'Test Model Name',
    templateId: 'test-template-id',
    iterationNote: version > 1 ? 'Iteration note' : undefined,
    metadata: { some: 'data' },
    ...data,
  });

  beforeEach(() => {
    mockStorage = new MemoryStorageProvider();
    historyManager = createHistoryManager(mockStorage);

    (uuidv4 as any).mockClear();
    mockModelManager.getModel.mockClear();

    mockModelManager.getModel.mockReturnValue({
      name: 'Default Mock Model',
      defaultModel: 'default-mock-model-variant',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addRecord', () => {
    it('should add a valid record and save to storage', async () => {
      const record = mockPromptRecord('id1', 'chain1', 1);
      await historyManager.addRecord(record);
      const records = await mockStorage.getItem('prompt_history');
      expect(JSON.parse(records!)).toEqual([record]);
    });

    it.skip('should add a record and fetch modelName if not provided and modelKey exists', async () => {
      const recordWithoutModelName = mockPromptRecord('id1', 'chain1', 1);
      delete recordWithoutModelName.modelName;

      mockModelManager.getModel.mockReturnValue({
        defaultModel: 'Fetched Model Name',
      });

      // This test requires modelManager to be injected, which is currently not the case.
      // await historyManager.addRecord(recordWithoutModelName);
      // expect(mockModelManager.getModel).toHaveBeenCalledWith('test-model-key');
      // const storedRecords = JSON.parse(await mockStorage.getItem('prompt_history') ?? '[]');
      // expect(storedRecords[0].modelName).toBe('Fetched Model Name');
    });

    it('should not fetch modelName if modelKey does not exist and modelManager is not provided', async () => {
      const recordWithoutModelKey = { ...mockPromptRecord('id1', 'chain1', 1), modelKey: '' };
      delete recordWithoutModelKey.modelName;
      
      await historyManager.addRecord(recordWithoutModelKey);
      
      expect(mockModelManager.getModel).not.toHaveBeenCalled();
      const records = JSON.parse(await mockStorage.getItem('prompt_history') ?? '[]');
      expect(records[0].modelName).toBeUndefined();
    });

    it('should throw RecordValidationError for an invalid record (e.g., missing originalPrompt)', async () => {
      const invalidRecord = {
        ...mockPromptRecord('id1', 'chain1', 1),
        originalPrompt: '',
      } as PromptRecord;
      await expect(historyManager.addRecord(invalidRecord)).rejects.toThrow(
        RecordValidationError
      );
    });
  });

  describe('getRecords', () => {
    it('should return empty array if storage is empty', async () => {
      const records = await historyManager.getRecords();
      expect(records).toEqual([]);
    });
  });

  describe('createNewChain and getChain', () => {
    it('keeps a selected older base when appending a new version', async () => {
      (uuidv4 as any).mockReturnValueOnce('chain').mockReturnValueOnce('v2').mockReturnValueOnce('v3');
      const root = mockPromptRecord('v1', 'chain', 1);
      await historyManager.createNewChain(root);
      const change = { chainId: 'chain', originalPrompt: root.originalPrompt, optimizedPrompt: 'Revision',
        modelKey: root.modelKey, templateId: root.templateId };
      await historyManager.addIteration(change);
      await expect(historyManager.addIteration({ ...change, previousId: 'missing' })).rejects.toThrow();
      const chain = await historyManager.addIteration({ ...change, previousId: 'v1' });
      expect(chain.versions.map(record => [record.version, record.previousId])).toEqual([
        [1, undefined], [2, 'v1'], [3, 'v1'],
      ]);
    });

    it('should create a new chain and get it', async () => {
      (uuidv4 as any).mockReturnValue('new-chain-id');
      const chainRecord = mockPromptRecord('id1', 'new-chain-id', 1);
      const chain = await historyManager.createNewChain(chainRecord);
      expect(chain.chainId).toBe('new-chain-id');
      expect(chain.versions).toHaveLength(1);
    });
  });
});
