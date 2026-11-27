import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('image multimodal optimize guards', () => {
  it('single-image workspace streams optimize requests with the current image attached', () => {
    const source = readSource('src/components/image-mode/ImageImage2ImageWorkspace.vue')

    expect(source).toMatch(/optimizePromptStream\(request/)
    expect(source).toMatch(/inputImages:\s*\[/)
    expect(source).toMatch(/b64:\s*inputImageB64\.value/)
    expect(source).toMatch(/mimeType:\s*inputImageMime\.value/)
  })

  it('multi-image workspace uses streaming optimize with ordered input images', () => {
    const source = readSource('src/components/image-mode/ImageMultiImageWorkspace.vue')

    expect(source).toMatch(/promptService(?:\.value)?\.optimizePromptStream\(/)
    expect(source).toMatch(/inputImages:\s*preparedPayloads/)
  })
})
