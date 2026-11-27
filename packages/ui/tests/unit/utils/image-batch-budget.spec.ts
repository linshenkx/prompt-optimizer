import { describe, expect, it, vi } from 'vitest'
import { estimateImageRequestBytes, prepareImageBatchForBudget } from '../../../src/utils/image-batch-budget'
import type { ImageCompressionRuntime } from '../../../src/utils/image-compression'

describe('image batch budget', () => {
  it('estimates Base64, MIME types and per-image framing', () => {
    expect(estimateImageRequestBytes([])).toBe(0)
    expect(estimateImageRequestBytes([
      { b64: 'AQIDBA==', mimeType: 'image/png' },
      { b64: 'BQY=', mimeType: 'image/jpeg' },
    ])).toBe(8 + 9 + 32 + 4 + 10 + 32)
  })

  it('compresses a batch within its shared budget and preserves input order', async () => {
    const files = ['first.png', 'second.png'].map(name =>
      new File([new Uint8Array(100)], name, { type: 'image/png' }),
    )
    const runtime: ImageCompressionRuntime = {
      decode: async () => ({
        source: {} as CanvasImageSource,
        width: 1000,
        height: 1000,
        dispose: vi.fn(),
      }),
      encode: async () => new Blob([new Uint8Array(50)], { type: 'image/png' }),
    }
    const results = await prepareImageBatchForBudget(files, async () => true, {
      maxTotalBytes: 101,
      runtime,
    })
    expect(results?.map(result => result.file.name)).toEqual(['first.png', 'second.png'])
    expect(results?.reduce((sum, result) => sum + result.file.size, 0)).toBe(100)
    await expect(prepareImageBatchForBudget(files, async () => true, { maxTotalBytes: 1 }))
      .rejects.toThrow(RangeError)
  })
})
