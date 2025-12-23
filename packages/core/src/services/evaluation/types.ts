/**
 * 评估服务类型定义
 *
 * 提供 LLM 智能评估功能的类型系统
 */

import type { BasicSubMode, ProSubMode, ImageSubMode } from '../prompt/types';

// ==================== 评估类型 ====================

/**
 * 评估类型枚举
 */
export type EvaluationType =
  | 'original'
  | 'optimized'
  | 'compare'
  | 'prompt-only'      // 仅提示词评估（无需测试结果）
  | 'prompt-iterate';  // 带迭代需求的提示词评估

/**
 * 所有子模式的联合类型（用于评估模式配置）
 */
export type EvaluationSubMode = BasicSubMode | ProSubMode | ImageSubMode;

/**
 * 评估模式配置
 * 用于指定评估的功能模式和子模式
 */
export interface EvaluationModeConfig {
  /** 功能模式 */
  functionMode: 'basic' | 'pro' | 'image';
  /** 子模式 */
  subMode: EvaluationSubMode;
}

// ==================== Pro 模式评估上下文 ====================

/**
 * Pro-System 模式评估上下文
 * 用于多消息场景中的单条消息评估
 */
export interface ProSystemEvaluationContext {
  /** 被优化消息的元信息 */
  targetMessage: {
    /** 消息角色 */
    role: 'system' | 'user' | 'assistant' | 'tool';
    /** 消息内容（当前版本） */
    content: string;
    /** 原始内容（用于对比） */
    originalContent?: string;
  };
  /** 完整对话上下文 */
  conversationMessages: Array<{
    /** 消息角色 */
    role: string;
    /** 消息内容 */
    content: string;
    /** 是否为被优化的目标消息 */
    isTarget?: boolean;
  }>;
}

/**
 * Pro-User 模式评估上下文
 * 用于带变量的用户提示词评估
 */
export interface ProUserEvaluationContext {
  /** 变量列表 */
  variables: Array<{
    /** 变量名 */
    name: string;
    /** 变量值 */
    value: string;
    /** 变量来源 */
    source: 'predefined' | 'global' | 'temporary';
  }>;
  /** 原始提示词（含变量占位符） */
  rawPrompt: string;
  /** 变量替换后的提示词 */
  resolvedPrompt: string;
}

/**
 * Pro 模式评估上下文联合类型
 */
export type ProEvaluationContext = ProSystemEvaluationContext | ProUserEvaluationContext;

// ==================== 评估请求类型 ====================

/**
 * 评估请求基础结构
 */
export interface EvaluationRequestBase {
  /** 原始提示词 */
  originalPrompt: string;
  /** 测试文本/输入 */
  testContent: string;
  /** 评估使用的模型Key */
  evaluationModelKey: string;
  /** 可选：自定义变量 */
  variables?: Record<string, string>;
  /** 评估模式配置（必填） */
  mode: EvaluationModeConfig;
  /** Pro 模式专用上下文（可选） */
  proContext?: ProEvaluationContext;
}

/**
 * 原始提示词评估请求
 * 评估原始提示词的测试结果是否达成用户目的
 */
export interface OriginalEvaluationRequest extends EvaluationRequestBase {
  type: 'original';
  /** 原始测试结果 */
  testResult: string;
}

/**
 * 优化提示词评估请求
 * 评估优化后提示词的测试效果
 */
export interface OptimizedEvaluationRequest extends EvaluationRequestBase {
  type: 'optimized';
  /** 优化后的提示词 */
  optimizedPrompt: string;
  /** 优化后的测试结果 */
  testResult: string;
}

/**
 * 对比评估请求
 * 对比原始和优化后两个版本的测试效果
 */
export interface CompareEvaluationRequest extends EvaluationRequestBase {
  type: 'compare';
  /** 优化后的提示词 */
  optimizedPrompt: string;
  /** 原始测试结果 */
  originalTestResult: string;
  /** 优化后的测试结果 */
  optimizedTestResult: string;
}

/**
 * 仅提示词评估请求
 * 直接评估提示词本身的质量，无需测试结果
 */
export interface PromptOnlyEvaluationRequest extends EvaluationRequestBase {
  type: 'prompt-only';
  /** 优化后的提示词 */
  optimizedPrompt: string;
  // 不需要 testResult
}

/**
 * 带迭代需求的提示词评估请求
 * 评估优化后的提示词是否满足迭代需求
 */
export interface PromptIterateEvaluationRequest extends EvaluationRequestBase {
  type: 'prompt-iterate';
  /** 优化后的提示词 */
  optimizedPrompt: string;
  /** 迭代需求（来自 iterationNote） */
  iterateRequirement: string;
  // 不需要 testResult
}

/**
 * 评估请求联合类型
 */
export type EvaluationRequest =
  | OriginalEvaluationRequest
  | OptimizedEvaluationRequest
  | CompareEvaluationRequest
  | PromptOnlyEvaluationRequest
  | PromptIterateEvaluationRequest;

// ==================== 评估结果类型 ====================

/**
 * 单个评估维度
 */
export interface EvaluationDimension {
  /** 维度标识符 */
  key: string;
  /** 本地化显示名称（由模板返回） */
  label: string;
  /** 维度分数 (0-100) */
  score: number;
}

/**
 * 评估评分结构
 */
export interface EvaluationScore {
  /** 总分 (0-100) */
  overall: number;
  /** 各维度评分（动态数组） */
  dimensions: EvaluationDimension[];
}

/**
 * 评估响应
 */
export interface EvaluationResponse {
  /** 评估类型 */
  type: EvaluationType;
  /** 评估分数 */
  score: EvaluationScore;
  /** 问题清单（最多3条） */
  issues: string[];
  /** 改进建议（可用于迭代优化，最多3条） */
  improvements: string[];
  /** 一句话总结（简洁评价） */
  summary: string;
  /** 优化后是否更好（仅对比评估） */
  isOptimizedBetter?: boolean;
  /** 元数据 */
  metadata?: {
    model?: string;
    timestamp?: number;
    duration?: number;
  };
}

// ==================== 流式评估回调 ====================

/**
 * 流式评估回调处理器
 */
export interface EvaluationStreamHandlers {
  /** 接收到内容 token */
  onToken: (token: string) => void;
  /** 接收到分数更新（可选） */
  onScore?: (score: Partial<EvaluationScore>) => void;
  /** 评估完成 */
  onComplete: (response: EvaluationResponse) => void;
  /** 评估出错 */
  onError: (error: Error) => void;
}

// ==================== 服务接口 ====================

/**
 * 评估服务接口
 */
export interface IEvaluationService {
  /**
   * 执行评估（非流式）
   * @param request 评估请求
   * @returns 评估响应
   */
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;

  /**
   * 流式评估（用于实时显示）
   * @param request 评估请求
   * @param callbacks 流式回调处理器
   */
  evaluateStream(
    request: EvaluationRequest,
    callbacks: EvaluationStreamHandlers
  ): Promise<void>;
}

// ==================== 评估模板 ID 命名规则 ====================
//
// 模板 ID 格式: evaluation-{functionMode}-{subMode}-{type}
//
// 示例:
//   - evaluation-basic-system-original      (基础模式/系统提示词/原始评估)
//   - evaluation-basic-system-optimized     (基础模式/系统提示词/优化评估)
//   - evaluation-basic-system-compare       (基础模式/系统提示词/对比评估)
//   - evaluation-basic-system-prompt-only   (基础模式/系统提示词/仅提示词评估)
//   - evaluation-basic-system-prompt-iterate(基础模式/系统提示词/迭代需求评估)
//   - evaluation-basic-user-original        (基础模式/用户提示词/原始评估)
//   - evaluation-basic-user-optimized       (基础模式/用户提示词/优化评估)
//   - evaluation-basic-user-compare         (基础模式/用户提示词/对比评估)
//   - evaluation-basic-user-prompt-only     (基础模式/用户提示词/仅提示词评估)
//   - evaluation-basic-user-prompt-iterate  (基础模式/用户提示词/迭代需求评估)
//   - evaluation-pro-system-original        (高级模式/多消息模式/原始评估)
//   - evaluation-pro-system-optimized       (高级模式/多消息模式/优化评估)
//   - evaluation-pro-system-compare         (高级模式/多消息模式/对比评估)
//   - evaluation-pro-system-prompt-only     (高级模式/多消息模式/仅提示词评估)
//   - evaluation-pro-system-prompt-iterate  (高级模式/多消息模式/迭代需求评估)
//   - evaluation-pro-user-original          (高级模式/变量模式/原始评估)
//   - evaluation-pro-user-optimized         (高级模式/变量模式/优化评估)
//   - evaluation-pro-user-compare           (高级模式/变量模式/对比评估)
//   - evaluation-pro-user-prompt-only       (高级模式/变量模式/仅提示词评估)
//   - evaluation-pro-user-prompt-iterate    (高级模式/变量模式/迭代需求评估)
//
// 模板 ID 由 EvaluationService.getTemplateId() 动态生成，无需硬编码常量
