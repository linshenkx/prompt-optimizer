import { prepareMarkdownOutput, prepareDiffOutput } from './markdown-output'

self.onmessage = (event: MessageEvent<{ id: number; content: string; original?: string }>) => {
  try { self.postMessage({ id: event.data.id, output: typeof event.data.original === 'string'
    ? prepareDiffOutput(event.data.original, event.data.content) : prepareMarkdownOutput(event.data.content) }) }
  catch { self.postMessage({ id: event.data.id, output: { kind: 'source', reason: 'parse' } }) }
}
