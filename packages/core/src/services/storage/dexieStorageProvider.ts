import Dexie, { type Table } from 'dexie';
import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * 数据表接口定义
 */
interface StorageRecord {
  key: string;
  value: string;
  timestamp?: number;
}

/**
 * 获取数据库名称
 *
 * 优先级：
 * 1. 测试环境：使用注入的唯一数据库名称 (window.__TEST_DB_NAME__)
 * 2. 生产环境：使用固定名称 'PromptOptimizerDB'
 */
function getDatabaseName(): string {
  // 测试环境：从 window 对象读取测试数据库名称
  if (typeof window !== 'undefined') {
    const testDbName = (window as any).__TEST_DB_NAME__;
    if (testDbName) {
      return testDbName;
    }
  }

  // 生产环境：使用固定名称
  return 'PromptOptimizerDB';
}

/**
 * Dexie 数据库类
 */
class PromptOptimizerDB extends Dexie {
  storage!: Table<StorageRecord, string>;

  constructor() {
    super(getDatabaseName());

    // 定义数据库结构
    this.version(1).stores({
      storage: 'key, value, timestamp'
    });
  }
}

/**
 * 基于 Dexie 的存储提供器实现
 * 
 * 相比 LocalStorageProvider 的优势：
 * - 更大的存储容量（几GB vs 5MB）
 * - 原生事务支持，更好的并发安全
 * - 异步操作，不阻塞UI
 * - 更好的查询性能
 */
export class DexieStorageProvider implements IStorageProvider {
  private db: PromptOptimizerDB;
  private dbOpened: Promise<void>;
  
  // 用于原子操作的锁机制
  private keyLocks = new Map<string, Promise<void>>();

  constructor() {
    this.db = new PromptOptimizerDB();
    this.dbOpened = this.db.open().then(() => undefined).catch((error) => {
      console.error('Failed to open Dexie database:', error);
      // 抛出错误以使所有后续操作失败
      throw error;
    });
  }

  /**
   * 确保数据库已打开
   */
  private async initialize(): Promise<void> {
    await this.dbOpened;
  }

  /**
   * 重置迁移状态（主要用于测试）
   */
  static resetMigrationState(): void {
    // 因为迁移逻辑已移除，此函数不再需要
    // 保留为空函数以避免破坏测试的API
  }

  /**
   * 获取存储项
   */
  async getItem(key: string): Promise<string | null> {
    await this.initialize();
    
    try {
      const record = await this.db.storage.get(key);
      return record?.value ?? null;
    } catch (error) {
      console.error(`获取存储项失败 (${key}):`, error);
      throw new StorageError(`Failed to get item: ${key}`, 'read');
    }
  }

  /**
   * 设置存储项
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.initialize();
    
    try {
      await this.db.storage.put({
        key,
        value,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`设置存储项失败 (${key}):`, error);
      throw new StorageError(`Failed to set item: ${key}`, 'write');
    }
  }

  /**
   * 删除存储项
   */
  async removeItem(key: string): Promise<void> {
    await this.initialize();
    
    try {
      await this.db.storage.delete(key);
    } catch (error) {
      console.error(`删除存储项失败 (${key}):`, error);
      throw new StorageError(`Failed to remove item: ${key}`, 'delete');
    }
  }

  /**
   * 清空所有存储
   */
  async clearAll(): Promise<void> {
    await this.initialize();
    
    try {
      await this.db.storage.clear();
    } catch (error) {
      console.error('清空存储失败:', error);
      throw new StorageError('Failed to clear storage', 'clear');
    }
  }

  /**
   * 原子更新操作
   * 使用 Dexie 的事务机制确保原子性，带重试和降级机制
   */
  async atomicUpdate<T>(
    key: string,
    updateFn: (currentValue: T | null) => T
  ): Promise<void> {
    await this.initialize();

    // 获取键级别的锁
    const lockKey = `atomic_${key}`;
    if (this.keyLocks.has(lockKey)) {
      await this.keyLocks.get(lockKey);
    }

    const lockPromise = this._performAtomicUpdateWithRetry(key, updateFn);
    this.keyLocks.set(lockKey, lockPromise);

    try {
      await lockPromise;
    } finally {
      this.keyLocks.delete(lockKey);
    }
  }

  /**
   * 隐藏式数据更新 - 内部使用原子更新实现
   * 实现 IStorageProvider 接口要求
   */
  async updateData<T>(
    key: string,
    modifier: (currentValue: T | null) => T
  ): Promise<void> {
    // 直接使用内部的原子更新实现
    await this.atomicUpdate(key, modifier);
  }

  /**
   * 类型守卫：检查是否为Error对象
   */
  private isError(error: unknown): error is Error {
    return error instanceof Error || (typeof error === 'object' && error !== null && 'name' in error && 'message' in error);
  }

  /**
   * 带重试机制的原子更新
   */
  private async _performAtomicUpdateWithRetry<T>(
    key: string,
    updateFn: (currentValue: T | null) => T,
    maxRetries: number = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this._performAtomicUpdate(key, updateFn);
        return; // 成功，直接返回
      } catch (error) {
        lastError = error as Error;
        console.warn(`原子更新尝试 ${attempt}/${maxRetries} 失败 (${key}):`, error);

        // 如果是事务错误且还有重试机会，等待一段时间后重试
        if (this.isError(error) && error.name === 'PrematureCommitError' && attempt < maxRetries) {
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000); // 指数退避，最大1秒
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // 如果是最后一次尝试或非事务错误，尝试降级到简单更新
        if (attempt === maxRetries) {
          console.warn(`所有重试失败，尝试降级到简单更新 (${key})`);
          try {
            await this._performSimpleUpdate(key, updateFn);
            console.log(`降级更新成功 (${key})`);
            return;
          } catch (fallbackError) {
            console.error(`降级更新也失败 (${key}):`, fallbackError);
            throw lastError; // 抛出原始错误
          }
        }
      }
    }

    if (lastError) {
      throw lastError
    }
    throw new StorageError(`Failed to perform atomic update after ${maxRetries} attempts`, 'write')
  }

  /**
   * 简单更新（降级方案）
   */
  private async _performSimpleUpdate<T>(
    key: string,
    updateFn: (currentValue: T | null) => T
  ): Promise<void> {
    try {
      // 读取当前值
      const currentRecord = await this.db.storage.get(key);
      const currentValue = currentRecord?.value
        ? JSON.parse(currentRecord.value) as T
        : null;

      // 应用更新函数
      const newValue = updateFn(currentValue);

      // 直接写入新值（不使用事务）
      await this.db.storage.put({
        key,
        value: JSON.stringify(newValue),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`简单更新失败 (${key}):`, error);
      throw new StorageError(`Failed to perform simple update: ${key}`, 'write');
    }
  }

  /**
   * 执行原子更新
   */
  private async _performAtomicUpdate<T>(
    key: string,
    updateFn: (currentValue: T | null) => T
  ): Promise<void> {
    try {
      // 使用更安全的事务处理方式
      await this.db.transaction('rw', this.db.storage, async (tx) => {
        try {
          // 读取当前值
          const currentRecord = await tx.table('storage').get(key);
          const currentValue = currentRecord?.value
            ? JSON.parse(currentRecord.value) as T
            : null;

          // 应用更新函数 - 确保同步执行
          const newValue = updateFn(currentValue);

          // 写入新值
          await tx.table('storage').put({
            key,
            value: JSON.stringify(newValue),
            timestamp: Date.now()
          });
        } catch (innerError) {
          // 事务内部错误，让事务回滚
          console.error(`事务内部操作失败 (${key}):`, innerError);
          throw innerError;
        }
      });
    } catch (error) {
      console.error(`原子更新失败 (${key}):`, error);

      // 如果是Dexie事务错误，提供更详细的错误信息
      if (this.isError(error) && error.name === 'PrematureCommitError') {
        throw new StorageError(
          `Database transaction error for key ${key}: ${error.message}. Please try again.`,
          'write',
        );
      }

      throw new StorageError(`Failed to perform atomic update: ${key}`, 'write');
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
    await this.initialize();

    try {
      await this.db.transaction('rw', this.db.storage, async () => {
        const updates: Array<StorageRecord> = [];
        const deletions: string[] = [];

        for (const { key, operation, value } of operations) {
          if (operation === 'set' && value !== undefined) {
            updates.push({
              key,
              value,
              timestamp: Date.now()
            });
          } else if (operation === 'remove') {
            deletions.push(key);
          }
        }

        // 批量写入
        if (updates.length > 0) {
          await this.db.storage.bulkPut(updates);
        }

        // 批量删除
        if (deletions.length > 0) {
          await this.db.storage.bulkDelete(deletions);
        }
      });
    } catch (error) {
      console.error('批量更新失败:', error);
      throw new StorageError('Failed to perform batch update', 'write');
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageInfo(): Promise<{
    itemCount: number;
    estimatedSize: number;
    lastUpdated: number | null;
  }> {
    await this.initialize();

    try {
      const itemCount = await this.db.storage.count();
      const lastRecord = await this.db.storage
        .orderBy('timestamp')
        .last();

      // 估算存储大小（粗略计算）
      const allRecords = await this.db.storage.toArray();
      const estimatedSize = allRecords.reduce(
        (total, record) => total + record.value.length,
        0
      );

      return {
        itemCount,
        estimatedSize,
        lastUpdated: lastRecord?.timestamp ?? null
      };
    } catch (error) {
      console.error('获取存储信息失败:', error);
      return {
        itemCount: 0,
        estimatedSize: 0,
        lastUpdated: null
      };
    }
  }

  /**
   * 导出所有数据（用于备份）
   */
  async exportAll(): Promise<Record<string, string>> {
    await this.initialize();

    try {
      const allRecords = await this.db.storage.toArray();
      const result: Record<string, string> = {};

      allRecords.forEach(record => {
        result[record.key] = record.value;
      });

      return result;
    } catch (error) {
      console.error('导出数据失败:', error);
      throw new StorageError('Failed to export data', 'read');
    }
  }

  /**
   * 导入数据（用于恢复）
   */
  async importAll(data: Record<string, string>): Promise<void> {
    await this.initialize();

    try {
      const records: StorageRecord[] = Object.entries(data).map(([key, value]) => ({
        key,
        value,
        timestamp: Date.now()
      }));

      await this.db.storage.bulkPut(records);
    } catch (error) {
      console.error('导入数据失败:', error);
      throw new StorageError('Failed to import data', 'write');
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      console.error('关闭数据库失败:', error);
    }
  }
} 
