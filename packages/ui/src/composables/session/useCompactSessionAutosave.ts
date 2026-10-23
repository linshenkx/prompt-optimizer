import { onScopeDispose, watch, type Ref } from 'vue'

/**
 * Save mobile edits before the OS can discard a background page. Existing session
 * stores remain the single source of truth; subscriptions do not copy snapshots.
 * The app's pagehide/visibility handlers still provide the final best-effort flush.
 */
export function useCompactSessionAutosave(options: {
  enabled: Ref<boolean>
  subscribe: (onChange: () => void) => () => void
  save: () => Promise<unknown>
}) {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  const cancelPending = () => {
    clearTimeout(debounceTimer)
    clearTimeout(maxWaitTimer)
    debounceTimer = undefined
    maxWaitTimer = undefined
  }
  const save = () => {
    cancelPending()
    if (!options.enabled.value) return
    void options.save().catch(error => {
      console.error('[CompactSessionAutosave] Failed to save mobile edits:', error)
    })
  }
  const schedule = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(save, 750)
    maxWaitTimer ??= setTimeout(save, 5000)
  }
  watch(options.enabled, enabled => {
    unsubscribe?.()
    unsubscribe = undefined
    cancelPending()
    if (enabled) unsubscribe = options.subscribe(schedule)
  }, { immediate: true })
  onScopeDispose(() => {
    unsubscribe?.()
    cancelPending()
  })
  return { cancelPending }
}
