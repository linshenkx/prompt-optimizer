import type { MarkdownOutput } from './markdown-output'
import MarkdownWorker from './markdown-output.worker?worker&inline'
import { MARKDOWN_SOURCE_BUDGET, MARKDOWN_PREVIEW_INPUT_BUDGET, PAGE_PREVIEW_BUDGET, hasHtmlPreviewHint } from './markdown-output-limits'

type Job = { id: number; owner: symbol; content: string; original?: string; previewHtml?: boolean; done: (output: MarkdownOutput) => void }
const queue = new Map<symbol, Job>()
const owners = new Set<symbol>()
const leases = new Map<symbol, number>()
const previewLeases = new Map<symbol, number>()
let worker: Worker | undefined
let workerReady = false
let running: Job | undefined
let deadline: ReturnType<typeof setTimeout> | undefined
let sequence = 0

function stopWorker() { clearTimeout(deadline); worker?.terminate(); worker = undefined; workerReady = false }
function accept(job: Job, output: MarkdownOutput) {
  if (!owners.has(job.owner)) return
  const otherNodes = [...leases.entries()].reduce((sum, [owner, nodes]) => sum + (owner === job.owner ? 0 : nodes), 0)
  const previews = output.kind === 'html' ? output.previews?.length ?? 0 : 0
  const otherPreviews = [...previewLeases.entries()].reduce((sum, [owner, count]) => sum + (owner === job.owner ? 0 : count), 0)
  if (previews + otherPreviews > PAGE_PREVIEW_BUDGET) output = { kind: 'source', reason: 'total-previews' }
  if (output.kind !== 'source' && otherNodes + output.nodes > 6000) output = { kind: 'source', reason: 'total-nodes' }
  if (output.kind !== 'source') { leases.set(job.owner, output.nodes); previewLeases.set(job.owner, previews) }
  else { leases.delete(job.owner); previewLeases.delete(job.owner) }
  job.done(output)
}
function next() {
  if (running || !queue.size) return
  const job = queue.values().next().value as Job
  queue.delete(job.owner)
  running = job
  try {
    const submit = () => {
      deadline = setTimeout(() => {
        running = undefined
        stopWorker()
        accept(job, { kind: 'source', reason: 'deadline' })
        next()
      }, 1500)
      worker!.postMessage({ id: job.id, content: job.content, original: job.original, previewHtml: job.previewHtml })
    }
    if (!worker) {
      worker = new MarkdownWorker()
      const createdWorker = worker
      worker.onmessage = event => {
        if (worker !== createdWorker) return
        if (event.data.ready) {
          if (workerReady || running !== job) return
          clearTimeout(deadline)
          workerReady = true
          submit()
          return
        }
        const current = running
        if (!current || event.data.id !== current.id) return
        clearTimeout(deadline)
        running = undefined
        accept(current, event.data.output)
        next()
      }
      worker.onerror = () => {
        if (worker !== createdWorker) return
        const current = running
        running = undefined
        stopWorker()
        if (current) accept(current, { kind: 'source', reason: 'worker' })
        next()
      }
      // Slow devices must not spend the parse budget importing the parser and
      // highlighter. Bootstrap is independently bounded and shared by all views.
      deadline = setTimeout(() => {
        running = undefined
        stopWorker()
        accept(job, { kind: 'source', reason: 'startup' })
        next()
      }, 5000)
      worker.postMessage({ type: 'init' })
    } else if (workerReady) submit()
  } catch {
    running = undefined
    stopWorker()
    accept(job, { kind: 'source', reason: 'unavailable' })
    next()
  }
}

/** One worker, one running job and at most one pending version per live view. */
export function createMarkdownOutputClient() {
  const owner = Symbol('markdown-view')
  owners.add(owner)
  const cancel = () => {
    queue.delete(owner)
    if (running?.owner === owner) { running = undefined; stopWorker(); next() }
  }
  return {
    request(content: string, done: Job['done'], original?: string, previewHtml = false) {
      cancel()
      const budget = previewHtml && original === undefined && (content.length <= MARKDOWN_SOURCE_BUDGET || hasHtmlPreviewHint(content))
        ? MARKDOWN_PREVIEW_INPUT_BUDGET : MARKDOWN_SOURCE_BUDGET
      if (content.length + (original?.length ?? 0) > budget || typeof Worker === 'undefined') {
        leases.delete(owner)
        previewLeases.delete(owner)
        done({ kind: 'source', reason: 'size-or-worker' })
        return
      }
      if (queue.size >= 8) {
        leases.delete(owner)
        previewLeases.delete(owner)
        done({ kind: 'source', reason: 'queue' })
        return
      }
      queue.set(owner, { id: ++sequence, owner, content, original, previewHtml, done })
      next()
    },
    requestDiff(original: string, content: string, done: Job['done']) { this.request(content, done, original) },
    cancel,
    release() { cancel(); leases.delete(owner); previewLeases.delete(owner) },
    dispose() {
      owners.delete(owner)
      leases.delete(owner)
      previewLeases.delete(owner)
      cancel()
      if (!owners.size) stopWorker()
    },
  }
}
