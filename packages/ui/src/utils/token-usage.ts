import type { LLMTokenUsage } from '@prompt-optimizer/core'

function readSafeTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/**
 * Validates and normalizes provider-agnostic token usage for a single model result.
 * Returns null if the payload is invalid or contains no valid counts.
 */
export function sanitizeTokenUsage(usage: unknown): LLMTokenUsage | null {
  if (!usage || typeof usage !== 'object') {
    return null
  }

  const candidate = usage as Partial<Record<keyof LLMTokenUsage, unknown>>
  const normalized: LLMTokenUsage = {
    inputTokens: readSafeTokenCount(candidate.inputTokens),
    outputTokens: readSafeTokenCount(candidate.outputTokens),
    cachedInputTokens: readSafeTokenCount(candidate.cachedInputTokens),
    totalTokens: readSafeTokenCount(candidate.totalTokens),
  }

  return Object.values(normalized).some((count) => count !== null) ? normalized : null
}

export function setOutputTokenUsage(record: { tokenUsage?: LLMTokenUsage }, usage: unknown): void {
  const counts = sanitizeTokenUsage(usage)
  if (counts) record.tokenUsage = counts
  else delete record.tokenUsage
}

/**
 * Resolves the headline token count for compact UI display.
 * Prefers provider totalTokens, falling back to inputTokens + outputTokens when both exist.
 */
export function resolveDisplayTotalTokens(usage: LLMTokenUsage): number | null {
  if (usage.totalTokens !== null) {
    return usage.totalTokens
  }

  if (usage.inputTokens !== null && usage.outputTokens !== null) {
    const sum = usage.inputTokens + usage.outputTokens
    return Number.isSafeInteger(sum) ? sum : null
  }

  return null
}
