import { describe, expect, it } from 'vitest'
import {
  normalizeAnthropicUsage,
  normalizeChatCompletionUsage,
  normalizeGeminiUsage,
  normalizeResponsesUsage
} from '../../../src/services/llm/usage'

const unknownUsage = {
  inputTokens: null,
  outputTokens: null,
  cachedInputTokens: null,
  totalTokens: null
}

describe('token usage normalization', () => {
  it.each([
    ['Chat Completions', normalizeChatCompletionUsage],
    ['Responses', normalizeResponsesUsage],
    ['Gemini', normalizeGeminiUsage],
    ['Anthropic', normalizeAnthropicUsage]
  ])('%s omits absent usage', (_provider, normalize) => {
    for (const value of [undefined, null, {}, 42, 'usage']) {
      expect(normalize(value)).toBeUndefined()
    }
  })

  it('preserves Chat Completions zero counts and prefers its standard cache field', () => {
    expect(normalizeChatCompletionUsage({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      prompt_tokens_details: { cached_tokens: 0 },
      prompt_cache_hit_tokens: 5
    })).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0 })
  })

  it.each([undefined, null, { cached_tokens: -1 }])('falls back to DeepSeek cache hits with %j', details => {
    expect(normalizeChatCompletionUsage({
      prompt_tokens: '10',
      completion_tokens: NaN,
      total_tokens: Infinity,
      prompt_tokens_details: details,
      prompt_cache_hit_tokens: 5
    })).toEqual({ ...unknownUsage, cachedInputTokens: 5 })
  })

  it('reads Responses counts without deriving an unreported total', () => {
    expect(normalizeResponsesUsage({
      input_tokens: 12,
      output_tokens: 4,
      input_tokens_details: { cached_tokens: 5 },
      total_tokens: Number.MAX_SAFE_INTEGER + 1
    })).toEqual({ inputTokens: 12, outputTokens: 4, cachedInputTokens: 5, totalTokens: null })
    expect(normalizeResponsesUsage({
      input_tokens: -3,
      output_tokens: 1.5,
      input_tokens_details: { cached_tokens: false },
      total_tokens: null
    })).toBeUndefined()
  })

  it('keeps Gemini cached content within input and adds thoughts to output', () => {
    expect(normalizeGeminiUsage({
      promptTokenCount: 12,
      candidatesTokenCount: 4,
      thoughtsTokenCount: 3,
      cachedContentTokenCount: 5,
      totalTokenCount: 19
    })).toEqual({ inputTokens: 12, outputTokens: 7, cachedInputTokens: 5, totalTokens: 19 })
  })

  it.each([
    { candidates: 0, thoughts: undefined, output: 0 },
    { candidates: undefined, thoughts: 3, output: 3 },
    { candidates: '4', thoughts: -3, output: null },
    { candidates: Number.MAX_SAFE_INTEGER, thoughts: 1, output: null }
  ])('handles Gemini candidate count $candidates and thought count $thoughts', ({ candidates, thoughts, output }) => {
    expect(normalizeGeminiUsage({
      promptTokenCount: 1,
      candidatesTokenCount: candidates,
      thoughtsTokenCount: thoughts
    })).toEqual({ ...unknownUsage, inputTokens: 1, outputTokens: output })
  })

  it('includes Anthropic cache creation and reads in input, with only reads counted as cached', () => {
    expect(normalizeAnthropicUsage({
      input_tokens: 2,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
      output_tokens: 5
    })).toEqual({ inputTokens: 32, outputTokens: 5, cachedInputTokens: 20, totalTokens: 37 })

    expect(normalizeAnthropicUsage({
      input_tokens: 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: 0,
      output_tokens: 0
    })).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0 })
  })

  it('requires known Anthropic input and output counts to derive a total', () => {
    expect(normalizeAnthropicUsage({
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
      output_tokens: 5
    })).toEqual({ ...unknownUsage, outputTokens: 5, cachedInputTokens: 20 })
  })

  it('rejects overflow when deriving Anthropic input or total', () => {
    const max = Number.MAX_SAFE_INTEGER

    expect(normalizeAnthropicUsage({
      input_tokens: max,
      cache_creation_input_tokens: 1,
      output_tokens: 2
    })).toEqual({ ...unknownUsage, outputTokens: 2 })

    expect(normalizeAnthropicUsage({
      input_tokens: max,
      output_tokens: 1
    })).toEqual({ ...unknownUsage, inputTokens: max, outputTokens: 1 })
  })
})
