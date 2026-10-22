import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSelectMenuViewportLayout, useSelectMenuViewport } from '../../../src/composables/ui/useSelectMenuViewport'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('select menu visible viewport geometry', () => {
  it('fits the reported Android keyboard viewport, including the configuration footer', () => {
    const layout = getSelectMenuViewportLayout({ top: 225, bottom: 257 }, { offsetTop: 0, height: 299 }, 64)
    expect(layout).toEqual({ placement: 'top-start', maxHeight: 213, bodyMaxHeight: 149 })
    // Three 64px rows remain scrollable instead of putting the third row behind the IME.
    expect(layout.bodyMaxHeight).toBeLessThan(3 * 64)
    expect(225 - layout.maxHeight - 4).toBeGreaterThanOrEqual(8)
  })

  it('accounts for browser viewport panning and preserves horizontal alignment', () => {
    const layout = getSelectMenuViewportLayout({ top: 420, bottom: 452 }, { offsetTop: 200, height: 299 }, 64, 'bottom-end')
    expect(layout).toEqual({ placement: 'top-end', maxHeight: 208, bodyMaxHeight: 144 })
    expect(420 - layout.maxHeight - 4).toBeGreaterThanOrEqual(200 + 8)
  })

  it('opens downward near the top of the visible screen and stays within its lower edge', () => {
    const layout = getSelectMenuViewportLayout({ top: 40, bottom: 72 }, { offsetTop: 0, height: 299 }, 64)
    expect(layout).toEqual({ placement: 'bottom-start', maxHeight: 215, bodyMaxHeight: 151 })
    expect(72 + 4 + layout.maxHeight).toBeLessThanOrEqual(299 - 8)
  })

  it('caps tall phone menus and never creates a negative scroll height in short viewports', () => {
    expect(getSelectMenuViewportLayout({ top: 100, bottom: 132 }, { offsetTop: 0, height: 850 }).maxHeight).toBe(320)
    expect(getSelectMenuViewportLayout({ top: 80, bottom: 112 }, { offsetTop: 0, height: 190 }, 100).bodyMaxHeight).toBe(0)
  })
})

function setup(compact = true) {
  const viewport = Object.assign(new EventTarget(), { offsetTop: 0, height: 669, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  const trigger = document.createElement('div')
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ top: 225, bottom: 257 } as DOMRect)
  const menu = document.createElement('div')
  const footer = document.createElement('div')
  footer.setAttribute('data-action', '')
  vi.spyOn(footer, 'getBoundingClientRect').mockReturnValue({ height: 64 } as DOMRect)
  menu.append(footer)
  const show = ref(false)
  const isCompact = ref(compact)
  const scope = effectScope()
  scopes.push(scope)
  const controller = scope.run(() => useSelectMenuViewport({
    show, isCompact, getTrigger: () => trigger, getMenu: () => menu, getPlacement: () => 'bottom-start',
  }))!
  return { viewport, show, isCompact, controller, scope }
}

describe('open select menu viewport lifecycle', () => {
  it('repositions while the keyboard opens and removes constraints when it closes', async () => {
    const { viewport, show, controller } = setup()
    show.value = true
    await nextTick()
    expect(controller.layout.value?.placement).toBe('bottom-start')
    viewport.height = 299
    viewport.dispatchEvent(new Event('resize'))
    await vi.waitFor(() => expect(controller.layout.value?.placement).toBe('top-start'))
    expect(controller.menuStyle.value?.['--n-height']).toBe('149px')
    viewport.height = 669
    viewport.dispatchEvent(new Event('resize'))
    await vi.waitFor(() => expect(controller.layout.value?.placement).toBe('bottom-start'))
    show.value = false
    await nextTick()
    expect(controller.menuStyle.value).toBeUndefined()
  })

  it('keeps desktop selectors untouched and releases listeners on width changes and disposal', async () => {
    const { viewport, show, isCompact, controller, scope } = setup(false)
    const add = vi.spyOn(viewport, 'addEventListener')
    const remove = vi.spyOn(viewport, 'removeEventListener')
    show.value = true
    await nextTick()
    expect(controller.layout.value).toBeNull()
    expect(add).not.toHaveBeenCalled()
    isCompact.value = true
    await nextTick()
    expect(add).toHaveBeenCalledTimes(2)
    isCompact.value = false
    await nextTick()
    expect(remove).toHaveBeenCalledTimes(2)
    expect(controller.layout.value).toBeNull()
    isCompact.value = true
    await nextTick()
    scope.stop()
    expect(remove).toHaveBeenCalledTimes(4)
  })

  it('does not constrain native pinch zoom as if it were the keyboard', async () => {
    const { viewport, show, controller } = setup()
    viewport.scale = 2
    show.value = true
    await nextTick()
    expect(controller.layout.value).toBeNull()
  })
})
