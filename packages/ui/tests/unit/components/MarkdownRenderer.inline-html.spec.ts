import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownRenderer from '../../../src/components/MarkdownRenderer.vue'
import { prepareMarkdownOutput } from '../../../src/utils/markdown-output'
import { installMarkdownWorker } from '../support/markdown-worker'

beforeEach(() => installMarkdownWorker(vi, prepareMarkdownOutput))
afterEach(() => vi.unstubAllGlobals())

const page = '<html><body><button onclick="this.textContent=1">0</button></body></html>'
const mixed = `# Before\n\n\`\`\`html\n${page}\n\`\`\`\n\nBetween **both** pages.\n\n~~~html\n${page}\n~~~\n\nAfter.`

describe('inline HTML in Markdown previews', () => {
  it('updates HTML bodies even when Markdown and placeholder markup are unchanged', async () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: mixed, htmlPreviews: true } })
    try {
      await flushPromises()
      await wrapper.setProps({ content: mixed.replaceAll('>0</button>', '>updated</button>') })
      await flushPromises()
      expect(wrapper.findAll('iframe')).toHaveLength(2)
      for (const iframe of wrapper.findAll('iframe')) {
        const outer = new DOMParser().parseFromString(iframe.attributes('srcdoc')!, 'text/html')
        expect(outer.querySelector('iframe')?.getAttribute('srcdoc')).toContain('>updated</button>')
      }
    } finally { wrapper.unmount() }
  })
  it('preserves Markdown and places multiple isolated pages in document order', async () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: mixed, htmlPreviews: true, disableInternalScroll: true } })
    try {
      await flushPromises()
      expect([...wrapper.get('.markdown-content').element.children].map(node => node.tagName)).toEqual(['H1', 'DIV', 'P', 'DIV', 'P'])
      expect(wrapper.findAll('iframe')).toHaveLength(2)
      expect(wrapper.get('strong').text()).toBe('both')
      expect(wrapper.find('script').exists()).toBe(false)
      for (const iframe of wrapper.findAll('iframe')) {
        expect(iframe.attributes('sandbox')).toBe('allow-scripts')
        const outer = new DOMParser().parseFromString(iframe.attributes('srcdoc')!, 'text/html')
        expect(outer.querySelector('iframe')?.getAttribute('srcdoc')).toBe(page + '\n')
      }
      const frames = wrapper.findAll('iframe').map(frame => frame.element)
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()
      expect(wrapper.findAll('iframe').map(frame => frame.element)).toEqual(frames)
    } finally { wrapper.unmount() }
  })

  it('executes no HTML while streaming, suspended, or previewing an incomplete outcome', async () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: mixed, htmlPreviews: true, streaming: true } })
    try {
      expect(wrapper.find('iframe').exists()).toBe(false)
      await wrapper.setProps({ streaming: false })
      await flushPromises()
      expect(wrapper.findAll('iframe')).toHaveLength(2)
      await wrapper.setProps({ suspended: true })
      await flushPromises()
      expect(wrapper.find('iframe').exists()).toBe(false)
      await wrapper.setProps({ suspended: false, htmlPreviews: false })
      await flushPromises()
      expect(wrapper.find('iframe').exists()).toBe(false)
      expect(wrapper.findAll('pre code')).toHaveLength(2)
    } finally { wrapper.unmount() }
  })

  it('disposes inline browsing contexts on source fallback and unmount', async () => {
    const wrapper = mount(MarkdownRenderer, { props: { content: mixed, htmlPreviews: true } })
    await flushPromises()
    const frame = wrapper.get('iframe').element
    await wrapper.setProps({ content: 'x'.repeat(70000) })
    await flushPromises()
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="output-source-view"]').exists()).toBe(true)
    expect(frame.parentNode?.isConnected ?? false).toBe(false)
    wrapper.unmount()
  })
})
