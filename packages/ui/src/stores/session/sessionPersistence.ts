import type { IPreferenceService } from '@prompt-optimizer/core'
import { withSessionAccess } from './sessionConcurrency'

/** A restore checkpoint alone may write while ordinary session saves are frozen. */
export type SessionWritePermit = symbol

type PersistenceState = {
  pending: Set<Promise<unknown>>
  permit: SessionWritePermit | null
  snapshots: Map<string, unknown>
  writes: Map<string, Promise<void>>
  conflicts: Set<string>
}

// Scope the boundary to the actual storage service, not a second session store.
const states = new WeakMap<IPreferenceService, PersistenceState>()
const getState = (service: IPreferenceService) => {
  let state = states.get(service)
  if (!state) {
    state = { pending: new Set(), permit: null, snapshots: new Map(), writes: new Map(), conflicts: new Set() }
    states.set(service, state)
  }
  return state
}

export const SESSION_CONFLICT_EVENT = 'prompt-optimizer:session-conflict'
const copySnapshot = <T>(value: T): T => value == null ? value : JSON.parse(JSON.stringify(value))
const comparableSnapshot = (value: unknown): string => {
  let snapshot = value
  if (typeof snapshot === 'string') {
    try { snapshot = JSON.parse(snapshot) } catch { /* Compare legacy strings as stored. */ }
  }
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const content = { ...snapshot as Record<string, unknown> }
    delete content.lastActiveAt
    snapshot = content
  }
  return JSON.stringify(snapshot, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
}

export const hasSessionConflicts = (service: IPreferenceService | undefined) =>
  service ? getState(service).conflicts.size > 0 : false

export const hasSessionConflict = (service: IPreferenceService | undefined, key: string) =>
  service ? getState(service).conflicts.has(key) : false

/** Only an explicit store hydration establishes a new baseline; GC/export reads do not. */
export async function readSessionSnapshot<T>(service: IPreferenceService, key: string, fallback: T): Promise<T> {
  const value = await service.get(key, fallback)
  if (service.compareAndSet) {
    const state = getState(service)
    state.snapshots.set(key, copySnapshot(value))
    state.conflicts.delete(key)
  }
  return value
}

export async function writeSessionSnapshot<T>(service: IPreferenceService, key: string, value: T): Promise<void> {
  if (!service.compareAndSet) { await service.set(key, value); return }
  const state = getState(service)
  const snapshot = copySnapshot(value)
  const previous = state.writes.get(key) ?? Promise.resolve()
  const task = previous.catch(() => {}).then(async () => {
    const baseline = state.snapshots.get(key) ?? null
    if (!state.conflicts.has(key) && state.snapshots.has(key) && comparableSnapshot(snapshot) === comparableSnapshot(baseline)) {
      // Idle/pagehide saves must not rewrite old content or flag an untouched tab.
      // Keep its original baseline: a later real edit still needs conflict checking.
      return
    }
    if (state.conflicts.has(key) || !await service.compareAndSet!(key, baseline, snapshot)) {
      if (!state.conflicts.has(key)) {
        const current = await service.get(key, null)
        if (comparableSnapshot(current) === comparableSnapshot(snapshot)) {
          state.snapshots.set(key, copySnapshot(current))
          return
        }
      }
      if (!state.conflicts.has(key)) {
        state.conflicts.add(key)
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_CONFLICT_EVENT))
      }
      throw new Error('Session changed in another window; the local draft was retained')
    }
    state.snapshots.set(key, snapshot)
  })
  state.writes.set(key, task)
  try { await task } finally { if (state.writes.get(key) === task) state.writes.delete(key) }
}

/** Every store enters here before starting snapshot or image persistence. */
export async function runSessionWrite(
  service: IPreferenceService | undefined,
  job: () => Promise<boolean | void>,
  permit?: SessionWritePermit,
): Promise<boolean> {
  if (!service) return (await job()) !== false
  const state = getState(service)
  if (state.permit && state.permit !== permit) return false
  const run = async () => state.permit && state.permit !== permit ? false : (await job()) !== false
  // A restore checkpoint already owns the exclusive browser lease.
  const task = state.permit === permit && permit ? run() : withSessionAccess(run)
  state.pending.add(task)
  try {
    return (await task) !== false
  } finally {
    state.pending.delete(task)
  }
}

/** Freeze new writes synchronously; ready drains even direct store saves. */
export function pauseSessionWrites(service: IPreferenceService) {
  const state = getState(service)
  if (state.permit) throw new Error('Session persistence is already paused')
  const permit = Symbol('session-restore-checkpoint')
  state.permit = permit
  return {
    permit,
    ready: Promise.allSettled([...state.pending]).then(() => undefined),
    release: () => {
      if (state.permit === permit) state.permit = null
    },
  }
}
