import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceLayout } from '../../../src/composables/ui/useWorkspaceLayout'

afterEach(() => vi.unstubAllGlobals())

describe('mobile keyboard viewport', () => {
  it('keeps a save target stationary on blur until the IME actually closes', async () => {
    const viewport = Object.assign(new EventTarget(), { height: 669, scale: 1, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    vi.stubGlobal('innerHeight', 669)
    vi.stubGlobal('innerWidth', 360)
    let layout!: ReturnType<typeof useWorkspaceLayout>
    const wrapper = mount(defineComponent({ setup() {
      layout = useWorkspaceLayout()
      return () => h('input')
    } }), { attachTo: document.body })
    try {
      await nextTick()
      const input = wrapper.element as HTMLInputElement
      input.focus()
      viewport.height = 299
      viewport.dispatchEvent(new Event('resize'))
      expect(layout.keyboardOpen.value).toBe(true)
      expect(layout.keyboardViewportHeight.value).toBe(299)
      input.blur()
      // A pointer click blurs the input before the button receives click.
      expect(layout.keyboardViewportHeight.value).toBe(299)
      viewport.height = 669
      viewport.dispatchEvent(new Event('resize'))
      expect(layout.keyboardOpen.value).toBe(false)
      expect(layout.keyboardViewportHeight.value).toBeUndefined()
    } finally { wrapper.unmount() }
  })

  it('retains browser zoom and tracks keyboard panning without resizing desktop by default', async () => {
    const viewport = Object.assign(new EventTarget(), { height: 669, scale: 1, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    vi.stubGlobal('innerHeight', 669)
    vi.stubGlobal('innerWidth', 1440)
    let layout!: ReturnType<typeof useWorkspaceLayout>
    const wrapper = mount(defineComponent({ setup() {
      layout = useWorkspaceLayout()
      return () => h('textarea')
    } }), { attachTo: document.body })
    try {
      await nextTick()
      expect(layout.isCompact.value).toBe(false)
      expect(layout.keyboardViewportHeight.value).toBeUndefined()
      ;(wrapper.element as HTMLTextAreaElement).focus()
      viewport.height = 300
      viewport.scale = 2
      viewport.dispatchEvent(new Event('resize'))
      expect(layout.keyboardOpen.value).toBe(false)
      expect(layout.keyboardViewportHeight.value).toBeUndefined()
      viewport.scale = 1
      viewport.offsetTop = 18
      viewport.dispatchEvent(new Event('scroll'))
      expect(layout.keyboardViewportTop.value).toBe(18)
      viewport.height = 669
      viewport.dispatchEvent(new Event('resize'))
      expect(layout.keyboardViewportTop.value).toBe(0)
    } finally { wrapper.unmount() }
  })
})
