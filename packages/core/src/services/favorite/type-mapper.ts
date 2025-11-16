import type { PromptRecordType } from '../history/types';

/**
 * 功能模式映射接口
 * 对应 FavoritePrompt 中的三层分类体系
 */
export interface FunctionModeMapping {
  /** 功能模式 (一级分类) */
  functionMode: 'basic' | 'context' | 'image';
  /** 优化模式 (二级分类,仅用于 basic/context 模式) */
  optimizationMode?: 'system' | 'user';
  /** 图像子模式 (二级分类,仅用于 image 模式) */
  imageSubMode?: 'text2image' | 'image2image';
}

/**
 * 类型映射工具类
 * 负责将历史记录类型 (PromptRecordType) 映射到收藏功能模式分类
 */
export class TypeMapper {
  /**
   * 从历史记录类型映射到功能模式分类
   * @param recordType 历史记录类型
   * @returns 功能模式映射
   */
  static mapFromRecordType(recordType: PromptRecordType): FunctionModeMapping {
    // 图像模式映射
    if (recordType === 'imageOptimize' || recordType === 'contextImageOptimize' || recordType === 'imageIterate') {
      return {
        functionMode: 'image',
        imageSubMode: 'text2image' // 默认文生图模式
      };
    }

    if (recordType === 'text2imageOptimize') {
      return {
        functionMode: 'image',
        imageSubMode: 'text2image'
      };
    }

    if (recordType === 'image2imageOptimize') {
      return {
        functionMode: 'image',
        imageSubMode: 'image2image'
      };
    }

    // 上下文模式映射 (context)
    if (recordType === 'conversationMessageOptimize' || recordType === 'contextIterate') {
      return {
        functionMode: 'context',
        optimizationMode: 'system'
      };
    }

    if (recordType === 'contextUserOptimize') {
      return {
        functionMode: 'context',
        optimizationMode: 'user'
      };
    }

    // 基础模式映射 (basic)
    if (recordType === 'optimize' || recordType === 'iterate') {
      return {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
    }

    if (recordType === 'userOptimize') {
      return {
        functionMode: 'basic',
        optimizationMode: 'user'
      };
    }

    // 测试类型回退到基础系统模式
    if (recordType === 'test') {
      return {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
    }

    // 兜底：未知类型回退到基础系统模式
    console.warn(`[TypeMapper] Unknown record type: ${recordType}, falling back to basic/system`);
    return {
      functionMode: 'basic',
      optimizationMode: 'system'
    };
  }

  /**
   * 验证功能模式映射的完整性和合法性
   * @param mapping 功能模式映射
   * @returns 是否有效
   */
  static validateMapping(mapping: Partial<FunctionModeMapping>): boolean {
    // 功能模式必填
    if (!mapping.functionMode) {
      return false;
    }

    // 检查功能模式值合法性
    if (!['basic', 'context', 'image'].includes(mapping.functionMode)) {
      return false;
    }

    // 基础模式和上下文模式必须有优化模式
    if (mapping.functionMode === 'basic' || mapping.functionMode === 'context') {
      if (!mapping.optimizationMode) {
        return false;
      }
      if (!['system', 'user'].includes(mapping.optimizationMode)) {
        return false;
      }
      // 这两种模式不应有 imageSubMode
      if (mapping.imageSubMode) {
        return false;
      }
    }

    // 图像模式必须有图像子模式
    if (mapping.functionMode === 'image') {
      if (!mapping.imageSubMode) {
        return false;
      }
      if (!['text2image', 'image2image'].includes(mapping.imageSubMode)) {
        return false;
      }
      // 图像模式不应有 optimizationMode
      if (mapping.optimizationMode) {
        return false;
      }
    }

    return true;
  }

  /**
   * 从功能模式映射推断出对应的历史记录类型
   * 主要用于反向映射和验证
   * @param mapping 功能模式映射
   * @returns 可能的历史记录类型
   */
  static inferRecordTypes(mapping: FunctionModeMapping): PromptRecordType[] {
    const { functionMode, optimizationMode, imageSubMode } = mapping;

    // 基础模式
    if (functionMode === 'basic') {
      if (optimizationMode === 'system') {
        return ['optimize', 'iterate'];
      }
      if (optimizationMode === 'user') {
        return ['userOptimize'];
      }
    }

    // 上下文模式
    if (functionMode === 'context') {
      if (optimizationMode === 'system') {
        return ['conversationMessageOptimize', 'contextIterate'];
      }
      if (optimizationMode === 'user') {
        return ['contextUserOptimize'];
      }
    }

    // 图像模式
    if (functionMode === 'image') {
      if (imageSubMode === 'text2image') {
        return ['imageOptimize', 'contextImageOptimize', 'imageIterate', 'text2imageOptimize'];
      }
      if (imageSubMode === 'image2image') {
        return ['image2imageOptimize'];
      }
    }

    return [];
  }
}
