import * as fs from 'fs/promises';
import * as path from 'path';
import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * 基于文件的存储提供器 - 增强版
 * 专为Electron桌面环境设计，使用JSON文件持久化存储数据
 *
 * 特性：
 * - 延迟写入优化性能，减少I/O操作
 * - 内存缓存提供快速读取
 * - 原子写入确保数据完整性
 * - 数据备份和智能恢复机制
 * - 原子性updateData操作
 * - 严格的初始化控制
 */
export class FileStorageProvider implements IStorageProvider {
  private filePath: string;
  private backupPath: string;
  private data: Map<string, string> = new Map();
  private writeTimeout: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;
  private writeLock: Promise<void> = Promise.resolve();
  private updateLock: Promise<void> = Promise.resolve();
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  // 配置常量
  private readonly WRITE_DELAY = 500; // 500ms延迟写入
  private readonly TEMP_FILE_SUFFIX = '.tmp';
  private readonly BACKUP_FILE_SUFFIX = '.backup';
  private readonly MAX_FLUSH_TIME = 3000; // 最大flush时间：3秒
  private flushAttempts = 0; // flush尝试次数
  private readonly MAX_FLUSH_ATTEMPTS = 3; // 最大flush尝试次数
  
  constructor(userDataPath: string) {
    if (!userDataPath) {
      throw new StorageError('FileStorageProvider requires userDataPath parameter', 'read');
    }

    this.filePath = path.join(userDataPath, 'prompt-optimizer-data.json');
    this.backupPath = path.join(userDataPath, 'prompt-optimizer-data.json' + this.BACKUP_FILE_SUFFIX);
  }
  
  /**
   * 确保存储已初始化 - 增强版
   * 使用单例模式确保初始化只执行一次
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.initialize();
    await this.initializationPromise;
  }

  /**
   * 初始化存储，加载现有数据 - 增强版
   * 包含智能恢复机制
   */
  private async initialize(): Promise<void> {
    try {
      console.log('[FileStorage] Initializing storage...');
      await this.loadFromFileWithRecovery();
      this.initialized = true;
      console.log('[FileStorage] Storage initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FileStorage] Failed to initialize:', errorMessage);
      throw new StorageError(`Failed to initialize file storage: ${errorMessage}`, 'read');
    }
  }
  
  /**
   * 从文件加载数据到内存 - 增强版，包含智能恢复机制
   */
  private async loadFromFileWithRecovery(): Promise<void> {
    // 尝试从主文件加载
    const mainFileResult = await this.tryLoadFromFile(this.filePath, 'main');
    if (mainFileResult.success) {
      this.data = mainFileResult.data!;
      // 成功加载主文件后，创建备份
      await this.createBackup();
      return;
    }

    console.warn('[FileStorage] Main file failed, trying backup...');

    // 尝试从备份文件加载
    const backupFileResult = await this.tryLoadFromFile(this.backupPath, 'backup');
    if (backupFileResult.success) {
      this.data = backupFileResult.data!;
      console.log('[FileStorage] Successfully recovered from backup');

      // 从备份恢复后，重新创建主文件（跳过备份创建以保护现有备份）
      await this.saveToFileWithoutBackup();

      // 主文件恢复成功后，重新创建备份以确保备份是最新的
      try {
        await this.createBackup();
        console.log('[FileStorage] Backup refreshed after recovery');
      } catch (error) {
        console.warn('[FileStorage] Failed to refresh backup after recovery:', error);
        // 备份失败不应该影响恢复流程
      }

      return;
    }

    console.warn('[FileStorage] Both main and backup files failed, checking if files exist...');

    // 检查是否是首次运行（文件不存在）
    const mainExists = await this.fileExists(this.filePath);
    const backupExists = await this.fileExists(this.backupPath);

    if (!mainExists && !backupExists) {
      // 首次运行，创建空存储
      console.log('[FileStorage] First run detected, creating new storage');
      this.data = new Map();
      await this.saveToFile();
      return;
    }

    // 文件存在但都损坏了，这是严重问题
    console.error('[FileStorage] CRITICAL: Both storage files exist but are corrupted!');
    console.error('[FileStorage] Main file error:', mainFileResult.error);
    console.error('[FileStorage] Backup file error:', backupFileResult.error);

    // 在这种情况下，我们不能简单地重置数据，而是抛出错误让上层处理
    throw new StorageError(
      `Storage corruption detected. Main: ${mainFileResult.error}, Backup: ${backupFileResult.error}`,
      'read'
    );
  }

  /**
   * 尝试从指定文件加载数据
   */
  private async tryLoadFromFile(filePath: string, fileType: string): Promise<{
    success: boolean;
    data?: Map<string, string>;
    error?: string;
  }> {
    try {
      // 检查文件是否存在
      await fs.access(filePath);

      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf8');

      // 验证JSON格式
      if (!this.validateJSON(content)) {
        return {
          success: false,
          error: `Invalid JSON format in ${fileType} file`
        };
      }

      // 解析数据
      const parsed = JSON.parse(content);
      const data = new Map<string, string>();

      // 确保所有值都是字符串类型
      for (const [key, value] of Object.entries(parsed || {})) {
        data.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      }

      console.log(`[FileStorage] Successfully loaded ${data.size} items from ${fileType} file`);

      return {
        success: true,
        data
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to load ${fileType} file: ${errorMessage}`
      };
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建备份文件
   */
  private async createBackup(): Promise<void> {
    try {
      if (await this.fileExists(this.filePath)) {
        await fs.copyFile(this.filePath, this.backupPath);
        console.log('[FileStorage] Backup created successfully');
      }
    } catch (error) {
      console.warn('[FileStorage] Failed to create backup:', error);
      // 备份失败不应该影响主要功能
    }
  }
  
  /**
   * 将内存数据保存到文件 - 增强版
   * 包含备份创建和数据验证
   */
  private async saveToFile(): Promise<void> {
    const data = Object.fromEntries(this.data);
    const jsonString = JSON.stringify(data, null, 2);

    // 验证数据完整性
    if (!this.validateJSON(jsonString)) {
      throw new StorageError('Generated JSON is invalid', 'write');
    }

    // 如果主文件存在，先创建备份
    if (await this.fileExists(this.filePath)) {
      await this.createBackup();
    }

    // 原子写入主文件
    await this.atomicWrite(jsonString);

    console.log(`[FileStorage] Saved ${this.data.size} items to storage`);
  }

  /**
   * 将内存数据保存到文件 - 不创建备份版本
   * 用于从备份恢复时，避免覆盖完好的备份文件
   */
  private async saveToFileWithoutBackup(): Promise<void> {
    const data = Object.fromEntries(this.data);
    const jsonString = JSON.stringify(data, null, 2);

    // 验证数据完整性
    if (!this.validateJSON(jsonString)) {
      throw new StorageError('Generated JSON is invalid', 'write');
    }

    console.log('[FileStorage] Saving to main file without creating backup (recovery mode)');

    // 直接原子写入主文件，不创建备份
    await this.atomicWrite(jsonString);

    console.log(`[FileStorage] Recovered and saved ${this.data.size} items to storage`);
  }
  
  /**
   * 原子写入文件
   */
  private async atomicWrite(data: string): Promise<void> {
    const tempPath = this.filePath + this.TEMP_FILE_SUFFIX;
    
    try {
      // 确保目录存在
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      
      // 1. 写入临时文件
      await fs.writeFile(tempPath, data, 'utf8');
      
      // 2. 验证文件格式
      if (!this.validateJSON(data)) {
        throw new StorageError('Invalid JSON format', 'write');
      }
      
      // 3. 原子性重命名
      await fs.rename(tempPath, this.filePath);
      
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch {}
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageError(`Atomic write failed: ${errorMessage}`, 'write');
    }
  }
  
  /**
   * 验证JSON格式
   */
  private validateJSON(data: string): boolean {
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 调度延迟写入
   */
  private scheduleWrite(): void {
    this.isDirty = true;
    
    // 如果已有待写入任务，重置计时器
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }
    
    this.writeTimeout = setTimeout(async () => {
      if (this.isDirty) {
        try {
          await this.acquireWriteLock(async () => {
            await this.saveToFile();
            this.isDirty = false;
          });
        } catch (error) {
          console.error('[FileStorage] Scheduled write failed:', error);
          // 重置isDirty标志以避免无限重试
          this.isDirty = false;
        }
      }
      this.writeTimeout = null;
    }, this.WRITE_DELAY);
  }
  
  /**
   * 立即写入（关键时刻使用）
   * 带有超时保护和重试限制，确保不会无限循环
   */
  async flush(): Promise<void> {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }

    if (!this.isDirty) {
      return; // 没有脏数据，直接返回
    }

    // 检查重试次数限制
    if (this.flushAttempts >= this.MAX_FLUSH_ATTEMPTS) {
      console.error('[FileStorage] Max flush attempts reached, forcing isDirty to false');
      this.isDirty = false;
      this.flushAttempts = 0;
      throw new StorageError('Max flush attempts exceeded', 'write');
    }

    this.flushAttempts++;

    try {
      // 使用Promise.race实现超时保护
      await Promise.race([
        this.acquireWriteLock(async () => {
          await this.saveToFile();
          this.isDirty = false;
          this.flushAttempts = 0; // 成功后重置计数器
          console.log('[FileStorage] Data saved successfully');
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new StorageError('Flush timeout', 'write')), this.MAX_FLUSH_TIME)
        )
      ]);
    } catch (error) {
      console.error('[FileStorage] Failed to save data during flush:', error);

      // 如果达到最大重试次数或者是超时错误，强制重置状态
      if (this.flushAttempts >= this.MAX_FLUSH_ATTEMPTS ||
          (error instanceof StorageError && error.operation === 'write' && error.params?.details === 'Flush timeout')) {
        console.warn('[FileStorage] Forcing isDirty to false to prevent infinite loop');
        this.isDirty = false;
        this.flushAttempts = 0;
      }

      throw error; // 重新抛出错误以便上层处理
    }
  }
  
  /**
   * 获取写入锁，确保写入操作串行执行
   */
  private async acquireWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const currentLock = this.writeLock;
    let resolveLock: () => void;
    
    this.writeLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    try {
      await currentLock;
      const result = await operation();
      return result;
    } finally {
      resolveLock!();
    }
  }
  
  // IStorageProvider接口实现
  
  async getItem(key: string): Promise<string | null> {
    await this.ensureInitialized();
    return this.data.get(key) || null;
  }
  
  async setItem(key: string, value: string): Promise<void> {
    await this.ensureInitialized();
    this.data.set(key, value);
    this.scheduleWrite(); // 延迟写入
  }
  
  async removeItem(key: string): Promise<void> {
    await this.ensureInitialized();
    this.data.delete(key);
    this.scheduleWrite(); // 延迟写入
  }
  
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    this.data.clear();
    // 强制写入，即使没有脏数据
    await this.acquireWriteLock(async () => {
      await this.saveToFile();
    });
  }
  
  /**
   * 原子性数据更新 - 增强版
   * 确保读-修改-写操作的原子性，防止并发问题
   */
  async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    await this.ensureInitialized();

    // 使用更新锁确保原子性
    const currentLock = this.updateLock;
    let resolveLock: () => void;

    this.updateLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    try {
      await currentLock;

      // 在锁保护下执行原子操作
      await this.performAtomicUpdate(key, modifier);

    } catch (error) {
      // 业务逻辑错误直接透传，保持错误类型
      if (error instanceof Error &&
          (error.name.includes('Error') ||
           error.constructor.name !== 'Error' ||
           error.message.includes('模型') ||
           error.message.includes('不存在'))) {
        throw error;
      }
      // 只有真正的存储错误才包装为StorageError
      throw new StorageError(`Data update failed: ${key}`, 'write');
    } finally {
      resolveLock!();
    }
  }

  /**
   * 执行原子更新操作
   */
  private async performAtomicUpdate<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    // 重新从存储读取最新数据，确保数据一致性
    const latestData = await this.getLatestData<T>(key);

    // 应用修改
    const newValue = modifier(latestData);

    // 验证新值
    this.validateValue(newValue);

    // 写入新值
    this.data.set(key, JSON.stringify(newValue));
    this.scheduleWrite(); // 延迟写入

    console.log(`[FileStorage] Atomic update completed for key: ${key}`);
  }

  /**
   * 获取最新数据，确保数据一致性
   */
  private async getLatestData<T>(key: string): Promise<T | null> {
    // 如果有待写入的数据，先刷新到文件
    if (this.isDirty) {
      console.log('[FileStorage] Flushing pending changes before read...');
      await this.flush();
    }

    // 从内存缓存读取
    const currentData = this.data.get(key);
    if (!currentData) {
      return null;
    }

    try {
      return JSON.parse(currentData) as T;
    } catch (error) {
      console.error(`[FileStorage] Failed to parse data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 验证值的有效性
   */
  private validateValue<T>(value: T): void {
    try {
      JSON.stringify(value);
    } catch (error) {
      throw new StorageError('Value is not serializable', 'write');
    }
  }
  
  async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    await this.ensureInitialized();
    
    try {
      for (const op of operations) {
        if (op.operation === 'set' && op.value !== undefined) {
          this.data.set(op.key, op.value);
        } else if (op.operation === 'remove') {
          this.data.delete(op.key);
        }
      }
      
      await this.flush(); // 批量操作后立即写入
      
    } catch (error) {
      throw new StorageError('Batch update failed', 'write');
    }
  }
  
  getCapabilities() {
    return {
      supportsAtomic: true,
      supportsBatch: true,
      maxStorageSize: undefined // 文件存储无固定大小限制
    };
  }
}
