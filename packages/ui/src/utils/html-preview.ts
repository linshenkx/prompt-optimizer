import type { InjectionKey } from 'vue'

export const HTML_PREVIEW_HOST_KEY: InjectionKey<string> = Symbol('html-preview-host')
export const HTML_PREVIEW_ERROR_TYPE = 'prompt-optimizer:preview-error'
export const HTML_PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline' https: blob:; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; media-src https: data: blob:; connect-src https: http: wss: ws:; frame-src about:; worker-src blob:; base-uri 'none'; form-action 'none'"

const svgStart = /^(?:\s|<!--[\s\S]*?-->|<\?xml\s[\s\S]*?\?>)*<svg\b/iu
export const isSvgDocument = (source: string): boolean => svgStart.test(source)

export function extractHtmlCandidate(content: string): string {
  const source = content.trim()
  if (!source) return ''
  const withoutComments = source.replace(/^(?:\s*<!--[\s\S]*?-->)+\s*/u, '')
  if (isSvgDocument(source) || /^<!doctype\s+html\b/iu.test(withoutComments)
    || /^<(?:html|head|body|div|section|article|main|header|footer|nav|aside|h[1-6]|p|table|ul|ol|form|button|input|canvas|style|script|details)\b/iu.test(withoutComments)) return source
  const lines = source.split(/\r?\n/u)
  const candidates: string[] = []
  let hasFence = false
  for (let index = 0; index < lines.length; index++) {
    const opening = lines[index].match(/^ {0,3}(`{3,}|~{3,})(.*)$/u)
    if (!opening) continue
    hasFence = true
    const marker = opening[1]
    const language = opening[2].trim().toLowerCase()
    const start = ++index
    const closing = new RegExp('^ {0,3}' + marker[0] + '{' + marker.length + ',}[ \\t]*$', 'u')
    while (index < lines.length && !closing.test(lines[index])) index++
    if (index === lines.length) return ''
    const candidate = lines.slice(start, index).join('\n').trim()
    if (language === 'html' || language === 'html5' || (language === 'svg' && isSvgDocument(candidate))) candidates.push(candidate)
  }
  return hasFence && candidates.length === 1 ? candidates[0] : ''
}

export function htmlSourceAsMarkdown(content: string): string {
  const runs = content.match(/`+/gu) || []
  const fence = '`'.repeat(runs.reduce((length, run) => Math.max(length, run.length + 1), 3))
  return fence + 'html\n' + content + '\n' + fence
}

// Serialized into the child document. Keep this function self-contained.
function monitorPreview(id: string, type: string, svg: boolean) {
  let reported = false
  const report = (message: string) => {
    if (reported) return
    reported = true
    parent.postMessage({ type, id, message: message.slice(0, 2000) }, '*')
  }
  window.addEventListener('error', (event: Event) => {
    if (event instanceof ErrorEvent) report(event.message || 'Script error')
    else {
      const target = event.target as HTMLScriptElement | HTMLLinkElement | null
      if (target?.tagName === 'SCRIPT' || target?.tagName === 'LINK') {
        report('Failed to load resource: ' + ((target as HTMLScriptElement).src || (target as HTMLLinkElement).href || target.tagName))
      }
    }
  }, true)
  window.addEventListener('unhandledrejection', event => {
    report(String(event.reason?.message || event.reason || 'Unhandled promise rejection'))
  })
  window.addEventListener('securitypolicyviolation', event => {
    if (/^(?:script|connect|worker)-src/u.test(event.effectiveDirective)) {
      report('Blocked by preview policy: ' + event.effectiveDirective + ' ' + event.blockedURI)
    }
  })
  if (svg) {
    window.addEventListener('DOMContentLoaded', () => {
      const root = document.querySelector('svg')
      if (!root || root.hasAttribute('viewBox')) return
      const width = root.getAttribute('width')
      const height = root.getAttribute('height')
      if (width && height && !width.includes('%') && !height.includes('%')) {
        const w = root.width.baseVal.value
        const h = root.height.baseVal.value
        if (w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h)) root.setAttribute('viewBox', '0 0 ' + w + ' ' + h)
      }
    })
  }
}

const scriptValue = (value: string) => JSON.stringify(value).replace(/</gu, '\\u003c')
const attributeValue = (value: string) => value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
const tagAttributes = "(?:[^\"'<>]|\"[^\"]*\"|'[^']*')*"
const preamble = "(?:\\s|<!--[\\s\\S]*?-->|<!doctype\\b[^>]*>)*"
const rootStart = new RegExp('^' + preamble + '<html\\b' + tagAttributes + '>', 'iu')
const headStart = new RegExp('^' + preamble + '(?:<html\\b' + tagAttributes + '>' + preamble + ')?<head\\b' + tagAttributes + '>', 'iu')

// Install listeners before user scripts without rewriting script strings/import maps.
export function buildHtmlPreviewContent(html: string, id: string): string {
  const svg = isSvgDocument(html)
  const monitor = '<script data-preview-monitor>(' + monitorPreview.toString() + ')('
    + scriptValue(id) + ',' + scriptValue(HTML_PREVIEW_ERROR_TYPE) + ',' + svg + ');</script>'
  if (svg) {
    return '<!doctype html><html><head><meta charset="utf-8">' + monitor
      + '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body>svg{display:block;width:100%;height:100%}</style>'
      + '</head><body>' + html + '</body></html>'
  }
  const head = html.match(headStart)?.[0]
  if (head) return html.slice(0, head.length) + monitor + html.slice(head.length)
  const root = html.match(rootStart)?.[0]
  if (root) return html.slice(0, root.length) + '<head>' + monitor + '</head>' + html.slice(root.length)
  return '<!doctype html><head><meta charset="utf-8">' + monitor + '</head>' + html
}

// Children may report only their own bounded error text across the sandbox.
function relayPreviewError(id: string, type: string) {
  window.addEventListener('message', event => {
    const data = event.data
    if (event.source !== document.querySelector('iframe')?.contentWindow || data?.type !== type || data.id !== id
      || typeof data.message !== 'string' || data.message.length > 2000) return
    parent.postMessage({ type, id, message: data.message }, '*')
  })
}

export function buildHtmlPreviewDocument(html: string, id = ''): string {
  const escaped = attributeValue(buildHtmlPreviewContent(html, id))
  return '<!doctype html><html data-preview-id="' + attributeValue(id) + '"><head><meta charset="utf-8">'
    + '<meta http-equiv="Content-Security-Policy" content="' + HTML_PREVIEW_CSP + '">'
    + '<meta name="referrer" content="no-referrer">'
    + '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;border:0;width:100%;height:100%;background:white}</style>'
    + '<script>(' + relayPreviewError.toString() + ')(' + scriptValue(id) + ',' + scriptValue(HTML_PREVIEW_ERROR_TYPE) + ');</script>'
    + '</head><body><iframe sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="' + escaped + '"></iframe></body></html>'
}
