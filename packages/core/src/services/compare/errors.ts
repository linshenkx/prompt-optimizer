/**
 * Compare service error class
 * 对比服务错误类
 */

import { COMPARE_ERROR_CODES, type ErrorParams } from '../../constants/error-codes';

export class CompareError extends Error {
  public readonly code: string;
  public readonly params?: ErrorParams;

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = 'CompareError';
    this.code = code;
    this.params = params ?? (message ? { details: message } : undefined);
  }
}

/**
 * Input validation error
 * 输入验证错误
 */
export class CompareValidationError extends CompareError {
  constructor(message: string) {
    super(COMPARE_ERROR_CODES.VALIDATION_ERROR, message, { details: message });
  }
}

/**
 * Compare calculation error
 * 对比计算错误
 */
export class CompareCalculationError extends CompareError {
  constructor(message: string) {
    super(COMPARE_ERROR_CODES.CALCULATION_ERROR, message, { details: message });
  }
} 