/**
 * 模型基础错误
 */
export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelError';
  }
}

/**
 * 模型验证错误
 */
export class ModelValidationError extends ModelError {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(message);
    this.name = 'ModelValidationError';
  }
}

// 注意: ModelConfigError 已移至 llm/errors.ts，避免重复定义 