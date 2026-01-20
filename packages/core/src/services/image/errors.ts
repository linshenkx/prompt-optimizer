import type { ErrorParams } from '../../constants/error-codes'
import { BaseError } from '../llm/errors'

export class ImageError extends BaseError {
  constructor(code: string, message?: string, params?: ErrorParams) {
    super(code, message, params)
  }
}

