import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeImageSourceToPayload,
  normalizeGeneratedImagePayload,
  persistImagePayloadAsAssetId,
} from '../../../src/utils/image-asset-storage'

describe('image asset storage utilities', () => {
  it('normalizes generated base64 and data URLs through one path', async () => {
    expect(await normalizeGeneratedImagePayload({ b64: 'data:image/webp;base64,AAAA' })).toEqual({ b64: 'AAAA', mimeType: 'image/webp' })
    expect(await normalizeGeneratedImagePayload({ b64: 'AAAA', mimeType: 'image/jpeg' })).toEqual({ b64: 'AAAA', mimeType: 'image/jpeg' })
    expect(await normalizeGeneratedImagePayload({ url: 'data:image/png;base64,AAAA' })).toEqual({ b64: 'AAAA', mimeType: 'image/png' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('infers image mime type from PNG bytes when the remote url responds as application/octet-stream', async () => {
    const pngBytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ])

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: {
          get: vi.fn((name: string) =>
            name.toLowerCase() === 'content-type' ? 'application/octet-stream' : null
          ),
        },
        arrayBuffer: async () => pngBytes.buffer,
      }))
    )

    const payload = await normalizeImageSourceToPayload('https://example.com/generated-image')

    expect(payload).toMatchObject({
      mimeType: 'image/png',
      b64: Buffer.from(pngBytes).toString('base64'),
    })
  })

  it('rejects new asset writes when storage is configured to reject quota overflow', async () => {
    const storageService = {
      getMetadata: vi.fn(async () => null),
      getStorageStats: vi.fn(async () => ({
        count: 1000,
        totalBytes: 200 * 1024 * 1024,
        oldestAt: null,
        newestAt: null,
      })),
      getConfig: vi.fn(() => ({
        maxCacheSize: 200 * 1024 * 1024,
        maxCount: 1000,
        quotaStrategy: 'reject',
      })),
      saveImage: vi.fn(async () => 'img_new'),
    }

    await expect(
      persistImagePayloadAsAssetId({
        payload: {
          b64: 'AAAA',
          mimeType: 'image/png',
        },
        storageService: storageService as any,
      }),
    ).rejects.toThrow(/quota/i)

    expect(storageService.saveImage).not.toHaveBeenCalled()
  })
})
