import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import HtmlPreview from '../../../src/components/HtmlPreview.vue'
import { HTML_PREVIEW_HOST_KEY, HTML_PREVIEW_CSP } from '../../../src/utils/html-preview'
import { MARKDOWN_PREVIEW_INPUT_BUDGET } from '../../../src/utils/markdown-output-limits'

const hostFile = readFileSync(resolve(__dirname, '../../../../extension/public/html-preview.html'), 'utf8')

describe('packaged HTML preview host', () => {
  it('keeps Web/desktop on srcdoc and the extension on its declared host', async () => {
    const web = mount(HtmlPreview, { props: { html: '<h1>Web</h1>' } })
    expect(web.get('iframe').attributes('src')).toBeUndefined()
    expect(web.get('iframe').attributes('srcdoc')).toContain('&lt;h1&gt;Web&lt;/h1&gt;')
    web.unmount()

    const extension = mount(HtmlPreview, {
      props: { html: '<h1>Before load</h1>' }, attachTo: document.body,
      global: { provide: { [HTML_PREVIEW_HOST_KEY as symbol]: 'https://extension.test/html-preview.html' } },
    })
    const frame = extension.get('iframe')
    const post = vi.spyOn((frame.element as HTMLIFrameElement).contentWindow!, 'postMessage')
    expect(frame.attributes('srcdoc')).toBeUndefined()
    expect(frame.attributes('sandbox')).toBe('allow-scripts')
    await extension.setProps({ html: '<h1>Latest</h1>' })
    expect(post).not.toHaveBeenCalled()
    await frame.trigger('load')
    expect(post).toHaveBeenLastCalledWith({ type: 'prompt-optimizer:render-html', html: '<h1>Latest</h1>' }, '*')
    await extension.setProps({ html: '<h1>Replacement</h1>' })
    expect(post).toHaveBeenLastCalledWith({ type: 'prompt-optimizer:render-html', html: '<h1>Replacement</h1>' }, '*')
    expect(post).toHaveBeenCalledTimes(2)
    extension.unmount()
  })

  it('keeps extension and Web resource restrictions aligned without relaxing extension pages', () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../../../extension/public/manifest.json'), 'utf8'))
    expect(manifest.sandbox.pages).toContain('html-preview.html')
    expect(manifest.content_security_policy.sandbox).toBe(`sandbox allow-scripts; ${HTML_PREVIEW_CSP}`)
    expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self';")
    const doc = new DOMParser().parseFromString(hostFile, 'text/html')
    expect(doc.querySelector('meta[http-equiv]')?.getAttribute('content')).toBe(HTML_PREVIEW_CSP)
    expect(doc.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('accepts only bounded parent updates and does not reload identical HTML', () => {
    const doc = new DOMParser().parseFromString(hostFile, 'text/html')
    let content = ''
    const frame = { get srcdoc() { return content }, set srcdoc(value: string) { content = value } }
    const setter = vi.spyOn(frame, 'srcdoc', 'set')
    const parent = {}
    let receive: (event: { source: unknown; data: unknown }) => void
    runInNewContext(doc.querySelector('script')!.textContent!, {
      parent, document: { querySelector: () => frame },
      window: { addEventListener: (_name: string, handler: typeof receive) => { receive = handler } },
    })
    const send = (html: unknown, source: unknown = parent) => receive({ source, data: { type: 'prompt-optimizer:render-html', html } })
    send('<h1>Original</h1>')
    send('<h1>Original</h1>')
    send('<h1>Forged by child or sibling</h1>', {})
    send({ html: 'invalid' })
    send('x'.repeat(MARKDOWN_PREVIEW_INPUT_BUDGET + 1))
    expect(frame.srcdoc).toBe('<h1>Original</h1>')
    expect(setter).toHaveBeenCalledTimes(1)
    send('x'.repeat(MARKDOWN_PREVIEW_INPUT_BUDGET))
    expect(frame.srcdoc).toHaveLength(MARKDOWN_PREVIEW_INPUT_BUDGET)
    send('<h1>Replacement</h1>')
    expect(frame.srcdoc).toBe('<h1>Replacement</h1>')
  })
})
