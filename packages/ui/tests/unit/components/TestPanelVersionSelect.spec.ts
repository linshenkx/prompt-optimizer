import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { NPopover, NSelect } from 'naive-ui'
import TestPanelVersionSelect from '../../../src/components/TestPanelVersionSelect.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(w => w.unmount())
  vi.restoreAllMocks()
})

describe('prompt source selector', () => {
  const options = [
    { value: 0, label: 'Original', fullLabel: 'Original' },
    { value: 'workspace', label: 'Workspace', fullLabel: 'Workspace (v2)' },
  ]

  it('previews the current content without changing source, and excludes an open menu', async () => {
    let content = 'Original source content'
    const wrapper = mount(TestPanelVersionSelect, { props: {
      value: 0, options, previewSource: () => ({ content }),
    } })
    wrappers.push(wrapper)
    const popover = wrapper.getComponent(NPopover)
    popover.vm.$emit('update:show', true)
    await flushPromises()
    expect(wrapper.text()).toContain(content)
    await wrapper.setProps({ previewSource: () => ({ content: '' }) })
    await flushPromises()
    expect(wrapper.text()).toContain('This source has no prompt yet.')
    expect(wrapper.emitted('update:value')).toBeUndefined()
    expect(wrapper.emitted('preview')).toBeUndefined()
    wrapper.getComponent(NSelect).vm.$emit('update:show', true)
    await wrapper.vm.$nextTick()
    expect(popover.props('show')).toBe(false)
    expect(popover.props('disabled')).toBe(true)
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'workspace')
    expect(wrapper.emitted('update:value')).toEqual([['workspace']])
    content = 'Workspace source content'
    await wrapper.setProps({ value: 'workspace', previewSource: () => ({ content }) })
    wrapper.getComponent(NSelect).vm.$emit('update:show', false)
    popover.vm.$emit('update:show', true)
    await flushPromises()
    expect(wrapper.text()).toContain(content)
  })

  it('offers full reading from the menu without changing the selected source', async () => {
    const wrapper = mount(TestPanelVersionSelect, { props: {
      value: 0, options, previewSource: () => ({ content: 'Source' }),
    } })
    wrappers.push(wrapper)
    wrapper.getComponent(NSelect).vm.$emit('update:show', true)
    await flushPromises()
    const button = wrapper.findAll('button').find(b => b.text().includes('View prompt'))
    expect(button).toBeDefined()
    await button!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('preview')).toEqual([[]])
    expect(wrapper.emitted('update:value')).toBeUndefined()
    expect(wrapper.getComponent(NSelect).props('show')).toBe(false)
    expect(wrapper.getComponent(NPopover).props('show')).toBe(false)
  })

  it('only offers full reading when the rendered preview is clipped', async () => {
    // jsdom has no layout; keep measurements valid when Naive UI remounts the popover.
    let measuredHeight = 240
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => measuredHeight)
    const wrapper = mount(TestPanelVersionSelect, { props: {
      value: 0, options, previewSource: () => ({ content: 'Short source' }),
    } })
    wrappers.push(wrapper)
    wrapper.getComponent(NPopover).vm.$emit('update:show', true)
    await flushPromises()
    await wrapper.setProps({ previewSource: () => ({ content: 'Fits completely' }) })
    await flushPromises()
    expect(wrapper.find('.source-hover-preview__full').exists()).toBe(false)
    measuredHeight = 600
    await wrapper.setProps({ previewSource: () => ({ content: 'Long source'.repeat(80) }) })
    await flushPromises()
    expect(wrapper.find('.source-hover-preview__full').exists()).toBe(true)
    measuredHeight = 100
    await wrapper.setProps({ previewSource: () => ({ content: 'Short again' }) })
    await flushPromises()
    expect(wrapper.find('.source-hover-preview__full').exists()).toBe(false)
  })
})
