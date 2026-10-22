import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NModal } from 'naive-ui'
import AdaptiveModal from '../../../src/components/common/AdaptiveModal.vue'

const layout = vi.hoisted(() => ({ compact: null as unknown }))
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({ useWorkspaceLayout: () => ({ isCompact: layout.compact }) }))
vi.mock('../../../src/composables/ui/useCompactModalBack', () => ({ useCompactModalBack: vi.fn() }))

let wrapper: VueWrapper | undefined
let target: HTMLDivElement | undefined
let host: HTMLDivElement | undefined
afterEach(() => {
  wrapper?.unmount()
  target?.remove()
  host?.remove()
})

function createSurface(compact = true) {
  const isCompact = ref(compact)
  layout.compact = isCompact
  target = document.createElement('div')
  host = document.createElement('div')
  document.body.append(target, host)
  return { isCompact, target, host }
}

describe('AdaptiveModal mobile presentation contract', () => {
  it('puts the opt-in hook on the real teleported card and retains its draft when the breakpoint changes', async () => {
    const { isCompact, target, host } = createSurface()
    const mounted = vi.fn()
    const Draft = defineComponent({
      setup() {
        mounted()
        const value = ref('initial')
        return () => h('input', { class: 'draft-probe', value: value.value, onInput: (event: Event) => { value.value = (event.target as HTMLInputElement).value } })
      },
    })
    wrapper = mount(AdaptiveModal, {
      attachTo: host,
      props: { show: true, compactClass: 'business-editor--compact' },
      attrs: { to: target, title: 'Model editor', style: { width: '600px' } },
      slots: { default: () => h(Draft), action: '<button class="save-probe">Save</button>' },
      global: { stubs: { Teleport: false } },
    })
    await flushPromises()
    const card = target.querySelector('.n-card')
    expect(card).not.toBeNull()
    expect(card?.classList.contains('business-editor--compact')).toBe(true)
    expect(card?.classList.contains('adaptive-modal-page')).toBe(true)
    expect(card?.querySelector('.n-card-content .draft-probe')).not.toBeNull()
    expect(card?.querySelector('.save-probe')).not.toBeNull()
    const input = card!.querySelector<HTMLInputElement>('.draft-probe')!
    input.value = 'unsaved mobile draft'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    isCompact.value = false
    await nextTick()
    expect(target.querySelector('.n-card')).toBe(card)
    expect(card?.classList.contains('business-editor--compact')).toBe(false)
    expect(card?.classList.contains('adaptive-modal-page')).toBe(false)
    expect(input.value).toBe('unsaved mobile draft')
    expect(mounted).toHaveBeenCalledOnce()
    isCompact.value = true
    await nextTick()
    expect(card?.classList.contains('business-editor--compact')).toBe(true)
    expect(mounted).toHaveBeenCalledOnce()
  })

  it('keeps existing show events and desktop props intact without leaking compactClass as a DOM attribute', async () => {
    const { target, host } = createSurface(false)
    wrapper = mount(AdaptiveModal, {
      attachTo: host,
      props: { show: true, preset: 'card', compactClass: 'business-editor--compact' },
      attrs: { to: target, title: 'Desktop editor', style: { width: '600px' } },
      slots: { default: '<p>Content</p>' },
      global: { stubs: { Teleport: false } },
    })
    await flushPromises()
    const modal = wrapper.findComponent(NModal)
    expect(modal.props('show')).toBe(true)
    expect(modal.props('preset')).toBe('card')
    expect(target.querySelector('.n-card-header__main')?.textContent).toBe('Desktop editor')
    expect(target.querySelector<HTMLElement>('.n-card')?.style.width).toBe('600px')
    expect(target.querySelector('[compact-class], [compactclass]')).toBeNull()
    expect(target.querySelector('.business-editor--compact')).toBeNull()
    modal.vm.$emit('update:show', false)
    expect(wrapper.emitted('update:show')).toEqual([[false]])
  })
})
