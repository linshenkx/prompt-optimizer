/**
 * Evaluation service error classes
 * 评估服务错误类
 */

import { EVALUATION_ERROR_CODES } from '../../constants/error-codes';

/**
 * Base error class for evaluation service
 * 评估服务基础错误类
 */
export class EvaluationError extends Error {
  public readonly code: string;

  constructor(
    code: string,
    public readonly context?: string,
    message?: string
  ) {
    // Fallback message includes code for debugging when not translated
    super(message ? `[${code}] ${message}` : `[${code}] context=${context || 'none'}`);
    this.name = 'EvaluationError';
    this.code = code;
  }
}

/**
 * Evaluation request validation error
 * 评估请求验证错误
 */
export class EvaluationValidationError extends EvaluationError {
  constructor(message: string) {
    super(EVALUATION_ERROR_CODES.VALIDATION_ERROR, undefined, message);
    this.name = 'EvaluationValidationError';
  }
}

/**
 * Evaluation model error (model does not exist or is misconfigured)
 * 评估模型错误（模型不存在或配置错误）
 */
export class EvaluationModelError extends EvaluationError {
  constructor(modelKey: string) {
    super(EVALUATION_ERROR_CODES.MODEL_NOT_FOUND, modelKey);
    this.name = 'EvaluationModelError';
  }
}

/**
 * Evaluation template error (template does not exist)
 * 评估模板错误（模板不存在）
 */
export class EvaluationTemplateError extends EvaluationError {
  constructor(templateId: string) {
    super(EVALUATION_ERROR_CODES.TEMPLATE_NOT_FOUND, templateId);
    this.name = 'EvaluationTemplateError';
  }
}

/**
 * Evaluation parse error (cannot parse LLM evaluation result)
 * 评估解析错误（无法解析 LLM 返回的评估结果）
 */
export class EvaluationParseError extends EvaluationError {
  constructor(message: string) {
    super(EVALUATION_ERROR_CODES.PARSE_ERROR, undefined, message);
    this.name = 'EvaluationParseError';
  }
}

/**
 * Evaluation execution error (LLM call failed, etc.)
 * 评估执行错误（LLM 调用失败等）
 */
export class EvaluationExecutionError extends EvaluationError {
  constructor(message: string, public readonly cause?: Error) {
    super(EVALUATION_ERROR_CODES.EXECUTION_ERROR, undefined, message);
    this.name = 'EvaluationExecutionError';
  }
}
