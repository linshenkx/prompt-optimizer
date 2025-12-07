/**
 * 评估服务错误类
 */

/**
 * 评估服务基础错误类
 */
export class EvaluationError extends Error {
  constructor(message: string, public readonly context?: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * 评估请求验证错误
 */
export class EvaluationValidationError extends EvaluationError {
  constructor(message: string) {
    super(`评估请求验证错误: ${message}`);
    this.name = 'EvaluationValidationError';
  }
}

/**
 * 评估模型错误（模型不存在或配置错误）
 */
export class EvaluationModelError extends EvaluationError {
  constructor(modelKey: string) {
    super(`评估模型错误: 模型 "${modelKey}" 不存在或未启用`, modelKey);
    this.name = 'EvaluationModelError';
  }
}

/**
 * 评估模板错误（模板不存在）
 */
export class EvaluationTemplateError extends EvaluationError {
  constructor(templateId: string) {
    super(`评估模板错误: 模板 "${templateId}" 不存在`, templateId);
    this.name = 'EvaluationTemplateError';
  }
}

/**
 * 评估解析错误（无法解析 LLM 返回的评估结果）
 */
export class EvaluationParseError extends EvaluationError {
  constructor(message: string) {
    super(`评估结果解析错误: ${message}`);
    this.name = 'EvaluationParseError';
  }
}

/**
 * 评估执行错误（LLM 调用失败等）
 */
export class EvaluationExecutionError extends EvaluationError {
  constructor(message: string, public readonly cause?: Error) {
    super(`评估执行错误: ${message}`);
    this.name = 'EvaluationExecutionError';
  }
}
