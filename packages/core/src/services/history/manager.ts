import { IHistoryManager, PromptRecord, PromptRecordChain } from './types';
import { IStorageProvider } from '../storage/types';
import { StorageAdapter } from '../storage/adapter';
import { RecordNotFoundError, RecordValidationError, HistoryStorageError, HistoryError } from './errors';
import { v4 as uuidv4 } from 'uuid';
import { IModelManager } from '../model/types';
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys';
import { HISTORY_ERROR_CODES, IMPORT_EXPORT_ERROR_CODES } from '../../constants/error-codes';
import { ImportExportError } from '../../interfaces/import-export';

/**
 * History Manager implementation
 */
export class HistoryManager implements IHistoryManager {
  private readonly storageKey = CORE_SERVICE_KEYS.PROMPT_HISTORY;
  private readonly maxRecords = 50; // Maximum 50 records
  private readonly storage: StorageAdapter;
  private readonly modelManager: IModelManager;

  constructor(storageProvider: IStorageProvider, modelManager: IModelManager) {
    this.storage = new StorageAdapter(storageProvider);
    this.modelManager = modelManager;
  }

  /**
   * Helper function to get model name
   * @param modelKey model key
   * @returns model name or undefined
   */
  private async getModelNameByKey(modelKey: string): Promise<string | undefined> {
    if (!modelKey) return undefined;
    
    try {
      const model = await this.modelManager.getModel(modelKey);
      return model?.name;
    } catch (err) {
      // If model not found or other error, simply return undefined
      return undefined;
    }
  }

  private trimRecordsPreservingRoots(records: PromptRecord[]): PromptRecord[] {
    if (records.length <= this.maxRecords) {
      return records;
    }

    const retained = [...records];
    const chainCounts = new Map<string, number>();
    const rootCounts = new Map<string, number>();
    for (const r of retained) {
      chainCounts.set(r.chainId, (chainCounts.get(r.chainId) ?? 0) + 1);
      if (r.version === 1) {
        rootCounts.set(r.chainId, (rootCounts.get(r.chainId) ?? 0) + 1);
      }
    }

    while (retained.length > this.maxRecords) {
      let evictIndex = -1;
      for (let i = retained.length - 1; i >= 1; i--) {
        const candidate = retained[i];
        const count = chainCounts.get(candidate.chainId) ?? 0;
        const roots = rootCounts.get(candidate.chainId) ?? 0;
        // Never evict the sole root of a chain that still has other retained records;
        // evicting a 1-record chain's root cleanly drops that entire chain.
        if (candidate.version !== 1 || count <= 1 || roots > 1) {
          evictIndex = i;
          break;
        }
      }
      if (evictIndex === -1) {
        evictIndex = retained.length - 1;
      }
      const [evicted] = retained.splice(evictIndex, 1);
      chainCounts.set(evicted.chainId, (chainCounts.get(evicted.chainId) ?? 1) - 1);
      if (evicted.version === 1) {
        rootCounts.set(evicted.chainId, (rootCounts.get(evicted.chainId) ?? 1) - 1);
      }
    }

    return retained;
  }

  /**
   * Add a new record using atomic operation
   * @param record The record to add
   */
  async addRecord(record: PromptRecord): Promise<void> {
    try {
      this.validateRecord(record);
      
      // If modelName is not provided but modelKey exists, try to get model name
      if (!record.modelName && record.modelKey) {
        record.modelName = await this.getModelNameByKey(record.modelKey);
      }
      
      // Use updateData to handle concurrent modifications
      await this.storage.updateData<PromptRecord[]>(
        this.storageKey,
        (existingRecords: PromptRecord[] | null) => {
          const records = existingRecords || [];
          
          // Ensure record ID is unique
          if (records.some((r: PromptRecord) => r.id === record.id)) {
            throw new HistoryError(
              HISTORY_ERROR_CODES.VALIDATION_ERROR,
              { details: `Record with ID ${record.id} already exists` },
              `Record with ID ${record.id} already exists`
            );
          }
          
          // Add record to existing records (at the beginning)
          const updatedRecords = [record, ...records];
          
          // Ensure we don't exceed maxRecords without orphaning active chains
          return this.trimRecordsPreservingRoots(updatedRecords);
        }
      );
    } catch (err: any) {
      if (err instanceof HistoryError) {
        throw err;
      }
      if (err.message?.includes('Get')) {
        throw new HistoryStorageError('Failed to get history records', 'read');
      } else {
        throw new HistoryStorageError('Failed to save history records', 'write');
      }
    }
  }

  /**
   * Get all records
   * @returns Array of prompt records
   */
  async getRecords(): Promise<PromptRecord[]> {
    try {
      const data = await this.storage.getItem(this.storageKey);
      if (!data) return [];
      
      const records: PromptRecord[] = JSON.parse(data);
      
      // 直接返回记录，排序逻辑由调用者根据需求处理
      return records;
    } catch (err) {
      throw new HistoryStorageError('Failed to get history records', 'read');
    }
  }

  /**
   * Get a specific record by ID
   * @param id Record ID
   * @returns The record or null if not found
   */
  async getRecord(id: string): Promise<PromptRecord> {
    const records = await this.getRecords();
    const record = records.find(r => r.id === id);
    
    if (!record) {
      throw new RecordNotFoundError(`Record with ID ${id} not found`, id);
    }
    
    return record;
  }

  /**
   * Delete a record by ID
   * @param id Record ID
   */
  async deleteRecord(id: string): Promise<void> {
    try {
      await this.storage.updateData<PromptRecord[]>(this.storageKey, current => {
        const records = current ?? [];
        if (!records.some(r => r.id === id)) {
          throw new RecordNotFoundError(`Record with ID ${id} not found`, id);
        }
        return records.filter(r => r.id !== id);
      });
    } catch (err) {
      if (err instanceof RecordNotFoundError) {
        throw err;
      }
      throw new HistoryStorageError('Failed to delete record', 'delete');
    }
  }

  /**
   * Get iteration chain for a record
   * @param recordId The ID of the record to start the chain from
   * @returns Array of records forming the iteration chain
   */
  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    const allRecords = await this.getRecords();
    const chain: PromptRecord[] = [];
    let currentId = recordId;
    
    while (currentId) {
      const record = allRecords.find(r => r.id === currentId);
      if (!record) break;
      
      chain.unshift(record);
      currentId = record.previousId ?? '';
    }
    
    return chain;
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    try {
      await this.storage.removeItem(this.storageKey);
    } catch (err) {
      throw new HistoryStorageError('Failed to clear history', 'delete');
    }
  }

  /**
   * Save records to storage
   * @param records Records to save
   */
  private async saveToStorage(records: PromptRecord[]): Promise<void> {
    await this.storage.setItem(this.storageKey, JSON.stringify(records));
  }

  /**
   * Validate a record
   * @param record Record to validate
   */
  private validateRecord(record: PromptRecord): void {
    const errors: string[] = [];
    
    if (!record.id) errors.push('ID is required');
    if (!record.originalPrompt) errors.push('Original prompt is required');
    if (!record.optimizedPrompt) errors.push('Optimized prompt is required');
    if (!record.type) errors.push('Type is required');
    if (!record.chainId) errors.push('Chain ID is required');
    if (record.version === undefined) errors.push('Version is required');
    
    if (errors.length > 0) {
      throw new RecordValidationError('Record validation failed', errors);
    }
  }

  /**
   * Create a new chain with initial record
   * @param params Initial record params
   * @returns The new chain
   */
  async createNewChain(params: Omit<PromptRecord, 'chainId' | 'version' | 'previousId'>): Promise<PromptRecordChain> {
    // Generate chain ID
    const chainId = uuidv4();
    
    // Create record with chainId and initial version
    const record: PromptRecord = {
      ...params,
      chainId,
      version: 1,
      previousId: undefined,
      timestamp: params.timestamp || Date.now()
    };
    
    // Add record
    await this.addRecord(record);
    
    // Return the new chain
    return this.getChain(chainId);
  }

  /**
   * Add an iteration to an existing chain
   * @param params Parameters for the iteration
   * @returns The updated chain
   */
  async addIteration(params: {
    chainId: string;
    originalPrompt: string;
    optimizedPrompt: string;
    modelKey: string;
    templateId: string;
    iterationNote?: string;
    metadata?: Record<string, any>;
  }): Promise<PromptRecordChain> {
    const modelName = params.modelKey ? await this.getModelNameByKey(params.modelKey) : undefined;
    let updatedChain: PromptRecordChain | undefined;

    await this.storage.updateData<PromptRecord[]>(this.storageKey, existingRecords => {
      const records = existingRecords ?? [];
      const chainRecords = records.filter(r => r.chainId === params.chainId);
      if (chainRecords.length === 0) {
        throw new RecordNotFoundError(`Chain with ID ${params.chainId} not found`, params.chainId);
      }

      const sortedRecords = [...chainRecords].sort((a, b) => a.version - b.version);
      const rootRecord = sortedRecords.find(r => r.version === 1);
      if (!rootRecord) {
        throw new HistoryError(
          HISTORY_ERROR_CODES.CHAIN_ERROR,
          { details: `Chain ${params.chainId} has no root record (version 1)` },
          `Chain ${params.chainId} has no root record (version 1)`
        );
      }

      const currentRecord = sortedRecords[sortedRecords.length - 1];
      const record: PromptRecord = {
        id: uuidv4(),
        chainId: params.chainId,
        originalPrompt: params.originalPrompt,
        optimizedPrompt: params.optimizedPrompt,
        type: 'iterate',
        version: currentRecord.version + 1,
        previousId: currentRecord.id,
        timestamp: Date.now(),
        modelKey: params.modelKey,
        ...(modelName !== undefined ? { modelName } : {}),
        templateId: params.templateId,
        ...(params.iterationNote !== undefined ? { iterationNote: params.iterationNote } : {}),
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {})
      };

      this.validateRecord(record);
      if (records.some(r => r.id === record.id)) {
        throw new HistoryError(
          HISTORY_ERROR_CODES.VALIDATION_ERROR,
          { details: `Record with ID ${record.id} already exists` },
          `Record with ID ${record.id} already exists`
        );
      }

      const nextRecords = this.trimRecordsPreservingRoots([record, ...records]);
      const retainedChainRecords = nextRecords
        .filter(r => r.chainId === params.chainId)
        .sort((a, b) => a.version - b.version);

      updatedChain = {
        chainId: params.chainId,
        rootRecord,
        currentRecord: record,
        versions: retainedChainRecords
      };

      return nextRecords;
    });

    return updatedChain!;
  }

  /**
   * Get a chain by ID
   * @param chainId Chain ID
   * @returns The chain
   */
  async getChain(chainId: string): Promise<PromptRecordChain> {
    try {
      const allRecords = await this.getRecords();
      
      // Filter records for this chain
      const chainRecords = allRecords.filter(r => r.chainId === chainId);
      
      if (chainRecords.length === 0) {
        throw new RecordNotFoundError(`Chain with ID ${chainId} not found`, chainId);
      }
      
      // Sort by version (ascending)
      const sortedRecords = chainRecords.sort((a, b) => a.version - b.version);
      
      // Get root record (version 1)
      const rootRecord = sortedRecords.find(r => r.version === 1);
      if (!rootRecord) {
        throw new HistoryError(
          HISTORY_ERROR_CODES.CHAIN_ERROR,
          { details: `Chain ${chainId} has no root record (version 1)` },
          `Chain ${chainId} has no root record (version 1)`
        );
      }
      
      // Get current record (highest version)
      const currentRecord = sortedRecords[sortedRecords.length - 1];
      
      return {
        chainId,
        rootRecord,
        currentRecord,
        versions: sortedRecords
      };
    } catch (err) {
      if (err instanceof RecordNotFoundError || err instanceof HistoryError) {
        throw err;
      }
      throw new HistoryStorageError('Failed to get chain', 'read');
    }
  }

  /**
   * Get all chains
   * @returns Array of chains
   */
  async getAllChains(): Promise<PromptRecordChain[]> {
    const records = await this.getRecords();
    
    // Group records by chainId
    const chains = new Map<string, PromptRecord[]>();
    
    records.forEach(record => {
      if (!chains.has(record.chainId)) {
        chains.set(record.chainId, []);
      }
      chains.get(record.chainId)!.push(record);
    });
    
    // Create PromptRecordChain objects for each chain
    const results: PromptRecordChain[] = [];
    
    for (const [chainId, chainRecords] of chains.entries()) {
      // Sort by version (ascending)
      const sortedRecords = chainRecords.sort((a, b) => a.version - b.version);
      
      // Get root record (version 1)
      const rootRecord = sortedRecords.find(r => r.version === 1);
      if (!rootRecord) continue; // Skip chains without root record
      
      // Get current record (highest version)
      const currentRecord = sortedRecords[sortedRecords.length - 1];
      
      results.push({
        chainId,
        rootRecord,
        currentRecord,
        versions: sortedRecords
      });
    }
    
    // 按照最新记录的时间戳排序，最新的在前
    results.sort((a, b) => b.currentRecord.timestamp - a.currentRecord.timestamp);
    
    return results;
  }

  /**
   * Delete a chain by its ID
   * @param chainId The ID of the chain to delete
   */
  async deleteChain(chainId: string): Promise<void> {
    await this.storage.updateData<PromptRecord[]>(this.storageKey, current => {
      const records = current ?? [];
      const recordsToKeep = records.filter(record => record.chainId !== chainId);
      if (recordsToKeep.length === records.length) {
        throw new RecordNotFoundError(`Chain with ID ${chainId} not found`, chainId);
      }
      return recordsToKeep;
    });
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有历史记录
   */
  async exportData(): Promise<PromptRecord[]> {
    try {
      return await this.getRecords();
    } catch (error) {
      throw new ImportExportError(
        'Failed to export history data',
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      );
    }
  }

  /**
   * 导入历史记录
   */
  async importData(data: any): Promise<void> {
    if (!(await this.validateData(data))) {
      throw new RecordValidationError(
        'Invalid history data format: data must be an array of prompt records',
        [],
      );
    }

    // Prepare the complete replacement before its only write. A failed write
    // must not leave the old history cleared or publish only part of a chain.
    const records: PromptRecord[] = [];
    for (const record of (data as PromptRecord[]).slice(0, this.maxRecords)) {
      records.push({
        ...record,
        ...(!record.modelName && record.modelKey
          ? { modelName: await this.getModelNameByKey(record.modelKey) }
          : {}),
      });
    }
    try {
      await this.saveToStorage(records);
    } catch (error) {
      throw new ImportExportError(
        'Failed to import history data', await this.getDataType(), error as Error,
      );
    }
  }

  /**
   * 获取数据类型标识
   */
  async getDataType(): Promise<string> {
    return 'history';
  }

  /**
   * 验证历史记录数据格式
   */
  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) {
      return false;
    }

    const ids = new Set<string>();
    return data.every(item => {
      if (typeof item !== 'object' || item === null ||
        typeof item.id !== 'string' || item.id.length === 0 || ids.has(item.id)) return false;
      ids.add(item.id);
      return typeof item.originalPrompt === 'string' && item.originalPrompt.length > 0 &&
        typeof item.optimizedPrompt === 'string' && item.optimizedPrompt.length > 0 &&
        typeof item.type === 'string' && item.type.length > 0 &&
        typeof item.chainId === 'string' && item.chainId.length > 0 &&
        Number.isInteger(item.version) && item.version >= 1 &&
        typeof item.timestamp === 'number' && Number.isFinite(item.timestamp) &&
        typeof item.modelKey === 'string' &&
        typeof item.templateId === 'string' &&
        (item.previousId === undefined || typeof item.previousId === 'string');
    });
  }
}

/**
 * 创建聊天历史管理器的工厂函数
 * @param storageProvider 存储提供器实例
 * @param modelManager 模型管理器实例
 * @returns 聊天历史管理器实例
 */
export function createHistoryManager(
  storageProvider: IStorageProvider,
  modelManager: IModelManager
): HistoryManager {
  return new HistoryManager(storageProvider, modelManager);
}
