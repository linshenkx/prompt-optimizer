export interface IStorageProvider {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clearAll(): Promise<void>;

  /** Atomic across every connection to the same backing store. Never emulate with get/set. */
  compareAndSetItem?(key: string, expected: string | null, value: string | null): Promise<boolean>;
  
  // 隐藏式高级方法 - 内部自动选择最优实现
  updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void>;
  batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void>;
  
  // 可选：存储能力查询（用于监控和调试）
  getCapabilities?(): {
    supportsAtomic: boolean;
    supportsBatch: boolean;
    maxStorageSize?: number;
  };
}
