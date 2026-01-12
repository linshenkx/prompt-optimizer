/**
 * 变量值生成服务 - 错误类定义
 */

/**
 * 变量值生成服务基础错误类
 */
export class VariableValueGenerationError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'VariableValueGenerationError';
  }
}

/**
 * 变量值生成请求验证错误
 */
export class VariableValueGenerationValidationError extends VariableValueGenerationError {
  constructor(message: string) {
    super(`变量值生成请求验证错误: ${message}`, 'VALIDATION_ERROR');
    this.name = 'VariableValueGenerationValidationError';
  }
}

/**
 * 变量值生成模型错误
 */
export class VariableValueGenerationModelError extends VariableValueGenerationError {
  constructor(modelKey: string) {
    super(`变量值生成模型错误: 模型 "${modelKey}" 不存在或未启用`, 'MODEL_ERROR');
    this.name = 'VariableValueGenerationModelError';
  }
}

/**
 * 变量值生成解析错误
 */
export class VariableValueGenerationParseError extends VariableValueGenerationError {
  constructor(message: string) {
    super(`变量值生成结果解析错误: ${message}`, 'PARSE_ERROR');
    this.name = 'VariableValueGenerationParseError';
  }
}
