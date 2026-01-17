/**
 * History base error
 * 历史记录基础错误
 */

import { HISTORY_ERROR_CODES, type ErrorParams } from '../../constants/error-codes';

export class HistoryError extends Error {
  public readonly code: string;
  public readonly params?: ErrorParams;

  constructor(code: string, params?: ErrorParams, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = 'HistoryError';
    this.code = code;
    this.params = params ?? (message ? { details: message } : undefined);
  }
}

/**
 * History not found error
 * 历史记录未找到错误
 */
export class HistoryNotFoundError extends HistoryError {
  constructor(id: string) {
    super(HISTORY_ERROR_CODES.NOT_FOUND, { context: id });
    this.name = 'HistoryNotFoundError';
  }
}

/**
 * History chain error
 * 历史记录链错误
 */
export class HistoryChainError extends HistoryError {
  constructor(message: string) {
    super(HISTORY_ERROR_CODES.CHAIN_ERROR, undefined, message);
    this.name = 'HistoryChainError';
  }
}

/**
 * Record not found error
 * 记录不存在错误
 */
export class RecordNotFoundError extends HistoryError {
  constructor(
    message: string,
    public recordId: string
  ) {
    // i18n expects {details} for record_not_found
    super(HISTORY_ERROR_CODES.RECORD_NOT_FOUND, { details: message }, message);
    this.name = 'RecordNotFoundError';
  }
}

/**
 * History storage error
 * 历史记录存储错误
 *
 * Note: This class is different from StorageError in storage/errors.ts,
 * specifically for storage operation errors in the history module
 * 注意：此类与 storage/errors.ts 中的 StorageError 不同，
 * 专用于历史记录模块的存储操作错误
 */
export class HistoryStorageError extends HistoryError {
  constructor(
    message: string,
    public operation: 'read' | 'write' | 'delete' | 'init' | 'storage'
  ) {
    // i18n expects {details} for storage
    super(HISTORY_ERROR_CODES.STORAGE_ERROR, { details: message }, message);
    this.name = 'HistoryStorageError';
  }
}

/**
 * Record validation error
 * 记录验证错误
 */
export class RecordValidationError extends HistoryError {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(HISTORY_ERROR_CODES.VALIDATION_ERROR, undefined, message);
    this.name = 'RecordValidationError';
  }
} 