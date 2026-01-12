/**
 * 变量提取服务错误类
 */

/**
 * 变量提取服务基础错误类
 */
export class VariableExtractionError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'VariableExtractionError';
  }
}

/**
 * 变量提取请求验证错误
 */
export class VariableExtractionValidationError extends VariableExtractionError {
  constructor(message: string) {
    super(`变量提取请求验证错误: ${message}`, 'VALIDATION_ERROR');
    this.name = 'VariableExtractionValidationError';
  }
}

/**
 * 变量提取模型错误（模型不存在或配置错误）
 */
export class VariableExtractionModelError extends VariableExtractionError {
  constructor(modelKey: string) {
    super(`变量提取模型错误: 模型 "${modelKey}" 不存在或未启用`, 'MODEL_ERROR');
    this.name = 'VariableExtractionModelError';
  }
}

/**
 * 变量提取解析错误（无法解析 LLM 返回的变量提取结果）
 */
export class VariableExtractionParseError extends VariableExtractionError {
  constructor(message: string) {
    super(`变量提取结果解析错误: ${message}`, 'PARSE_ERROR');
    this.name = 'VariableExtractionParseError';
  }
}
