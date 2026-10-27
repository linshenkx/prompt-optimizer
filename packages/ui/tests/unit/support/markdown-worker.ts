import { prepareDiffOutput, type MarkdownOutput } from '../../../src/utils/markdown-output'

export function installMarkdownWorker(
  vi: { stubGlobal: (name: string, value: unknown) => unknown },
  prepare: (content: string) => MarkdownOutput,
) {
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:unit-test'
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: { id: number; output: MarkdownOutput } }) => void
    onerror?: () => void
    postMessage(job: { id: number; content: string; original?: string }) {
      this.onmessage?.({ data: { id: job.id, output: typeof job.original === 'string' ? prepareDiffOutput(job.original, job.content) : prepare(job.content) } })
    }
    addEventListener() {}
    terminate() {}
  })
}
