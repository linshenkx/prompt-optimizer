import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { FileStorageProvider } from '../../../src/services/storage/fileStorageProvider';
import { StorageError } from '../../../src/services/storage/errors';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('FileStorageProvider', () => {
  let provider: FileStorageProvider;
  let mockUserDataPath: string;
  let mockFilePath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUserDataPath = '/mock/user/data';
    mockFilePath = '/mock/user/data/prompt-optimizer-data.json';

    provider = new FileStorageProvider(mockUserDataPath);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with provided user data path', () => {
      expect(provider.getCapabilities()).toEqual({
        supportsAtomic: true,
        supportsBatch: true,
        maxStorageSize: undefined
      });
    });

    it('should throw error when no path provided', () => {
      expect(() => new FileStorageProvider('')).toThrow(StorageError);
    });
  });

  describe('initialization', () => {
    it('should create new storage when file does not exist', async () => {
      // Mock file not exists
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      const result = await provider.getItem('test-key');
      
      expect(result).toBeNull();
      expect(mockFs.access).toHaveBeenCalledWith(mockFilePath);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should load existing data from file', async () => {
      const mockData = { 'test-key': 'test-value' };
      const mockContent = JSON.stringify(mockData);
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockContent);

      const result = await provider.getItem('test-key');
      
      expect(result).toBe('test-value');
      expect(mockFs.readFile).toHaveBeenCalledWith(mockFilePath, 'utf8');
    });

    it('should throw error when both main and backup files are corrupted', async () => {
      // Mock both main and backup files exist but are corrupted
      mockFs.access
        .mockResolvedValueOnce(undefined) // main file exists
        .mockResolvedValueOnce(undefined); // backup file exists

      mockFs.readFile
        .mockResolvedValueOnce('invalid json') // corrupted main file
        .mockResolvedValueOnce('invalid json'); // corrupted backup file

      await expect(provider.getItem('test-key')).rejects.toThrow(StorageError);
      await expect(provider.getItem('test-key')).rejects.toThrow('Storage corruption detected');
    });
  });

  describe('getItem', () => {
    beforeEach(async () => {
      // Setup initialized storage
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"test-key":"test-value"}');
    });

    it('should return stored value', async () => {
      const result = await provider.getItem('test-key');
      expect(result).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      const result = await provider.getItem('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('setItem', () => {
    beforeEach(async () => {
      // Setup initialized storage
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should store value and schedule write', async () => {
      await provider.setItem('new-key', 'new-value');
      
      const result = await provider.getItem('new-key');
      expect(result).toBe('new-value');
    });

    it('should update existing value', async () => {
      await provider.setItem('key', 'value1');
      await provider.setItem('key', 'value2');
      
      const result = await provider.getItem('key');
      expect(result).toBe('value2');
    });
  });

  describe('removeItem', () => {
    beforeEach(async () => {
      // Setup initialized storage with data
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"test-key":"test-value"}');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should remove existing item', async () => {
      await provider.removeItem('test-key');
      
      const result = await provider.getItem('test-key');
      expect(result).toBeNull();
    });

    it('should handle removal of non-existent item', async () => {
      await provider.removeItem('non-existent');
      
      // Should not throw error
      const result = await provider.getItem('test-key');
      expect(result).toBe('test-value'); // Original data should remain
    });
  });

  describe('clearAll', () => {
    beforeEach(async () => {
      // Setup initialized storage with data
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"key1":"value1","key2":"value2"}');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should clear all data and write immediately', async () => {
      // First ensure data is loaded
      await provider.getItem('key1');

      // Clear the mock to count only clearAll writes
      mockFs.writeFile.mockClear();

      await provider.clearAll();

      const result1 = await provider.getItem('key1');
      const result2 = await provider.getItem('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('updateData', () => {
    beforeEach(async () => {
      // Setup initialized storage
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should update data with modifier function', async () => {
      await provider.setItem('counter', '5');
      
      await provider.updateData<number>('counter', (current) => {
        return (current || 0) + 1;
      });
      
      const result = await provider.getItem('counter');
      expect(result).toBe('6');
    });

    it('should handle null current value', async () => {
      await provider.updateData<string>('new-key', (current) => {
        return current || 'default';
      });
      
      const result = await provider.getItem('new-key');
      expect(result).toBe('"default"');
    });

    it('should propagate business logic errors', async () => {
      await expect(provider.updateData('key', () => {
        throw new Error('Business logic error');
      })).rejects.toThrow('Business logic error');
    });
  });

  describe('batchUpdate', () => {
    beforeEach(async () => {
      // Setup initialized storage
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should perform batch operations and write immediately', async () => {
      const operations = [
        { key: 'key1', operation: 'set' as const, value: 'value1' },
        { key: 'key2', operation: 'set' as const, value: 'value2' },
        { key: 'key3', operation: 'remove' as const }
      ];
      
      await provider.batchUpdate(operations);
      
      expect(await provider.getItem('key1')).toBe('value1');
      expect(await provider.getItem('key2')).toBe('value2');
      expect(await provider.getItem('key3')).toBeNull();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toEqual({
        supportsAtomic: true,
        supportsBatch: true,
        maxStorageSize: undefined
      });
    });
  });

  describe('flush', () => {
    beforeEach(async () => {
      // Setup initialized storage
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should immediately write pending changes', async () => {
      await provider.setItem('key', 'value');
      
      // Clear previous write calls
      mockFs.writeFile.mockClear();
      
      await provider.flush();
      
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });
});
