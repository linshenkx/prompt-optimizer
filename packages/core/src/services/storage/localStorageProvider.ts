import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * 简单的异步锁实现
 */
class AsyncLock {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(key: string): Promise<() => void> {
    // 等待现有锁完成
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch {
        // 忽略锁中的错误，继续尝试获取锁
      }
    }

    // 创建新锁
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.locks.delete(key);
        resolve();
      };
    });

    this.locks.set(key, lockPromise);

    // 返回释放函数
    return releaseLock!;
  }
}

/**
 * 增强的LocalStorageProvider，提供事务性操作
 */
export class LocalStorageProvider implements IStorageProvider {
  private lock = new AsyncLock();

  public async getItem(key: string): Promise<string | null> {
    const release = await this.lock.acquire(key);
    try {
      const item = localStorage.getItem(key);
      return item;
    } catch (error) {
      throw new StorageError(`Failed to get storage item: ${key}`, 'read');
    } finally {
      release();
    }
  }

  public async setItem(key: string, value: string): Promise<void> {
    const release = await this.lock.acquire(key);
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      throw new StorageError(`Failed to set storage item: ${key}`, 'write');
    } finally {
      release();
    }
  }

  public async removeItem(key: string): Promise<void> {
    const release = await this.lock.acquire(key);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      throw new StorageError(`Failed to remove storage item: ${key}`, 'delete');
    } finally {
      release();
    }
  }

  public async clearAll(): Promise<void> {
    const release = await this.lock.acquire('__clear_all__');
    try {
      localStorage.clear();
    } catch (error) {
      throw new StorageError('Failed to clear all storage items', 'clear');
    } finally {
      release();
    }
  }

  /**
   * 隐藏式数据更新 - 内部自动选择最优实现
   * 业务层无需关心是否支持原子操作
   * @param key 存储键
   * @param modifier 修改函数，接收当前值，返回新值
   */
  public async updateData<T>(
    key: string, 
    modifier: (currentValue: T | null) => T
  ): Promise<void> {
    // LocalStorageProvider 内部使用手动原子操作
    const release = await this.lock.acquire(key);
    try {
      // 读取当前值
      const currentData = localStorage.getItem(key);
      const currentValue: T | null = currentData ? JSON.parse(currentData) : null;
      
      // 应用修改 - 允许业务逻辑错误透传
      const newValue = modifier(currentValue);
      
      // 写入新值
      localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      // 业务逻辑错误直接透传，保持错误类型
      if (error instanceof Error &&
          (error.name.includes('Error') ||
           error.constructor.name !== 'Error' ||
           error.message.includes('Model') ||
           error.message.includes('not found') ||
           error.message.includes('not exist'))) {
        throw error;
      }
      // 只有真正的存储错误才包装为StorageError
      throw new StorageError(`Failed to update data: ${key}`, 'write');
    } finally {
      release();
    }
  }

  /**
   * 获取存储能力信息
   */
  public getCapabilities() {
    return {
      supportsAtomic: true, // 通过手动锁实现
      supportsBatch: true,
      maxStorageSize: 5 * 1024 * 1024 // 约5MB
    };
  }

  /**
   * 批量操作
   * @param operations 批量操作列表
   */
  public async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    // 获取所有相关键的锁
    const keys = operations.map(op => op.key);
    const releases = await Promise.all(keys.map(key => this.lock.acquire(key)));
    
    try {
      for (const op of operations) {
        if (op.operation === 'set' && op.value !== undefined) {
          localStorage.setItem(op.key, op.value);
        } else if (op.operation === 'remove') {
          localStorage.removeItem(op.key);
        }
      }
    } catch (error) {
      throw new StorageError('Failed to perform batch update', 'write');
    } finally {
      // 释放所有锁
      releases.forEach(release => release());
    }
  }
}
