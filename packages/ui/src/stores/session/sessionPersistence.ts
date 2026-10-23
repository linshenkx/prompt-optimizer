import type { IPreferenceService } from '@prompt-optimizer/core'

/** A restore checkpoint alone may write while ordinary session saves are frozen. */
export type SessionWritePermit = symbol

type PersistenceState = {
  pending: Set<Promise<unknown>>
  permit: SessionWritePermit | null
}

// Scope the boundary to the actual storage service, not a second session store.
const states = new WeakMap<IPreferenceService, PersistenceState>()
const getState = (service: IPreferenceService) => {
  let state = states.get(service)
  if (!state) {
    state = { pending: new Set(), permit: null }
    states.set(service, state)
  }
  return state
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
  const task = job()
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
