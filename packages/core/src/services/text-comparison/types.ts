import type { TextRequestEvidence } from '../llm/types'

export interface TextComparisonSource {
  favoriteId: string
  assetId: string
  versionId: string
  expectedRevision: string
  title: string
}

export interface ComparisonExecutionSource {
  kind: 'desktop' | 'browser'
  sourceId: string
  sourceEpoch: string
  connectionGeneration: string
  label: string
}

export interface TextComparisonRequest {
  rawPrompt: string
  messages: [{ role: 'user'; content: string }]
  variables: Record<string, string>
}

export type TextComparisonPromptSnapshot =
  | { kind: 'draft'; request: TextComparisonRequest }
  | { kind: 'saved-version'; versionId: string; version: number; request: TextComparisonRequest }

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
  candidatePrompt?: TextComparisonPromptSnapshot
  runs: [CompletedTextComparisonRun, CompletedTextComparisonRun]
}

export interface SavedComparisonV1 extends CompletedTextComparison {
  schemaVersion: 'saved-comparison/v1'
  candidatePrompt?: never
  savedAt: number
}

export interface SavedComparisonV2 extends CompletedTextComparison {
  schemaVersion: 'saved-comparison/v2'
  candidatePrompt: TextComparisonPromptSnapshot
  savedAt: number
}

export type SavedComparison = SavedComparisonV1 | SavedComparisonV2

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
  comparison: SavedComparison
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
