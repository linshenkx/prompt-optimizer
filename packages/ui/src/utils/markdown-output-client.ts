import type { MarkdownOutput } from './markdown-output'
import MarkdownWorker from './markdown-output.worker?worker&inline'

type Job = { id: number; owner: symbol; content: string; original?: string; done: (output: MarkdownOutput) => void }
const queue = new Map<symbol, Job>()
const owners = new Set<symbol>()
const leases = new Map<symbol, number>()
let worker: Worker | undefined
let running: Job | undefined
let deadline: ReturnType<typeof setTimeout> | undefined
let sequence = 0

function stopWorker() { clearTimeout(deadline); worker?.terminate(); worker = undefined }
function accept(job: Job, output: MarkdownOutput) {
  if (!owners.has(job.owner)) return
  const otherNodes = [...leases.entries()].reduce((sum, [owner, nodes]) => sum + (owner === job.owner ? 0 : nodes), 0)
  if (output.kind !== 'source' && otherNodes + output.nodes > 6000) output = { kind: 'source', reason: 'total-nodes' }
  if (output.kind !== 'source') leases.set(job.owner, output.nodes)
  else leases.delete(job.owner)
  job.done(output)
}
function next() {
  if (running || !queue.size) return
  const job = queue.values().next().value as Job
  queue.delete(job.owner)
  running = job
  try {
    if (!worker) {
      worker = new MarkdownWorker()
      worker.onmessage = event => {
        const current = running
        if (!current || event.data.id !== current.id) return
        clearTimeout(deadline)
        running = undefined
        accept(current, event.data.output)
        next()
      }
      worker.onerror = () => {
        const current = running
        running = undefined
        stopWorker()
        if (current) accept(current, { kind: 'source', reason: 'worker' })
        next()
      }
    }
    deadline = setTimeout(() => {
      running = undefined
      stopWorker()
      accept(job, { kind: 'source', reason: 'deadline' })
      next()
    }, 1500)
    worker.postMessage({ id: job.id, content: job.content, original: job.original })
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
    request(content: string, done: Job['done'], original?: string) {
      cancel()
      if (content.length + (original?.length ?? 0) > 64 * 1024 || typeof Worker === 'undefined') {
        leases.delete(owner)
        done({ kind: 'source', reason: 'size-or-worker' })
        return
      }
      if (queue.size >= 8) {
        leases.delete(owner)
        done({ kind: 'source', reason: 'queue' })
        return
      }
      queue.set(owner, { id: ++sequence, owner, content, original, done })
      next()
    },
    requestDiff(original: string, content: string, done: Job['done']) { this.request(content, done, original) },
    cancel,
    dispose() {
      owners.delete(owner)
      leases.delete(owner)
      cancel()
      if (!owners.size) stopWorker()
    },
  }
}
