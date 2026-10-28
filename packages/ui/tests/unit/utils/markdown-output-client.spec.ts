import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMarkdownOutputClient } from '../../../src/utils/markdown-output-client'
import { prepareMarkdownOutput, prepareDiffOutput } from '../../../src/utils/markdown-output'
import { installMarkdownWorker } from '../support/markdown-worker'

if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:unit-test'
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('bounded Markdown renderer', () => {
  it('transports large HTML separately while bounding Markdown, frame count and total input', () => {
    const html = '<html><body><svg>' + '<path d="M0 0 L1 1"/>\n'.repeat(5000) + '</svg></body></html>'
    const result = prepareMarkdownOutput(`Before\n\n\`\`\`html\n${html}\n\`\`\`\n\nAfter`, true)
    expect(result.kind).toBe('html')
    if (result.kind === 'html') {
      expect(result.previews?.[0]?.html.trim()).toBe(html)
      expect(result.html.length).toBeLessThan(200)
      expect(result.html).not.toContain('<path')
    }
    expect(prepareMarkdownOutput('x'.repeat(70000), true).kind).toBe('source')
    expect(prepareMarkdownOutput('x'.repeat(1024 * 1024 + 1), true).kind).toBe('source')
    expect(prepareMarkdownOutput('```html\n<button>0</button>\n```\n\n'.repeat(9), true)).toEqual({ kind: 'source', reason: 'previews' })
  })

  it('keeps raw HTML blocks in place and escapes executable inline attributes and unfinished fences', () => {
    const result = prepareMarkdownOutput('# Before\n\n<div><button>0</button></div>\n\nAfter <b>bold</b> <span style="position:fixed">text</span>.', true)
    expect(result.kind).toBe('html')
    if (result.kind === 'html') {
      expect(result.previews).toHaveLength(1)
      expect(result.html).toContain('<b>bold</b>')
      expect(result.html).not.toContain('<span style=')
    }
    const unfinished = prepareMarkdownOutput('```html\n<script>alert(1)</script>', true)
    expect(unfinished.kind === 'html' && unfinished.previews).toBeUndefined()
    const example = prepareMarkdownOutput('```text\n<div>literal example</div>\n```', true)
    expect(example.kind === 'html' && example.previews).toBeUndefined()
  })

  it('preserves full HTML documents with head styles, blank lines and literal replacement characters', () => {
    const html = '<!doctype html><html>\n<head><style>body{color:red}</style></head>\n\n<body>$& $`<script>const x="<b>";</script></body></html>'
    const result = prepareMarkdownOutput(html, true)
    expect(result.kind === 'html' && result.previews?.[0]?.html).toBe(html)
  })

  it('bounds page-wide iframe reservations and releases capacity when views suspend', () => {
    installMarkdownWorker(vi, prepareMarkdownOutput)
    const clients = Array.from({ length: 4 }, createMarkdownOutputClient)
    const content = '```html\n<button>0</button>\n```\n\n'.repeat(8)
    const results = clients.map(() => vi.fn())
    try {
      clients.forEach((client, index) => client.request(content, results[index]!, undefined, true))
      expect(results[2]!.mock.lastCall?.[0].previews).toHaveLength(8)
      expect(results[3]).toHaveBeenCalledWith({ kind: 'source', reason: 'total-previews' })
      clients[0]!.release()
      clients[3]!.request(content, results[3]!, undefined, true)
      expect(results[3]!.mock.lastCall?.[0].previews).toHaveLength(8)
    } finally { clients.forEach(client => client.dispose()) }
  })
  it('bounds diff computation and preserves complete small comparisons', () => {
    const output = prepareDiffOutput('same old', 'same new')
    expect(output.kind).toBe('diff')
    if (output.kind === 'diff') {
      expect(output.result.fragments.map(fragment => fragment.text).join('')).toContain('old')
      expect(output.result.fragments.map(fragment => fragment.text).join('')).toContain('new')
      expect(output.result.summary).toMatchObject({ additions: 3, deletions: 3 })
    }
    expect(prepareDiffOutput('a'.repeat(65536), 'b').kind).toBe('source')
  })
  it('rejects large or dense markup before creating host DOM', () => {
    expect(prepareMarkdownOutput('x'.repeat(65537)).kind).toBe('source')
    expect(prepareMarkdownOutput('*word* '.repeat(1000)).kind).toBe('source')
    expect(prepareMarkdownOutput('# Heading\n\n**text**').kind).toBe('html')
  })
  it('terminates an unresponsive worker and retains a source fallback', () => {
    vi.useFakeTimers()
    const terminate = vi.fn()
    vi.stubGlobal('Worker', class {
      onmessage?: (event: { data: { ready: boolean } }) => void
      postMessage(job: { type?: string }) { if (job.type === 'init') this.onmessage?.({ data: { ready: true } }) }
      terminate = terminate
    })
    const client = createMarkdownOutputClient(), done = vi.fn()
    try {
      client.request('original source', done)
      vi.advanceTimersByTime(1500)
      expect(done).toHaveBeenCalledWith({ kind: 'source', reason: 'deadline' })
      expect(terminate).toHaveBeenCalledTimes(1)
    } finally { client.dispose() }
  })
  it('bounds bootstrap separately from parsing on slow devices', () => {
    vi.useFakeTimers()
    const terminate = vi.fn()
    vi.stubGlobal('Worker', class { postMessage() {} terminate = terminate })
    const client = createMarkdownOutputClient(), done = vi.fn()
    try {
      client.request('source', done)
      vi.advanceTimersByTime(1500)
      expect(done).not.toHaveBeenCalled()
      vi.advanceTimersByTime(3500)
      expect(done).toHaveBeenCalledWith({ kind: 'source', reason: 'startup' })
      expect(terminate).toHaveBeenCalledTimes(1)
    } finally { client.dispose() }
  })
  it('ignores a late bootstrap message from a cancelled worker', () => {
    const instances: Array<{ onmessage?: (event: unknown) => void; postMessage: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal('Worker', class {
      onmessage?: (event: unknown) => void
      postMessage = vi.fn()
      terminate() {}
      constructor() { instances.push(this) }
    })
    const client = createMarkdownOutputClient(), oldDone = vi.fn(), done = vi.fn()
    try {
      client.request('old', oldDone)
      client.request('new', done)
      instances[0]!.onmessage?.({ data: { ready: true } })
      expect(instances[1]!.postMessage).toHaveBeenCalledTimes(1)
      instances[1]!.onmessage?.({ data: { ready: true } })
      const sent = instances[1]!.postMessage.mock.lastCall![0]
      expect(sent.content).toBe('new')
      instances[1]!.onmessage?.({ data: { id: sent.id, output: { kind: 'html', html: '<p>new</p>', nodes: 2 } } })
      expect(oldDone).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalledTimes(1)
    } finally { client.dispose() }
  })
  it('bounds pending work, cancels obsolete jobs, and does not publish to disposed views', () => {
    const workers: Array<{ onmessage?: (event: unknown) => void; postMessage: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal('Worker', class {
      onmessage?: (event: unknown) => void
      postMessage = vi.fn((job: { type?: string }) => { if (job.type === 'init') this.onmessage?.({ data: { ready: true } }) })
      terminate() {}
      constructor() { workers.push(this) }
    })
    const clients = Array.from({ length: 12 }, createMarkdownOutputClient)
    const results = clients.map(() => vi.fn())
    try {
      clients.forEach((client, index) => client.request('job', results[index]!))
      expect(results.filter(result => result.mock.calls.length)).toHaveLength(3)
      clients[0]!.dispose()
      expect(workers[1]?.postMessage.mock.calls.some(([job]) => job.content === 'job')).toBe(true)
      expect(results[0]).not.toHaveBeenCalled()
    } finally { clients.forEach(client => client.dispose()) }
  })
})
