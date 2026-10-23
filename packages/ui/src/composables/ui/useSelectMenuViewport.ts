import { computed, nextTick, onScopeDispose, shallowRef, useId, watch, type Ref } from 'vue'

interface VerticalBounds { top: number; bottom: number }
interface VisibleViewport { offsetTop: number; height: number }

/** Naive's follower uses the layout viewport; Android's IME only shrinks visualViewport. */
export function getSelectMenuViewportLayout(
  trigger: VerticalBounds,
  viewport: VisibleViewport,
  chromeHeight = 0,
  preferredPlacement = 'bottom-start',
) {
  // The menu has a 4px vertical margin. Leave another 8px at the visible edge.
  const clearance = 12
  const above = Math.max(0, trigger.top - viewport.offsetTop - clearance)
  const below = Math.max(0, viewport.offsetTop + viewport.height - trigger.bottom - clearance)
  const preferredTop = preferredPlacement.startsWith('top')
  const preferredSpace = preferredTop ? above : below
  const oppositeSpace = preferredTop ? below : above
  const useTop = preferredSpace >= 320 || preferredSpace >= oppositeSpace ? preferredTop : !preferredTop
  const maxHeight = Math.floor(Math.min(320, useTop ? above : below))
  return {
    placement: `${useTop ? 'top' : 'bottom'}-${preferredPlacement.endsWith('end') ? 'end' : 'start'}` as const,
    maxHeight,
    bodyMaxHeight: Math.max(0, maxHeight - Math.ceil(chromeHeight)),
  }
}

export function useSelectMenuViewport(options: {
  show: Ref<boolean>
  isCompact: Ref<boolean>
  getTrigger: () => HTMLElement | null
  getMenu: () => HTMLElement | null
  getPlacement: () => string
}) {
  const layout = shallowRef<ReturnType<typeof getSelectMenuViewportLayout> | null>(null)
  let stop = () => {}

  watch([options.show, options.isCompact], ([show, compact]) => {
    stop()
    layout.value = null
    if (!show || !compact || typeof window === 'undefined') return

    let active = true
    let frame: number | undefined
    const viewport = window.visualViewport
    const update = () => {
      if (!active) return
      const trigger = options.getTrigger()
      // Native pinch-zoom panning should not be treated as a keyboard resize.
      if (!trigger || Math.abs((viewport?.scale ?? 1) - 1) > 0.05) {
        layout.value = null
        return
      }
      const menu = options.getMenu()
      const chromeHeight = Array.from(menu?.children ?? [])
        .filter(child => child.hasAttribute('data-action') || child.hasAttribute('data-header'))
        .reduce((height, child) => height + child.getBoundingClientRect().height, 0)
      layout.value = getSelectMenuViewportLayout(
        trigger.getBoundingClientRect(),
        { offsetTop: viewport?.offsetTop ?? 0, height: viewport?.height ?? window.innerHeight },
        chromeHeight,
        options.getPlacement(),
      )
    }
    const scheduleUpdate = () => {
      if (frame !== undefined) return
      frame = requestAnimationFrame(() => {
        frame = undefined
        update()
      })
    }
    const observer = new ResizeObserver(scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)
    document.addEventListener('scroll', scheduleUpdate, true)
    viewport?.addEventListener('resize', scheduleUpdate)
    viewport?.addEventListener('scroll', scheduleUpdate)
    update()
    void nextTick(() => {
      if (!active) return
      update()
      const trigger = options.getTrigger()
      const menu = options.getMenu()
      if (trigger) observer.observe(trigger)
      if (menu) observer.observe(menu)
    })
    stop = () => {
      if (!active) return
      active = false
      if (frame !== undefined) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      document.removeEventListener('scroll', scheduleUpdate, true)
      viewport?.removeEventListener('resize', scheduleUpdate)
      viewport?.removeEventListener('scroll', scheduleUpdate)
    }
  }, { flush: 'post' })

  onScopeDispose(() => stop())
  const menuStyle = computed(() => layout.value ? {
    // Naive UI 2.44: --n-height caps both its virtual list and regular scrollbar.
    '--n-height': `${layout.value.bodyMaxHeight}px`,
    '--swc-menu-body-height': `${layout.value.bodyMaxHeight}px`,
    maxHeight: `${layout.value.maxHeight}px`,
  } : undefined)
  return { layout, menuStyle }
}

/** Binding for plain form NSelects; no desktop props or duplicated viewport calculations. */
export function useCompactSelectMenu(isCompact: Ref<boolean>, visible: Ref<boolean>) {
  const selectRef = shallowRef<{ $el: HTMLElement } | null>(null)
  const open = shallowRef(false)
  const menuId = `compact-select-menu-${useId()}`
  const viewport = useSelectMenuViewport({
    show: computed(() => open.value && visible.value),
    isCompact,
    getTrigger: () => selectRef.value?.$el ?? null,
    getMenu: () => document.getElementById(menuId),
    getPlacement: () => 'bottom-start',
  })
  // The forms can switch between pill providers and NSelect without discarding their draft.
  watch([visible, isCompact], () => { open.value = false })
  const attrs = computed(() => isCompact.value ? {
    menuProps: { id: menuId, style: viewport.menuStyle.value },
    ...(viewport.layout.value ? { placement: viewport.layout.value.placement } : {}),
  } : {})
  return { selectRef, attrs, onUpdateShow: (show: boolean) => { open.value = show } }
}
