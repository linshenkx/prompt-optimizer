/**
 * Compare service error class
 * 对比服务错误类
 */

import { COMPARE_ERROR_CODES } from '../../constants/error-codes';

export class CompareError extends Error {
  public readonly code: string;

  constructor(code: string, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = 'CompareError';
    this.code = code;
  }
}

/**
 * Input validation error
 * 输入验证错误
 */
export class CompareValidationError extends CompareError {
  constructor(message: string) {
    super(COMPARE_ERROR_CODES.VALIDATION_ERROR, message);
  }
}

/**
 * Compare calculation error
 * 对比计算错误
 */
export class CompareCalculationError extends CompareError {
  constructor(message: string) {
    super(COMPARE_ERROR_CODES.CALCULATION_ERROR, message);
  }
} 