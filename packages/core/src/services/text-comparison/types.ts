import type { TextRequestEvidence } from '../llm/types'

export interface TextComparisonSource {
  favoriteId: string
  assetId: string
  versionId: string
  expectedRevision: string
  title: string
}

export interface ComparisonExecutionSource {
  kind: 'desktop'
  sourceId: string
  sourceEpoch: string
  connectionGeneration: string
  label: string
}

export interface TextComparisonCandidateSelection {
  id: 'a' | 'b'
  configKey: string
  expectedRevision: string
}

export interface PrepareTextComparison {
  source: Omit<TextComparisonSource, 'title'>
  variables: Record<string, string>
  candidates: [TextComparisonCandidateSelection, TextComparisonCandidateSelection]
}

export interface TextComparisonRequest {
  rawPrompt: string
  messages: [{ role: 'user'; content: string }]
  variables: Record<string, string>
}

export interface TextComparisonRun {
  id: 'a' | 'b'
  runId: string
  model: { configKey: string; name: string; providerId: string; modelId: string }
  effective: {
    parameterCoverage: 'declared'
    parameters: TextRequestEvidence['parameters']
    omittedParameterNames: string[]
    requestEvidence: 'pending' | 'captured'
    preview?: TextRequestEvidence
    request?: TextRequestEvidence
  }
  status: 'prepared' | 'running' | 'success' | 'error' | 'cancelled'
  output: string
  reasoning: string
  errorCode?: string
  startedAt?: number
  completedAt?: number
}

export interface PreparedTextComparison {
  preparedId: string
  comparisonId: string
  previewRevision: string
  expiresAt: number
  executionSource: ComparisonExecutionSource
  source: TextComparisonSource
  request: TextComparisonRequest
  runs: [TextComparisonRun, TextComparisonRun]
}

export type ComparisonTerminalStatus = 'success' | 'error' | 'cancelled'

export type CompletedTextComparisonRun = TextComparisonRun & {
  status: ComparisonTerminalStatus
  startedAt: number
  completedAt: number
}

export interface CompletedTextComparison {
  id: string
  executionSource: ComparisonExecutionSource
  source: TextComparisonSource
  request: TextComparisonRequest
  runs: [CompletedTextComparisonRun, CompletedTextComparisonRun]
}

export interface SavedComparisonV1 extends CompletedTextComparison {
  schemaVersion: 'saved-comparison/v1'
  savedAt: number
}

export interface SavedComparisonSummary {
  id: string
  title: string
  savedAt: number
  statuses: [ComparisonTerminalStatus, ComparisonTerminalStatus]
  revision: string
}

export interface ComparisonListOptions {
  favoriteId?: string
  limit?: number
  cursor?: string
}

export interface SavedComparisonPage {
  items: SavedComparisonSummary[]
  nextCursor?: string
}

export interface SavedComparisonResult {
  comparison: SavedComparisonV1
  revision: string
}

export interface ComparisonDeletion {
  deleted: boolean
  alreadyDeleted: boolean
}

export interface ComparisonViewer {
  list(options?: ComparisonListOptions): Promise<SavedComparisonPage>
  get(id: string): Promise<SavedComparisonResult>
  delete(id: string, expectedRevision: string): Promise<ComparisonDeletion>
}
