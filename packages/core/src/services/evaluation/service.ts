/**
 * 评估服务实现
 *
 * 使用 LLM 对测试结果进行智能评估和打分
 */

import type { ILLMService, StreamHandlers } from '../llm/types';
import type { IModelManager } from '../model/types';
import type { ITemplateManager, Template } from '../template/types';
import { TemplateProcessor, type TemplateContext } from '../template/processor';
import {
  type IEvaluationService,
  type EvaluationRequest,
  type EvaluationResponse,
  type EvaluationStreamHandlers,
  type EvaluationScore,
  type EvaluationType,
  type EvaluationDimension,
  type EvaluationModeConfig,
  type PatchOperation,
  type PatchOperationType,
} from './types';
import {
  EvaluationValidationError,
  EvaluationModelError,
  EvaluationTemplateError,
  EvaluationExecutionError,
  EvaluationParseError,
} from './errors';
import { jsonrepair } from 'jsonrepair';

/**
 * 评估服务实现类
 */
export class EvaluationService implements IEvaluationService {
  constructor(
    private llmService: ILLMService,
    private modelManager: IModelManager,
    private templateManager: ITemplateManager
  ) {}

  /**
   * 执行评估（非流式）
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    this.validateRequest(request);
    await this.validateModel(request.evaluationModelKey);

    const template = await this.getEvaluationTemplate(request.type, request.mode);
    const context = this.buildTemplateContext(request);
    const messages = TemplateProcessor.processTemplate(template, context);

    const startTime = Date.now();
    try {
      const result = await this.llmService.sendMessage(messages, request.evaluationModelKey);
      const duration = Date.now() - startTime;

      return this.parseEvaluationResult(result, request.type, {
        model: request.evaluationModelKey,
        timestamp: Date.now(),
        duration,
      });
    } catch (error) {
      throw new EvaluationExecutionError(
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 流式评估
   */
  async evaluateStream(
    request: EvaluationRequest,
    callbacks: EvaluationStreamHandlers
  ): Promise<void> {
    try {
      this.validateRequest(request);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    try {
      await this.validateModel(request.evaluationModelKey);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let template: Template;
    try {
      template = await this.getEvaluationTemplate(request.type, request.mode);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const context = this.buildTemplateContext(request);
    const messages = TemplateProcessor.processTemplate(template, context);

    let fullContent = '';
    const startTime = Date.now();

    const streamHandlers: StreamHandlers = {
      onToken: (token) => {
        fullContent += token;
        callbacks.onToken(token);
      },
      onComplete: () => {
        const duration = Date.now() - startTime;
        try {
          const response = this.parseEvaluationResult(fullContent, request.type, {
            model: request.evaluationModelKey,
            timestamp: Date.now(),
            duration,
          });
          callbacks.onComplete(response);
        } catch (error) {
          callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
      },
      onError: (error) => {
        callbacks.onError(new EvaluationExecutionError(error.message, error));
      },
    };

    try {
      await this.llmService.sendMessageStream(messages, request.evaluationModelKey, streamHandlers);
    } catch (error) {
      callbacks.onError(
        new EvaluationExecutionError(
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * 验证评估请求
   */
  private validateRequest(request: EvaluationRequest): void {
    if (!request.evaluationModelKey?.trim()) {
      throw new EvaluationValidationError('Evaluation model key must not be empty.');
    }

    if (!request.mode) {
      throw new EvaluationValidationError('Evaluation mode configuration must not be empty.');
    }
    if (!request.mode.functionMode) {
      throw new EvaluationValidationError('Function mode must not be empty.');
    }
    if (!request.mode.subMode) {
      throw new EvaluationValidationError('Sub mode must not be empty.');
    }

    switch (request.type) {
      case 'original':
        if (!request.testResult?.trim()) {
          throw new EvaluationValidationError('Test result must not be empty.');
        }
        break;

      case 'optimized':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        if (!request.testResult?.trim()) {
          throw new EvaluationValidationError('Test result must not be empty.');
        }
        break;

      case 'compare':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        if (!request.originalTestResult?.trim()) {
          throw new EvaluationValidationError('Original test result must not be empty.');
        }
        if (!request.optimizedTestResult?.trim()) {
          throw new EvaluationValidationError('Optimized test result must not be empty.');
        }
        break;

      case 'prompt-only':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        break;

      case 'prompt-iterate':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        if (!request.iterateRequirement?.trim()) {
          throw new EvaluationValidationError('Iteration requirement must not be empty.');
        }
        break;

      default:
        throw new EvaluationValidationError(`Unknown evaluation type: ${(request as any).type}`);
    }
  }

  /**
   * 验证评估模型
   */
  private async validateModel(modelKey: string): Promise<void> {
    const model = await this.modelManager.getModel(modelKey);
    if (!model) {
      throw new EvaluationModelError(modelKey);
    }
  }

  /**
   * 获取评估模板
   */
  private async getEvaluationTemplate(type: EvaluationType, mode: EvaluationModeConfig): Promise<Template> {
    const templateId = this.getTemplateId(type, mode);

    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template?.content) {
        throw new EvaluationTemplateError(templateId);
      }
      return template;
    } catch (error) {
      if (error instanceof EvaluationTemplateError) {
        throw error;
      }
      throw new EvaluationTemplateError(templateId);
    }
  }

  /**
   * 根据评估类型和模式获取模板ID
   */
  private getTemplateId(type: EvaluationType, mode: EvaluationModeConfig): string {
    return `evaluation-${mode.functionMode}-${mode.subMode}-${type}`;
  }

  /**
   * 构建模板上下文
   */
  private buildTemplateContext(request: EvaluationRequest): TemplateContext {
    const baseContext: TemplateContext = {
      testContent: request.testContent || '',
      ...(request.variables || {}),
    };

    // 原始提示词（可选）
    if (request.originalPrompt) {
      baseContext.originalPrompt = request.originalPrompt;
      baseContext.hasOriginalPrompt = true;
    } else {
      baseContext.hasOriginalPrompt = false;
    }

    // Pro 模式上下文
    if (request.proContext) {
      baseContext.proContext = JSON.stringify(request.proContext, null, 2);
    }

    switch (request.type) {
      case 'original':
        return {
          ...baseContext,
          testResult: request.testResult,
        };

      case 'optimized':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
          testResult: request.testResult,
        };

      case 'compare':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
          originalTestResult: request.originalTestResult,
          optimizedTestResult: request.optimizedTestResult,
        };

      case 'prompt-only':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
        };

      case 'prompt-iterate':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
          iterateRequirement: request.iterateRequirement,
        };

      default:
        return baseContext;
    }
  }

  /**
   * 解析评估结果
   */
  private parseEvaluationResult(
    content: string,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number }
  ): EvaluationResponse {
    const tryNormalizeParsed = (parsed: unknown): EvaluationResponse | null => {
      if (!parsed || typeof parsed !== 'object') return null;

      if (!Array.isArray(parsed) && (parsed as any).score) {
        return this.normalizeEvaluationResponse(parsed, type, metadata);
      }

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object' && (item as any).score) {
            return this.normalizeEvaluationResponse(item, type, metadata);
          }
        }
      }

      return null;
    };

    // 尝试解析 JSON
    const fencedMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
    const candidates = [fencedMatch?.[1], content].filter(Boolean) as string[];

    for (const candidate of candidates) {
      try {
        const repairedJson = jsonrepair(candidate);
        const parsed = JSON.parse(repairedJson);
        const normalized = tryNormalizeParsed(parsed);
        if (normalized) {
          return normalized;
        }
      } catch (e) {
        console.warn(
          '[EvaluationService] jsonrepair failed:',
          e instanceof Error ? e.message : String(e)
        );
      }
    }

    // 降级解析
    const textResult = this.parseTextEvaluation(content, type, metadata);
    if (textResult) {
      console.warn('[EvaluationService] Using text fallback parsing');
      return textResult;
    }

    throw new EvaluationParseError(
      `Failed to parse evaluation result. Raw content length: ${content.length} characters.`
    );
  }

  /**
   * 标准化评估响应（统一结构）
   */
  private normalizeEvaluationResponse(
    data: any,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number }
  ): EvaluationResponse {
    if (!data || typeof data !== 'object') {
      throw new EvaluationParseError('Evaluation result is not a valid object.');
    }

    if (!data.score || typeof data.score !== 'object') {
      throw new EvaluationParseError('Evaluation result is missing the "score" field.');
    }

    // 提取分数
    const extractScore = (value: any, fieldName: string): number => {
      if (value === undefined || value === null) {
        throw new EvaluationParseError(`Evaluation result is missing score for "${fieldName}".`);
      }
      const num = typeof value === 'number' ? value : parseInt(String(value));
      if (isNaN(num)) {
        throw new EvaluationParseError(`Invalid numeric score for "${fieldName}": ${value}`);
      }
      return Math.max(0, Math.min(100, num));
    };

    // 解析维度
    const dimensionsData = data.score.dimensions;
    if (!dimensionsData || !Array.isArray(dimensionsData)) {
      throw new EvaluationParseError('Evaluation result "dimensions" must be an array.');
    }

    if (dimensionsData.length === 0) {
      throw new EvaluationParseError('Evaluation result "dimensions" array must not be empty.');
    }

    const dimensions: EvaluationDimension[] = dimensionsData.map((dim: any, index: number) => {
      if (!dim || typeof dim !== 'object') {
        throw new EvaluationParseError(`dimensions[${index}] is not a valid object.`);
      }
      if (!dim.key || typeof dim.key !== 'string') {
        throw new EvaluationParseError(`dimensions[${index}] is missing a valid "key" field.`);
      }
      if (!dim.label || typeof dim.label !== 'string') {
        throw new EvaluationParseError(`dimensions[${index}] is missing a valid "label" field.`);
      }
      return {
        key: dim.key,
        label: dim.label,
        score: extractScore(dim.score, `dimensions[${index}].score`),
      };
    });

    const score: EvaluationScore = {
      overall: extractScore(data.score.overall, 'overall'),
      dimensions,
    };

    // 解析 improvements（最多3条）
    const improvements = Array.isArray(data.improvements)
      ? data.improvements.slice(0, 3)
      : [];

    // 解析 patchPlan（最多3条）
    const patchPlan = this.normalizePatchPlan(data.patchPlan || []).slice(0, 3);

    const summary = typeof data.summary === 'string' ? data.summary : '';

    return {
      type,
      score,
      improvements,
      summary,
      patchPlan,
      metadata,
    };
  }

  /**
   * 文本解析评估结果（降级方案）
   */
  private parseTextEvaluation(
    content: string,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number }
  ): EvaluationResponse | null {
    const scorePatterns = [
      /总[分评][:：]\s*(\d{1,3})/,
      /overall[:：]\s*(\d{1,3})/i,
      /(\d{1,3})\s*[分点](?:\s*[（(]满分100[)）])?/,
      /评分[:：]\s*(\d{1,3})/,
    ];

    let overall: number | null = null;
    for (const pattern of scorePatterns) {
      const match = content.match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num >= 0 && num <= 100) {
          overall = num;
          break;
        }
      }
    }

    if (overall === null) {
      return null;
    }

    return {
      type,
      score: {
        overall,
        dimensions: [
          { key: 'overall', label: '综合评分', score: overall },
        ],
      },
      improvements: [],
      summary: '评估完成',
      patchPlan: [],
      metadata,
    };
  }

  /**
   * 标准化补丁计划数组（简化版）
   */
  private normalizePatchPlan(patchPlan: any[]): PatchOperation[] {
    if (!Array.isArray(patchPlan)) {
      return [];
    }

    const validOps: PatchOperationType[] = ['insert', 'replace', 'delete'];

    return patchPlan
      .map((op: any) => {
        if (!op || typeof op !== 'object') {
          return null;
        }

        let opType: PatchOperationType = 'replace';
        if (op.op && validOps.includes(op.op)) {
          opType = op.op;
        }

        // 反转义 HTML 实体（LLM 可能返回转义后的 XML 标签）
        const oldText = this.unescapeHtmlEntities(String(op.oldText || ''));
        if (!oldText) {
          return null;
        }

        const newText = this.unescapeHtmlEntities(
          op.newText !== undefined ? String(op.newText) : ''
        );

        const operation: PatchOperation = {
          op: opType,
          oldText,
          newText,
          instruction: String(op.instruction || ''),
        };

        if (typeof op.occurrence === 'number' && Number.isFinite(op.occurrence)) {
          const occ = Math.trunc(op.occurrence);
          if (occ > 0) {
            operation.occurrence = occ;
          }
        }

        return operation;
      })
      .filter((op): op is PatchOperation => op !== null);
  }

  /**
   * 反转义 HTML 实体
   * LLM 生成 JSON 时可能对 XML 标签进行 HTML 转义
   * 支持：命名实体、十进制实体(&#123;)、十六进制实体(&#x2F;)
   */
  private unescapeHtmlEntities(text: string): string {
    if (!text) return text;
    return text
      // 命名实体
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&sol;/g, '/')
      // 十六进制实体 &#xHH; 或 &#xHHHH;
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      // 十进制实体 &#DDD;
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }
}

/**
 * 创建评估服务的工厂函数
 */
export function createEvaluationService(
  llmService: ILLMService,
  modelManager: IModelManager,
  templateManager: ITemplateManager
): IEvaluationService {
  return new EvaluationService(llmService, modelManager, templateManager);
}
