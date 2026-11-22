import type { LLMTokenUsage } from './types'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

function readTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function finalizeUsage(usage: LLMTokenUsage): LLMTokenUsage | undefined {
  return Object.values(usage).some(count => count !== null) ? usage : undefined
}

function addTokenCounts(...counts: Array<number | null>): number | null {
  let sum: number | null = null
  for (const count of counts) {
    if (count !== null) {
      sum = (sum ?? 0) + count
    }
  }
  return Number.isSafeInteger(sum) ? sum : null
}

export function normalizeChatCompletionUsage(rawUsage: unknown): LLMTokenUsage | undefined {
  const usage = asRecord(rawUsage)
  const promptDetails = asRecord(usage?.prompt_tokens_details)
  return finalizeUsage({
    inputTokens: readTokenCount(usage?.prompt_tokens),
    outputTokens: readTokenCount(usage?.completion_tokens),
    cachedInputTokens: readTokenCount(promptDetails?.cached_tokens)
      ?? readTokenCount(usage?.prompt_cache_hit_tokens),
    totalTokens: readTokenCount(usage?.total_tokens)
  })
}

export function normalizeResponsesUsage(rawUsage: unknown): LLMTokenUsage | undefined {
  const usage = asRecord(rawUsage)
  const inputDetails = asRecord(usage?.input_tokens_details)
  return finalizeUsage({
    inputTokens: readTokenCount(usage?.input_tokens),
    outputTokens: readTokenCount(usage?.output_tokens),
    cachedInputTokens: readTokenCount(inputDetails?.cached_tokens),
    totalTokens: readTokenCount(usage?.total_tokens)
  })
}

/**
 * Gemini's prompt count already includes cached content. Its candidate and thought
 * counts together represent output tokens, matching OpenAI and Anthropic billing semantics.
 */
export function normalizeGeminiUsage(rawUsage: unknown): LLMTokenUsage | undefined {
  const usage = asRecord(rawUsage)
  return finalizeUsage({
    inputTokens: readTokenCount(usage?.promptTokenCount),
    outputTokens: addTokenCounts(
      readTokenCount(usage?.candidatesTokenCount),
      readTokenCount(usage?.thoughtsTokenCount)
    ),
    cachedInputTokens: readTokenCount(usage?.cachedContentTokenCount),
    totalTokens: readTokenCount(usage?.totalTokenCount)
  })
}

export function normalizeAnthropicUsage(rawUsage: unknown): LLMTokenUsage | undefined {
  const usage = asRecord(rawUsage)
  const uncachedInput = readTokenCount(usage?.input_tokens)
  const cacheCreation = readTokenCount(usage?.cache_creation_input_tokens)
  const cacheRead = readTokenCount(usage?.cache_read_input_tokens)
  const inputTokens = uncachedInput === null ? null : addTokenCounts(uncachedInput, cacheCreation, cacheRead)
  const outputTokens = readTokenCount(usage?.output_tokens)

  return finalizeUsage({
    inputTokens,
    outputTokens,
    cachedInputTokens: cacheRead,
    totalTokens: inputTokens === null || outputTokens === null ? null : addTokenCounts(inputTokens, outputTokens)
  })
}
