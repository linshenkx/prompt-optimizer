import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { buildHtmlPreviewContent, buildHtmlPreviewDocument, extractHtmlCandidate, htmlSourceAsMarkdown } from '../../../src/utils/html-preview'
import { mount } from '@vue/test-utils'
import MarkdownRenderer from '../../../src/components/MarkdownRenderer.vue'
import { prepareMarkdownOutput } from '../../../src/utils/markdown-output'
import { installMarkdownWorker } from '../support/markdown-worker'
import { runInNewContext } from 'node:vm'

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
    const child = document.querySelector('iframe')?.getAttribute('srcdoc') || ''
    expect(child).toBe(buildHtmlPreviewContent(html, ''))
    expect(child.replace(/<script data-preview-monitor>[\s\S]*?<\/script>/u, '')).toBe(html)
    expect(document.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts')
    expect(document.querySelector('meta[http-equiv]')?.getAttribute('content')).toContain('connect-src https: http: wss: ws:')
    expect(document.querySelectorAll('script')).toHaveLength(1)
  })

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><circle cx="700" cy="200" r="40"/></svg>',
    '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><path d="M0 0L800 400"/></svg>',
  ])('previews raw SVG and explicit SVG fences through the shared isolated renderer: %s', svg => {
    const fence = String.fromCharCode(96).repeat(3)
    for (const source of [svg, 'Here is the image:\n' + fence + 'svg\n' + svg + '\n' + fence]) {
      expect(extractHtmlCandidate(source)).toBe(svg)
      const result = prepareMarkdownOutput(source, true)
      expect(result.kind).toBe('html')
      if (result.kind !== 'html') throw new Error('Expected SVG preview')
      expect(result.previews?.map(preview => ({ ...preview, html: preview.html.trim() }))).toEqual([{ id: 0, html: svg }])
      expect(result.html).not.toContain('<svg')
    }
    const child = new DOMParser().parseFromString(buildHtmlPreviewContent(svg, 'svg-test'), 'text/html')
    expect(child.querySelector('svg')).not.toBeNull()
    expect(child.querySelector('style')?.textContent).toContain('width:100%;height:100%')
  })

  it('keeps XML examples and mislabeled SVG fences inert', () => {
    const fence = String.fromCharCode(96).repeat(3)
    for (const source of [fence + 'xml\n<svg><script>alert(1)</script></svg>\n' + fence, fence + 'svg\n<html><script>alert(1)</script></html>\n' + fence]) {
      expect(extractHtmlCandidate(source)).toBe('')
      const result = prepareMarkdownOutput(source, true)
      if (result.kind !== 'html') throw new Error('Expected literal code')
      expect(result.previews).toBeUndefined()
    }
  })

  it.each(['error', 'unhandledrejection', 'resource'])('reports a bounded first %s before generated scripts run', kind => {
    const source = '<!doctype html><html><head><script type="module">import "missing-module";</script></head><body></body></html>'
    const child = new DOMParser().parseFromString(buildHtmlPreviewContent(source, 'run-1'), 'text/html')
    const scripts = child.querySelectorAll('script')
    expect(scripts[0].hasAttribute('data-preview-monitor')).toBe(true)
    expect(scripts[1].textContent).toBe('import "missing-module";')
    const listeners = new Map<string, (event: unknown) => void>()
    const postMessage = vi.fn()
    runInNewContext(scripts[0].textContent!, {
      ErrorEvent,
      parent: { postMessage },
      window: { addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn) },
    })
    if (kind === 'error') listeners.get('error')!(new ErrorEvent('error', { message: 'x'.repeat(3000) }))
    else if (kind === 'unhandledrejection') listeners.get(kind)!({ reason: new Error('Module rejected') })
    else listeners.get('error')!({ target: { tagName: 'SCRIPT', src: 'https://example.com/missing.js' } })
    expect(postMessage).toHaveBeenCalledOnce()
    expect(postMessage.mock.calls[0][0]).toMatchObject({ id: 'run-1', type: 'prompt-optimizer:preview-error' })
    expect(postMessage.mock.calls[0][0].message.length).toBeLessThanOrEqual(2000)
    listeners.get('error')!(new ErrorEvent('error', { message: 'Repeated error' }))
    expect(postMessage).toHaveBeenCalledOnce()
  })
})
