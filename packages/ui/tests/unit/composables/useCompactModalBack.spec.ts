import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasCompactModalLayers, releaseCompactOverlayHistory, useCompactModalBack } from '../../../src/composables/ui/useCompactModalBack'

const scopes: ReturnType<typeof effectScope>[] = []
const settle = async () => { await nextTick(); await nextTick() }
const openLayer = () => {
  const show = ref(true)
  const scope = effectScope()
  scopes.push(scope)
  const close = vi.fn(() => { show.value = false })
  scope.run(() => useCompactModalBack(show, ref(true), close))
  return { show, close, scope }
}

afterEach(async () => {
  scopes.splice(0).forEach(scope => scope.stop())
  await settle()
  await vi.waitFor(() => expect(history.state?.compactOverlay).toBeUndefined())
})

describe('compact overlay history', () => {
  it('does not add browser history or intercept Back on desktop', async () => {
    history.replaceState({ position: 0 }, '', '/')
    const length = history.length
    const scope = effectScope()
    scopes.push(scope)
    const close = vi.fn()
    scope.run(() => useCompactModalBack(ref(true), ref(false), close))
    await settle()
    expect(history.length).toBe(length)
    expect(hasCompactModalLayers()).toBe(false)
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(close).not.toHaveBeenCalled()
  })

  it('removes an unmounted editor from the stack before the next Back', async () => {
    history.replaceState({ position: 0 }, '', '/')
    const manager = openLayer()
    await settle()
    const editor = openLayer()
    await settle()
    editor.scope.stop()
    await settle()
    expect(hasCompactModalLayers()).toBe(true)
    history.back()
    await vi.waitFor(() => expect(manager.close).toHaveBeenCalledOnce())
    expect(editor.close).not.toHaveBeenCalled()
    await settle()
    expect(hasCompactModalLayers()).toBe(false)
  })

  it('removes its temporary history entry when the final layer unmounts', async () => {
    history.replaceState({ position: 0 }, '', '/')
    const editor = openLayer()
    await settle()
    editor.scope.stop()
    await settle()
    await vi.waitFor(() => expect(history.state?.compactOverlay).toBeUndefined())
    expect(location.pathname).toBe('/')
    expect(editor.close).not.toHaveBeenCalled()
  })

  it('closes only the nested editor on Back, then returns to the workspace', async () => {
    history.replaceState({ position: 0 }, '', '/')
    const manager = openLayer()
    await settle()
    const editor = openLayer()
    await settle()
    history.back()
    await vi.waitFor(() => expect(editor.close).toHaveBeenCalledOnce())
    expect(manager.show.value).toBe(true)
    await settle()
    history.back()
    await vi.waitFor(() => expect(manager.close).toHaveBeenCalledOnce())
  })

  it('finishes closing a menu before navigation so Back cannot undo the new route', async () => {
    history.replaceState({ position: 0 }, '', '/')
    const menu = openLayer()
    await settle()
    menu.show.value = false
    await releaseCompactOverlayHistory()
    history.pushState({ position: 1 }, '', '/favorites')
    await settle()
    expect(location.pathname).toBe('/favorites')
    expect(history.state).toEqual({ position: 1 })
  })

  it('retains a protected form when its parent rejects Back', async () => {
    history.replaceState({ position: 0 }, '', '/')
    const scope = effectScope()
    scopes.push(scope)
    const close = vi.fn()
    scope.run(() => useCompactModalBack(ref(true), ref(true), close))
    await settle()
    history.back()
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
    await settle()
    expect(history.state?.compactOverlay).toBeTruthy()
  })
})
