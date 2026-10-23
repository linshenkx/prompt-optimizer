import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceSplit } from '../../../src/composables/ui/useWorkspaceSplit'

afterEach(() => vi.restoreAllMocks())

function createSplit(percent: unknown = 50) {
  const source = reactive({ layout: { percent } })
  const commit = vi.fn((value: number) => { source.layout.percent = value })
  let split!: ReturnType<typeof useWorkspaceSplit>
  const wrapper = mount(defineComponent({ setup() {
    const root = ref<HTMLElement | null>(null)
    split = useWorkspaceSplit({ root, getPercent: () => source.layout.percent, setPercent: commit })
    return () => h('div', { ref: root }, [h('button', {
      onPointerdown: split.onSplitPointerDown, onKeydown: split.onSplitKeydown,
    })])
  } }))
  vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as DOMRect)
  return { wrapper, split, source, commit }
}

describe('workspace split behavior', () => {
  it('reads restored/replaced layout without writing it, and retains valid state for invalid values', async () => {
    const { wrapper, split, source, commit } = createSplit(36.6)
    try {
      expect(split.mainSplitLeftPct.value).toBe(37)
      source.layout = { percent: 20 }
      await nextTick()
      expect(split.mainSplitLeftPct.value).toBe(25)
      source.layout = { percent: 90 }
      await nextTick()
      expect(split.mainSplitLeftPct.value).toBe(50)
      source.layout = { percent: NaN }
      await nextTick()
      expect(split.mainSplitLeftPct.value).toBe(50)
      expect(commit).not.toHaveBeenCalled()
    } finally { wrapper.unmount() }
  })

  it.each(['pointerup', 'pointercancel'])('keeps drag updates local and commits once on %s', async finishEvent => {
    const { wrapper, split, source, commit } = createSplit()
    try {
      wrapper.get('button').element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, bubbles: true }))
      document.dispatchEvent(new MouseEvent('pointermove', { clientX: 200 }))
      expect(split.mainSplitLeftPct.value).toBe(30)
      expect(source.layout.percent).toBe(50)
      expect(commit).not.toHaveBeenCalled()
      document.dispatchEvent(new MouseEvent(finishEvent))
      document.dispatchEvent(new MouseEvent(finishEvent))
      expect(commit).toHaveBeenCalledExactlyOnceWith(30)
      document.dispatchEvent(new MouseEvent('pointermove', { clientX: 500 }))
      expect(split.mainSplitLeftPct.value).toBe(30)
      expect(document.body.style.cursor).toBe('')
      expect(document.body.style.userSelect).toBe('')
    } finally { wrapper.unmount() }
  })

  it('preserves keyboard steps, limits, immediate commits and ignored keys', async () => {
    const { wrapper, split, commit } = createSplit(40)
    try {
      const key = (value: string) => wrapper.get('button').trigger('keydown', { key: value })
      await key('ArrowLeft')
      expect(commit).toHaveBeenLastCalledWith(39)
      await key('Home')
      await key('ArrowLeft')
      expect(split.mainSplitLeftPct.value).toBe(25)
      await key('End')
      await key('ArrowRight')
      expect(split.mainSplitLeftPct.value).toBe(50)
      expect(commit).toHaveBeenCalledTimes(5)
      await key('PageDown')
      expect(commit).toHaveBeenCalledTimes(5)
    } finally { wrapper.unmount() }
  })

  it('commits the last draft on unmount and removes global drag effects', async () => {
    const { wrapper, split, commit } = createSplit()
    wrapper.get('button').element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, bubbles: true }))
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 150 }))
    wrapper.unmount()
    expect(commit).toHaveBeenCalledExactlyOnceWith(25)
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 500 }))
    document.dispatchEvent(new MouseEvent('pointerup'))
    expect(split.mainSplitLeftPct.value).toBe(25)
    expect(commit).toHaveBeenCalledOnce()
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })
})
