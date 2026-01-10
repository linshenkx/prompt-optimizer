/**
 * 变量提取服务实现
 *
 * 使用 LLM 对提示词进行智能变量提取
 */

import type { ILLMService } from '../llm/types';
import type { IModelManager } from '../model/types';
import type { ITemplateManager, Template } from '../template/types';
import { TemplateProcessor, type TemplateContext } from '../template/processor';
import {
  type IVariableExtractionService,
  type VariableExtractionRequest,
  type VariableExtractionResponse,
  type ExtractedVariable,
} from './types';
import {
  VariableExtractionValidationError,
  VariableExtractionModelError,
  VariableExtractionParseError,
} from './errors';
import { jsonrepair } from 'jsonrepair';

/**
 * 变量提取服务实现类
 */
export class VariableExtractionService implements IVariableExtractionService {
  constructor(
    private llmService: ILLMService,
    private modelManager: IModelManager,
    private templateManager: ITemplateManager
  ) {}

  /**
   * 提取变量
   */
  async extract(request: VariableExtractionRequest): Promise<VariableExtractionResponse> {
    // 1. 验证请求
    this.validateRequest(request);

    // 2. 验证模型
    await this.validateModel(request.extractionModelKey);

    // 3. 获取提示词模板
    const template = await this.getExtractionTemplate();

    // 4. 构建模板上下文
    const context = this.buildTemplateContext(request);

    // 5. 使用 TemplateProcessor 渲染模板
    const messages = TemplateProcessor.processTemplate(template, context);

    // 6. 调用 LLM 发送请求
    try {
      const result = await this.llmService.sendMessage(messages, request.extractionModelKey);

      // 7. 解析 LLM 返回的 JSON 结果
      const parsed = this.parseExtractionResult(result);
      return this.filterResponse(parsed, request.existingVariableNames);
    } catch (error) {
      throw new VariableExtractionParseError(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private filterResponse(
    response: VariableExtractionResponse,
    existingVariableNames?: string[]
  ): VariableExtractionResponse {
    const normalize = (name: string) => name.trim().toLowerCase();

    const existing = new Set(
      (existingVariableNames ?? []).map(normalize).filter(Boolean)
    );

    const seen = new Set<string>();
    const variables = response.variables.filter((v) => {
      const key = normalize(v.name);
      if (!key) return false;
      if (existing.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { ...response, variables };
  }

  /**
   * 验证请求参数
   */
  private validateRequest(request: VariableExtractionRequest): void {
    if (!request.promptContent?.trim()) {
      throw new VariableExtractionValidationError('Prompt content must not be empty.');
    }

    if (!request.extractionModelKey?.trim()) {
      throw new VariableExtractionValidationError('Extraction model key must not be empty.');
    }
  }

  /**
   * 验证模型存在性
   */
  private async validateModel(modelKey: string): Promise<void> {
    const model = await this.modelManager.getModel(modelKey);
    if (!model) {
      throw new VariableExtractionModelError(modelKey);
    }
  }

  /**
   * 获取提示词模板 (统一模板)
   */
  private async getExtractionTemplate(): Promise<Template> {
    const templateId = 'variable-extraction';

    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template?.content) {
        throw new VariableExtractionParseError(`Template "${templateId}" not found or empty.`);
      }
      return template;
    } catch (error) {
      throw new VariableExtractionParseError(
        `Failed to get template "${templateId}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 构建模板上下文
   */
  private buildTemplateContext(request: VariableExtractionRequest): TemplateContext {
    const context: TemplateContext = {
      promptContent: request.promptContent,
      existingVariableNames: request.existingVariableNames?.join(', ') || '无',
      hasExistingVariables: !!request.existingVariableNames?.length,
    };

    return context;
  }

  /**
   * 解析 LLM 返回的 JSON 结果
   */
  private parseExtractionResult(content: string): VariableExtractionResponse {
    // 1. 尝试提取 JSON 代码块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
    const jsonText = jsonMatch ? jsonMatch[1] : content;

    try {
      // 2. 使用 jsonrepair 修复可能的格式问题
      const repaired = jsonrepair(jsonText);
      const parsed = JSON.parse(repaired);

      // 3. 标准化响应
      return this.normalizeExtractionResponse(parsed);
    } catch (error) {
      console.warn(
        '[VariableExtractionService] Failed to parse JSON:',
        error instanceof Error ? error.message : String(error)
      );

      // 尝试直接解析（不通过 jsonrepair）
      try {
        const parsed = JSON.parse(jsonText);
        return this.normalizeExtractionResponse(parsed);
      } catch (fallbackError) {
        throw new VariableExtractionParseError(
          `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}. Raw content length: ${content.length} characters.`
        );
      }
    }
  }

  /**
   * 标准化提取响应（统一结构）
   */
  private normalizeExtractionResponse(data: any): VariableExtractionResponse {
    if (!data || typeof data !== 'object') {
      throw new VariableExtractionParseError('Extraction result is not a valid object.');
    }

    // 验证 variables 字段
    if (!Array.isArray(data.variables)) {
      throw new VariableExtractionParseError('Extraction result must have a "variables" array.');
    }

    // 验证 summary 字段
    if (typeof data.summary !== 'string') {
      throw new VariableExtractionParseError('Extraction result must have a "summary" string.');
    }

    // 标准化每个变量
    const variables: ExtractedVariable[] = data.variables.map((variable: any, index: number) => {
      // 验证必需字段
      if (!variable || typeof variable !== 'object') {
        throw new VariableExtractionParseError(`variables[${index}] is not a valid object.`);
      }

      if (typeof variable.name !== 'string' || !variable.name.trim()) {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "name" field.`);
      }

      if (typeof variable.value !== 'string') {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "value" field.`);
      }

      if (!variable.position || typeof variable.position !== 'object') {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "position" object.`);
      }

      if (typeof variable.position.originalText !== 'string') {
        throw new VariableExtractionParseError(
          `variables[${index}].position is missing a valid "originalText" field.`
        );
      }

      if (typeof variable.position.occurrence !== 'number') {
        throw new VariableExtractionParseError(
          `variables[${index}].position is missing a valid "occurrence" number.`
        );
      }

      if (typeof variable.reason !== 'string') {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "reason" field.`);
      }

      return {
        name: variable.name.trim(),
        value: variable.value,
        position: {
          originalText: variable.position.originalText,
          occurrence: variable.position.occurrence,
        },
        reason: variable.reason,
        category: variable.category ? String(variable.category) : undefined,
      };
    });

    return {
      variables,
      summary: data.summary.trim(),
    };
  }
}

/**
 * 创建变量提取服务的工厂函数
 */
export function createVariableExtractionService(
  llmService: ILLMService,
  modelManager: IModelManager,
  templateManager: ITemplateManager
): IVariableExtractionService {
  return new VariableExtractionService(llmService, modelManager, templateManager);
}
