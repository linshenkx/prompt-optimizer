import { DATA_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

export class DataError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'DataError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

export class DataInvalidJsonError extends DataError {
  constructor(details?: string) {
    super(DATA_ERROR_CODES.INVALID_JSON, details, details ? { details } : undefined)
    this.name = 'DataInvalidJsonError'
  }
}

export class DataInvalidFormatError extends DataError {
  constructor(details: string) {
    super(DATA_ERROR_CODES.INVALID_FORMAT, details, { details })
    this.name = 'DataInvalidFormatError'
  }
}

export class DataImportPartialFailedError extends DataError {
  constructor(count: number, details: string) {
    super(DATA_ERROR_CODES.IMPORT_PARTIAL_FAILED, details, { count, details })
    this.name = 'DataImportPartialFailedError'
  }
}

export class DataExportFailedError extends DataError {
  constructor(details: string) {
    super(DATA_ERROR_CODES.EXPORT_FAILED, details, { details })
    this.name = 'DataExportFailedError'
  }
}

