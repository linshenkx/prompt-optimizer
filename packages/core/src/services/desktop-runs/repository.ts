import type { IStorageProvider } from '../storage/types'

export const DESKTOP_RUNS_KEY = 'mcp:runs:v1'
export type DesktopRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted'
export interface DesktopRun {
  id: string
  requestKey: string
  requestHash: string
  ownerId: string
  kind: string
  status: DesktopRunStatus
  createdAt: number
  updatedAt: number
  saved: boolean
  input: unknown
  output?: unknown
  partial?: string
  reasoning?: string
  error?: { code: string; message: string }
  cancelRequested?: boolean
  deleted?: boolean
  historyChainId?: string
}

export class DesktopRunRepositoryError extends Error {
  constructor(readonly code: string) { super(`Desktop run storage failed (${code}).`) }
}

export function createDesktopRunRepository(storage: IStorageProvider) {
  const parse = (raw: string | null): DesktopRun[] => {
    if (raw === null) return []
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { throw new DesktopRunRepositoryError('RUN_STORE_INVALID') }
    if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item.id !== 'string' ||
      !item.id || typeof item.requestKey !== 'string' || !item.requestKey || typeof item.requestHash !== 'string' ||
      typeof item.ownerId !== 'string' || typeof item.kind !== 'string' ||
      !['running', 'succeeded', 'failed', 'cancelled', 'interrupted'].includes(item.status) ||
      !Number.isSafeInteger(item.createdAt) || !Number.isSafeInteger(item.updatedAt) || typeof item.saved !== 'boolean' ||
      (item.deleted !== undefined && typeof item.deleted !== 'boolean')) ||
      new Set(parsed.map(item => item.id)).size !== parsed.length ||
      new Set(parsed.map(item => item.requestKey)).size !== parsed.length) {
      throw new DesktopRunRepositoryError('RUN_STORE_INVALID')
    }
    return parsed as DesktopRun[]
  }
  const list = async () => parse(await storage.getItem(DESKTOP_RUNS_KEY))
  const change = async <Result>(modifier: (runs: DesktopRun[]) => Result): Promise<Result> => {
    if (!storage.compareAndSetItem) throw new DesktopRunRepositoryError('ATOMIC_STORAGE_REQUIRED')
    for (let attempt = 0; attempt < 12; attempt++) {
      const original = await storage.getItem(DESKTOP_RUNS_KEY)
      const runs = parse(original)
      const result = modifier(runs)
      const value = JSON.stringify(runs)
      parse(value)
      if (value.length > 32 * 1024 * 1024) throw new DesktopRunRepositoryError('RUN_STORE_FULL')
      if (await storage.compareAndSetItem(DESKTOP_RUNS_KEY, original, value)) return result
    }
    throw new DesktopRunRepositoryError('RUN_STORE_CONFLICT')
  }
  return {
    list,
    async get(id: string): Promise<DesktopRun> {
      const run = (await list()).find(item => item.id === id)
      if (!run || run.deleted) throw new DesktopRunRepositoryError('RUN_NOT_FOUND')
      return run
    },
    create: (run: DesktopRun) => change(runs => {
      const previous = runs.find(item => item.requestKey === run.requestKey)
      if (previous) {
        if (previous.deleted) throw new DesktopRunRepositoryError('RUN_DELETED')
        if (previous.requestHash !== run.requestHash) throw new DesktopRunRepositoryError('REQUEST_KEY_REUSED')
        return previous
      }
      if (runs.filter(item => !item.deleted).length >= 200) throw new DesktopRunRepositoryError('RUN_STORE_FULL')
      if (runs.filter(item => item.status === 'running').length >= 4) throw new DesktopRunRepositoryError('RUN_CAPACITY_REACHED')
      runs.push(run)
      return run
    }),
    update: (id: string, updates: Partial<DesktopRun>) => change(runs => {
      const run = runs.find(item => item.id === id)
      if (!run) throw new DesktopRunRepositoryError('RUN_NOT_FOUND')
      if (run.deleted) throw new DesktopRunRepositoryError('RUN_DELETED')
      Object.assign(run, updates, { id, updatedAt: Math.max(Date.now(), run.updatedAt + 1) })
      return run
    }),
    delete: (id: string, expectedUpdatedAt: number) => change(runs => {
      const position = runs.findIndex(item => item.id === id)
      if (position < 0) return
      if (runs[position].status === 'running') throw new DesktopRunRepositoryError('RUN_ACTIVE')
      if (runs[position].updatedAt !== expectedUpdatedAt) throw new DesktopRunRepositoryError('REVISION_CONFLICT')
      const run = runs[position]
      runs[position] = { id: run.id, requestKey: run.requestKey, requestHash: run.requestHash, ownerId: run.ownerId,
        kind: run.kind, status: run.status, createdAt: run.createdAt, updatedAt: Date.now(), saved: false, input: null, deleted: true }
    }),
    async exportData() {
      return { version: 1, runs: (await list()).filter(run => run.deleted || (run.saved && run.status !== 'running')) }
    },
    async getDataType() { return 'desktopRuns' },
    async validateData(data: unknown) {
      try { merge(await list(), data); return true } catch { return false }
    },
    async importData(data: unknown) {
      await change(runs => { const merged = merge(runs, data); runs.splice(0, runs.length, ...merged) })
    },
  }
  function merge(current: DesktopRun[], data: unknown): DesktopRun[] {
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
      (data as { version?: unknown }).version !== 1 || Object.keys(data).some(key => !['version', 'runs'].includes(key))) {
      throw new DesktopRunRepositoryError('RUN_BACKUP_INVALID')
    }
    const incoming = parse(JSON.stringify((data as { runs?: unknown }).runs ?? null))
    const merged = current.slice()
    for (const run of incoming) {
      if (run.status === 'running' || (!run.deleted && !run.saved)) throw new DesktopRunRepositoryError('RUN_BACKUP_INVALID')
      const previous = merged.find(item => item.id === run.id || item.requestKey === run.requestKey)
      if (previous && JSON.stringify(previous) !== JSON.stringify(run)) throw new DesktopRunRepositoryError('RUN_IMPORT_CONFLICT')
      if (!previous) merged.push(run)
    }
    if (merged.filter(run => !run.deleted).length > 200 || JSON.stringify(merged).length > 32 * 1024 * 1024) {
      throw new DesktopRunRepositoryError('RUN_STORE_FULL')
    }
    return merged
  }
}

export type DesktopRunRepository = ReturnType<typeof createDesktopRunRepository>
