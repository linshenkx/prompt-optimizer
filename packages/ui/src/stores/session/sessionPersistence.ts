import type { IPreferenceService } from '@prompt-optimizer/core'
import { withSessionAccess } from './sessionConcurrency'

/** A restore checkpoint alone may write while ordinary session saves are frozen. */
export type SessionWritePermit = symbol

type PersistenceState = {
  pending: Set<Promise<unknown>>
  permit: SessionWritePermit | null
  snapshots: Map<string, unknown>
  writes: Map<string, Promise<unknown>>
  conflicts: Set<string>
  restores: Map<string, RestoreCheckpoint>
}

type RestoreCheckpoint = {
  task: Promise<void>
  removeIfUnchanged?: () => Promise<boolean>
}

// Scope the boundary to the actual storage service, not a second session store.
const states = new WeakMap<IPreferenceService, PersistenceState>()
const getState = (service: IPreferenceService) => {
  let state = states.get(service)
  if (!state) {
    state = { pending: new Set(), permit: null, snapshots: new Map(), writes: new Map(), conflicts: new Set(), restores: new Map() }
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
  const state = getState(service)
  const checkpoint = state.restores.get(key)
  let value: T
  if (checkpoint && service.readSnapshot) {
    // The receipt captures the original raw value even when decoding is rejected
    // by the size limit. It belongs to this restore, never the mutable write baseline.
    const snapshot = await service.readSnapshot(key, fallback)
    checkpoint.removeIfUnchanged = snapshot.removeIfUnchanged
    if (!snapshot.result.ok) throw snapshot.result.error
    value = snapshot.result.value
  } else {
    value = await service.get(key, fallback)
    if (checkpoint && service.compareAndSet) {
      const original = copySnapshot(value)
      checkpoint.removeIfUnchanged = () => service.compareAndSet!(key, original, null)
    }
  }
  if (service.compareAndSet) {
    state.snapshots.set(key, copySnapshot(value))
    state.conflicts.delete(key)
  }
  return value
}

const queueSnapshotCommit = async <T>(state: PersistenceState, key: string, commit: () => Promise<T>): Promise<T> => {
  const previous = state.writes.get(key) ?? Promise.resolve()
  const task = previous.catch(() => {}).then(commit)
  state.writes.set(key, task)
  try { return await task } finally { if (state.writes.get(key) === task) state.writes.delete(key) }
}

/** Keep cleanup tied to one restore attempt; concurrent restores of that key share it. */
export function withSessionRestoreCheckpoint(
  service: IPreferenceService | undefined,
  key: string,
  restore: (cleanup: () => Promise<boolean>) => Promise<void>,
): Promise<void> {
  if (!service) return restore(async () => false)
  const state = getState(service)
  const current = state.restores.get(key)
  if (current) return current.task
  const checkpoint: RestoreCheckpoint = { task: Promise.resolve() }
  const cleanup = () => runSessionWrite(service, () => queueSnapshotCommit(state, key, async () => {
    // Import may have frozen writes while this operation waited for a preceding commit.
    if (state.permit) return false
    if (service.compareAndSet) {
      if (!checkpoint.removeIfUnchanged || !await checkpoint.removeIfUnchanged()) return false
      state.snapshots.set(key, null)
    } else {
      // Electron's existing IPC provider has no atomic snapshot capability.
      await service.delete(key)
    }
    return true
  }))
  checkpoint.task = Promise.resolve().then(() => restore(cleanup)).finally(() => {
    checkpoint.removeIfUnchanged = undefined
    if (state.restores.get(key) === checkpoint) state.restores.delete(key)
  })
  state.restores.set(key, checkpoint)
  return checkpoint.task
}

export async function writeSessionSnapshot<T>(service: IPreferenceService, key: string, value: T): Promise<void> {
  if (!service.compareAndSet) { await service.set(key, value); return }
  const state = getState(service)
  const snapshot = copySnapshot(value)
  await queueSnapshotCommit(state, key, async () => {
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
