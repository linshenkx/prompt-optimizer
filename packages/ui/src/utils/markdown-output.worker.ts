import { prepareMarkdownOutput, prepareDiffOutput } from './markdown-output'

self.onmessage = (event: MessageEvent<{ type?: 'init'; id: number; content: string; original?: string; previewHtml?: boolean }>) => {
  if (event.data.type === 'init') { self.postMessage({ ready: true }); return }
  try { self.postMessage({ id: event.data.id, output: typeof event.data.original === 'string'
    ? prepareDiffOutput(event.data.original, event.data.content) : prepareMarkdownOutput(event.data.content, event.data.previewHtml) }) }
  catch { self.postMessage({ id: event.data.id, output: { kind: 'source', reason: 'parse' } }) }
}
