import { mount } from '@vue/test-utils'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { prepareMarkdownOutput } from '../../../src/utils/markdown-output'
import { installMarkdownWorker } from '../support/markdown-worker'
import MarkdownRenderer from '../../../src/components/MarkdownRenderer.vue'

beforeEach(() => installMarkdownWorker(vi, prepareMarkdownOutput))
afterEach(() => vi.unstubAllGlobals())

describe('MarkdownRenderer responsive reading', () => {
  it('returns from a capacity fallback to a complete rich answer', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '**Saved answer**', disableInternalScroll: true },
      global: { stubs: { NScrollbar: { template: '<section><slot /></section>' } } },
    })
    expect(wrapper.get('.markdown-content strong').text()).toBe('Saved answer')
    await wrapper.setProps({ content: 'x'.repeat(70000) })
    expect(wrapper.find('.markdown-content').exists()).toBe(false)
    expect(wrapper.find('[data-testid="output-source-view"]').exists()).toBe(true)
    await wrapper.setProps({ content: '**Restored answer**' })
    await vi.waitFor(() => expect(wrapper.get('.markdown-content strong').text()).toBe('Restored answer'))
    wrapper.unmount()
  })
  it('keeps an unchanged answer visible when switching between page and panel scrolling', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '**Saved answer**', disableInternalScroll: true },
      global: { stubs: { NScrollbar: { template: '<section><slot /></section>' } } },
    })
    expect(wrapper.get('.markdown-content strong').text()).toBe('Saved answer')
    await wrapper.setProps({ disableInternalScroll: false })
    expect(wrapper.get('.markdown-content strong').text()).toBe('Saved answer')
    await wrapper.setProps({ disableInternalScroll: true })
    expect(wrapper.get('.markdown-content strong').text()).toBe('Saved answer')
    wrapper.unmount()
  })
})
