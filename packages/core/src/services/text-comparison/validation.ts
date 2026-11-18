import type { TextRequestEvidence } from '../llm/types'
import { isPublicTextRequestOmissions, isPublicTextRequestParameters } from '../llm/request-evidence'
import type { ComparisonTerminalStatus, SavedComparisonV1 } from './types'

export const COMPARISON_RECORD_LIMIT = 1024 * 1024
export const COMPARISON_STORAGE_LIMIT = 16 * COMPARISON_RECORD_LIMIT
const encoder = new TextEncoder()

export type ComparisonRepositoryErrorCode =
  | 'INVALID_INPUT'
  | 'COMPARISON_DATA_INVALID'
  | 'COMPARISON_NOT_FOUND'
  | 'COMPARISON_DELETED'
  | 'REVISION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RESULT_STORAGE_LIMIT'

export class ComparisonRepositoryError extends Error {
  constructor(readonly code: ComparisonRepositoryErrorCode) {
    super(`Saved comparison request failed (${code}).`)
    this.name = 'ComparisonRepositoryError'
  }
}

export function invalidComparisonData(): never {
  throw new ComparisonRepositoryError('COMPARISON_DATA_INVALID')
}

export const object = (value: unknown, keys?: readonly string[]): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (!keys || Object.keys(value).every(key => keys.includes(key)))

export const named = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)

export const timestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export const terminal = (value: unknown): value is ComparisonTerminalStatus =>
  value === 'success' || value === 'error' || value === 'cancelled'

export const byteLength = (value: string) => encoder.encode(value).byteLength

export function parseJson(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return invalidComparisonData() }
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (object(value)) {
    return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key =>
      JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  }
  return JSON.stringify(value) ?? 'null'
}

function evidence(value: unknown): value is TextRequestEvidence {
  return object(value, ['api', 'modelId', 'parameters', 'omittedParameterNames']) &&
    (value.api === 'chat-completions' || value.api === 'responses') && named(value.modelId) &&
    isPublicTextRequestParameters(value.parameters) && isPublicTextRequestOmissions(value.omittedParameterNames)
}

function validRun(value: unknown, id: 'a' | 'b'): boolean {
  if (!object(value, ['id', 'runId', 'model', 'effective', 'status', 'output', 'reasoning', 'errorCode', 'startedAt', 'completedAt']) ||
    value.id !== id || !uuid(value.runId) || !terminal(value.status) ||
    !timestamp(value.startedAt) || !timestamp(value.completedAt) || value.completedAt < value.startedAt ||
    typeof value.output !== 'string' || typeof value.reasoning !== 'string' ||
    (value.errorCode !== undefined && (typeof value.errorCode !== 'string' || !/^[A-Z_]{1,64}$/.test(value.errorCode)))) return false

  const { effective, model } = value
  if (!object(model, ['configKey', 'name', 'providerId', 'modelId']) ||
    ![model.configKey, model.name, model.providerId, model.modelId].every(named) ||
    !object(effective, ['parameterCoverage', 'parameters', 'omittedParameterNames', 'requestEvidence', 'preview', 'request']) ||
    effective.parameterCoverage !== 'declared' || !isPublicTextRequestParameters(effective.parameters) ||
    !isPublicTextRequestOmissions(effective.omittedParameterNames) ||
    (effective.preview !== undefined && (!evidence(effective.preview) || effective.preview.modelId !== model.modelId))) return false

  if (effective.requestEvidence === 'captured') return evidence(effective.request) && effective.request.modelId === model.modelId
  return effective.requestEvidence === 'pending' && effective.request === undefined && value.status !== 'success'
}

export function isSavedComparison(value: unknown): value is SavedComparisonV1 {
  if (!object(value, ['schemaVersion', 'id', 'savedAt', 'source', 'executionSource', 'request', 'runs']) ||
    value.schemaVersion !== 'saved-comparison/v1' || !uuid(value.id) || !timestamp(value.savedAt)) return false

  const { source, executionSource, request, runs } = value
  return object(source, ['favoriteId', 'assetId', 'versionId', 'expectedRevision', 'title']) &&
    [source.favoriteId, source.assetId, source.versionId, source.expectedRevision, source.title].every(named) &&
    object(executionSource, ['kind', 'sourceId', 'sourceEpoch', 'connectionGeneration', 'label']) &&
    executionSource.kind === 'desktop' &&
    [executionSource.sourceId, executionSource.sourceEpoch, executionSource.connectionGeneration, executionSource.label].every(named) &&
    object(request, ['rawPrompt', 'messages', 'variables']) && named(request.rawPrompt) &&
    Array.isArray(request.messages) && request.messages.length === 1 &&
    object(request.messages[0], ['role', 'content']) && request.messages[0].role === 'user' && named(request.messages[0].content) &&
    object(request.variables) && Object.values(request.variables).every(item => typeof item === 'string') &&
    Array.isArray(runs) && runs.length === 2 && validRun(runs[0], 'a') && validRun(runs[1], 'b') &&
    runs[0].runId !== runs[1].runId && runs[0].model.configKey !== runs[1].model.configKey
}
