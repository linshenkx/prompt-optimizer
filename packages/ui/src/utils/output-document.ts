import { Text } from '@codemirror/state'
import { toRaw, shallowRef, unref, reactive, type Ref } from 'vue'

export type OutputRecord = { result: string; reasoning: string; status?: OutputPhase }
export type OutputField = 'result' | 'reasoning'
export type OutputPhase = 'streaming' | 'complete' | 'cancelled' | 'capacity' | 'failed'
export function restoredOutputStatus(value: unknown): { status?: OutputPhase } {
  const status = value === 'streaming' ? 'cancelled' : value
  return ['complete', 'cancelled', 'capacity', 'failed'].includes(status as string) ? { status: status as OutputPhase } : {}
}
export class OutputInterruptedError extends Error {
  constructor(public readonly reason: 'cancelled' | 'capacity') {
    super(`Output ${reason}`)
    this.name = 'OutputInterruptedError'
  }
}
export const isOutputInterrupted = (error: unknown) => error instanceof OutputInterruptedError

// Session snapshots have a 1 MiB storage contract. Reserve room for metadata,
// CAS normalization and asset IDs; concurrent runs share the remaining budget.
const SNAPSHOT_BUDGET = 1024 * 1024 - 16 * 1024
const GLOBAL_LIVE_BUDGET = 8 * 1024 * 1024
const documents = new WeakMap<object, OutputDocument>()
const liveFields = new WeakMap<object, { document: OutputDocument; field: OutputField }>()
export function liveOutputValue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const binding = liveFields.get(value)
  return binding?.document.isLive && binding.document.isCurrent
    ? binding.document.read(binding.field) : undefined
}
type OutputOwner = { $state: object; $subscribe?: (listener: () => void, options: { detached: boolean; flush: 'sync' }) => () => void }
type OutputGroup = { documents: Set<OutputDocument>; slots: Map<string, { id: symbol; document?: OutputDocument }>; baseBytes: number; version: number; dirty?: boolean; stop?: () => void; snapshot?: () => object }
const owners = new WeakMap<object, OutputGroup>()
let globalLiveBytes = 0
let liveDocumentCount = 0
export const getOutputVersion = (owner: object) => owners.get(toRaw(owner))?.version ?? 0
const encoder = new TextEncoder()
const jsonBytes = (text: string) => encoder.encode(JSON.stringify(text)).byteLength - 2

export function getOutputDocument(record: OutputRecord | undefined): OutputDocument | undefined {
  return record ? documents.get(toRaw(record)) : undefined
}

/** Resolve a live record only at an explicit snapshot/copy boundary. */
export function resolveOutputRecord(value: object): object {
  const document = documents.get(toRaw(value))
  return document?.isLive
    ? { ...value, result: document.read('result'), reasoning: document.read('reasoning'), status: document.phase }
    : value
}

export function hasLiveOutput(value: unknown): boolean {
  if (liveOutputValue(value) !== undefined) return true
  const item = unref(value)
  if (!item || typeof item !== 'object') return false
  if (documents.get(toRaw(item))?.isLive) return true
  return Object.values(item).some(hasLiveOutput)
}

function budgetMetadata(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (documents.get(toRaw(value))?.isLive) return { ...value, result: '', reasoning: '' }
  if (Array.isArray(value)) return value.map(budgetMetadata)
  // Raw image payloads are saved as asset IDs by the session stores.
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'testImageB64')
    .map(([key, item]) => [key, budgetMetadata(item)]))
}

/** An append-only text tree. No Vue proxy, DOM, full-prefix writes or token history. */
export class OutputDocument {
  phase: OutputPhase = 'streaming'
  readonly controller = new AbortController()
  private trees: Record<OutputField, Text> = { result: Text.empty, reasoning: Text.empty }
  private pending: Record<OutputField, string[]> = { result: [], reasoning: [] }
  private pendingLength: Record<OutputField, number> = { result: 0, reasoning: 0 }
  private cache: Partial<Record<OutputField, string>> = {}
  private listeners = new Set<() => void>()
  private usedBytes = 0
  private usedMemory = 32 * 1024
  private readonly group: OutputGroup
  private finalized = false
  private readonly identity = Symbol('output-run')
  private readonly boundFields = new Set<object>()
  get isCurrent() { return !this.slot || this.group.slots.get(this.slot)?.id === this.identity }
  get isLive() { return !this.finalized }

  constructor(readonly record: OutputRecord, owner?: OutputOwner, private readonly slot?: string) {
    // Producers may hand us a plain object before Pinia wraps it. Publish the
    // terminal fields through its canonical proxy, including after a remount.
    this.record = reactive(record)
    const key = owner ? toRaw(owner) : toRaw(record)
    this.group = owners.get(key) ?? { documents: new Set(), slots: new Map(), baseBytes: 0, version: 0, snapshot: owner ? () => owner.$state : undefined }
    owners.set(key, this.group)
    if (slot) { this.group.slots.get(slot)?.document?.interrupt(); this.group.slots.set(slot, { id: this.identity, document: this }) }
    this.group.documents.add(this)
    if (!this.group.stop && owner?.$subscribe) this.group.stop = owner.$subscribe(() => { this.group.dirty = true }, { detached: true, flush: 'sync' })
    documents.set(toRaw(record), this)
    this.record.status = 'streaming'
    this.refreshBudget()
    globalLiveBytes += this.usedMemory
    if (++liveDocumentCount > 32 || globalLiveBytes > GLOBAL_LIVE_BUDGET) this.interrupt('capacity')
  }
  private refreshBudget() {
    this.group.baseBytes = this.group.snapshot ? encoder.encode(JSON.stringify(budgetMetadata(this.group.snapshot()))).byteLength : 0
    this.group.dirty = false
  }
  bindField(reference: object, field: OutputField) {
    liveFields.set(reference, { document: this, field })
    this.boundFields.add(reference)
  }

  get length() { return this.size('result') }
  size(field: OutputField) { return this.trees[field].length + this.pendingLength[field] || (this.finalized ? this.record[field].length : 0) }
  private flush(field: OutputField) {
    if (!this.pendingLength[field]) return
    const token = this.pending[field].join('')
    this.pending[field] = []
    this.pendingLength[field] = 0
    this.trees[field] = this.trees[field].append(Text.of(token.split('\n')))
  }
  text(field: OutputField): Text {
    this.flush(field)
    if (this.finalized && !this.trees[field].length && this.record[field]) this.trees[field] = Text.of(this.record[field].split('\n'))
    return this.trees[field]
  }
  read(field: OutputField): string {
    this.flush(field)
    return this.cache[field] ??= this.trees[field].length ? this.trees[field].toString() : this.finalized ? this.record[field] : ''
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size && this.finalized) this.releaseTrees()
    }
  }
  private notify() { for (const listener of this.listeners) listener() }
  private releaseTrees() { this.trees = { result: Text.empty, reasoning: Text.empty }; this.cache = {} }

  append(field: OutputField, token: string) {
    if (this.phase !== 'streaming') throw new OutputInterruptedError(this.phase === 'capacity' ? 'capacity' : 'cancelled')
    if (!token) return
    if (this.group.dirty) this.refreshBudget()
    // Reject oversized chunks before encoding or allocating a document tree.
    const bytes = token.length > SNAPSHOT_BUDGET ? SNAPSHOT_BUDGET + 1 : jsonBytes(token)
    let lineCount = 0
    if (token.length <= SNAPSHOT_BUDGET) for (let index = 0; index < token.length; index++) {
      if (token.charCodeAt(index) === 10 || token.charCodeAt(index) === 13) lineCount++
    }
    const memory = token.length * 2 + lineCount * 16
    const reserved = [...this.group.documents].reduce((sum, item) => sum + item.usedBytes, 0)
    if (this.group.baseBytes + reserved + bytes > SNAPSHOT_BUDGET || globalLiveBytes + memory > GLOBAL_LIVE_BUDGET) {
      this.interrupt('capacity')
      throw new OutputInterruptedError('capacity')
    }
    this.usedBytes += bytes
    this.group.version++
    globalLiveBytes += memory
    this.usedMemory += memory
    this.pending[field].push(token)
    this.pendingLength[field] += token.length
    if (this.pendingLength[field] >= 4096 || this.pending[field].length >= 256) this.flush(field)
    delete this.cache[field]
    this.notify()
  }
  interrupt(reason: 'cancelled' | 'capacity' = 'cancelled') {
    if (this.phase !== 'streaming') return
    this.phase = reason
    this.controller.abort(new OutputInterruptedError(reason))
    this.notify()
  }
  finish(failed = false) {
    if (this.finalized) return
    // Materialize once, then publish a complete/partial record atomically to Pinia.
    this.record.result = this.read('result')
    this.record.reasoning = this.read('reasoning')
    if (this.phase === 'streaming') this.phase = failed ? 'failed' : 'complete'
    this.record.status = this.phase
    globalLiveBytes -= this.usedMemory
    this.usedMemory = 0
    this.usedBytes = 0
    this.group.documents.delete(this)
    this.finalized = true
    if (this.slot && this.isCurrent) this.group.slots.get(this.slot)!.document = undefined
    for (const reference of this.boundFields) if (liveFields.get(reference)?.document === this) liveFields.delete(reference)
    this.boundFields.clear()
    liveDocumentCount--
    this.refreshBudget()
    if (!this.group.documents.size) { this.group.stop?.(); this.group.stop = undefined }
    this.notify()
    this.releaseTrees()
  }
}

export function beginOutputStream(record: OutputRecord, owner?: OutputOwner, slot?: string) {
  const document = new OutputDocument(record, owner, slot)
  return {
    document,
    signal: document.controller.signal,
    onToken: (token: string) => document.append('result', token),
    onReasoningToken: (token: string) => document.append('reasoning', token),
    finish: (failed = false) => document.finish(failed),
  }
}

/** Scalar optimization state uses the same document and checkpoint boundary. */
export function createOutputChannel(result: Ref<string>, reasoning: Ref<string>, owner?: unknown) {
  const outputRecord = shallowRef<OutputRecord>()
  const store = owner && typeof owner === 'object' && '$state' in owner ? owner as { $state: object } : undefined
  return {
    outputRecord,
    begin() {
      const record: OutputRecord = {
        get result() { return result.value }, set result(value) { if (stream.document.isCurrent) result.value = value },
        get reasoning() { return reasoning.value }, set reasoning(value) { if (stream.document.isCurrent) reasoning.value = value },
      }
      const stream = beginOutputStream(record, store, 'optimization')
      outputRecord.value = record
      for (const [field, reference, key] of [['result', result, 'optimizedPrompt'], ['reasoning', reasoning, 'reasoning']] as const) {
        stream.document.bindField(reference, field)
        const storedRef = store && (toRaw(store.$state) as Record<string, unknown>)[key]
        if (storedRef && typeof storedRef === 'object') stream.document.bindField(storedRef, field)
      }
      return stream
    },
  }
}
