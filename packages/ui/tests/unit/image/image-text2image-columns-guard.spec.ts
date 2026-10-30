import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readWorkspaceSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/image-mode/ImageText2ImageWorkspace.vue'),
    'utf8',
  )

describe('image text2image columns guard', () => {
  it('connects column count and batch execution to the shared toolbar', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/<TestWorkspaceToolbar[\s>]/)
    expect(source).toContain('v-model:count="testColumnCountModel"')
    expect(source).toContain(':running="isAnyVariantRunning"')
    expect(source).toContain(':can-use-four-columns="canUseFourColumns"')
    expect(source).toContain('@run="runAllVariants"')
  })
})
