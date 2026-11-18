import type { AssetReadPagination, AssetReadStorage } from '../asset-reader/types'
import { TextAdapterRegistry } from '../llm/adapters/registry'
import { LLMService } from '../llm/service'
import type { ITextAdapterRegistry, TextRequestEvidence } from '../llm/types'
import { TextComparisonError } from './errors'
import { createComparisonPreparation, validateComparisonSelection } from './preparation'
import type { PreparedComparisonCandidate } from './preparation'
import { canonical, terminal } from './validation'
import type {
  ComparisonExecutionSource,
  ComparisonTerminalStatus,
  CompletedTextComparison,
  CompletedTextComparisonRun,
  PreparedTextComparison,
  PrepareTextComparison,
  TextComparisonRun,
} from './types'

export { TextComparisonError } from './errors'
export type { TextComparisonErrorCode } from './errors'

const MAX_RETAINED_COMPARISONS = 8
const PREVIEW_LIFETIME_MS = 5 * 60_000
const RUN_TIMEOUT_MS = 10 * 60_000
const RESULT_LIFETIME_MS = 30 * 60_000
const MAX_OUTPUT_CHARS = 80_000

interface ComparisonGroup {
  selection?: PrepareTextComparison
  candidates?: [PreparedComparisonCandidate, PreparedComparisonCandidate]
  view: PreparedTextComparison
  starting?: Promise<void>
  timer?: ReturnType<typeof setTimeout>
  controllers: Map<string, AbortController>
}

const id = () => globalThis.crypto.randomUUID()

function createRun(side: 'a' | 'b', candidate: PreparedComparisonCandidate): TextComparisonRun {
  return { id: side, runId: id(), model: candidate.model, effective: candidate.effective,
    status: 'prepared', output: '', reasoning: '' }
}

function isCompleted(run: TextComparisonRun): run is CompletedTextComparisonRun {
  return terminal(run.status) && run.startedAt !== undefined && run.completedAt !== undefined
}

export function createTextComparisonService({
  storage,
  executionSource,
  registry = new TextAdapterRegistry(),
}: {
  storage: AssetReadStorage
  executionSource: ComparisonExecutionSource
  registry?: ITextAdapterRegistry
}) {
  const source: ComparisonExecutionSource = {
    kind: 'desktop',
    sourceId: executionSource.sourceId,
    sourceEpoch: executionSource.sourceEpoch,
    connectionGeneration: executionSource.connectionGeneration,
    label: executionSource.label,
  }
  const llm = new LLMService({
    async getModel() { throw new TextComparisonError('MODEL_CONFIGURATION_INVALID') },
  }, registry)
  const preparation = createComparisonPreparation(storage, source, registry, llm)
  const groups = new Map<string, ComparisonGroup>()
  let pendingPrepares = 0
  let disposed = false

  function assertOpen() {
    if (disposed) throw new TextComparisonError('COMPARISON_SERVICE_CLOSED')
  }

  function requireGroup(preparedId: string) {
    assertOpen()
    const group = groups.get(preparedId)
    if (!group) throw new TextComparisonError('PREPARATION_NOT_FOUND')
    return group
  }

  function expire(group: ComparisonGroup) {
    if (group.timer !== undefined) clearTimeout(group.timer)
    groups.delete(group.view.preparedId)
    group.selection = undefined
    group.candidates = undefined
    for (const controller of group.controllers.values()) controller.abort()
    group.controllers.clear()
  }

  function schedule(group: ComparisonGroup, delay: number, action: () => void) {
    if (group.timer !== undefined) clearTimeout(group.timer)
    group.timer = setTimeout(action, delay)
    if (typeof group.timer === 'object') group.timer.unref?.()
  }

  function finishRun(
    group: ComparisonGroup,
    run: TextComparisonRun,
    status: ComparisonTerminalStatus,
    errorCode?: string,
  ) {
    if (disposed || !groups.has(group.view.preparedId) || terminal(run.status)) return
    run.completedAt = Math.max(run.startedAt ?? 0, Date.now())
    run.startedAt ??= run.completedAt
    run.status = status
    if (errorCode) run.errorCode = errorCode
    const controller = group.controllers.get(run.runId)
    group.controllers.delete(run.runId)
    if (status !== 'success') controller?.abort()
    if (group.view.runs.every(isCompleted)) {
      group.selection = undefined
      group.candidates = undefined
      schedule(group, RESULT_LIFETIME_MS, () => expire(group))
    }
  }

  async function sendRun(
    group: ComparisonGroup,
    run: TextComparisonRun,
    candidate: PreparedComparisonCandidate,
    controller: AbortController,
  ) {
    const active = () => run.status === 'running' && !controller.signal.aborted
    const acceptEvidence = (evidence: TextRequestEvidence) => {
      if (!active()) throw new Error('Comparison request is no longer active')
      if (canonical(evidence) !== canonical(candidate.effective.preview)) {
        finishRun(group, run, 'error', 'REQUEST_CHANGED')
        throw new Error('Unexpected comparison request')
      }
      run.effective.request = structuredClone(evidence)
      run.effective.requestEvidence = 'captured'
    }
    const append = (field: 'output' | 'reasoning', token: string) => {
      if (!active()) return
      const remaining = MAX_OUTPUT_CHARS - run.output.length - run.reasoning.length
      if (token.length <= remaining) {
        run[field] += token
        return
      }
      let partial = token.slice(0, remaining)
      if (/[\uD800-\uDBFF]$/u.test(partial)) partial = partial.slice(0, -1)
      run[field] += partial
      finishRun(group, run, 'error', 'OUTPUT_LIMIT')
    }

    try {
      await llm.sendMessageStream(structuredClone(group.view.request.messages), run.model.configKey, {
        signal: controller.signal,
        onRequest: acceptEvidence,
        onToken: token => { append('output', token) },
        onReasoningToken: token => { append('reasoning', token) },
        onComplete: response => {
          if (!response) return
          if (!run.output) append('output', response.content)
          if (!run.reasoning && response.reasoning) append('reasoning', response.reasoning)
        },
        onError: () => { finishRun(group, run, 'error', 'MODEL_REQUEST_FAILED') },
      }, { configSnapshot: candidate.config })
      if (run.effective.requestEvidence !== 'captured') {
        finishRun(group, run, 'error', 'REQUEST_EVIDENCE_MISSING')
      } else if (!run.output.trim() && !run.reasoning.trim()) {
        finishRun(group, run, 'error', 'MODEL_EMPTY_OUTPUT')
      } else {
        finishRun(group, run, 'success')
      }
    } catch {
      finishRun(group, run, 'error', 'MODEL_REQUEST_FAILED')
    }
  }

  async function start(group: ComparisonGroup, selection: PrepareTextComparison,
    candidates: [PreparedComparisonCandidate, PreparedComparisonCandidate]) {
    try {
      const current = await preparation.prepare(selection)
      if (canonical(current.request) !== canonical(group.view.request) ||
        current.candidates.some((item, index) => canonical(item.effective.preview) !== canonical(candidates[index].effective.preview))) {
        throw new TextComparisonError('STALE_PREPARATION')
      }
    } catch {
      assertOpen()
      expire(group)
      throw new TextComparisonError('STALE_PREPARATION')
    }
    requireGroup(group.view.preparedId)

    group.selection = undefined
    group.candidates = undefined
    const actions = group.view.runs.flatMap((run, index) => {
      if (run.status !== 'prepared') return []
      const controller = new AbortController()
      group.controllers.set(run.runId, controller)
      run.startedAt = Date.now()
      run.status = 'running'
      return [{ run, candidate: candidates[index], controller }]
    })
    if (!actions.length) return

    schedule(group, RUN_TIMEOUT_MS, () => {
      for (const run of group.view.runs) finishRun(group, run, 'error', 'REQUEST_TIMEOUT')
    })
    for (const { run, candidate, controller } of actions) void sendRun(group, run, candidate, controller)
  }

  return {
    reader: preparation.reader,
    listModels(options?: AssetReadPagination) {
      assertOpen()
      return preparation.listModels(options)
    },
    async prepare(input: PrepareTextComparison): Promise<PreparedTextComparison> {
      assertOpen()
      validateComparisonSelection(input)
      if (groups.size + pendingPrepares >= MAX_RETAINED_COMPARISONS) throw new TextComparisonError('PREPARATION_LIMIT')
      const selection = structuredClone(input)
      pendingPrepares += 1
      try {
        const result = await preparation.prepare(selection)
        assertOpen()
        const view: PreparedTextComparison = {
          preparedId: id(),
          comparisonId: id(),
          previewRevision: id(),
          expiresAt: Date.now() + PREVIEW_LIFETIME_MS,
          executionSource: source,
          source: result.source,
          request: result.request,
          runs: [createRun('a', result.candidates[0]), createRun('b', result.candidates[1])],
        }
        const group: ComparisonGroup = {
          view, selection, candidates: result.candidates, controllers: new Map(),
        }
        groups.set(view.preparedId, group)
        schedule(group, PREVIEW_LIFETIME_MS, () => expire(group))
        return structuredClone(view)
      } finally {
        pendingPrepares -= 1
      }
    },
    async execute(preparedId: string, previewRevision: string): Promise<PreparedTextComparison> {
      const group = requireGroup(preparedId)
      if (group.view.previewRevision !== previewRevision) throw new TextComparisonError('REVISION_CONFLICT')
      if (!group.starting && group.selection && group.candidates) {
        if (Date.now() >= group.view.expiresAt) {
          expire(group)
          throw new TextComparisonError('STALE_PREPARATION')
        }
        group.starting = start(group, group.selection, group.candidates)
      }
      if (group.starting) {
        try { await group.starting } finally { group.starting = undefined }
      }
      requireGroup(preparedId)
      return structuredClone(group.view)
    },
    get(preparedId: string): PreparedTextComparison {
      return structuredClone(requireGroup(preparedId).view)
    },
    cancel(preparedId: string, runId?: string): PreparedTextComparison {
      const group = requireGroup(preparedId)
      const runs = runId === undefined ? group.view.runs : group.view.runs.filter(run => run.runId === runId)
      if (!runs.length) throw new TextComparisonError('RUN_NOT_FOUND')
      if (!group.starting && runs.some(run => run.status === 'prepared')) throw new TextComparisonError('COMPARISON_NOT_RUNNING')
      for (const run of runs) finishRun(group, run, 'cancelled')
      return structuredClone(group.view)
    },
    completed(preparedId: string): CompletedTextComparison {
      const { view } = requireGroup(preparedId)
      const [a, b] = view.runs
      if (!isCompleted(a) || !isCompleted(b)) throw new TextComparisonError('COMPARISON_NOT_COMPLETE')
      return structuredClone({
        id: view.comparisonId, executionSource: view.executionSource, source: view.source, request: view.request, runs: [a, b],
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const group of groups.values()) expire(group)
    },
  }
}
