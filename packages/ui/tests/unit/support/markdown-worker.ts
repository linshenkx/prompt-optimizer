import { prepareDiffOutput, type MarkdownOutput } from '../../../src/utils/markdown-output'

export function installMarkdownWorker(
  vi: { stubGlobal: (name: string, value: unknown) => unknown },
  prepare: (content: string, previewHtml?: boolean) => MarkdownOutput,
) {
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:unit-test'
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: { ready?: boolean; id?: number; output?: MarkdownOutput } }) => void
    onerror?: () => void
    postMessage(job: { type?: 'init'; id: number; content: string; original?: string; previewHtml?: boolean }) {
      if (job.type === 'init') { this.onmessage?.({ data: { ready: true } }); return }
      this.onmessage?.({ data: { id: job.id, output: typeof job.original === 'string' ? prepareDiffOutput(job.original, job.content) : prepare(job.content, job.previewHtml) } })
    }
    addEventListener() {}
    terminate() {}
  })
}
