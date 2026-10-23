export type AppUpdatePreparationResult = 'ready' | 'busy' | 'save-failed'

/** The host may reload only after this explicit application checkpoint succeeds. */
export function createAppUpdatePreparation(options: {
  isBusy: () => boolean
  flush: () => Promise<boolean>
  subscribeToChanges?: (changed: () => void) => () => void
}) {
  let pending: Promise<AppUpdatePreparationResult> | null = null
  const prepare = async (): Promise<AppUpdatePreparationResult> => {
    if (options.isBusy()) return 'busy'
    let changed = false
    const unsubscribe = options.subscribeToChanges?.(() => { changed = true })
    try {
      if (!await options.flush()) return 'save-failed'
      // Optimization or a protected editor may have opened while storage was pending.
      return changed || options.isBusy() ? 'busy' : 'ready'
    } catch {
      return 'save-failed'
    } finally {
      unsubscribe?.()
    }
  }
  return () => {
    if (!pending) pending = prepare().finally(() => { pending = null })
    return pending
  }
}
