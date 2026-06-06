import { describe, expect, it } from 'vitest'
import { isStructuredErrorLike, toErrorWithCode } from '../../../src/utils/error'

describe('core error utilities', () => {
  it('identifies structured error-like payloads', () => {
    expect(isStructuredErrorLike({ code: 'ERR_CODE' })).toBe(true)
    expect(isStructuredErrorLike({ code: 123 })).toBe(false)
    expect(isStructuredErrorLike(null)).toBe(false)
    expect(isStructuredErrorLike('ERR_CODE')).toBe(false)
  })

  it('returns existing Error instances without losing attached structured fields', () => {
    const original = Object.assign(new Error('original'), {
      code: 'ORIGINAL_CODE',
      params: { context: 'existing' },
    })

    expect(toErrorWithCode(original)).toBe(original)
  })

  it('normalizes structured, string, empty, and object payloads into Error instances', () => {
    const structured = toErrorWithCode({
      code: 'STRUCTURED_CODE',
      params: { context: 'payload' },
      stack: 'structured stack',
    })
    expect(structured).toMatchObject({
      name: 'Error',
      message: '[STRUCTURED_CODE]',
      code: 'STRUCTURED_CODE',
      params: { context: 'payload' },
      stack: 'structured stack',
    })

    expect(toErrorWithCode('plain failure').message).toBe('plain failure')
    expect(toErrorWithCode(undefined, 'fallback failure').message).toBe('fallback failure')
    expect(toErrorWithCode(null, 'fallback failure').message).toBe('fallback failure')
    expect(toErrorWithCode({ reason: 'unknown' }).message).toBe('[object Object]')
  })
})
