import type { IImportExportable } from '../../interfaces/import-export'
import type {
  ComparisonListOptions, ComparisonViewer, CompletedTextComparison,
  SavedComparisonResult, SavedComparisonSummary, SavedComparisonV1,
} from './types'
import {
  byteLength, canonical, COMPARISON_RECORD_LIMIT, COMPARISON_STORAGE_LIMIT, ComparisonRepositoryError,
  invalidComparisonData, isSavedComparison, named, object, parseJson, terminal, timestamp, uuid,
} from './validation'

const PREFIX = 'comparison/v1/'
const INDEX_KEY = PREFIX + 'catalog'
const RECORD_PREFIX = PREFIX + 'records/'
const INTENT_PREFIX = PREFIX + 'intents/'
const hashPattern = /^[a-f0-9]{64}$/

interface ComparisonReadStore {
  getItem(key: string): string | null
}
export interface ComparisonTransaction extends ComparisonReadStore {
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export interface ComparisonStorage {
  getItem(key: string): Promise<string | null>
  getEntriesByPrefix(prefix: string): Promise<Array<[string, string]>>
  withWriteTransaction<T>(modify: (store: ComparisonTransaction) => T): Promise<T>
}

interface StoredComparison {
  id: string
  revision: string
  comparison: SavedComparisonV1 | null
}
interface IndexEntry extends SavedComparisonSummary {
  favoriteId: string
  bytes: number
}
interface ComparisonBackup {
  version: 1
  records: StoredComparison[]
  intents: Array<{ hash: string; id: string }>
}

export interface ComparisonRepository extends ComparisonViewer, IImportExportable {
  save(comparison: CompletedTextComparison, saveKey: string): Promise<SavedComparisonResult>
  exportData(): Promise<ComparisonBackup>
}

function parseStored(value: unknown, id?: string): StoredComparison {
  if (!object(value, ['id', 'revision', 'comparison']) || !uuid(value.id) || !uuid(value.revision) ||
    (id !== undefined && id !== value.id) ||
    (value.comparison !== null && (!isSavedComparison(value.comparison) || value.comparison.id !== value.id))) {
    return invalidComparisonData()
  }
  return { id: value.id, revision: value.revision, comparison: value.comparison }
}

function readStored(raw: string | null, id: string): StoredComparison | null {
  return raw === null ? null : parseStored(parseJson(raw), id)
}

function isIndexEntry(value: unknown): value is IndexEntry {
  return object(value, ['id', 'favoriteId', 'title', 'savedAt', 'statuses', 'revision', 'bytes']) &&
    uuid(value.id) && named(value.favoriteId) && named(value.title) && timestamp(value.savedAt) &&
    Array.isArray(value.statuses) && value.statuses.length === 2 && value.statuses.every(terminal) &&
    uuid(value.revision) && timestamp(value.bytes) && value.bytes > 0 && value.bytes <= COMPARISON_RECORD_LIMIT
}

function readCatalog(raw: string | null): IndexEntry[] {
  if (raw === null) return []
  const parsed = parseJson(raw)
  if (!Array.isArray(parsed) || !parsed.every(isIndexEntry) ||
    new Set(parsed.map(item => item.id)).size !== parsed.length) return invalidComparisonData()
  return parsed
}

function indexEntry(record: StoredComparison): IndexEntry | null {
  const { comparison, revision, id } = record
  if (!comparison) return null
  const bytes = byteLength(JSON.stringify(comparison))
  if (bytes > COMPARISON_RECORD_LIMIT) throw new ComparisonRepositoryError('RESULT_STORAGE_LIMIT')
  return {
    id, revision, bytes, favoriteId: comparison.source.favoriteId, title: comparison.source.title,
    savedAt: comparison.savedAt, statuses: [comparison.runs[0].status, comparison.runs[1].status],
  }
}

function checkBudget(catalog: IndexEntry[]) {
  if (catalog.reduce((total, item) => total + item.bytes, 0) > COMPARISON_STORAGE_LIMIT) {
    throw new ComparisonRepositoryError('RESULT_STORAGE_LIMIT')
  }
}

function parseBackup(value: unknown): ComparisonBackup {
  if (!object(value, ['version', 'records', 'intents']) || value.version !== 1 ||
    !Array.isArray(value.records) || !Array.isArray(value.intents)) return invalidComparisonData()
  const records = value.records.map(record => parseStored(record))
  const ids = new Set(records.map(record => record.id))
  if (ids.size !== records.length) return invalidComparisonData()
  const hashes = new Set<string>()
  const intents = value.intents.map(intent => {
    if (!object(intent, ['hash', 'id']) || typeof intent.hash !== 'string' || !hashPattern.test(intent.hash) ||
      !uuid(intent.id) || !ids.has(intent.id) || hashes.has(intent.hash)) return invalidComparisonData()
    hashes.add(intent.hash)
    return { hash: intent.hash, id: intent.id }
  })
  checkBudget(records.flatMap(record => indexEntry(record) ?? []))
  return { version: 1, records, intents }
}

function same(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}

function planImport(store: ComparisonReadStore, backup: ComparisonBackup) {
  const catalog = readCatalog(store.getItem(INDEX_KEY))
  const indexed = new Set(catalog.map(item => item.id))
  const writes: Array<[string, string]> = []
  for (const record of backup.records) {
    const key = RECORD_PREFIX + record.id
    const current = readStored(store.getItem(key), record.id)
    if (current) {
      if (!same(current, record)) throw new ComparisonRepositoryError('IDEMPOTENCY_CONFLICT')
      if (indexed.has(record.id) !== (record.comparison !== null)) return invalidComparisonData()
      continue
    }
    if (indexed.has(record.id)) return invalidComparisonData()
    const summary = indexEntry(record)
    if (summary) catalog.push(summary)
    writes.push([key, JSON.stringify(record)])
  }
  for (const { hash, id } of backup.intents) {
    const key = INTENT_PREFIX + hash
    const current = store.getItem(key)
    if (current !== null && current !== id) throw new ComparisonRepositoryError('IDEMPOTENCY_CONFLICT')
    if (current === null) writes.push([key, id])
  }
  checkBudget(catalog)
  if (writes.length) writes.push([INDEX_KEY, JSON.stringify(catalog)])
  return writes
}

function backupFromSnapshot(snapshot: Array<[string, string]>): ComparisonBackup {
  const records: StoredComparison[] = []
  const intents: ComparisonBackup['intents'] = []
  let catalog: IndexEntry[] = []
  for (const [key, value] of snapshot) {
    if (key === INDEX_KEY) catalog = readCatalog(value)
    else if (key.startsWith(RECORD_PREFIX)) records.push(parseStored(parseJson(value), key.slice(RECORD_PREFIX.length)))
    else if (key.startsWith(INTENT_PREFIX)) intents.push({ hash: key.slice(INTENT_PREFIX.length), id: value })
    else return invalidComparisonData()
  }
  const expected = records.flatMap(record => indexEntry(record) ?? [])
  const ordered = (items: IndexEntry[]) => [...items].sort((a, b) => a.id.localeCompare(b.id))
  if (!same(ordered(catalog), ordered(expected))) return invalidComparisonData()
  return parseBackup({ version: 1, records, intents })
}

function checkId(id: string) {
  if (!uuid(id)) throw new ComparisonRepositoryError('INVALID_INPUT')
}

async function intentHash(key: string): Promise<string> {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(key)) {
    throw new ComparisonRepositoryError('INVALID_INPUT')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function order(a: Pick<IndexEntry, 'savedAt' | 'id'>, b: Pick<IndexEntry, 'savedAt' | 'id'>) {
  return b.savedAt - a.savedAt || a.id.localeCompare(b.id)
}

function listAfter(catalog: IndexEntry[], options: ComparisonListOptions) {
  const limit = options.limit ?? 20
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    (options.favoriteId !== undefined && !named(options.favoriteId))) {
    throw new ComparisonRepositoryError('INVALID_INPUT')
  }
  let cursor: Pick<IndexEntry, 'savedAt' | 'id'> | undefined
  if (options.cursor !== undefined) {
    const parts = typeof options.cursor === 'string' ? /^(0|[1-9][0-9]*)\.([a-f0-9-]+)$/.exec(options.cursor) : null
    if (!parts || !timestamp(Number(parts[1])) || !uuid(parts[2])) throw new ComparisonRepositoryError('INVALID_INPUT')
    cursor = { savedAt: Number(parts[1]), id: parts[2] }
  }
  const sorted = catalog.filter(item => (options.favoriteId === undefined || options.favoriteId === item.favoriteId) &&
    (!cursor || order(item, cursor) > 0)).sort(order)
  const items = sorted.slice(0, limit).map(({ id, title, savedAt, statuses, revision }) => ({ id, title, savedAt, statuses, revision }))
  const last = items[items.length - 1]
  return { items, ...(last && sorted.length > limit ? { nextCursor: `${last.savedAt}.${last.id}` } : {}) }
}

export function createComparisonRepository(storage: ComparisonStorage): ComparisonRepository {
  return {
    async save(completed, saveKey) {
      const currentComparison: SavedComparisonV1 = {
        ...structuredClone(completed), schemaVersion: 'saved-comparison/v1', savedAt: Date.now(),
      }
      if (!isSavedComparison(currentComparison)) return invalidComparisonData()
      if (byteLength(JSON.stringify(currentComparison)) > COMPARISON_RECORD_LIMIT) {
        throw new ComparisonRepositoryError('RESULT_STORAGE_LIMIT')
      }
      const intent = INTENT_PREFIX + await intentHash(saveKey)
      const id = currentComparison.id
      const key = RECORD_PREFIX + id
      return storage.withWriteTransaction(store => {
        const intended = store.getItem(intent)
        if (intended !== null && intended !== id) throw new ComparisonRepositoryError('IDEMPOTENCY_CONFLICT')
        const existing = readStored(store.getItem(key), id)
        if (existing) {
          if (!existing.comparison) throw new ComparisonRepositoryError('COMPARISON_DELETED')
          if (!same(existing.comparison, { ...currentComparison, savedAt: existing.comparison.savedAt })) {
            throw new ComparisonRepositoryError('IDEMPOTENCY_CONFLICT')
          }
          if (intended === null) store.setItem(intent, id)
          return { comparison: existing.comparison, revision: existing.revision }
        }
        const catalog = readCatalog(store.getItem(INDEX_KEY))
        if (intended !== null || catalog.some(item => item.id === id)) return invalidComparisonData()
        const revision = globalThis.crypto.randomUUID()
        const record = { id, revision, comparison: currentComparison }
        catalog.push(indexEntry(record)!)
        checkBudget(catalog)
        store.setItem(key, JSON.stringify(record))
        store.setItem(intent, id)
        store.setItem(INDEX_KEY, JSON.stringify(catalog))
        return { comparison: currentComparison, revision }
      })
    },
    async list(options = {}) {
      if (!object(options, ['limit', 'cursor', 'favoriteId'])) throw new ComparisonRepositoryError('INVALID_INPUT')
      return listAfter(readCatalog(await storage.getItem(INDEX_KEY)), options)
    },
    async get(id) {
      checkId(id)
      const record = readStored(await storage.getItem(RECORD_PREFIX + id), id)
      if (!record?.comparison) throw new ComparisonRepositoryError('COMPARISON_NOT_FOUND')
      return { comparison: record.comparison, revision: record.revision }
    },
    async delete(id, expectedRevision) {
      checkId(id)
      if (!uuid(expectedRevision)) throw new ComparisonRepositoryError('INVALID_INPUT')
      return storage.withWriteTransaction(store => {
        const key = RECORD_PREFIX + id
        const record = readStored(store.getItem(key), id)
        if (!record) throw new ComparisonRepositoryError('COMPARISON_NOT_FOUND')
        if (record.revision !== expectedRevision) throw new ComparisonRepositoryError('REVISION_CONFLICT')
        if (!record.comparison) return { deleted: false, alreadyDeleted: true }
        const catalog = readCatalog(store.getItem(INDEX_KEY))
        if (!catalog.some(item => item.id === id)) return invalidComparisonData()
        store.setItem(key, JSON.stringify({ id, revision: record.revision, comparison: null }))
        store.setItem(INDEX_KEY, JSON.stringify(catalog.filter(item => item.id !== id)))
        return { deleted: true, alreadyDeleted: false }
      })
    },
    async exportData() {
      return backupFromSnapshot(await storage.getEntriesByPrefix(PREFIX))
    },
    async getDataType() { return 'savedComparisons' },
    async validateData(value: unknown) {
      try {
        const backup = parseBackup(value)
        const snapshot = new Map(await storage.getEntriesByPrefix(PREFIX))
        planImport({ getItem: key => snapshot.get(key) ?? null }, backup)
        return true
      } catch (error) {
        if (error instanceof ComparisonRepositoryError) return false
        throw error
      }
    },
    async importData(value: unknown) {
      const backup = parseBackup(value)
      await storage.withWriteTransaction(store => {
        for (const [key, contents] of planImport(store, backup)) store.setItem(key, contents)
      })
    },
  }
}
