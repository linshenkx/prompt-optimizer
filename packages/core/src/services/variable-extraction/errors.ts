/**
 * 变量提取服务错误类
 */

import { VARIABLE_EXTRACTION_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

/**
 * 变量提取服务基础错误类
 */
export class VariableExtractionError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'VariableExtractionError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

/**
 * 变量提取请求验证错误
 */
export class VariableExtractionValidationError extends VariableExtractionError {
  constructor(details: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.VALIDATION_ERROR, details, { details })
    this.name = 'VariableExtractionValidationError'
  }
}

/**
 * 变量提取模型错误（模型不存在或配置错误）
 */
export class VariableExtractionModelError extends VariableExtractionError {
  constructor(modelKey: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.MODEL_NOT_FOUND, undefined, { context: modelKey })
    this.name = 'VariableExtractionModelError'
  }
}

/**
 * 变量提取解析错误（无法解析 LLM 返回的变量提取结果）
 */
export class VariableExtractionParseError extends VariableExtractionError {
  constructor(details: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.PARSE_ERROR, details, { details })
    this.name = 'VariableExtractionParseError'
  }
}

/**
 * 变量提取执行错误（LLM 调用失败等）
 */
export class VariableExtractionExecutionError extends VariableExtractionError {
  constructor(details: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.EXECUTION_ERROR, details, { details })
    this.name = 'VariableExtractionExecutionError'
  }
}
