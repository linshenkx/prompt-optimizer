import { v4 as randomUUID } from 'uuid'
import type { StreamHandlers } from '../llm/types'
import type { IPromptService, OptimizationRequest } from '../prompt/types'
import { canonical } from '../text-comparison/validation'
import { hashText } from '../../utils/portable-crypto'
import { BrowserBridgeError, publicBrowserError } from './protocol'

type PromptRunner = Pick<IPromptService, 'optimizePromptStream' | 'testPromptStream'>
type TextRequest =
  | { kind: 'optimize'; request: OptimizationRequest }
  | { kind: 'test'; modelKey: string; systemPrompt: string; userPrompt: string }
type Run = {
  id: string
  kind: TextRequest['kind']
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  createdAt: number
  updatedAt: number
  saved: false
  partial: string
  reasoning: string
  output?: string
  error?: { code: string }
}
type Job = { state: Run; controller: AbortController; signature: string }

const MAX_RUNS = 64
const MAX_RUNNING = 4
const MAX_TEXT_LENGTH = 200_000

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function prepare(input: Record<string, unknown>, get: (id: string) => Run): TextRequest {
  const { kind, request, inputRunId, promptField } = input
  if (!record(request) || !text(request.modelKey)) throw new BrowserBridgeError('INVALID_INPUT')
  if (kind === 'optimize') {
    const { targetPrompt, optimizationMode, modelKey, templateId } = request
    if (inputRunId !== undefined || promptField !== undefined || !text(targetPrompt) ||
      (optimizationMode !== 'system' && optimizationMode !== 'user') || (templateId !== undefined && !text(templateId)) ||
      Object.keys(request).some(key => !['targetPrompt', 'optimizationMode', 'modelKey', 'templateId'].includes(key))) {
      throw new BrowserBridgeError('INVALID_INPUT')
    }
    return { kind, request: { targetPrompt, optimizationMode, modelKey: modelKey as string, templateId } }
  }
  if (kind !== 'test' ||
    Object.keys(request).some(key => !['systemPrompt', 'userPrompt', 'modelKey'].includes(key)) ||
    (request.systemPrompt !== undefined && typeof request.systemPrompt !== 'string') ||
    (request.userPrompt !== undefined && typeof request.userPrompt !== 'string') ||
    (promptField !== undefined && promptField !== 'systemPrompt' && promptField !== 'userPrompt')) {
    throw new BrowserBridgeError('INVALID_INPUT')
  }
  let systemPrompt = (request.systemPrompt as string | undefined) ?? ''
  let userPrompt = (request.userPrompt as string | undefined) ?? ''
  if (inputRunId !== undefined) {
    if (!text(inputRunId)) throw new BrowserBridgeError('INVALID_INPUT')
    const previous = get(inputRunId)
    if (previous.status !== 'succeeded' || !text(previous.output)) throw new BrowserBridgeError('INPUT_RUN_NOT_SUCCEEDED')
    if (promptField === 'userPrompt') userPrompt = previous.output
    else systemPrompt = previous.output
  } else if (promptField !== undefined) {
    throw new BrowserBridgeError('INVALID_INPUT')
  }
  if (!text(userPrompt)) throw new BrowserBridgeError('INVALID_INPUT')
  return { kind, modelKey: request.modelKey, systemPrompt, userPrompt }
}

export function createBrowserTextRuns(service: PromptRunner, verify: (revision: string, modelKey: string) => Promise<void>) {
  const jobs = new Map<string, Job>()
  const requests = new Map<string, Job>()
  let running = 0
  let closed = false

  function get(runId: string) {
    const job = jobs.get(runId)
    if (!job) throw new BrowserBridgeError('RUN_NOT_FOUND')
    return job
  }

  async function execute(prepared: TextRequest, job: Job, timeoutMs: number) {
    const { state, controller } = job
    const { signal } = controller
    const timer = setTimeout(() => controller.abort(new BrowserBridgeError('RUN_TIMEOUT')), timeoutMs)
    let output: string | undefined
    let failure: Error | undefined
    function append(field: 'partial' | 'reasoning', token: string) {
      signal.throwIfAborted()
      if (state[field].length + token.length > MAX_TEXT_LENGTH) {
        controller.abort(new BrowserBridgeError('RESULT_STORAGE_LIMIT'))
        signal.throwIfAborted()
      }
      state[field] += token
      state.updatedAt = Date.now()
    }
    const handlers: StreamHandlers = {
      signal,
      onToken: token => append('partial', token),
      onReasoningToken: token => append('reasoning', token),
      onComplete: response => { output = response?.content },
      onError: error => { failure = error },
    }
    try {
      signal.throwIfAborted()
      if (prepared.kind === 'optimize') await service.optimizePromptStream(prepared.request, handlers)
      else await service.testPromptStream(prepared.systemPrompt, prepared.userPrompt, prepared.modelKey, handlers)
      signal.throwIfAborted()
      if (failure) throw failure
      const result = output ?? state.partial
      if (!text(result)) throw new BrowserBridgeError('EMPTY_RUN_OUTPUT')
      if (result.length > MAX_TEXT_LENGTH) throw new BrowserBridgeError('RESULT_STORAGE_LIMIT')
      state.output = result
      state.status = 'succeeded'
    } catch (error) {
      const code = publicBrowserError(signal.aborted ? signal.reason : error)
      state.status = code === 'RUN_CANCELLED' || code === 'CONNECTION_CLOSED' ? 'cancelled' : 'failed'
      state.error = { code }
    } finally {
      clearTimeout(timer)
      state.updatedAt = Date.now()
      running--
    }
  }

  return {
    async start({ input, requestKey, expectedRevision }: Record<string, unknown>) {
      if (closed) throw new BrowserBridgeError('CONNECTION_CLOSED')
      if (!record(input) || !text(expectedRevision) || typeof requestKey !== 'string' ||
        !/^[a-zA-Z0-9._:-]{1,128}$/.test(requestKey) ||
        Object.keys(input).some(key => !['kind', 'request', 'inputRunId', 'promptField', 'timeoutMs'].includes(key))) {
        throw new BrowserBridgeError('INVALID_INPUT')
      }
      const timeoutMs = input.timeoutMs ?? 180_000
      if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 600_000) {
        throw new BrowserBridgeError('INVALID_INPUT')
      }
      const signature = hashText(canonical([expectedRevision, input]))
      function retry() {
        const previous = requests.get(requestKey as string)
        if (!previous) return undefined
        if (previous.signature !== signature) throw new BrowserBridgeError('IDEMPOTENCY_CONFLICT')
        return structuredClone(previous.state)
      }
      const previous = retry()
      if (previous) return previous
      const prepared = prepare(input, id => get(id).state)
      await verify(expectedRevision, prepared.kind === 'optimize' ? prepared.request.modelKey : prepared.modelKey)
      if (closed) throw new BrowserBridgeError('CONNECTION_CLOSED')
      const concurrent = retry()
      if (concurrent) return concurrent
      if (jobs.size >= MAX_RUNS || running >= MAX_RUNNING) throw new BrowserBridgeError('RUN_CAPACITY_REACHED')
      const now = Date.now()
      const state: Run = {
        id: randomUUID(), kind: prepared.kind, status: 'running', createdAt: now, updatedAt: now,
        saved: false, partial: '', reasoning: '',
      }
      const job = { state, signature, controller: new AbortController() }
      jobs.set(state.id, job)
      requests.set(requestKey, job)
      running++
      void execute(prepared, job, timeoutMs)
      return structuredClone(state)
    },
    get(runId: string) { return structuredClone(get(runId).state) },
    cancel(runId: string) {
      const job = get(runId)
      if (job.state.status === 'running') job.controller.abort(new BrowserBridgeError('RUN_CANCELLED'))
      return structuredClone(job.state)
    },
    dispose() {
      closed = true
      for (const job of jobs.values()) {
        if (job.state.status === 'running') job.controller.abort(new BrowserBridgeError('CONNECTION_CLOSED'))
      }
      jobs.clear()
      requests.clear()
    },
  }
}
