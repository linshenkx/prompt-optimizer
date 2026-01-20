/**
 * 模型基础错误
 */
import { MODEL_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

export class ModelError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'ModelError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

/**
 * 模型验证错误
 */
export class ModelValidationError extends ModelError {
  constructor(
    details: string,
    public errors: string[],
  ) {
    super(MODEL_ERROR_CODES.VALIDATION_ERROR, details, { details })
    this.name = 'ModelValidationError'
  }
}

// 注意: ModelConfigError 已移至 llm/errors.ts，避免重复定义 
