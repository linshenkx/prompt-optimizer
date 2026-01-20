import type { IHistoryManager, PromptRecord, PromptRecordChain } from './types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { HistoryStorageError, RecordNotFoundError } from './errors';

/**
 * Electron环境下的历史记录管理器代理
 * 通过IPC与主进程中的真实HistoryManager通信
 */
export class ElectronHistoryManagerProxy implements IHistoryManager {
  private get electronAPI() {
    if (!window.electronAPI) {
      throw new HistoryStorageError('Electron API not available', 'storage');
    }
    return window.electronAPI;
  }

  async addRecord(record: PromptRecord): Promise<void> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeRecord = safeSerializeForIPC(record);
    return this.electronAPI.history.addRecord(safeRecord);
  }

  async getRecords(): Promise<PromptRecord[]> {
    return this.electronAPI.history.getHistory();
  }

  async getRecord(id: string): Promise<PromptRecord> {
    const records = await this.getRecords();
    const record = records.find(r => r.id === id);
    if (!record) {
      throw new RecordNotFoundError(`Record with ID ${id} not found`, id);
    }
    return record;
  }

  async deleteRecord(id: string): Promise<void> {
    return this.electronAPI.history.deleteRecord(id);
  }

  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    return this.electronAPI.history.getIterationChain(recordId);
  }

  async clearHistory(): Promise<void> {
    return this.electronAPI.history.clearHistory();
  }

  async getAllChains(): Promise<PromptRecordChain[]> {
    return this.electronAPI.history.getAllChains();
  }

  async getChain(chainId: string): Promise<PromptRecordChain> {
    return this.electronAPI.history.getChain(chainId);
  }

  async createNewChain(record: Omit<PromptRecord, 'chainId' | 'version' | 'previousId'>): Promise<PromptRecordChain> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeRecord = safeSerializeForIPC(record);
    return this.electronAPI.history.createNewChain(safeRecord);
  }

  async addIteration(params: {
    chainId: string;
    originalPrompt: string;
    optimizedPrompt: string;
    iterationNote?: string;
    modelKey: string;
    templateId: string;
  }): Promise<PromptRecordChain> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeParams = safeSerializeForIPC(params);
    return this.electronAPI.history.addIteration(safeParams);
  }

  async deleteChain(chainId: string): Promise<void> {
    return this.electronAPI.history.deleteChain(chainId);
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有历史记录
   */
  async exportData(): Promise<PromptRecord[]> {
    return (this.electronAPI as any).history.exportData();
  }

  /**
   * 导入历史记录
   */
  async importData(data: any): Promise<void> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeData = safeSerializeForIPC(data);
    return (this.electronAPI as any).history.importData(safeData);
  }

  /**
   * 获取数据类型标识
   */
  async getDataType(): Promise<string> {
    return (this.electronAPI as any).history.getDataType();
  }

  /**
   * 验证历史记录数据格式
   */
  async validateData(data: any): Promise<boolean> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeData = safeSerializeForIPC(data);
    return (this.electronAPI as any).history.validateData(safeData);
  }
}
