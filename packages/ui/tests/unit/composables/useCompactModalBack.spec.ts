import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { releaseCompactOverlayHistory, useCompactModalBack } from '../../../src/composables/ui/useCompactModalBack'

const scopes: ReturnType<typeof effectScope>[] = []
const settle = async () => { await nextTick(); await nextTick() }
const openLayer = () => {
  const show = ref(true)
  const scope = effectScope()
  scopes.push(scope)
  const close = vi.fn(() => { show.value = false })
  scope.run(() => useCompactModalBack(show, ref(true), close))
  return { show, close }
}

afterEach(async () => {
  scopes.splice(0).forEach(scope => scope.stop())
  await settle()
  await vi.waitFor(() => expect(history.state?.compactOverlay).toBeUndefined())
})

describe('compact overlay history', () => {
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
