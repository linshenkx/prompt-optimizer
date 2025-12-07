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
} from './types';
import {
  EvaluationValidationError,
  EvaluationModelError,
  EvaluationTemplateError,
  EvaluationExecutionError,
  EvaluationParseError,
} from './errors';

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
    // 验证请求
    this.validateRequest(request);

    // 验证模型
    await this.validateModel(request.evaluationModelKey);

    // 获取评估模板（使用模式配置）
    const template = await this.getEvaluationTemplate(request.type, request.mode);

    // 构建模板上下文
    const context = this.buildTemplateContext(request);

    // 处理模板生成消息
    const messages = TemplateProcessor.processTemplate(template, context);

    // 调用 LLM
    const startTime = Date.now();
    try {
      const result = await this.llmService.sendMessage(messages, request.evaluationModelKey);
      const duration = Date.now() - startTime;

      // 解析评估结果
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
    // 验证请求
    try {
      this.validateRequest(request);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    // 验证模型
    try {
      await this.validateModel(request.evaluationModelKey);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    // 获取评估模板（使用模式配置）
    let template: Template;
    try {
      template = await this.getEvaluationTemplate(request.type, request.mode);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    // 构建模板上下文
    const context = this.buildTemplateContext(request);

    // 处理模板生成消息
    const messages = TemplateProcessor.processTemplate(template, context);

    // 流式调用 LLM
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
    if (!request.originalPrompt?.trim()) {
      throw new EvaluationValidationError('原始提示词不能为空');
    }

    if (!request.evaluationModelKey?.trim()) {
      throw new EvaluationValidationError('评估模型Key不能为空');
    }

    // 验证模式配置
    if (!request.mode) {
      throw new EvaluationValidationError('评估模式配置不能为空');
    }
    if (!request.mode.functionMode) {
      throw new EvaluationValidationError('功能模式不能为空');
    }
    if (!request.mode.subMode) {
      throw new EvaluationValidationError('子模式不能为空');
    }

    switch (request.type) {
      case 'original':
        if (!request.testResult?.trim()) {
          throw new EvaluationValidationError('测试结果不能为空');
        }
        break;

      case 'optimized':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('优化后的提示词不能为空');
        }
        if (!request.testResult?.trim()) {
          throw new EvaluationValidationError('测试结果不能为空');
        }
        break;

      case 'compare':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('优化后的提示词不能为空');
        }
        if (!request.originalTestResult?.trim()) {
          throw new EvaluationValidationError('原始测试结果不能为空');
        }
        if (!request.optimizedTestResult?.trim()) {
          throw new EvaluationValidationError('优化后测试结果不能为空');
        }
        break;

      default:
        throw new EvaluationValidationError(`未知的评估类型: ${(request as any).type}`);
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
   * 格式: evaluation-{functionMode}-{subMode}-{type}
   */
  private getTemplateId(type: EvaluationType, mode: EvaluationModeConfig): string {
    return `evaluation-${mode.functionMode}-${mode.subMode}-${type}`;
  }

  /**
   * 构建模板上下文
   */
  private buildTemplateContext(request: EvaluationRequest): TemplateContext {
    const baseContext: TemplateContext = {
      originalPrompt: request.originalPrompt,
      testContent: request.testContent || '',
      ...(request.variables || {}),
    };

    // 如果有 Pro 模式上下文，序列化后添加到上下文
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
    // 尝试解析 JSON 格式的评估结果
    const parseErrors: string[] = [];

    // 提取 JSON 块（支持 ```json ... ``` 或直接 JSON 对象）
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) ||
      content.match(/\{[\s\S]*"score"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        return this.normalizeEvaluationResponse(parsed, type, metadata, content);
      } catch (e) {
        parseErrors.push(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      parseErrors.push('未找到有效的 JSON 评估结果');
    }

    // 降级：尝试文本解析提取分数
    const textResult = this.parseTextEvaluation(content, type, metadata);
    if (textResult) {
      console.warn('[EvaluationService] JSON解析失败，使用文本解析:', parseErrors.join('; '));
      return textResult;
    }

    // 完全解析失败：抛出错误而非返回默认值
    throw new EvaluationParseError(
      `无法解析评估结果。${parseErrors.join('; ')}。原始内容长度: ${content.length} 字符`
    );
  }

  /**
   * 标准化评估响应
   * @throws {EvaluationParseError} 当必要字段缺失时抛出
   */
  private normalizeEvaluationResponse(
    data: any,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number },
    _rawContent?: string
  ): EvaluationResponse {
    // 严格验证必要字段
    if (!data || typeof data !== 'object') {
      throw new EvaluationParseError('评估结果不是有效的对象');
    }

    if (!data.score || typeof data.score !== 'object') {
      throw new EvaluationParseError('评估结果缺少 score 字段');
    }

    // 安全地提取分数，无默认值
    const extractScore = (value: any, fieldName: string): number => {
      if (value === undefined || value === null) {
        throw new EvaluationParseError(`评估结果缺少 ${fieldName} 分数`);
      }
      const num = typeof value === 'number' ? value : parseInt(String(value));
      if (isNaN(num)) {
        throw new EvaluationParseError(`${fieldName} 分数不是有效数字: ${value}`);
      }
      return Math.max(0, Math.min(100, num));
    };

    // 验证并提取维度分数（新格式：数组）
    const dimensionsData = data.score.dimensions;
    if (!dimensionsData || !Array.isArray(dimensionsData)) {
      throw new EvaluationParseError('评估结果 dimensions 必须是数组格式');
    }

    if (dimensionsData.length === 0) {
      throw new EvaluationParseError('评估结果 dimensions 数组不能为空');
    }

    // 解析维度数组
    const dimensions: EvaluationDimension[] = dimensionsData.map((dim: any, index: number) => {
      if (!dim || typeof dim !== 'object') {
        throw new EvaluationParseError(`dimensions[${index}] 不是有效对象`);
      }
      if (!dim.key || typeof dim.key !== 'string') {
        throw new EvaluationParseError(`dimensions[${index}] 缺少有效的 key 字段`);
      }
      if (!dim.label || typeof dim.label !== 'string') {
        throw new EvaluationParseError(`dimensions[${index}] 缺少有效的 label 字段`);
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

    // 解析新字段：issues, improvements, summary
    const issues = Array.isArray(data.issues) ? data.issues : [];
    const improvements = Array.isArray(data.improvements) ? data.improvements : [];
    const summary = typeof data.summary === 'string' ? data.summary : '';

    const response: EvaluationResponse = {
      type,
      score,
      issues,
      improvements,
      summary,
      metadata,
    };

    // 对比评估专属字段
    if (type === 'compare') {
      response.isOptimizedBetter = data.isOptimizedBetter;
    }

    return response;
  }

  /**
   * 文本解析评估结果（降级方案）
   * 仅当能从文本中提取到有效分数时返回结果，否则返回 null
   */
  private parseTextEvaluation(
    content: string,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number }
  ): EvaluationResponse | null {
    // 尝试从文本中提取分数（需要明确的分数格式）
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

    // 如果无法提取到有效分数，返回 null 表示解析失败
    if (overall === null) {
      return null;
    }

    // 尝试判断对比评估的结论
    let isOptimizedBetter: boolean | undefined;

    if (type === 'compare') {
      // 检查是否包含优化后更好的关键词
      const betterKeywords = ['优化后更好', '优化后效果更好', '改进明显', 'optimized.*better'];
      const worseKeywords = ['原始更好', '原始效果更好', '优化后变差', 'original.*better'];

      const betterMatch = betterKeywords.some((kw) => new RegExp(kw, 'i').test(content));
      const worseMatch = worseKeywords.some((kw) => new RegExp(kw, 'i').test(content));

      if (betterMatch && !worseMatch) {
        isOptimizedBetter = true;
      } else if (worseMatch && !betterMatch) {
        isOptimizedBetter = false;
      }
    }

    return {
      type,
      score: {
        overall,
        // 降级方案下创建单一维度表示总体评分
        dimensions: [
          { key: 'overall', label: '综合评分', score: overall },
        ],
      },
      // 降级方案无法解析结构化内容，返回空数组
      issues: [],
      improvements: [],
      summary: isOptimizedBetter !== undefined
        ? (isOptimizedBetter ? '优化后效果更好' : '原始效果更好')
        : '评估完成',
      isOptimizedBetter,
      metadata,
    };
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
