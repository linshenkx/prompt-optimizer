import { describe, expect, it } from 'vitest'
import {
  getSupportedParameters,
  validateLLMParams,
} from '../../../src/services/model/validation'

describe('model validation', () => {
  it('returns a valid result when llmParams are not configured', () => {
    expect(validateLLMParams(undefined, 'openai')).toEqual({
      isValid: true,
      errors: [],
      warnings: [],
    })
  })

  it('accepts valid built-in parameters for OpenAI-compatible providers', () => {
    const result = validateLLMParams(
      {
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 1024,
        timeout: 10_000,
      },
      'deepseek',
    )

    expect(result).toEqual({
      isValid: true,
      errors: [],
      warnings: [],
    })
  })

  it('rejects invalid built-in parameter types and ranges', () => {
    const result = validateLLMParams(
      {
        temperature: 3,
        max_tokens: 1.5,
      },
      'openai',
    )

    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameterName: 'temperature',
          parameterValue: 3,
          expectedType: 'number',
          expectedRange: '0 - 2',
        }),
        expect.objectContaining({
          parameterName: 'max_tokens',
          parameterValue: 1.5,
          expectedType: 'integer',
        }),
      ]),
    )
    expect(result.warnings).toEqual([])
  })

  it('warns for safe unknown parameters but rejects dangerous custom parameter names', () => {
    const result = validateLLMParams(
      {
        vendor_extension: 'enabled',
        api_key_override: 'secret',
      },
      'openai',
    )

    expect(result.isValid).toBe(false)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        parameterName: 'vendor_extension',
        parameterValue: 'enabled',
      }),
    ])
    expect(result.errors).toEqual([
      expect.objectContaining({
        parameterName: 'api_key_override',
        parameterValue: 'secret',
      }),
    ])
  })

  it('validates Gemini-only parameter names and string-array stop sequences', () => {
    const valid = validateLLMParams(
      {
        maxOutputTokens: 2048,
        topP: 0.8,
        stopSequences: ['END'],
        includeThoughts: true,
      },
      'gemini',
    )

    expect(valid.isValid).toBe(true)
    expect(valid.errors).toEqual([])

    const invalid = validateLLMParams(
      {
        stopSequences: [],
      },
      'gemini',
    )

    expect(invalid.isValid).toBe(false)
    expect(invalid.errors).toEqual([
      expect.objectContaining({
        parameterName: 'stopSequences',
        expectedType: 'string',
      }),
    ])
  })

  it('filters supported parameter definitions by provider', () => {
    const openaiParameters = getSupportedParameters('openai').map((parameter) => parameter.name)
    const geminiParameters = getSupportedParameters('gemini').map((parameter) => parameter.name)

    expect(openaiParameters).toEqual(
      expect.arrayContaining(['temperature', 'top_p', 'max_tokens', 'timeout']),
    )
    expect(openaiParameters).not.toContain('maxOutputTokens')

    expect(geminiParameters).toEqual(
      expect.arrayContaining(['temperature', 'maxOutputTokens', 'topP', 'stopSequences']),
    )
    expect(geminiParameters).not.toContain('max_tokens')
  })
})
