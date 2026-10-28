import type { InjectionKey } from 'vue'

// Only the extension supplies a packaged, manifest-declared sandbox page.
// Web and desktop keep using srcdoc without platform detection in shared UI.
export const HTML_PREVIEW_HOST_KEY: InjectionKey<string> = Symbol('html-preview-host')
export const HTML_PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline' https: blob:; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; media-src https: data: blob:; connect-src https: http: wss: ws:; frame-src about:; worker-src blob:; base-uri 'none'; form-action 'none'"

// Only offer executable previews for explicit HTML fences or HTML-looking input.
// In particular, XML and HTML examples inside other code fences stay as text.
export function extractHtmlCandidate(content: string): string {
  const source = content.trim()
  if (!source) return ''
  const withoutComments = source.replace(/^(?:\s*<!--[\s\S]*?-->)+\s*/u, '')
  if (/^<!doctype\s+html\b/iu.test(withoutComments)
    || /^<(?:html|head|body|div|section|article|main|header|footer|nav|aside|h[1-6]|p|table|ul|ol|form|button|input|canvas|svg|style|script|details)\b/iu.test(withoutComments)) return source

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
    const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \\t]*$`, 'u')
    while (index < lines.length && !closing.test(lines[index])) index++
    if (index === lines.length) return ''
    if (language === 'html' || language === 'html5') {
      candidates.push(lines.slice(start, index).join('\n').trim())
    }
  }
  // Multiple HTML examples are ambiguous. Never silently run the first one.
  if (hasFence) return candidates.length === 1 ? candidates[0] : ''

  return ''
}

// Full HTML must remain literal in Markdown view: its CSS otherwise escapes
// the output container before the user ever opens the isolated preview.
export function htmlSourceAsMarkdown(content: string): string {
  const runs = content.match(/`+/gu) || []
  const fence = '`'.repeat(runs.reduce((length, run) => Math.max(length, run.length + 1), 3))
  return `${fence}html\n${content}\n${fence}`
}

// The outer document carries the policy before any model-provided markup.
// A nested srcdoc preserves full documents (head, CSS, import maps and modules)
// without parsing/re-serializing or injecting into their scripts and strings.
export function buildHtmlPreviewDocument(html: string): string {
  const escaped = html.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_CSP}">
<meta name="referrer" content="no-referrer">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;border:0;width:100%;height:100%;background:white}</style>
</head><body><iframe sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escaped}"></iframe></body></html>`
}
