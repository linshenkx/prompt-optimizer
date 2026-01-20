/**
 * 存储错误类
 */
import { STORAGE_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

type StorageOperation = 'read' | 'write' | 'delete' | 'clear' | 'config'

const STORAGE_OPERATION_TO_CODE: Record<
  StorageOperation,
  (typeof STORAGE_ERROR_CODES)[keyof typeof STORAGE_ERROR_CODES]
> = {
  read: STORAGE_ERROR_CODES.READ_ERROR,
  write: STORAGE_ERROR_CODES.WRITE_ERROR,
  delete: STORAGE_ERROR_CODES.DELETE_ERROR,
  clear: STORAGE_ERROR_CODES.CLEAR_ERROR,
  config: STORAGE_ERROR_CODES.CONFIG_ERROR,
}

export class StorageError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(
    message: string,
    public readonly operation: StorageOperation,
    params?: ErrorParams,
  ) {
    const code = STORAGE_OPERATION_TO_CODE[operation]
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'StorageError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
} 
