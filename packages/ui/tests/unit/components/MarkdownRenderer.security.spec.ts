import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownRenderer from '../../../src/components/MarkdownRenderer.vue'

describe('MarkdownRenderer safe content rendering', () => {
  it('retains ordinary formatting, links and code', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        disableInternalScroll: true,
        content: '# Heading\n\n**Important** [docs](https://example.com)\n\n```text\nplain code\n```',
      },
    })

    expect(wrapper.find('h1').text()).toBe('Heading')
    expect(wrapper.find('strong').text()).toBe('Important')
    expect(wrapper.find('a').attributes('href')).toBe('https://example.com')
    expect(wrapper.find('code').text()).toContain('plain code')
    wrapper.unmount()
  })

  it('removes active HTML from model-provided content', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        disableInternalScroll: true,
        content:
          '<img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">unsafe</a>\n\nSafe text',
      },
    })

    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('[onerror]').exists()).toBe(false)
    expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Safe text')
    wrapper.unmount()
  })
})
