/**
 * 收藏服务相关错误类型
 */

import { FAVORITE_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

export class FavoriteError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'FavoriteError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

export class FavoriteNotFoundError extends FavoriteError {
  constructor(id: string) {
    super(FAVORITE_ERROR_CODES.NOT_FOUND, undefined, { context: id })
    this.name = 'FavoriteNotFoundError'
  }
}

export class FavoriteAlreadyExistsError extends FavoriteError {
  constructor(content?: string) {
    const raw = typeof content === 'string' ? content : ''
    const trimmed = raw.trim()
    const maxLen = 200
    const preview =
      trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed

    super(
      FAVORITE_ERROR_CODES.ALREADY_EXISTS,
      undefined,
      preview ? { preview, length: trimmed.length } : undefined,
    )
    this.name = 'FavoriteAlreadyExistsError'
  }
}

export class FavoriteCategoryNotFoundError extends FavoriteError {
  constructor(id: string) {
    super(FAVORITE_ERROR_CODES.CATEGORY_NOT_FOUND, undefined, { context: id })
    this.name = 'FavoriteCategoryNotFoundError'
  }
}

export class FavoriteValidationError extends FavoriteError {
  constructor(details: string) {
    super(FAVORITE_ERROR_CODES.VALIDATION_ERROR, details, { details })
    this.name = 'FavoriteValidationError'
  }
}

export class FavoriteStorageError extends FavoriteError {
  constructor(details: string, public cause?: Error) {
    super(FAVORITE_ERROR_CODES.STORAGE_ERROR, details, { details })
    this.name = 'FavoriteStorageError'
  }
}

/**
 * 标签相关错误
 */
export class FavoriteTagError extends FavoriteError {
  constructor(code: string, details?: string, params?: ErrorParams) {
    super(code, details, params ?? (details ? { details } : undefined))
    this.name = 'FavoriteTagError'
  }
}

/**
 * 标签已存在错误
 */
export class FavoriteTagAlreadyExistsError extends FavoriteTagError {
  constructor(tag: string) {
    super(FAVORITE_ERROR_CODES.TAG_ALREADY_EXISTS, undefined, { context: tag })
    this.name = 'FavoriteTagAlreadyExistsError'
  }
}

/**
 * Tag not found error
 */
export class FavoriteTagNotFoundError extends FavoriteTagError {
  constructor(tag: string) {
    super(FAVORITE_ERROR_CODES.TAG_NOT_FOUND, undefined, { context: tag })
    this.name = 'FavoriteTagNotFoundError'
  }
}

/**
 * Data migration error
 */
export class FavoriteMigrationError extends FavoriteError {
  constructor(message: string, public cause?: Error) {
    super(FAVORITE_ERROR_CODES.MIGRATION_ERROR, message, { details: message })
    this.name = 'FavoriteMigrationError'
  }
}

/**
 * 导入导出错误
 */
export class FavoriteImportExportError extends FavoriteError {
  constructor(message: string, public cause?: Error, public details?: string[]) {
    super(FAVORITE_ERROR_CODES.IMPORT_EXPORT_ERROR, message, { details: message })
    this.name = 'FavoriteImportExportError'
  }
}
