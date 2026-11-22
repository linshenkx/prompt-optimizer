import { ref, toRaw } from 'vue'
import type { LLMTokenUsage } from '@prompt-optimizer/core'

const usageByRecord = new WeakMap<object, LLMTokenUsage>()
const usageVersion = ref(0)

function readSafeTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/**
 * Validates and normalizes provider-agnostic token usage for ephemeral UI display.
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

/**
 * Associates ephemeral token usage with an output record without mutating persisted session data.
 */
export function setOutputTokenUsage(record: object | null | undefined, usage: unknown): void {
  if (!record || typeof record !== 'object') {
    return
  }

  const rawRecord = toRaw(record)
  const sanitized = sanitizeTokenUsage(usage)
  if (sanitized) {
    usageByRecord.set(rawRecord, sanitized)
  } else {
    usageByRecord.delete(rawRecord)
  }
  usageVersion.value++
}

/**
 * Clears any ephemeral token usage bound to an output record.
 */
export function clearOutputTokenUsage(record: object | null | undefined): void {
  if (!record || typeof record !== 'object') {
    return
  }

  const rawRecord = toRaw(record)
  if (usageByRecord.delete(rawRecord)) {
    usageVersion.value++
  }
}

/**
 * Reads ephemeral token usage bound to an output record reactively.
 */
export function getOutputTokenUsage(record: object | null | undefined): LLMTokenUsage | null {
  void usageVersion.value
  if (!record || typeof record !== 'object') {
    return null
  }

  return usageByRecord.get(toRaw(record)) ?? null
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
