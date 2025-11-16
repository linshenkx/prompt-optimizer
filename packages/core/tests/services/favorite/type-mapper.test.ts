import { describe, it, expect } from 'vitest';
import { TypeMapper, type FunctionModeMapping } from '../../../src/services/favorite/type-mapper';
import type { PromptRecordType } from '../../../src/services/history/types';

/**
 * TypeMapper 单元测试
 * 测试历史记录类型到功能模式的映射逻辑
 */
describe('TypeMapper', () => {
  describe('mapFromRecordType - 基础模式映射', () => {
    it('应该将 optimize 映射为 basic/system', () => {
      const result = TypeMapper.mapFromRecordType('optimize');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    });

    it('应该将 iterate 映射为 basic/system', () => {
      const result = TypeMapper.mapFromRecordType('iterate');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    });

    it('应该将 userOptimize 映射为 basic/user', () => {
      const result = TypeMapper.mapFromRecordType('userOptimize');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'user'
      });
    });

    it('应该将 test 映射为 basic/system', () => {
      const result = TypeMapper.mapFromRecordType('test');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    });
  });

  describe('mapFromRecordType - 上下文模式映射', () => {
    it('应该将 conversationMessageOptimize 映射为 context/system', () => {
      const result = TypeMapper.mapFromRecordType('conversationMessageOptimize');
      expect(result).toEqual({
        functionMode: 'context',
        optimizationMode: 'system'
      });
    });

    it('应该将 contextIterate 映射为 context/system', () => {
      const result = TypeMapper.mapFromRecordType('contextIterate');
      expect(result).toEqual({
        functionMode: 'context',
        optimizationMode: 'system'
      });
    });

    it('应该将 contextUserOptimize 映射为 context/user', () => {
      const result = TypeMapper.mapFromRecordType('contextUserOptimize');
      expect(result).toEqual({
        functionMode: 'context',
        optimizationMode: 'user'
      });
    });
  });

  describe('mapFromRecordType - 图像模式映射', () => {
    it('应该将 imageOptimize 映射为 image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('imageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('应该将 contextImageOptimize 映射为 image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('contextImageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('应该将 imageIterate 映射为 image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('imageIterate');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('应该将 text2imageOptimize 映射为 image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('text2imageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('应该将 image2imageOptimize 映射为 image/image2image', () => {
      const result = TypeMapper.mapFromRecordType('image2imageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'image2image'
      });
    });
  });

  describe('mapFromRecordType - 未知类型处理', () => {
    it('应该将未知类型映射为 basic/system 并输出警告', () => {
      // 使用 console.warn 的 spy
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = TypeMapper.mapFromRecordType('unknown' as PromptRecordType);

      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
      expect(warnSpy).toHaveBeenCalledWith(
        '[TypeMapper] Unknown record type: unknown, falling back to basic/system'
      );

      warnSpy.mockRestore();
    });
  });

  describe('validateMapping - 合法映射验证', () => {
    it('应该接受合法的 basic/system 映射', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('应该接受合法的 basic/user 映射', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'user'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('应该接受合法的 context/system 映射', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('应该接受合法的 context/user 映射', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'user'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('应该接受合法的 image/text2image 映射', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'text2image'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('应该接受合法的 image/image2image 映射', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'image2image'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });
  });

  describe('validateMapping - 非法映射验证', () => {
    it('应该拒绝缺少 functionMode 的映射', () => {
      const mapping: Partial<FunctionModeMapping> = {
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝非法的 functionMode 值', () => {
      const mapping = {
        functionMode: 'invalid' as any,
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 basic 模式缺少 optimizationMode', () => {
      const mapping: Partial<FunctionModeMapping> = {
        functionMode: 'basic'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 context 模式缺少 optimizationMode', () => {
      const mapping: Partial<FunctionModeMapping> = {
        functionMode: 'context'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 basic 模式的非法 optimizationMode 值', () => {
      const mapping = {
        functionMode: 'basic' as const,
        optimizationMode: 'invalid' as any
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 basic 模式包含 imageSubMode', () => {
      const mapping = {
        functionMode: 'basic' as const,
        optimizationMode: 'system' as const,
        imageSubMode: 'text2image' as const
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 context 模式包含 imageSubMode', () => {
      const mapping = {
        functionMode: 'context' as const,
        optimizationMode: 'system' as const,
        imageSubMode: 'text2image' as const
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 image 模式缺少 imageSubMode', () => {
      const mapping: Partial<FunctionModeMapping> = {
        functionMode: 'image'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 image 模式的非法 imageSubMode 值', () => {
      const mapping = {
        functionMode: 'image' as const,
        imageSubMode: 'invalid' as any
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('应该拒绝 image 模式包含 optimizationMode', () => {
      const mapping = {
        functionMode: 'image' as const,
        imageSubMode: 'text2image' as const,
        optimizationMode: 'system' as const
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });
  });

  describe('inferRecordTypes - 反向推断', () => {
    it('应该从 basic/system 推断出 optimize 和 iterate', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['optimize', 'iterate']);
    });

    it('应该从 basic/user 推断出 userOptimize', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'user'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['userOptimize']);
    });

    it('应该从 context/system 推断出 conversationMessageOptimize 和 contextIterate', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'system'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['conversationMessageOptimize', 'contextIterate']);
    });

    it('应该从 context/user 推断出 contextUserOptimize', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'user'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['contextUserOptimize']);
    });

    it('应该从 image/text2image 推断出所有文生图类型', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'text2image'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual([
        'imageOptimize',
        'contextImageOptimize',
        'imageIterate',
        'text2imageOptimize'
      ]);
    });

    it('应该从 image/image2image 推断出 image2imageOptimize', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'image2image'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['image2imageOptimize']);
    });

    it('应该对非法映射返回空数组', () => {
      const mapping = {
        functionMode: 'basic' as const,
        optimizationMode: undefined as any
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual([]);
    });
  });

  describe('映射和验证的完整性测试', () => {
    it('所有 PromptRecordType 映射后的结果都应该是合法的', () => {
      const allTypes: PromptRecordType[] = [
        'optimize',
        'userOptimize',
        'iterate',
        'test',
        'conversationMessageOptimize',
        'contextUserOptimize',
        'contextIterate',
        'imageOptimize',
        'contextImageOptimize',
        'imageIterate',
        'text2imageOptimize',
        'image2imageOptimize'
      ];

      allTypes.forEach(type => {
        const mapping = TypeMapper.mapFromRecordType(type);
        expect(TypeMapper.validateMapping(mapping)).toBe(true);
      });
    });

    it('映射和反向推断应该是一致的', () => {
      const testCases: Array<{
        recordType: PromptRecordType;
        mapping: FunctionModeMapping;
      }> = [
        {
          recordType: 'optimize',
          mapping: { functionMode: 'basic', optimizationMode: 'system' }
        },
        {
          recordType: 'userOptimize',
          mapping: { functionMode: 'basic', optimizationMode: 'user' }
        },
        {
          recordType: 'conversationMessageOptimize',
          mapping: { functionMode: 'context', optimizationMode: 'system' }
        },
        {
          recordType: 'contextUserOptimize',
          mapping: { functionMode: 'context', optimizationMode: 'user' }
        },
        {
          recordType: 'text2imageOptimize',
          mapping: { functionMode: 'image', imageSubMode: 'text2image' }
        },
        {
          recordType: 'image2imageOptimize',
          mapping: { functionMode: 'image', imageSubMode: 'image2image' }
        }
      ];

      testCases.forEach(({ recordType, mapping }) => {
        // 正向映射
        const mappedResult = TypeMapper.mapFromRecordType(recordType);
        expect(mappedResult).toEqual(mapping);

        // 反向推断
        const inferredTypes = TypeMapper.inferRecordTypes(mapping);
        expect(inferredTypes).toContain(recordType);
      });
    });
  });
});
