/**
 * 提示词记录类型
 */
export type PromptRecordType = 'optimize' | 'iterate';

/**
 * 提示词记录接口
 */
export interface PromptRecord {
  /** 记录ID */
  id: string;
  /** 原始提示词 */
  originalPrompt: string;
  /** 优化/迭代后的提示词 */
  optimizedPrompt: string;
  /** 记录类型 */
  type: PromptRecordType;
  /** 所属的提示词链ID */
  chainId: string;
  /** 在链中的版本号 */
  version: number;
  /** 前一个版本ID */
  previousId?: string;
  /** 时间戳 */
  timestamp: number;
  /** 使用的模型key */
  modelKey: string;
  /** 
   * 使用的模型显示名称 
   * 通过modelKey从modelManager中获取，用于UI展示
   * 不存储时使用modelKey作为后备显示
   */
  modelName?: string;
  /** 使用的提示词ID */
  templateId: string;
  /** 迭代时的修改说明 */
  iterationNote?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 历史记录链类型
 */
export interface PromptRecordChain {
  chainId: string;
  rootRecord: PromptRecord;
  currentRecord: PromptRecord;
  versions: PromptRecord[];
}

/**
 * 历史记录管理器接口
 */
export interface IHistoryManager {
  /** 添加记录 */
  addRecord(record: PromptRecord): Promise<void>;
  /** 获取所有记录 */
  getRecords(): Promise<PromptRecord[]>;
  /** 获取指定记录 */
  getRecord(id: string): Promise<PromptRecord>;
  /** 删除记录 */
  deleteRecord(id: string): Promise<void>;
  /** 获取迭代链 */
  getIterationChain(recordId: string): Promise<PromptRecord[]>;
  /** 清除所有记录 */
  clearHistory(): Promise<void>;
  /** 获取所有记录链 */
  getAllChains(): Promise<PromptRecordChain[]>;
  /** 创建新的记录链 */
  createNewChain(record: Omit<PromptRecord, 'chainId' | 'version' | 'previousId'>): Promise<PromptRecordChain>;
  /** 添加迭代记录 */
  addIteration(params: {
    chainId: string;
    originalPrompt: string;
    optimizedPrompt: string;
    iterationNote?: string; // Made optional to match manager.ts implementation
    modelKey: string;
    templateId: string;
  }): Promise<PromptRecordChain>;
} 