/** One origin-wide lock order: browser lock, then the local image-maintenance queue. */
const LOCK_NAME = 'prompt-optimizer:workspace-persistence'

const lockManager = (): LockManager | undefined => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' ||
    Boolean((window as Window & { electronAPI?: unknown }).electronAPI)) return undefined
  return navigator.locks
}

export const hasSessionLocks = () => Boolean(lockManager())

export type SessionRestoreRelease = (() => void) & { complete?: () => void }
export const completeSessionRestore = (lease: SessionRestoreRelease | undefined) => lease?.complete?.()

export async function withSessionAccess<T>(job: () => Promise<T>): Promise<T> {
  const locks = lockManager()
  return locks ? await locks.request(LOCK_NAME, { mode: 'shared' }, job) : job()
}

/** Destructive maintenance must also exclude ordinary cross-window image saves. */
export async function withSessionMaintenance<T>(job: () => Promise<T>): Promise<T> {
  const locks = lockManager()
  return locks ? await locks.request(LOCK_NAME, { mode: 'exclusive' }, job) : job()
}

/** Abort cancels a queued request; releasing a granted lease is idempotent. */
export function acquireSessionRestoreLock(signal: AbortSignal): Promise<() => void> {
  const locks = lockManager()
  if (!locks) return Promise.resolve(() => {})
  return new Promise((resolve, reject) => {
    let release!: () => void
    const held = new Promise<void>(done => { release = done })
    void locks.request(LOCK_NAME, { mode: 'exclusive', signal }, async () => {
      resolve(release)
      await held
    }).catch(reject)
  })
}
