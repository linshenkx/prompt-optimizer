import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import { diffWords } from 'diff'
import type { CompareResult, ChangeType } from '@prompt-optimizer/core'

export const MARKDOWN_SOURCE_BUDGET = 64 * 1024
export const MARKDOWN_HTML_BUDGET = 256 * 1024
export const MARKDOWN_NODE_BUDGET = 1500
export type MarkdownOutput = { kind: 'html'; html: string; nodes: number } | { kind: 'diff'; result: CompareResult; nodes: number } | { kind: 'source'; reason: string }
const parser = new MarkdownIt({
  // Generated HTML is an artifact, never host-page markup.
  html: false, linkify: true, typographer: true,
  highlight(source: string, language: string) {
    if (source.length > 20000 || !language || !hljs.getLanguage(language)) return ''
    try { return hljs.highlight(source, { language }).value } catch { return '' }
  },
})

/** Pure worker operation. Bounds apply before DOM construction or UI transfer. */
export function prepareMarkdownOutput(content: string): MarkdownOutput {
  if (content.length > MARKDOWN_SOURCE_BUDGET) return { kind: 'source', reason: 'size' }
  const html = parser.render(content)
  if (html.length > MARKDOWN_HTML_BUDGET) return { kind: 'source', reason: 'size' }
  const nodes = (html.match(/</g)?.length ?? 0) * 2
  return nodes > MARKDOWN_NODE_BUDGET ? { kind: 'source', reason: 'nodes' } : { kind: 'html', html, nodes }
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
