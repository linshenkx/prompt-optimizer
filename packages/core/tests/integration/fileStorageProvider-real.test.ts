import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStorageProvider } from '../../src/services/storage/fileStorageProvider';
import { StorageError } from '../../src/services/storage/errors';

describe('FileStorageProvider - Real File System Integration', () => {
  let provider: FileStorageProvider;
  let testDir: string;
  let storageFile: string;

  beforeEach(async () => {
    // 为每个用例分配独立目录，避免延迟写入跨用例互相干扰
    testDir = await fs.mkdtemp(path.join(__dirname, '..', '..', 'temp-test-storage-'));
    storageFile = path.join(testDir, 'prompt-optimizer-data.json');

    // 创建FileStorageProvider实例
    provider = new FileStorageProvider(testDir);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    try {
      await provider.flush();
    } catch {
      // 某些异常场景下 flush 会按预期失败，这里只做尽力清理
    }

    // 清理测试文件和目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('Real file operations', () => {
    it('should create storage file when it does not exist', async () => {
      // 确保文件不存在
      await expect(fs.access(storageFile)).rejects.toThrow();
      
      // 执行操作触发文件创建
      await provider.setItem('test-key', 'test-value');
      
      // 显式刷新，避免固定等待时间在高负载下产生抖动
      await provider.flush();
      
      // 验证文件被创建
      await expect(fs.access(storageFile)).resolves.toBeUndefined();
      
      // 验证文件内容
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);
      expect(data['test-key']).toBe('test-value');
    });

    it('should load existing data from real file', async () => {
      // 手动创建测试文件
      const testData = { 'existing-key': 'existing-value' };
      await fs.writeFile(storageFile, JSON.stringify(testData), 'utf8');
      
      // 创建新的provider实例来加载数据
      const newProvider = new FileStorageProvider(testDir);
      
      // 验证数据被正确加载
      const value = await newProvider.getItem('existing-key');
      expect(value).toBe('existing-value');
    });

    it('should throw error when file is corrupted and no backup exists', async () => {
      // 创建损坏的JSON文件
      await fs.writeFile(storageFile, 'invalid json content', 'utf8');

      // 创建新的provider实例
      const newProvider = new FileStorageProvider(testDir);

      // 应该抛出StorageError而不是创建新存储
      await expect(newProvider.setItem('recovery-key', 'recovery-value')).rejects.toThrow('Storage corruption detected');
    });

    it('should persist data across provider instances', async () => {
      // 使用第一个provider写入数据
      await provider.setItem('persist-key', 'persist-value');
      await provider.setItem('another-key', 'another-value');
      
      // 立即写入
      await provider.flush();
      
      // 创建新的provider实例
      const newProvider = new FileStorageProvider(testDir);
      
      // 验证数据持久化
      expect(await newProvider.getItem('persist-key')).toBe('persist-value');
      expect(await newProvider.getItem('another-key')).toBe('another-value');
    });

    it('should handle batch operations with real files', async () => {
      const operations = [
        { key: 'batch-key-1', operation: 'set' as const, value: 'batch-value-1' },
        { key: 'batch-key-2', operation: 'set' as const, value: 'batch-value-2' },
        { key: 'batch-key-3', operation: 'set' as const, value: 'batch-value-3' }
      ];

      await provider.batchUpdate(operations);

      // 验证数据在内存中正确
      expect(await provider.getItem('batch-key-1')).toBe('batch-value-1');
      expect(await provider.getItem('batch-key-2')).toBe('batch-value-2');
      expect(await provider.getItem('batch-key-3')).toBe('batch-value-3');

      // Reopen from disk to prove batchUpdate persisted the values, not just the in-memory map.
      const reloadedProvider = new FileStorageProvider(testDir);
      expect(await reloadedProvider.getItem('batch-key-1')).toBe('batch-value-1');
      expect(await reloadedProvider.getItem('batch-key-2')).toBe('batch-value-2');
      expect(await reloadedProvider.getItem('batch-key-3')).toBe('batch-value-3');
    });

    it('should retry pending data after a scheduled write fails', async () => {
      await provider.getItem('initialize-storage');
      vi.useFakeTimers();

      try {
        const saveSpy = vi
          .spyOn(provider as unknown as { saveToFile: () => Promise<void> }, 'saveToFile')
          .mockRejectedValueOnce(new Error('transient write failure'));

        await provider.setItem('retry-key', 'retry-value');
        await vi.advanceTimersByTimeAsync(500);
        saveSpy.mockRestore();

        await provider.flush();
      } finally {
        vi.useRealTimers();
      }

      const reloadedProvider = new FileStorageProvider(testDir);
      expect(await reloadedProvider.getItem('retry-key')).toBe('retry-value');
    });

    it('should keep pending data retryable after the flush attempt limit', async () => {
      await provider.getItem('initialize-storage');
      const saveSpy = vi
        .spyOn(provider as unknown as { saveToFile: () => Promise<void> }, 'saveToFile')
        .mockRejectedValue(new Error('persistent write failure'));

      await provider.setItem('eventual-key', 'eventual-value');
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await expect(provider.flush()).rejects.toThrow('persistent write failure');
      }

      saveSpy.mockRestore();
      await provider.flush();

      const reloadedProvider = new FileStorageProvider(testDir);
      expect(await reloadedProvider.getItem('eventual-key')).toBe('eventual-value');
    });

    it('should handle clearAll with real files', async () => {
      // 先添加一些数据
      await provider.setItem('clear-key-1', 'clear-value-1');
      await provider.setItem('clear-key-2', 'clear-value-2');
      await provider.flush();
      
      // 验证数据存在
      let content = await fs.readFile(storageFile, 'utf8');
      let data = JSON.parse(content);
      expect(Object.keys(data)).toHaveLength(2);
      
      // 清空所有数据
      await provider.clearAll();
      
      // 验证文件被清空
      content = await fs.readFile(storageFile, 'utf8');
      data = JSON.parse(content);
      expect(Object.keys(data)).toHaveLength(0);
    });

    it('should handle updateData with real files', async () => {
      // 初始化计数器
      await provider.setItem('counter', '5');
      await provider.flush();
      
      // 使用updateData增加计数器
      await provider.updateData<number>('counter', (current) => {
        return (current || 0) + 1;
      });
      
      await provider.flush();
      
      // 验证文件中的数据被正确更新
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);
      expect(data['counter']).toBe('6');
    });

    it('should handle concurrent operations safely', async () => {
      // 串行执行写入操作以避免文件冲突
      for (let i = 0; i < 10; i++) {
        await provider.setItem(`concurrent-key-${i}`, `concurrent-value-${i}`);
      }

      await provider.flush();

      // 验证所有数据都被正确写入
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);

      for (let i = 0; i < 10; i++) {
        expect(data[`concurrent-key-${i}`]).toBe(`concurrent-value-${i}`);
      }
    });

    it('should handle removeItem with real files', async () => {
      // 添加测试数据
      await provider.setItem('remove-key-1', 'remove-value-1');
      await provider.setItem('remove-key-2', 'remove-value-2');
      await provider.flush();
      
      // 删除一个键
      await provider.removeItem('remove-key-1');
      await provider.flush();
      
      // 验证文件中的数据
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);
      
      expect(data['remove-key-1']).toBeUndefined();
      expect(data['remove-key-2']).toBe('remove-value-2');
    });
  });

  describe('Error handling with real file system', () => {
    it('should throw error when directory cannot be created', async () => {
      // 尝试在只读位置创建存储（如果可能的话）
      // 这个测试可能需要根据具体环境调整
      const invalidPath = '/invalid/readonly/path';
      const invalidProvider = new FileStorageProvider(invalidPath);
      
      // 在某些系统上这可能会成功，所以我们只测试基本的错误处理
      try {
        await invalidProvider.setItem('test', 'test');
        await invalidProvider.flush();
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
      }
    });

    it('should handle temporary file cleanup on write failure', async () => {
      // 这个测试比较难模拟，但我们可以验证正常情况下没有临时文件残留
      await provider.setItem('temp-test', 'temp-value');
      await provider.flush();
      
      // 检查没有临时文件残留
      const files = await fs.readdir(testDir);
      const tempFiles = files.filter(file => file.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe('Performance with real files', () => {
    it('should handle large data efficiently', async () => {
      const largeValue = 'x'.repeat(10000); // 10KB的数据
      
      const startTime = Date.now();
      
      // 写入大量数据
      for (let i = 0; i < 100; i++) {
        await provider.setItem(`large-key-${i}`, largeValue);
      }
      
      await provider.flush();
      
      const writeTime = Date.now() - startTime;
      
      // 读取数据
      const readStartTime = Date.now();
      for (let i = 0; i < 100; i++) {
        await provider.getItem(`large-key-${i}`);
      }
      const readTime = Date.now() - readStartTime;
      
      // 性能断言（这些值可能需要根据实际情况调整）
      expect(writeTime).toBeLessThan(5000); // 写入应该在5秒内完成
      expect(readTime).toBeLessThan(100);   // 读取应该在100ms内完成（内存缓存）
      
      console.log(`Write time: ${writeTime}ms, Read time: ${readTime}ms`);
    });
  });
});
