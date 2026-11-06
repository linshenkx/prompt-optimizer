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

  it('persists the original animated GIF bytes and MIME type', async () => {
    const b64 = 'R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBFAABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7'
    const payload = await normalizeGeneratedImagePayload({ b64, mimeType: 'image/gif' })
    expect(payload).toEqual({ b64, mimeType: 'image/gif' })
    const storageService = {
      getMetadata: vi.fn(async () => null),
      getStorageStats: vi.fn(async () => ({ count: 0, totalBytes: 0 })),
      getConfig: vi.fn(() => ({ maxCacheSize: Infinity, maxCount: Infinity, quotaStrategy: 'reject' })),
      saveImage: vi.fn(async () => 'gif-asset'),
    }
    await persistImagePayloadAsAssetId({ payload: payload!, storageService: storageService as any })
    expect(storageService.saveImage).toHaveBeenCalledWith(expect.objectContaining({
      data: b64,
      metadata: expect.objectContaining({ mimeType: 'image/gif' }),
    }))
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
