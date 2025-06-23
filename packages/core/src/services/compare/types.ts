/**
 * 文本变化类型
 */
export enum ChangeType {
  UNCHANGED = 'unchanged',
  ADDED = 'added',
  REMOVED = 'removed'
}

/**
 * 文本片段
 */
export interface TextFragment {
  text: string;
  type: ChangeType;
  index: number;
}

/**
 * 对比结果
 */
export interface CompareResult {
  fragments: TextFragment[];
  summary: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

/**
 * 对比选项
 */
export interface CompareOptions {
  /** 对比粒度：word（单词级）、char（字符级） */
  granularity: 'word' | 'char';
  /** 是否忽略空白符 */
  ignoreWhitespace: boolean;
  /** 是否区分大小写 */
  caseSensitive: boolean;
}

/**
 * 文本对比服务接口
 */
export interface ICompareService {
  /**
   * 对比两个文本
   * @param original 原始文本
   * @param optimized 优化后文本
   * @param options 对比选项
   * @returns 对比结果
   */
  compareTexts(
    original: string,
    optimized: string,
    options?: Partial<CompareOptions>
  ): CompareResult;
} 