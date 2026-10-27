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
  | 'result'
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

/**
 * 聚焦说明
 * - 用户或系统明确指出本次分析/评估最优先要回答的问题
 */
export interface FocusBrief {
  /** 聚焦内容 */
  content: string;
  /** 聚焦来源 */
  source?: 'user' | 'system';
  /** 优先级：当前统一固定为最高 */
  priority?: 'highest';
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
    value?: string;
    /** 变量来源 */
    source: 'predefined' | 'global' | 'temporary';
  }>;
  /** 原始提示词（含变量占位符） */
  rawPrompt: string;
  /** 变量替换后的提示词 */
  resolvedPrompt?: string;
}

/**
 * Pro 模式评估上下文联合类型
 */
export type ProEvaluationContext = ProSystemEvaluationContext | ProUserEvaluationContext;

// ==================== 统一内容块 ====================

/**
 * 统一内容块
 * 用于承载：
 * - 左侧分析的设计态上下文
 * - 右侧测试用例输入
 * - 右侧执行快照中的额外执行态输入
 */
export interface EvaluationContentBlock {
  /** 内容块种类 */
  kind: 'text' | 'variables' | 'conversation' | 'image' | 'json' | 'custom';
  /** 展示标签 */
  label: string;
  /** 主内容 */
  content: string;
  /** 可选摘要 */
  summary?: string;
  /** 可选多媒体证据 */
  media?: EvaluationMediaItem[];
}

/**
 * 评估多媒体证据项
 * - 固定支持 assetId 或 b64 二选一
 */
export interface EvaluationMediaItem {
  /** 展示标签 */
  label: string;
  /** 图像资源引用 */
  assetId?: string;
  /** base64 图像数据（不含 data URL 前缀） */
  b64?: string;
  /** 图像 MIME 类型 */
  mimeType?: string;
}

/**
 * 当前工作区中的可编辑目标
 */
export interface EvaluationTarget {
  /** 当前工作区提示词（唯一 patch target） */
  workspacePrompt: string;
  /** 可选参考提示词（如 v0 / 进入分析前的原始内容） */
  referencePrompt?: string;
  /** 可选设计态上下文 */
  designContext?: EvaluationContentBlock;
}

/**
 * 测试用例
 * - 表达“这次到底在测什么”
 * - 多个执行快照可以共用同一个测试用例
 */
export interface EvaluationTestCase {
  /** 用例标识 */
  id: string;
  /** 展示标签 */
  label?: string;
  /** 用例输入 */
  input: EvaluationContentBlock;
  /** 可选共享设置摘要 */
  settingsSummary?: string;
}

/**
 * 执行提示词引用
 */
export interface EvaluationPromptRef {
  /** 提示词来源 */
  kind: 'workspace' | 'original' | 'version' | 'custom';
  /** 可选版本号 */
  version?: number;
  /** 展示标签 */
  label?: string;
  /** 动态别名来源（如“上一版”） */
  dynamicAlias?: 'previous';
}

/**
 * 单次执行快照
 */
export interface EvaluationSnapshot {
  /** 快照标识 */
  id: string;
  /** 快照标签，如 A/B/C/D */
  label: string;
  /** 对应测试用例 */
  testCaseId: string;
  /** 提示词来源 */
  promptRef: EvaluationPromptRef;
  /** 实际执行提示词 */
  promptText: string;
  /** 执行输出 */
  output: string;
  /** 可选输出证据块（如图片结果） */
  outputBlock?: EvaluationContentBlock;
  /** 可选推理 */
  reasoning?: string;
  /** 模型 key */
  modelKey?: string;
  /** 可选版本标签 */
  versionLabel?: string;
  /** 可选额外执行输入 */
  executionInput?: EvaluationContentBlock;
}

/**
 * Compare 评估的附加提示
 */
export interface CompareAnalysisHints {
  /** compare 模式 */
  mode?: 'generic' | 'structured';
  /** 结构化 compare 中各快照的角色 */
  snapshotRoles?: Record<string, StructuredCompareRole>;
  /** 是否存在共享测试用例 */
  hasSharedTestCases?: boolean;
  /** 是否存在相同提示词跨快照对比 */
  hasSamePromptSnapshots?: boolean;
  /** 是否属于同提示词同输入跨模型对比 */
  hasCrossModelComparison?: boolean;
}

/**
 * Structured Compare 角色
 */
export type StructuredCompareRole =
  | 'target'
  | 'baseline'
  | 'reference'
  | 'referenceBaseline'
  | 'replica'
  | 'auxiliary';

/**
 * Compare 的机器可读停止信号
 */
export interface CompareStopSignals {
  targetVsBaseline?: 'improved' | 'flat' | 'regressed';
  targetVsReferenceGap?: 'none' | 'minor' | 'major';
  improvementHeadroom?: 'none' | 'low' | 'medium' | 'high';
  overfitRisk?: 'low' | 'medium' | 'high';
  stopRecommendation?: 'continue' | 'stop' | 'review';
  stopReasons?: string[];
}

/**
 * Compare judgement 的 pair 类型
 */
export type CompareJudgementPairType =
  | 'targetBaseline'
  | 'targetReference'
  | 'referenceBaseline'
  | 'targetReplica';

/**
 * Compare 中需要额外暴露给 UI / rewrite / SPO 的冲突信号
 * - 不直接依赖 synthesis 文本
 * - 基于 pairwise judge 的确定性派生结果
 */
export type CompareConflictSignal =
  | 'improvementNotSupportedOnReference'
  | 'improvementUnstableAcrossReplicas'
  | 'regressionOutweighsCosmeticGains'
  | 'sampleOverfitRiskVisible';

/**
 * Compare judgement
 * - 结构化 compare 内部多次 pairwise judge 的可复用产物
 * - 供 UI、SPO、rewrite-from-evaluation 等上层直接消费
 */
export interface CompareJudgement {
  pairKey: string;
  pairType: CompareJudgementPairType;
  pairLabel: string;
  leftSnapshotId: string;
  leftSnapshotLabel: string;
  leftRole?: StructuredCompareRole;
  rightSnapshotId: string;
  rightSnapshotLabel: string;
  rightRole?: StructuredCompareRole;
  verdict: 'left-better' | 'right-better' | 'mixed' | 'similar';
  winner: 'left' | 'right' | 'none';
  confidence: 'low' | 'medium' | 'high';
  pairSignal: string;
  analysis: string;
  evidence: string[];
  learnableSignals: string[];
  overfitWarnings: string[];
}

/**
 * Compare insight 高亮
 * - 对 pairwise judge 的压缩摘要
 * - 供 UI 和后续自动改写链路直接消费
 */
export interface CompareInsightHighlight {
  pairKey: string;
  pairType: CompareJudgementPairType;
  pairLabel: string;
  pairSignal: string;
  verdict: CompareJudgement['verdict'];
  confidence: CompareJudgement['confidence'];
  analysis: string;
}

/**
 * Compare insight 汇总
 * - 基于 compareJudgements 的本地确定性聚合结果
 * - 保持轻量，避免再次扩展 compare 主协议
 */
export interface CompareInsights {
  pairHighlights: CompareInsightHighlight[];
  progressSummary?: CompareInsightHighlight;
  referenceGapSummary?: CompareInsightHighlight;
  promptChangeSummary?: CompareInsightHighlight;
  stabilitySummary?: CompareInsightHighlight;
  evidenceHighlights?: string[];
  learnableSignals?: string[];
  overfitWarnings?: string[];
  conflictSignals?: CompareConflictSignal[];
}

// ==================== 补丁操作类型 ====================

/**
 * 补丁操作类型
 */
export type PatchOperationType = 'insert' | 'replace' | 'delete';

/**
 * 补丁操作 - 精准修复指令
 *
 * 设计原则：
 * - 用 oldText/newText 实现简单字符串替换
 * - 支持 diff 可视化渲染（红删绿增）
 * - 本地 apply 就是简单的字符串 replace
 *
 * 操作约定：
 * - 插入：oldText 是锚点上下文，newText = oldText + 插入内容
 * - 删除：newText = ""
 * - 替换：直接 oldText → newText
 */
export interface PatchOperation {
  /** 操作类型 */
  op: PatchOperationType;
  /** 修改前的原文本片段（用于定位和 diff 展示） */
  oldText: string;
  /** 修改后的文本（删除时为空字符串） */
  newText: string;
  /** 操作说明（包含问题描述 + 修复说明） */
  instruction: string;
  /** 出现次数（从1开始，用于处理多次出现的情况，默认1） */
  occurrence?: number;
}

// ==================== 评估请求类型 ====================

/**
 * 评估请求基础结构
 */
export interface EvaluationRequestBase {
  /** 评估使用的模型Key */
  evaluationModelKey: string;
  /** 可选：自定义变量 */
  variables?: Record<string, string>;
  /** 评估模式配置（必填） */
  mode: EvaluationModeConfig;
  /** 聚焦说明（最高优先级） */
  focus?: FocusBrief;
}

/**
 * 单个结果评估请求
 * 评估某个提示词在一次测试中的输出效果
 */
export interface ResultEvaluationRequest extends EvaluationRequestBase {
  type: 'result';
  /** 当前可编辑目标 */
  target: EvaluationTarget;
  /** 当前测试用例 */
  testCase: EvaluationTestCase;
  /** 当前执行快照 */
  snapshot: EvaluationSnapshot;
}

/**
 * 对比评估请求
 * 对比原始和优化后两个版本的测试效果
 */
export interface CompareEvaluationRequest extends EvaluationRequestBase {
  type: 'compare';
  /** 当前可编辑目标 */
  target: EvaluationTarget;
  /** 公共测试用例 */
  testCases: EvaluationTestCase[];
  /** 执行快照（至少 2 个） */
  snapshots: EvaluationSnapshot[];
  /** compare 子场景提示 */
  compareHints?: CompareAnalysisHints;
}

/**
 * 仅提示词评估请求
 * 直接评估提示词本身的质量，无需测试结果
 */
export interface PromptOnlyEvaluationRequest extends EvaluationRequestBase {
  type: 'prompt-only';
  /** 当前可编辑目标 */
  target: EvaluationTarget;
}

/**
 * 带迭代需求的提示词评估请求
 * 评估优化后的提示词是否满足迭代需求
 */
export interface PromptIterateEvaluationRequest extends EvaluationRequestBase {
  type: 'prompt-iterate';
  /** 当前可编辑目标 */
  target: EvaluationTarget;
  /** 迭代需求（来自 iterationNote） */
  iterateRequirement: string;
}

/**
 * 评估请求联合类型
 */
export type EvaluationRequest =
  | ResultEvaluationRequest
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
 * 评估响应（统一结构）
 */
export interface EvaluationResponse {
  /** 评估类型 */
  type: EvaluationType;
  /** 评估分数 */
  score: EvaluationScore;
  /** 方向性改进建议（最多3条，用于迭代重写） */
  improvements: string[];
  /** 一句话总结 */
  summary: string;
  /** 精准修复操作（最多3条，用于直接编辑） */
  patchPlan: PatchOperation[];
  /** 元数据 */
  metadata?: {
    model?: string;
    timestamp?: number;
    duration?: number;
    compareMode?: 'generic' | 'structured';
    snapshotRoles?: Record<string, StructuredCompareRole>;
    compareStopSignals?: CompareStopSignals;
    compareJudgements?: CompareJudgement[];
    compareInsights?: CompareInsights;
  };
}

// ==================== 流式评估回调 ====================

/**
 * 流式评估回调处理器
 */
export interface EvaluationStreamHandlers {
  signal?: AbortSignal;
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
//   - evaluation-basic-system-result        (基础模式/系统提示词/单结果评估)
//   - evaluation-basic-system-compare       (基础模式/系统提示词/对比评估)
//   - evaluation-basic-system-prompt-only   (基础模式/系统提示词/仅提示词评估)
//   - evaluation-basic-system-prompt-iterate(基础模式/系统提示词/迭代需求评估)
//   - evaluation-basic-user-result          (基础模式/用户提示词/单结果评估)
//   - evaluation-basic-user-compare         (基础模式/用户提示词/对比评估)
//   - evaluation-basic-user-prompt-only     (基础模式/用户提示词/仅提示词评估)
//   - evaluation-basic-user-prompt-iterate  (基础模式/用户提示词/迭代需求评估)
//   - evaluation-pro-multi-result           (Pro模式/多消息模式/单结果评估)
//   - evaluation-pro-multi-compare          (Pro模式/多消息模式/对比评估)
//   - evaluation-pro-multi-prompt-only      (Pro模式/多消息模式/仅提示词评估)
//   - evaluation-pro-multi-prompt-iterate   (Pro模式/多消息模式/迭代需求评估)
//   - evaluation-pro-variable-result        (Pro模式/变量模式/单结果评估)
//   - evaluation-pro-variable-compare       (Pro模式/变量模式/对比评估)
//   - evaluation-pro-variable-prompt-only   (Pro模式/变量模式/仅提示词评估)
//   - evaluation-pro-variable-prompt-iterate(Pro模式/变量模式/迭代需求评估)
//
// 模板 ID 由 EvaluationService.getTemplateId() 动态生成，无需硬编码常量
