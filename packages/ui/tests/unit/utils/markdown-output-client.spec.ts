import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMarkdownOutputClient } from '../../../src/utils/markdown-output-client'
import { prepareMarkdownOutput, prepareDiffOutput } from '../../../src/utils/markdown-output'

if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:unit-test'
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('bounded Markdown renderer', () => {
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
    vi.stubGlobal('Worker', class { postMessage() {} terminate = terminate })
    const client = createMarkdownOutputClient(), done = vi.fn()
    try {
      client.request('original source', done)
      vi.advanceTimersByTime(1500)
      expect(done).toHaveBeenCalledWith({ kind: 'source', reason: 'deadline' })
      expect(terminate).toHaveBeenCalledTimes(1)
    } finally { client.dispose() }
  })
  it('bounds pending work, cancels obsolete jobs, and does not publish to disposed views', () => {
    const workers: Array<{ onmessage?: (event: unknown) => void; postMessage: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal('Worker', class {
      postMessage = vi.fn()
      terminate() {}
      constructor() { workers.push(this) }
    })
    const clients = Array.from({ length: 12 }, createMarkdownOutputClient)
    const results = clients.map(() => vi.fn())
    try {
      clients.forEach((client, index) => client.request('job', results[index]!))
      expect(results.filter(result => result.mock.calls.length)).toHaveLength(3)
      clients[0]!.dispose()
      expect(workers[1]?.postMessage).toHaveBeenCalledTimes(1)
      expect(results[0]).not.toHaveBeenCalled()
    } finally { clients.forEach(client => client.dispose()) }
  })
})
