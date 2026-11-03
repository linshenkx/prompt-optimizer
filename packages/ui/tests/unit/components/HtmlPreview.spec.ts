import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import HtmlPreview from '../../../src/components/HtmlPreview.vue'
import { buildHtmlPreviewContent, HTML_PREVIEW_ERROR_TYPE, HTML_PREVIEW_HOST_KEY, HTML_PREVIEW_CSP } from '../../../src/utils/html-preview'
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
    const id = post.mock.calls[0][0].id as string
    expect(post).toHaveBeenLastCalledWith({ type: 'prompt-optimizer:render-html', html: buildHtmlPreviewContent('<h1>Latest</h1>', id), id }, '*')
    await extension.setProps({ html: '<h1>Replacement</h1>' })
    const replacementId = post.mock.calls[1][0].id as string
    expect(replacementId).not.toBe(id)
    expect(post).toHaveBeenLastCalledWith({ type: 'prompt-optimizer:render-html', html: buildHtmlPreviewContent('<h1>Replacement</h1>', replacementId), id: replacementId }, '*')
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
    const frame = { contentWindow: {}, get srcdoc() { return content }, set srcdoc(value: string) { content = value } }
    const setter = vi.spyOn(frame, 'srcdoc', 'set')
    const parent = { postMessage: vi.fn() }
    let receive: (event: { source: unknown; data: unknown }) => void
    runInNewContext(doc.querySelector('script')!.textContent!, {
      parent, document: { querySelector: () => frame },
      window: { addEventListener: (_name: string, handler: typeof receive) => { receive = handler } },
    })
    const send = (html: unknown, source: unknown = parent) => receive({ source, data: { type: 'prompt-optimizer:render-html', html, id: 'current' } })
    send('<h1>Original</h1>')
    send('<h1>Original</h1>')
    send('<h1>Forged by child or sibling</h1>', {})
    send({ html: 'invalid' })
    send('x'.repeat(MARKDOWN_PREVIEW_INPUT_BUDGET + 16385))
    expect(frame.srcdoc).toBe('<h1>Original</h1>')
    expect(setter).toHaveBeenCalledTimes(1)
    send('x'.repeat(MARKDOWN_PREVIEW_INPUT_BUDGET))
    expect(frame.srcdoc).toHaveLength(MARKDOWN_PREVIEW_INPUT_BUDGET)
    send('<h1>Replacement</h1>')
    expect(frame.srcdoc).toBe('<h1>Replacement</h1>')
    const error = { type: HTML_PREVIEW_ERROR_TYPE, id: 'current', message: 'Module failed' }
    receive({ source: {}, data: error })
    receive({ source: frame.contentWindow, data: { ...error, id: 'old' } })
    expect(parent.postMessage).not.toHaveBeenCalled()
    receive({ source: frame.contentWindow, data: error })
    expect(parent.postMessage).toHaveBeenCalledWith(error, '*')
  })

  it('shows only errors from this frame and revision, clears them on replacement, and keeps messages literal', async () => {
    const wrapper = mount(HtmlPreview, { props: { html: '<h1>Page</h1>' }, attachTo: document.body })
    const frame = wrapper.get('iframe').element as HTMLIFrameElement
    const id = () => new DOMParser().parseFromString(frame.srcdoc, 'text/html').documentElement.getAttribute('data-preview-id')
    const firstId = id()
    const send = (source: unknown, revision: unknown, message = '<img src=x onerror=alert(1)>') => {
      window.dispatchEvent(new MessageEvent('message', { source: source as Window, data: { type: HTML_PREVIEW_ERROR_TYPE, id: revision, message } }))
    }
    send(window, firstId)
    send(frame.contentWindow, 'other-preview')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    send(frame.contentWindow, firstId)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="alert"]').text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.find('[role="alert"] img').exists()).toBe(false)
    await wrapper.setProps({ html: '<h1>Replacement</h1>' })
    send(frame.contentWindow, firstId, 'Stale error')
    await wrapper.vm.$nextTick()
    expect(id()).not.toBe(firstId)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    send(frame.contentWindow, id(), 'x'.repeat(2001))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
