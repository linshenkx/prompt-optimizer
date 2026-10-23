import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workspaces = [
  {
    name: 'text2image',
    file: 'src/components/image-mode/ImageText2ImageWorkspace.vue',
  },
  {
    name: 'image2image',
    file: 'src/components/image-mode/ImageImage2ImageWorkspace.vue',
  },
  {
    name: 'multiimage',
    file: 'src/components/image-mode/ImageMultiImageWorkspace.vue',
  },
]

const readSource = (file: string) =>
  readFileSync(resolve(process.cwd(), file), 'utf8')

describe('image workspace session commit guards', () => {
  // Commit order and failure policy are exercised through all three mounted
  // workspaces in integration/image-workspace-history.spec.ts.

  it.each(workspaces)('$name keeps streaming token handlers free of session persistence', ({ file }) => {
    const source = readSource(file)
    const tokenHandlers = source.match(/onToken:\s*[^=]*=>\s*\{[\s\S]*?\n\s*\}/g) || []

    expect(tokenHandlers.length).toBeGreaterThan(0)
    for (const handler of tokenHandlers) {
      expect(handler).not.toContain('saveSession')
      expect(handler).not.toContain('saveSessionAfterHistoryCommit')
      expect(handler).not.toContain('queueSessionSave')
    }
  })
})
