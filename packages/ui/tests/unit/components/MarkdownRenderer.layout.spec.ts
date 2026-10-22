import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownRenderer from '../../../src/components/MarkdownRenderer.vue'

describe('MarkdownRenderer responsive reading', () => {
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
