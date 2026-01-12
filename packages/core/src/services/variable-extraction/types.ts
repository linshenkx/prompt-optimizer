/**
 * 变量提取服务类型定义
 *
 * 提供 LLM 智能变量提取功能的类型系统
 */

// ==================== 请求/响应接口 ====================

/**
 * 变量提取请求
 */
export interface VariableExtractionRequest {
  /** 待分析的提示词内容 */
  promptContent: string;

  /** 提取使用的模型键 */
  extractionModelKey: string;

  /** 已存在的变量名列表（避免重名） */
  existingVariableNames?: string[];
}

/**
 * 提取的变量信息
 */
export interface ExtractedVariable {
  /** 变量名（符合命名规范：中文/英文/数字/下划线，不以数字开头） */
  name: string;

  /** 变量原始值 */
  value: string;

  /** 精准定位信息 */
  position: {
    /** 原文片段（用于查找替换） */
    originalText: string;
    /** 第几次出现（1-based，用于处理重复文本） */
    occurrence: number;
  };

  /** 提取理由 */
  reason: string;

  /** 分类（由LLM自主决定，如"内容主题"/"格式约束"/"需求描述"等） */
  category?: string;
}

/**
 * 变量提取响应
 */
export interface VariableExtractionResponse {
  /** 提取的变量列表（最多20个） */
  variables: ExtractedVariable[];

  /** 一句话总结 */
  summary: string;
}

// ==================== 服务接口 ====================

/**
 * 变量提取服务接口
 */
export interface IVariableExtractionService {
  /**
   * 提取变量
   * @param request - 提取请求
   * @returns 提取结果
   */
  extract(request: VariableExtractionRequest): Promise<VariableExtractionResponse>;
}
