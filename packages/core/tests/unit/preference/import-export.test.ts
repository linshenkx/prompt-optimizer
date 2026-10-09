import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreferenceService } from '../../../src/services/preference/service';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { FUNCTION_MODEL_KEYS } from '../../../src/constants/storage-keys';

describe('PreferenceService Import/Export', () => {
  let preferenceService: PreferenceService;
  let storageProvider: MemoryStorageProvider;

  beforeEach(() => {
    storageProvider = new MemoryStorageProvider();
    preferenceService = new PreferenceService(storageProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportData', () => {
    it('exports persisted UI settings after reopening without requiring earlier reads', async () => {
      await preferenceService.set('app:settings:ui:theme-id', 'dark');
      await preferenceService.set(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, 'judge');
      await preferenceService.set(FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL, 'vision');
      const reopened = new PreferenceService(storageProvider);
      expect(await reopened.exportData()).toEqual({
        'app:settings:ui:theme-id': 'dark',
        [FUNCTION_MODEL_KEYS.EVALUATION_MODEL]: 'judge',
        [FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL]: 'vision',
      });
    });
    it('should export all preferences', async () => {
      // 设置一些偏好设置
      await preferenceService.set('app:settings:ui:theme-id', 'dark');
      await preferenceService.set('app:settings:ui:preferred-language', 'zh-CN');
      await preferenceService.set('app:selected-optimize-model', 'openai');

      // 导出数据
      const exportedData = await preferenceService.exportData();

      // 验证导出的数据
      expect(typeof exportedData).toBe('object');
      expect(exportedData).toEqual({
        'app:settings:ui:theme-id': 'dark',
        'app:settings:ui:preferred-language': 'zh-CN',
        'app:selected-optimize-model': 'openai'
      });
    });

    it('should export empty object when no preferences exist', async () => {
      const exportedData = await preferenceService.exportData();
      expect(exportedData).toEqual({});
    });

    it('should handle export error gracefully', async () => {
      // 模拟getAll错误
      vi.spyOn(preferenceService, 'getAll').mockRejectedValue(new Error('Storage error'));

      await expect(preferenceService.exportData()).rejects.toThrow('Failed to export preference data');
    });
  });

  describe('importData', () => {
    it('restores function model settings from exported backups, including automatic evaluation selection', async () => {
      await preferenceService.set(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, 'custom-evaluation');
      await preferenceService.set(FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL, 'vision-model');
      const destination = new PreferenceService(new MemoryStorageProvider());
      await destination.importData(await preferenceService.exportData());
      expect(await destination.get(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, '')).toBe('custom-evaluation');
      expect(await destination.get(FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL, '')).toBe('vision-model');

      await preferenceService.set(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, '');
      await destination.importData(await preferenceService.exportData());
      expect(await destination.get(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, 'missing')).toBe('');
    });
    it('should import valid preferences', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'light',
        'app:settings:ui:preferred-language': 'en-US',
        'app:selected-optimize-model': 'anthropic'
      };

      await preferenceService.importData(importData);

      // 验证偏好设置已被导入
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('light');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('en-US');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('anthropic');
    });

    it('should handle legacy key conversion', async () => {
      const importData = {
        'theme-id': 'dark', // 旧版本键名
        'preferred-language': 'zh-CN', // 旧版本键名
        'app:selected-optimize-model': 'openai' // 新版本键名
      };

      await preferenceService.importData(importData);

      // 验证旧版本键名被转换为新版本
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('zh-CN');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('openai');
    });

    it('should skip invalid keys (not in whitelist)', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // 有效键
        'malicious-key': 'malicious-value', // 无效键
        'app:settings:ui:preferred-language': 'zh-CN' // 有效键
      };

      // 应该不抛出错误，只是跳过无效键
      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // 验证有效键被导入
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('zh-CN');

      // 验证无效键被跳过
      expect(await preferenceService.get('malicious-key', null)).toBe(null);
    });

    it('should skip invalid values', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // 有效值
        'app:settings:ui:preferred-language': 123, // 无效值（非字符串）
        'app:selected-optimize-model': 'openai' // 有效值
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // 验证有效值被导入
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('openai');

      // 验证无效值被跳过
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe(null);
    });

    it('should skip keys with dangerous characters', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // 有效键
        'app<script>alert("xss")</script>': 'malicious', // 包含危险字符的键
        'app:settings:ui:preferred-language': 'zh-CN' // 有效键
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // 验证有效键被导入
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('zh-CN');
    });

    it('should skip values with control characters', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // 有效值
        'app:settings:ui:preferred-language': 'zh-CN\x00\x01', // 包含控制字符的值
        'app:selected-optimize-model': 'openai' // 有效值
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // 验证有效值被导入
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('openai');

      // 验证包含控制字符的值被跳过
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe(null);
    });

    it('should handle import errors gracefully', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark'
      };

      // 模拟set错误
      vi.spyOn(preferenceService, 'set').mockRejectedValue(new Error('Set error'));

      // 应该不抛出错误，只是记录失败
      await expect(preferenceService.importData(importData)).resolves.not.toThrow();
    });
  });

  describe('validateData', () => {
    it('should validate correct preference data', async () => {
      const validData = {
        'app:settings:ui:theme-id': 'dark',
        'app:settings:ui:preferred-language': 'zh-CN',
        'app:selected-optimize-model': 'openai'
      };

      expect(await preferenceService.validateData(validData)).toBe(true);
    });

    it('should accept numeric and boolean values (converted to string)', async () => {
      const validData = {
        'app:settings:ui:theme-id': 'dark',
        'app:settings:ui:preferred-language': 123,
        'app:selected-optimize-model': true
      };

      expect(await preferenceService.validateData(validData)).toBe(true);
    });

    it('should reject invalid data formats', async () => {
      // 非对象
      expect(await preferenceService.validateData([])).toBe(false);
      expect(await preferenceService.validateData('string')).toBe(false);
      expect(await preferenceService.validateData(null)).toBe(false);

      // 数组
      expect(await preferenceService.validateData(['item1', 'item2'])).toBe(false);
    });
  });

  describe('getDataType', () => {
    it('should return correct data type', async () => {
      expect(await preferenceService.getDataType()).toBe('userSettings');
    });
  });

  describe('security validation', () => {
    it('should reject keys that are too long', async () => {
      const longKey = 'a'.repeat(51); // 超过50字符限制
      const importData = {
        [longKey]: 'value'
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // 验证长键名被跳过
      expect(await preferenceService.get(longKey, null)).toBe(null);
    });

    it('should reject values that are too long', async () => {
      const longValue = 'a'.repeat(1001); // 超过1000字符限制
      const importData = {
        'app:settings:ui:theme-id': longValue
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // 验证长值被跳过
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe(null);
    });

    it('should reject empty keys', async () => {
      const importData = {
        '': 'value' // 空键名
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      await expect(preferenceService.get('', null)).rejects.toThrow('Invalid preference key');
    });
  });
});
