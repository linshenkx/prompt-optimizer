import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * 存储适配器 - 为不支持高级方法的存储提供者提供兼容性
 * 隐藏原子操作实现细节，业务层无需关心
 */
export class StorageAdapter implements IStorageProvider {
  private locks: Map<string, Promise<void>> = new Map();

  constructor(private readonly baseProvider: IStorageProvider) {}

  // 基础方法直接代理
  async getItem(key: string): Promise<string | null> {
    return this.baseProvider.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.baseProvider.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return this.baseProvider.removeItem(key);
  }

  async clearAll(): Promise<void> {
    return this.baseProvider.clearAll();
  }

  /**
   * 隐藏式数据更新 - 内部实现原子性
   */
  async updateData<T>(
    key: string, 
    modifier: (currentValue: T | null) => T
  ): Promise<void> {
    // 如果基础提供者有updateData方法，直接使用
    if ('updateData' in this.baseProvider && typeof this.baseProvider.updateData === 'function') {
      return (this.baseProvider as any).updateData(key, modifier);
    }

    // 否则使用手动实现的原子操作
    const release = await this.acquireLock(key);
    try {
      // 读取当前值
      const currentData = await this.baseProvider.getItem(key);
      const currentValue: T | null = currentData ? JSON.parse(currentData) : null;
      
      // 应用修改 - 业务逻辑错误直接透传
      const newValue = modifier(currentValue);
      
      // 写入新值
      await this.baseProvider.setItem(key, JSON.stringify(newValue));
    } finally {
      release();
    }
  }

  /**
   * 批量更新操作
   */
  async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    // 如果基础提供者有batchUpdate方法，直接使用
    if ('batchUpdate' in this.baseProvider && typeof this.baseProvider.batchUpdate === 'function') {
      return (this.baseProvider as any).batchUpdate(operations);
    }

    // 否则顺序执行操作（简化实现）
    for (const op of operations) {
      if (op.operation === 'set' && op.value !== undefined) {
        await this.baseProvider.setItem(op.key, op.value);
      } else if (op.operation === 'remove') {
        await this.baseProvider.removeItem(op.key);
      }
    }
  }

  /**
   * 获取存储能力信息
   */
  getCapabilities() {
    // 基础提供者的能力
    if ('getCapabilities' in this.baseProvider && typeof this.baseProvider.getCapabilities === 'function') {
      return (this.baseProvider as any).getCapabilities();
    }
    
    // 默认能力
    return {
      supportsAtomic: true, // 通过适配器实现
      supportsBatch: false,
      maxStorageSize: undefined
    };
  }

  /**
   * 改进的异步锁实现
   * 使用队列机制避免死锁和锁泄漏
   */
  private async acquireLock(key: string): Promise<() => void> {
    // 如果已有锁，等待它完成
    const existingLock = this.locks.get(key);
    if (existingLock) {
      try {
        await existingLock;
      } catch (error) {
        // 忽略前一个操作的错误，继续获取锁
      }
    }

    // 创建新锁
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve, reject) => {
      let released = false;
      
      releaseLock = () => {
        if (!released) {
          released = true;
          this.locks.delete(key);
          resolve();
        }
      };
      
      // 设置超时防止死锁
      setTimeout(() => {
        if (!released) {
          released = true;
          this.locks.delete(key);
          reject(new StorageError(`Lock timeout for key: ${key}`, 'write'));
        }
      }, 30000); // 30秒超时
    });
    
    this.locks.set(key, lockPromise);
    return releaseLock!;
  }
} 
