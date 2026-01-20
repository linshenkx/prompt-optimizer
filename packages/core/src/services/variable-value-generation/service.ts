/**
 * 变量值生成服务 - 核心实现
 *
 * 使用 LLM 根据提示词上下文智能推测变量值
 */

import type { ILLMService } from '../llm/types';
import type { IModelManager } from '../model/types';
import type { ITemplateManager, Template } from '../template/types';
import { TemplateProcessor, type TemplateContext } from '../template/processor';
import {
  type IVariableValueGenerationService,
  type VariableValueGenerationRequest,
  type VariableValueGenerationResponse,
  type GeneratedVariableValue,
  type VariableToGenerate,
} from './types';
import {
  VariableValueGenerationError,
  VariableValueGenerationValidationError,
  VariableValueGenerationModelError,
  VariableValueGenerationParseError,
  VariableValueGenerationExecutionError,
} from './errors';
import { jsonrepair } from 'jsonrepair';
import { toErrorWithCode } from '../../utils/error';

/**
 * 变量值生成服务实现类
 */
export class VariableValueGenerationService implements IVariableValueGenerationService {
  constructor(
    private llmService: ILLMService,
    private modelManager: IModelManager,
    private templateManager: ITemplateManager
  ) {}

  /**
   * 生成变量值
   */
  async generate(request: VariableValueGenerationRequest): Promise<VariableValueGenerationResponse> {
    // 1. 验证请求
    this.validateRequest(request);

    // 2. 验证模型
    await this.validateModel(request.generationModelKey);

    // 3. 获取提示词模板
    const template = await this.getGenerationTemplate();

    // 4. 构建模板上下文
    const context = this.buildTemplateContext(request);

    // 5. 使用 TemplateProcessor 渲染模板
    const messages = TemplateProcessor.processTemplate(template, context);

    // 6. 调用 LLM 发送请求
    try {
      const result = await this.llmService.sendMessage(messages, request.generationModelKey);

      // 7. 解析 LLM 返回的 JSON 结果（传递请求的变量列表用于对齐校验）
      return this.parseGenerationResult(result, request.variables);
    } catch (error) {
      // 🔧 修复：保留原始错误类型，不要过度包装
      if (error instanceof VariableValueGenerationError) {
        throw error;
      }
      throw new VariableValueGenerationExecutionError(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * 验证请求参数
   */
  private validateRequest(request: VariableValueGenerationRequest): void {
    if (!request.promptContent?.trim()) {
      throw new VariableValueGenerationValidationError('Prompt content must not be empty.');
    }

    if (!request.generationModelKey?.trim()) {
      throw new VariableValueGenerationValidationError('Generation model key must not be empty.');
    }

    if (!request.variables || request.variables.length === 0) {
      throw new VariableValueGenerationValidationError('Variables list must not be empty.');
    }

    // 验证每个变量
    for (let i = 0; i < request.variables.length; i++) {
      const variable = request.variables[i];
      if (!variable.name?.trim()) {
        throw new VariableValueGenerationValidationError(`Variable at index ${i} has empty name.`);
      }
    }
  }

  /**
   * 验证模型是否存在
   */
  private async validateModel(modelKey: string): Promise<void> {
    const model = await this.modelManager.getModel(modelKey);
    if (!model) {
      throw new VariableValueGenerationModelError(modelKey);
    }
  }

  /**
   * 获取变量值生成模板
   */
  private async getGenerationTemplate(): Promise<Template> {
    const templateId = 'variable-value-generation';

    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template?.content) {
        throw new VariableValueGenerationExecutionError(`Template "${templateId}" not found or empty.`);
      }
      return template;
    } catch (error) {
      if (error instanceof VariableValueGenerationError) {
        throw error
      }
      if (typeof (error as any)?.code === 'string') {
        throw toErrorWithCode(error)
      }
      throw new VariableValueGenerationExecutionError(
        `Failed to get template "${templateId}": ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * 构建模板上下文
   */
  private buildTemplateContext(request: VariableValueGenerationRequest): TemplateContext {
    // 构建变量列表文本（用于模板注入）
    const variablesText = request.variables
      .map((v, idx) => {
        const parts = [`${idx + 1}. ${v.name}`];
        if (v.currentValue) parts.push(`（当前值: ${v.currentValue}）`);
        if (v.source) parts.push(`[${v.source}]`);
        return parts.join(' ');
      })
      .join('\n');

    return {
      promptContent: request.promptContent,
      variablesText,
      variableCount: request.variables.length,
    };
  }

  /**
   * 解析 LLM 生成结果
   */
  private parseGenerationResult(
    content: string | { content: string },
    requestedVariables: VariableToGenerate[]
  ): VariableValueGenerationResponse {
    // 统一处理 content（可能是字符串或对象）
    const textContent = typeof content === 'string' ? content : content.content;

    // 1. 尝试提取 JSON 代码块
    const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/i);
    const jsonText = jsonMatch ? jsonMatch[1] : textContent;

    try {
      // 2. 使用 jsonrepair 修复可能的格式问题
      const repaired = jsonrepair(jsonText);
      const parsed = JSON.parse(repaired);

      // 3. 标准化响应（传递请求的变量列表用于对齐）
      return this.normalizeGenerationResponse(parsed, requestedVariables);
    } catch (error) {
      // 回退：尝试直接解析
      try {
        const parsed = JSON.parse(jsonText);
        return this.normalizeGenerationResponse(parsed, requestedVariables);
      } catch (fallbackError) {
        throw new VariableValueGenerationParseError(
          `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * 标准化并验证生成响应
   * 🔧 修复：添加变量对齐校验，确保返回的变量与请求一致
   */
  private normalizeGenerationResponse(
    data: any,
    requestedVariables: VariableToGenerate[]
  ): VariableValueGenerationResponse {
    if (!data || typeof data !== 'object') {
      throw new VariableValueGenerationParseError('Generation result is not a valid object.');
    }

    if (!Array.isArray(data.values)) {
      throw new VariableValueGenerationParseError('Generation result must have a "values" array.');
    }

    if (typeof data.summary !== 'string') {
      throw new VariableValueGenerationParseError('Generation result must have a "summary" string.');
    }

    // 构建请求变量名集合（用于快速查找）
    // 🔧 对请求变量名也进行trim，避免首尾空格导致匹配失败
    const requestedNames = new Set(requestedVariables.map(v => v.name.trim()));

    // 标准化每个生成的值
    const rawValues: GeneratedVariableValue[] = data.values.map((item: any, index: number) => {
      if (!item || typeof item !== 'object') {
        throw new VariableValueGenerationParseError(`values[${index}] is not a valid object.`);
      }

      if (typeof item.name !== 'string' || !item.name.trim()) {
        throw new VariableValueGenerationParseError(`values[${index}] is missing a valid "name" field.`);
      }

      if (typeof item.value !== 'string') {
        throw new VariableValueGenerationParseError(`values[${index}] is missing a valid "value" field.`);
      }

      if (typeof item.reason !== 'string') {
        throw new VariableValueGenerationParseError(`values[${index}] is missing a valid "reason" field.`);
      }

      return {
        name: item.name.trim(),
        value: item.value,
        reason: item.reason,
        confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      };
    });

    // 🔧 对齐处理：过滤掉不在请求列表中的变量 + 建立Map用于快速查找
    const valueMap = new Map<string, GeneratedVariableValue>();
    for (const val of rawValues) {
      if (requestedNames.has(val.name)) {
        // 🔧 检测LLM返回的同名重复
        if (valueMap.has(val.name)) {
          console.warn(`[VariableValueGeneration] LLM返回了重复的变量名: ${val.name}，后者将覆盖前者`);
        }
        valueMap.set(val.name, val);
      } else {
        console.warn(`[VariableValueGeneration] LLM返回了未请求的变量: ${val.name}`);
      }
    }

    // 🔧 检测请求列表中的重复变量名
    const seenRequestNames = new Set<string>();
    for (const req of requestedVariables) {
      const trimmedName = req.name.trim();
      if (seenRequestNames.has(trimmedName)) {
        console.warn(`[VariableValueGeneration] 请求列表中存在重复的变量名: ${trimmedName}，将返回相同的生成结果`);
      }
      seenRequestNames.add(trimmedName);
    }

    // 🔧 补齐缺失的变量（LLM漏返回的）
    const alignedValues: GeneratedVariableValue[] = requestedVariables.map(req => {
      // 🔧 对请求变量名trim，与Set保持一致
      const trimmedName = req.name.trim();
      const generated = valueMap.get(trimmedName);
      if (generated) {
        return generated;
      }
      // 缺失的变量用空值补齐
      console.warn(`[VariableValueGeneration] LLM未返回变量 "${trimmedName}"，已补齐空值`);
      return {
        name: trimmedName,
        value: '',
        reason: '（LLM未生成此变量的值）',
        confidence: 0,
      };
    });

    return {
      values: alignedValues,
      summary: data.summary.trim(),
    };
  }
}

/**
 * 创建变量值生成服务的工厂函数
 *
 * @param llmService - LLM 服务实例
 * @param modelManager - 模型管理器实例
 * @param templateManager - 模板管理器实例
 * @returns 变量值生成服务实例
 */
export function createVariableValueGenerationService(
  llmService: ILLMService,
  modelManager: IModelManager,
  templateManager: ITemplateManager
): IVariableValueGenerationService {
  return new VariableValueGenerationService(llmService, modelManager, templateManager);
}
