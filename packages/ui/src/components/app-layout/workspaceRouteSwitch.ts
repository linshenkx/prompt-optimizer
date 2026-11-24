import type { Ref } from 'vue'
import type { SubModeKey } from '../../stores/session/useSessionManager'

interface WorkspaceRouteSwitchOptions {
  hasRestoredInitialState: Ref<boolean>
  parseSubModeKey: (path: string) => SubModeKey | null
  flushWorkspace: (key: SubModeKey) => Promise<boolean>
  restoreSessionToUI: () => Promise<void>
  onError?: (error: unknown, toPath: string, fromPath: string) => void
}

interface RouteChangeOptions {
  externalDataLoading?: boolean
}

export const createWorkspaceRouteSwitchController = (options: WorkspaceRouteSwitchOptions) => {
  let switchQueue: Promise<void> = Promise.resolve()
  let latest: { toPath: string; fromPath: string; promise: Promise<void> } | undefined
  let currentKey: SubModeKey | null | undefined

  const run = (toPath: string, fromPath: string): Promise<void> => {
    if (!options.hasRestoredInitialState.value) return Promise.resolve()

    if (latest?.toPath === toPath && latest.fromPath === fromPath) return latest.promise
    // The router already points at the destination, so use its previous path on
    // the first transition and record each source before queuing any work.
    const fromKey = currentKey === undefined ? options.parseSubModeKey(fromPath) : currentKey
    const toKey = options.parseSubModeKey(toPath)
    currentKey = toKey
    if (fromKey === toKey) return latest?.promise ?? switchQueue

    const save = fromKey ? switchQueue.then(async () => { await options.flushWorkspace(fromKey) }) : switchQueue
    switchQueue = save.catch(() => {})
    // The displayed workspace can sync its already hydrated state while saving
    // the source. Explicit navigation waits for both before applying external data.
    const sync = toKey ? options.restoreSessionToUI() : undefined
    const promise = Promise.all([save, sync]).then(() => {})
    latest = { toPath, fromPath, promise }
    return promise
  }

  const handleRouteChange = async (
    toPath: string,
    fromPath: string,
    routeChangeOptions: RouteChangeOptions = {},
  ) => {
    if (routeChangeOptions.externalDataLoading) return

    try {
      await run(toPath, fromPath)
    } catch (error) {
      options.onError?.(error, toPath, fromPath)
    }
  }

  return {
    run,
    handleRouteChange,
  }
}
