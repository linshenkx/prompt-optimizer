import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import { diffWords } from 'diff'
import type { CompareResult, ChangeType } from '@prompt-optimizer/core'
import { extractHtmlCandidate } from './html-preview'
import { MARKDOWN_SOURCE_BUDGET, MARKDOWN_HTML_BUDGET, MARKDOWN_NODE_BUDGET, MARKDOWN_PREVIEW_INPUT_BUDGET, MARKDOWN_PREVIEW_BUDGET, hasHtmlPreviewHint } from './markdown-output-limits'

export { MARKDOWN_SOURCE_BUDGET, MARKDOWN_HTML_BUDGET, MARKDOWN_NODE_BUDGET } from './markdown-output-limits'
export type HtmlPreviewBlock = { id: number; html: string }
export type MarkdownOutput = { kind: 'html'; html: string; nodes: number; previews?: HtmlPreviewBlock[] } | { kind: 'diff'; result: CompareResult; nodes: number } | { kind: 'source'; reason: string }
const options = {
  // Generated HTML is an artifact, never host-page markup.
  html: false, linkify: true, typographer: true,
  highlight(source: string, language: string) {
    if (source.length > 20000 || !language || !hljs.getLanguage(language)) return ''
    try { return hljs.highlight(source, { language }).value } catch { return '' }
  },
}
const parser = new MarkdownIt(options)
const previewParser = new MarkdownIt({ ...options, html: true })
type PreviewEnvironment = { previews: HtmlPreviewBlock[]; lines: string[] }
const previewSlot = (html: string, env: PreviewEnvironment) => {
  const id = env.previews.length
  env.previews.push({ id, html })
  return `<div data-html-preview-slot="${id}"></div>\n`
}
const defaultFence = previewParser.renderer.rules.fence!
previewParser.renderer.rules.fence = (tokens, index, renderOptions, env: PreviewEnvironment, renderer) => {
  const token = tokens[index]!
  const language = token.info.trim().split(/\s+/u)[0]?.toLowerCase()
  const lastLine = env.lines[(token.map?.[1] ?? 0) - 1]?.trim().replace(/^(?:>\s*)+/u, '') ?? ''
  const closed = lastLine.length >= token.markup.length && [...lastLine].every(char => char === token.markup[0])
  return (language === 'html' || language === 'html5') && closed
    ? previewSlot(token.content, env) : defaultFence(tokens, index, renderOptions, env, renderer)
}
previewParser.renderer.rules.html_block = (tokens, index, _options, env: PreviewEnvironment) => {
  const source = tokens[index]!.content
  return extractHtmlCandidate(source) ? previewSlot(source, env) : `<pre><code>${previewParser.utils.escapeHtml(source)}</code></pre>\n`
}
// Keep small inline formatting; attributes and executable markup stay out of
// the host. Complete HTML blocks use an isolated browsing context instead.
previewParser.renderer.rules.html_inline = (tokens, index) => {
  const source = tokens[index]!.content
  return /^<\/?(?:b|strong|i|em|u|s|del|sub|sup|kbd|mark|small|br)\s*\/?\s*>$/iu.test(source)
    ? source : previewParser.utils.escapeHtml(source)
}

/** Pure worker operation. Bounds apply before DOM construction or UI transfer. */
export function prepareMarkdownOutput(content: string, previewHtml = false): MarkdownOutput {
  if (content.length > (previewHtml ? MARKDOWN_PREVIEW_INPUT_BUDGET : MARKDOWN_SOURCE_BUDGET)) return { kind: 'source', reason: 'size' }
  if (content.length > MARKDOWN_SOURCE_BUDGET && !hasHtmlPreviewHint(content)) return { kind: 'source', reason: 'size' }
  const env: PreviewEnvironment = { previews: [], lines: [] }
  let html: string
  if (previewHtml) {
    env.lines = content.replace(/\r\n?/gu, '\n').split('\n')
    const tokens = previewParser.parse(content, env)
    const candidate = extractHtmlCandidate(content)
    const fullDocument = /^(?:\s*<!--[\s\S]*?-->\s*)*\s*<(?:!doctype\s+html\b|html\b)/iu.test(content)
    // Markdown treats standalone buttons and other inline HTML elements as a
    // paragraph. Preserve complete elements as artifacts without capturing
    // ordinary prose before or after them.
    const inline = tokens.length === 3 && tokens[0]?.type === 'paragraph_open'
      && tokens[1]?.type === 'inline' && tokens[2]?.type === 'paragraph_close'
      ? tokens[1].children : null
    const openingTag = inline?.[0]?.type === 'html_inline'
      ? inline[0].content.match(/^<([a-z][a-z0-9-]*)\b/iu)?.[1]?.toLowerCase() : undefined
    const lastInline = inline?.[inline.length - 1]
    const standaloneElement = openingTag && (
      (lastInline?.type === 'html_inline' && lastInline.content.toLowerCase() === `</${openingTag}>`)
      || (openingTag === 'input' && inline?.length === 1)
    )
    // Preserve whole documents and bare HTML fragments, including their head,
    // scripts and blank lines. Mixed Markdown continues through the token stream.
    html = candidate === content.trim() && (fullDocument || standaloneElement || tokens.every(token => token.type === 'html_block'))
      ? previewSlot(content, env) : previewParser.renderer.render(tokens, previewParser.options, env)
    if (env.previews.length > MARKDOWN_PREVIEW_BUDGET) return { kind: 'source', reason: 'previews' }
    const outsideHtml = content.length - env.previews.reduce((sum, preview) => sum + preview.html.length, 0)
    if (outsideHtml > MARKDOWN_SOURCE_BUDGET) return { kind: 'source', reason: 'size' }
  } else html = parser.render(content)
  if (html.length > MARKDOWN_HTML_BUDGET) return { kind: 'source', reason: 'size' }
  const nodes = (html.match(/</g)?.length ?? 0) * 2
  return nodes > MARKDOWN_NODE_BUDGET ? { kind: 'source', reason: 'nodes' }
    : { kind: 'html', html, nodes, ...(env.previews.length ? { previews: env.previews } : {}) }
}

export function prepareDiffOutput(original: string, content: string): MarkdownOutput {
  if (original.length + content.length > MARKDOWN_SOURCE_BUDGET) return { kind: 'source', reason: 'size' }
  const changes = diffWords(original, content, { timeout: 200, maxEditLength: 1000 })
  if (!changes || changes.length > 300) return { kind: 'source', reason: 'diff-budget' }
  const summary = { additions: 0, deletions: 0, unchanged: 0 }
  const fragments = changes.map((change, index) => {
    const type = (change.added ? 'added' : change.removed ? 'removed' : 'unchanged') as ChangeType
    summary[change.added ? 'additions' : change.removed ? 'deletions' : 'unchanged'] += change.value.length
    return { text: change.value, type, index }
  })
  return { kind: 'diff', result: { fragments, summary }, nodes: fragments.length * 2 + 20 }
}
