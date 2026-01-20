/**
 * 变量值生成服务 - 错误类定义
 */

import { VARIABLE_VALUE_GENERATION_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

/**
 * 变量值生成服务基础错误类
 */
export class VariableValueGenerationError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'VariableValueGenerationError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

/**
 * 变量值生成请求验证错误
 */
export class VariableValueGenerationValidationError extends VariableValueGenerationError {
  constructor(details: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.VALIDATION_ERROR, details, { details })
    this.name = 'VariableValueGenerationValidationError'
  }
}

/**
 * 变量值生成模型错误
 */
export class VariableValueGenerationModelError extends VariableValueGenerationError {
  constructor(modelKey: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.MODEL_NOT_FOUND, undefined, { context: modelKey })
    this.name = 'VariableValueGenerationModelError'
  }
}

/**
 * 变量值生成解析错误
 */
export class VariableValueGenerationParseError extends VariableValueGenerationError {
  constructor(details: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.PARSE_ERROR, details, { details })
    this.name = 'VariableValueGenerationParseError'
  }
}

/**
 * 变量值生成执行错误（LLM 调用失败等）
 */
export class VariableValueGenerationExecutionError extends VariableValueGenerationError {
  constructor(details: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.EXECUTION_ERROR, details, { details })
    this.name = 'VariableValueGenerationExecutionError'
  }
}
