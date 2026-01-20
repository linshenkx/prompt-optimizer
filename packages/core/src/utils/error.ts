import type { ErrorParams } from '../constants/error-codes'

type RecordLike = Record<string, unknown>

export type StructuredErrorLike = {
  code: string
  params?: ErrorParams
  message?: string
  name?: string
  stack?: string
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null
}

export function isStructuredErrorLike(value: unknown): value is StructuredErrorLike {
  return isRecord(value) && typeof value.code === 'string'
}

/**
 * Normalize unknown values into an Error instance while preserving `{ code, params }`
 * when available (e.g., errors crossing IPC boundaries).
 */
export function toErrorWithCode(value: unknown, fallbackMessage = 'Unknown error'): Error & Partial<StructuredErrorLike> {
  if (value instanceof Error) {
    return value as Error & Partial<StructuredErrorLike>
  }

  if (isStructuredErrorLike(value)) {
    const code = value.code
    const message =
      typeof value.message === 'string' && value.message.trim()
        ? value.message
        : `[${code}]`

    const err = new Error(message) as Error & Partial<StructuredErrorLike>
    err.name = typeof value.name === 'string' ? value.name : 'Error'
    err.code = code
    if (isRecord(value.params)) {
      err.params = value.params as ErrorParams
    }
    if (typeof value.stack === 'string') {
      err.stack = value.stack
    }
    return err
  }

  if (typeof value === 'string') {
    return new Error(value)
  }

  if (value === null || value === undefined) {
    return new Error(fallbackMessage)
  }

  return new Error(String(value))
}

