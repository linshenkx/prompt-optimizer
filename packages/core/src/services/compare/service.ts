import { 
  ICompareService, 
  CompareResult, 
  CompareOptions, 
  TextFragment, 
  ChangeType 
} from './types';
import { CompareValidationError, CompareCalculationError } from './errors';
import { diffChars, diffWords, type Change } from 'diff';

/**
 * 默认对比选项
 */
const DEFAULT_OPTIONS: CompareOptions = {
  granularity: 'word',
  ignoreWhitespace: false,
  caseSensitive: true
};

/**
 * 文本对比服务实现 - 使用 jsdiff 库
 */
export class CompareService implements ICompareService {
  /**
   * 对比两个文本
   */
  compareTexts(
    original: string,
    optimized: string,
    options?: Partial<CompareOptions>
  ): CompareResult {
    try {
      // 验证输入
      this.validateInput(original, optimized);
      
      // 合并选项
      const finalOptions = { ...DEFAULT_OPTIONS, ...options };
      
      // 执行对比
      const fragments = this.performTextComparison(original, optimized, finalOptions);
      
      // 生成统计信息
      const summary = this.generateSummary(fragments);
      
      return {
        fragments,
        summary
      };
    } catch (error) {
      if (error instanceof CompareValidationError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CompareCalculationError(
        `文本对比计算失败: ${errorMessage}`
      );
    }
  }

  /**
   * 验证输入参数
   */
  private validateInput(original: string, optimized: string): void {
    if (typeof original !== 'string') {
      throw new CompareValidationError('原始文本必须是字符串');
    }
    if (typeof optimized !== 'string') {
      throw new CompareValidationError('优化后文本必须是字符串');
    }
  }

  /**
   * 执行文本对比 - 使用 jsdiff
   */
  private performTextComparison(
    original: string,
    optimized: string,
    options: CompareOptions
  ): TextFragment[] {
    let diffResult: Change[];

    // 根据配置处理文本预处理
    let processedOriginal = original;
    let processedOptimized = optimized;

    if (options.ignoreWhitespace) {
      // 标准化空白符
      processedOriginal = original.replace(/\s+/g, ' ').trim();
      processedOptimized = optimized.replace(/\s+/g, ' ').trim();
    }

    if (!options.caseSensitive) {
      processedOriginal = processedOriginal.toLowerCase();
      processedOptimized = processedOptimized.toLowerCase();
    }

    // 根据粒度选择不同的 diff 方法
    switch (options.granularity) {
      case 'char':
        diffResult = diffChars(processedOriginal, processedOptimized);
        break;
      case 'word':
      default:
        diffResult = diffWords(processedOriginal, processedOptimized);
        break;
    }

    // 转换为我们的 TextFragment 格式
    return this.convertDiffResultToFragments(diffResult, original);
  }

  /**
   * 将 jsdiff 的结果转换为我们的 TextFragment 格式
   */
  private convertDiffResultToFragments(
    diffResult: Change[],
    originalText: string
  ): TextFragment[] {
    const fragments: TextFragment[] = [];
    let fragmentIndex = 0;

    for (const change of diffResult) {
      let changeType: ChangeType;

      if (change.added) {
        changeType = ChangeType.ADDED;
      } else if (change.removed) {
        changeType = ChangeType.REMOVED;
      } else {
        changeType = ChangeType.UNCHANGED;
      }

      // 确保文本内容来自原始输入（保持原始格式）
      let text = change.value;
      
      // 如果是未更改的部分，使用原始文本以保持格式
      if (changeType === ChangeType.UNCHANGED) {
        // 在原始文本中查找对应的部分
        const position = this.findTextPosition(text, originalText);
        if (position !== -1) {
          text = originalText.substring(position, position + text.length);
        }
      }

      fragments.push({
        text,
        type: changeType,
        index: fragmentIndex++
      });
    }

    return this.mergeConsecutiveFragments(fragments);
  }

  /**
   * 在文本中查找特定内容的位置
   */
  private findTextPosition(searchText: string, sourceText: string): number {
    // 简单的查找实现
    return sourceText.indexOf(searchText);
  }

  /**
   * 合并连续的相同类型片段
   */
  private mergeConsecutiveFragments(fragments: TextFragment[]): TextFragment[] {
    if (fragments.length === 0) return fragments;
    
    const merged: TextFragment[] = [];
    let current = { ...fragments[0] };
    
    for (let i = 1; i < fragments.length; i++) {
      const fragment = fragments[i];
      
      if (fragment.type === current.type) {
        // 合并相同类型的片段
        current.text += fragment.text;
      } else {
        // 添加当前片段并开始新的片段
        merged.push(current);
        current = { ...fragment, index: merged.length };
      }
    }
    
    merged.push(current);
    
    return merged;
  }

  /**
   * 生成统计信息
   */
  private generateSummary(fragments: TextFragment[]) {
    const summary = {
      additions: 0,
      deletions: 0,
      unchanged: 0
    };
    
    fragments.forEach(fragment => {
      switch (fragment.type) {
        case ChangeType.ADDED:
          summary.additions++;
          break;
        case ChangeType.REMOVED:
          summary.deletions++;
          break;
        case ChangeType.UNCHANGED:
          summary.unchanged++;
          break;
      }
    });
    
    return summary;
  }
} 