import { describe, expect, it } from 'vitest'

import { PromptDataConverter } from '../../../src/services/PromptDataConverter'
import type { OpenAIRequest, StandardPromptData } from '../../../src/types'

describe('PromptDataConverter errors', () => {
  it('does not expose Unknown error when OpenAI conversion receives a non-Error throw', () => {
    const converter = new PromptDataConverter()
    const request = {
      get messages() {
        throw 'message getter failed'
      },
    } as unknown as OpenAIRequest

    const result = converter.fromOpenAI(request)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to convert OpenAI data: message getter failed')
    expect(result.error).not.toContain('Unknown error')
  })

  it('uses an actionable fallback when export conversion receives an empty non-Error throw', () => {
    const converter = new PromptDataConverter()
    const data = {
      get messages() {
        throw ''
      },
    } as unknown as StandardPromptData

    const result = converter.toOpenAI(data)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to convert to OpenAI format: No additional details')
    expect(result.error).not.toContain('Unknown error')
  })
})
