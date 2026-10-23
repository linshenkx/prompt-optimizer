import { onScopeDispose, watch, type Ref } from 'vue'
import type { SessionSaveResult } from '../../stores/session/sessionSaveResult'

/**
 * Save mobile edits before the OS can discard a background page. Existing session
 * stores remain the single source of truth; subscriptions do not copy snapshots.
 * The app's pagehide/visibility handlers still provide the final best-effort flush.
 */
export function useCompactSessionAutosave<Key>(options: {
  enabled: Ref<boolean>
  busy: Ref<boolean>
  subscribe: (onChange: (key: Key) => void) => () => void
  save: (key: Key) => Promise<SessionSaveResult>
}) {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  const pending = new Set<Key>()
  let saving = false
  let disposed = false
  let generation = 0
  let idleRevision = 0
  let waitingForIdle = false
  const clearTimers = () => {
    clearTimeout(debounceTimer)
    clearTimeout(maxWaitTimer)
    debounceTimer = undefined
    maxWaitTimer = undefined
  }
  const cancelPending = () => {
    clearTimers()
    pending.clear()
    waitingForIdle = false
    generation++
  }
  const canRun = () => !disposed && options.enabled.value && !options.busy.value
  const save = async () => {
    clearTimers()
    if (!canRun() || saving || !pending.size) return
    saving = true
    const attemptGeneration = generation
    const keys = [...pending]
    pending.clear()
    try {
      for (const [index, key] of keys.entries()) {
        if (generation !== attemptGeneration || !options.enabled.value || disposed) break
        if (options.busy.value) {
          keys.slice(index).forEach(pending.add, pending)
          break
        }
        const attemptIdleRevision = idleRevision
        let result: SessionSaveResult
        try {
          result = await options.save(key)
        } catch (error) {
          console.error('[CompactSessionAutosave] Failed to save mobile edits:', error)
          result = 'failed'
        }
        if (generation !== attemptGeneration || !options.enabled.value || disposed) break
        if (result === 'deferred') {
          keys.slice(index).forEach(pending.add, pending)
          // An idle transition can occur before an awaited status reaches us.
          waitingForIdle = options.busy.value || idleRevision === attemptIdleRevision
          break
        }
        if (result === 'blocked' || result === 'failed') pending.delete(key)
      }
    } finally {
      saving = false
      // An edit whose debounce expired during the write gets one trailing save.
      if (canRun() && pending.size && !waitingForIdle && !debounceTimer && !maxWaitTimer) void save()
    }
  }
  const schedule = (key: Key) => {
    if (disposed || !options.enabled.value) return
    pending.add(key)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => { void save() }, 750)
    maxWaitTimer ??= setTimeout(() => { void save() }, 5000)
  }
  watch(options.busy, busy => {
    if (busy) return
    idleRevision++
    waitingForIdle = false
    if (pending.size && !debounceTimer && !maxWaitTimer) void save()
  }, { flush: 'sync' })
  watch(options.enabled, enabled => {
    unsubscribe?.()
    unsubscribe = undefined
    cancelPending()
    if (enabled) unsubscribe = options.subscribe(schedule)
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    unsubscribe?.()
    cancelPending()
  })
  return { cancelPending }
}
