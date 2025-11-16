import type { OptimizationMode } from '../prompt/types';

/**
 * 提示词记录类型
 */
export type PromptRecordType =
  | 'optimize'
  | 'userOptimize'
  | 'iterate'
  | 'test'
  | 'contextUserOptimize'
  | 'contextIterate'
  | 'imageOptimize'
  | 'contextImageOptimize'
  | 'imageIterate'
  | 'text2imageOptimize'
  | 'image2imageOptimize'
  | 'conversationMessageOptimize';

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
  metadata?: {
    optimizationMode?: OptimizationMode;  // 优化模式
    messageId?: string;                   // 被优化消息的 ID
    messageRole?: string;                 // 消息角色
    conversationSnapshot?: Array<{        // 会话快照（用于多轮对话优化）
      id: string;                         // 消息 ID
      role: string;                       // 消息角色
      content: string;                    // 消息内容
      originalContent?: string;           // 原始内容
      chainId?: string;                   // 🆕 该消息使用的优化链 ID
      appliedVersion?: number;            // 🆕 应用的版本号 (0=v0原始, 1=v1, 2=v2...)
    }>;
    [key: string]: any;                   // 保持扩展性
  };
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

import { IImportExportable } from '../../interfaces/import-export';

/**
 * 历史记录管理器接口
 */
export interface IHistoryManager extends IImportExportable {
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
  /** 获取指定链 */
  getChain(chainId: string): Promise<PromptRecordChain>;
  /** 创建一个新的记录链 */
  createNewChain(params: Omit<PromptRecord, 'chainId' | 'version' | 'previousId'>): Promise<PromptRecordChain>;
  /** 向现有链中添加一次迭代 */
  addIteration(params: {
    chainId: string;
    originalPrompt: string;
    optimizedPrompt: string;
    modelKey: string;
    templateId: string;
    iterationNote?: string;
    metadata?: Record<string, any>;
  }): Promise<PromptRecordChain>;
  /** 删除指定ID的记录链 */
  deleteChain(chainId: string): Promise<void>;
} 
