/**
 * 对比服务错误类
 */
export class CompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompareError';
  }
}

/**
 * 输入验证错误
 */
export class CompareValidationError extends CompareError {
    constructor(message: string) {
        super(`输入验证错误: ${message}`);
    }
}

/**
 * 对比计算错误
 */
export class CompareCalculationError extends CompareError {
    constructor(message: string) {
        super(`对比计算错误: ${message}`);
    }
} 