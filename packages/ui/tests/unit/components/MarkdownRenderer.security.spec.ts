import { mount } from '@vue/test-utils'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { prepareMarkdownOutput } from '../../../src/utils/markdown-output'
import { installMarkdownWorker } from '../support/markdown-worker'
import MarkdownRenderer from '../../../src/components/MarkdownRenderer.vue'

beforeEach(() => installMarkdownWorker(vi, prepareMarkdownOutput))
afterEach(() => vi.unstubAllGlobals())

describe('MarkdownRenderer safe content rendering', () => {
  it('preserves literal dollar replacement sequences inside code', () => {
    const code = "currency: $& $' $` CODE_BLOCK_0"
    const wrapper = mount(MarkdownRenderer, {
      props: { disableInternalScroll: true, content: `Before\n\n\`\`\`text\n${code}\n\`\`\`\n\nAfter` },
    })
    try { expect(wrapper.get('pre code').text()).toBe(code) }
    finally { wrapper.unmount() }
  })

  it.each([1, 4, 8, 16, 32, 64])('keeps output proportional for %i code blocks with dollar/backtick text', (count) => {
    const code = 'currency: $`'
    const content = 'Explanation\n\n' + (`\`\`\`text\n${code}\n\`\`\`\n\n`).repeat(count)
    const wrapper = mount(MarkdownRenderer, { props: { disableInternalScroll: true, content } })
    try {
      expect(wrapper.findAll('pre code').map(block => block.text())).toEqual(Array(count).fill(code))
      expect(wrapper.element.querySelectorAll('*').length).toBeLessThan(count * 5 + 4)
    } finally { wrapper.unmount() }
  })

  it('preserves blank lines and indentation inside code instead of normalizing source whitespace', () => {
    const code = '  first\n\n\n\n    second'
    const wrapper = mount(MarkdownRenderer, {
      props: { disableInternalScroll: true, content: `\`\`\`text\n${code}\n\`\`\`` },
    })
    try { expect(wrapper.get('pre code').element.textContent).toBe(code + '\n') }
    finally { wrapper.unmount() }
  })

  it('keeps long generated SVG code complete without constructing a highlighted DOM tree', () => {
    const code = '<svg>\n' + '<path d="M1 2 L30 40" fill="red"/>\n'.repeat(1000) + '</svg>'
    const wrapper = mount(MarkdownRenderer, {
      props: { disableInternalScroll: true, content: `\`\`\`html\n${code}\n\`\`\`` },
    })
    expect(wrapper.get('pre code').text()).toBe(code)
    expect(wrapper.find('pre code span').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(false)
    wrapper.unmount()
  })

  it('escapes unknown-language code and avoids highlighting while streaming', () => {
    for (const props of [
      { content: '```unknown-language\n<style>body{display:none}</style>\n```' },
      { content: '```html\n<style>body{display:none}</style>\n```', streaming: true },
    ]) {
      const wrapper = mount(MarkdownRenderer, { props: { ...props, disableInternalScroll: true } })
      if (props.streaming) expect(wrapper.getComponent({ name: 'OutputSourceView' }).props('content')).toBe(props.content)
      else expect(wrapper.get('pre code').text()).toContain('<style>body{display:none}</style>')
      expect(wrapper.find('style').exists()).toBe(false)
      expect(wrapper.find('pre code span').exists()).toBe(false)
      wrapper.unmount()
    }
  })

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
