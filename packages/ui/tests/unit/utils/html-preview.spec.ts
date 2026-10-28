import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { buildHtmlPreviewDocument, extractHtmlCandidate, htmlSourceAsMarkdown } from '../../../src/utils/html-preview'
import { mount } from '@vue/test-utils'
import MarkdownRenderer from '../../../src/components/MarkdownRenderer.vue'
import { prepareMarkdownOutput } from '../../../src/utils/markdown-output'
import { installMarkdownWorker } from '../support/markdown-worker'

beforeEach(() => installMarkdownWorker(vi, prepareMarkdownOutput))
afterEach(() => vi.unstubAllGlobals())

describe('HTML preview extraction', () => {
  it.each([
    '<button onclick="this.textContent=123">Run</button>',
    '<input type="range" min="0" max="10">',
    '<canvas width="80" height="40"></canvas>',
  ])('previews standalone inline HTML elements without inserting them into the host: %s', source => {
    const result = prepareMarkdownOutput(source, true)
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') throw new Error('Expected HTML output')
    expect(result.previews).toEqual([{ id: 0, html: source }])
    expect(result.html).toBe('<div data-html-preview-slot="0"></div>\n')
  })

  it.each([
    'Use <button onclick="alert(1)">Run</button> to continue.',
    '<button onclick="alert(1)">Run</button> then continue.',
    '<button onclick="alert(1)">Run</button>\n\n# Explanation',
  ])('keeps inline HTML surrounded by Markdown prose literal: %s', source => {
    const result = prepareMarkdownOutput(source, true)
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') throw new Error('Expected HTML output')
    expect(result.previews).toBeUndefined()
    expect(result.html).not.toContain('<button')
    expect(result.html).toContain('&lt;button')
  })

  it('keeps document styles and markup out of the host, even with Markdown fences inside HTML', () => {
    const source = '<html><head><style>body{display:none}</style></head><body>```\n<style>body{color:red}</style>\n```</body></html>'
    const wrapper = mount(MarkdownRenderer, { props: { content: htmlSourceAsMarkdown(source), disableInternalScroll: true } })
    expect(wrapper.find('style').exists()).toBe(false)
    expect(wrapper.get('pre code').text()).toContain(source)
    wrapper.unmount()
  })
  it.each([
    '<!DOCTYPE html><html><head><style>body{color:red}</style></head><body>Hello</body></html>',
    '<!-- Generated page -->\n<html><body>Hello</body></html>',
    '<div><button onclick="this.textContent=123">Run</button></div>',
  ])('recognizes raw HTML: %s', (html) => {
    expect(extractHtmlCandidate(html)).toBe(html)
  })

  it('extracts a single HTML block surrounded by explanation and other code', () => {
    const html = '<html><body><script>const x = "&<>";</script></body></html>'
    expect(extractHtmlCandidate(`Here is the page:\n\n\`\`\`html\n${html}\n\`\`\`\n\nSave as index.html.`)).toBe(html)
    expect(extractHtmlCandidate(`~~~HTML\n${html}\n~~~~`)).toBe(html)
  })

  it.each([
    '# Markdown\n\nText with <div>an example</div>',
    '<root><item>XML</item></root>',
    '<?xml version="1.0"?><html/>',
    '```xml\n<html><body>XML</body></html>\n```',
    '```text\n```html\n<div>Nested example</div>\n```\n```',
    '```html\n<div>Still streaming</div>',
    '```html\n<div>A</div>\n```\n```html\n<div>B</div>\n```',
  ])('does not offer an ambiguous or non-HTML preview: %s', (content) => {
    expect(extractHtmlCandidate(content)).toBe('')
  })

  it('preserves scripts, head, import maps and special characters exactly in nested srcdoc', () => {
    const html = '<!doctype html><html><head><script type="importmap">{"imports":{"x":"https://example.com/x.js?a=1&b=2"}}</script></head><body><script>const text = \'</head>"&<>\';</script></body></html>'
    const document = new DOMParser().parseFromString(buildHtmlPreviewDocument(html), 'text/html')
    expect(document.querySelector('iframe')?.getAttribute('srcdoc')).toBe(html)
    expect(document.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts')
    expect(document.querySelector('meta[http-equiv]')?.getAttribute('content')).toContain('connect-src https: http: wss: ws:')
    expect(document.querySelectorAll('script')).toHaveLength(0)
  })
})
