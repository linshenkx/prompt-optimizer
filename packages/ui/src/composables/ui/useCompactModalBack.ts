import { nextTick, onScopeDispose, watch, type Ref } from 'vue'

type Layer = { id: symbol; close: () => void }
const layers: Layer[] = []
const marker = `prompt-optimizer:compact-overlay:${Math.random().toString(36).slice(2)}`
let listening = false
let scheduled = false
let returning = false
let overlayUrl = ''

// One same-URL history entry covers the overlay stack. Back closes its top layer;
// a nested editor returns to its list without navigating away from the workspace.
function scheduleSync() {
  if (scheduled || typeof window === 'undefined') return
  scheduled = true
  void nextTick(() => {
    scheduled = false
    if (returning) return
    const ownsEntry = history.state?.compactOverlay === marker
    if (layers.length) {
      overlayUrl = location.href
      if (!ownsEntry) {
        history.pushState({ ...history.state, compactOverlay: marker }, '', location.href)
      }
    } else if (!layers.length && ownsEntry && location.href === overlayUrl) {
      returning = true
      history.back()
    }
  })
}

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('popstate', () => {
    if (returning) {
      returning = false
      scheduleSync()
      return
    }
    if (layers.length && location.href === overlayUrl && history.state?.compactOverlay !== marker) {
      layers.at(-1)?.close()
      // The parent may reject a close to protect an unsaved form.
      scheduleSync()
    }
  })
}

/** Used by the optional app-update checkpoint to preserve protected mobile forms. */
export const hasCompactModalLayers = () => layers.length > 0

/** Finish the overlay's history pop before a router push can add a new page. */
export async function releaseCompactOverlayHistory() {
  if (typeof window === 'undefined' || history.state?.compactOverlay !== marker) return
  returning = true
  await new Promise<void>(resolve => {
    window.addEventListener('popstate', () => resolve(), { once: true })
    history.back()
  })
}

export function useCompactModalBack(show: Ref<boolean | undefined>, compact: Ref<boolean>, close: () => void) {
  const id = Symbol('compact-modal')
  const remove = () => {
    const index = layers.findIndex(layer => layer.id === id)
    if (index !== -1) layers.splice(index, 1)
  }
  watch([show, compact], ([visible, enabled]) => {
    remove()
    if (visible && enabled && typeof window !== 'undefined') {
      listen()
      layers.push({ id, close })
    }
    scheduleSync()
  }, { immediate: true, flush: 'post' })
  onScopeDispose(() => { remove(); scheduleSync() })
}
