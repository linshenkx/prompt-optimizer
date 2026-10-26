import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../../../core/node_modules/fake-indexeddb/auto/index.mjs'
import { ImageStorageService } from '../../../../core/src/services/image/storage'

import {
  assertImageResourceRestoreReportSafe,
  assertImageRestoreCapacity,
  createFullImageDataFromResource,
  restoreImageResource,
  safeImageResourceFileName,
  validateImageResourceBytes,
} from '../../../src/utils/image-resource-backup'

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

describe('image resource backup helpers', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('creates stable safe file names with optional content hashes', () => {
    expect(safeImageResourceFileName('cover asset', 'image/png')).toBe('cover%20asset.png')
    expect(safeImageResourceFileName('cover asset', 'image/png', 'abc')).toBe('cover%20asset.abc.png')
  })

  it('validates image bytes with sha256 before size fallback', async () => {
    const bytes = new TextEncoder().encode('image-bytes')

    await expect(validateImageResourceBytes({
      kind: 'image',
      id: 'asset-1',
      path: 'resources/images/asset-1.png',
      sha256: await sha256Hex(bytes),
      sizeBytes: 999,
    }, bytes)).resolves.toBe('ok')

    await expect(validateImageResourceBytes({
      kind: 'image',
      id: 'asset-1',
      path: 'resources/images/asset-1.png',
      sha256: 'wrong',
      sizeBytes: bytes.byteLength,
    }, bytes)).resolves.toBe('corrupt')
  })

  it('centralizes restore-failure errors and byte-to-image reconstruction', () => {
    expect(() => assertImageResourceRestoreReportSafe({
      restored: 0,
      skipped: 0,
      missing: ['asset-1'],
      corrupt: [],
      errors: [],
    }, 'Favorite package')).toThrow('Favorite package resource validation failed: missing=1')

    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const image = createFullImageDataFromResource({
      kind: 'image',
      id: 'asset-2',
      path: 'resources/images/asset-2.png',
      mimeType: 'image/png',
      createdAt: 1,
      source: 'generated',
    }, jpegBytes)

    expect(image.metadata.mimeType).toBe('image/jpeg')
    expect(image.metadata.source).toBe('generated')
  })

  it('skips only when local storage has matching image bytes', async () => {
    const bytes = new TextEncoder().encode('backup-image')
    const entry = {
      kind: 'image' as const,
      id: 'asset-3',
      path: 'resources/images/asset-3.png',
      mimeType: 'image/png',
      createdAt: 1,
      source: 'uploaded' as const,
    }
    const saveImage = vi.fn(async () => 'asset-3')
    const metadataOnlyStorage = {
      getImage: vi.fn(async () => null),
      saveImage,
    }

    await expect(restoreImageResource(entry, bytes, metadataOnlyStorage)).resolves.toBe('restored')
    expect(saveImage).toHaveBeenCalledTimes(1)

    const completeStorage = {
      getImage: vi.fn(async () => ({
        metadata: {
          id: 'asset-3',
          mimeType: 'image/png',
          sizeBytes: 1,
          createdAt: 1,
          source: 'uploaded' as const,
        },
        data: globalThis.btoa('backup-image'),
      })),
      saveImage: vi.fn(async () => 'asset-3'),
    }

    await expect(restoreImageResource(entry, bytes, completeStorage)).resolves.toBe('skipped')
    expect(completeStorage.saveImage).not.toHaveBeenCalled()
  })

  it('rejects same-ID different content without overwriting the local image', async () => {
    const existing = createFullImageDataFromResource({ kind: 'image', id: 'shared', path: 'shared.png' },
      new TextEncoder().encode('target-image'))
    const storage = { getImage: vi.fn(async () => existing), saveImage: vi.fn() }
    await expect(restoreImageResource({ kind: 'image', id: 'shared', path: 'shared.png' },
      new TextEncoder().encode('backup-image'), storage)).rejects.toThrow('Image ID conflict: shared')
    expect(storage.saveImage).not.toHaveBeenCalled()
  })

  it('does not silently accept a declared hash when digest verification is unavailable', async () => {
    const bytes = new TextEncoder().encode('image-bytes')
    const hash = await sha256Hex(bytes)
    vi.stubGlobal('crypto', {})
    await expect(validateImageResourceBytes({ kind: 'image', id: 'one', path: 'one.png',
      sha256: hash, sizeBytes: bytes.byteLength }, bytes)).rejects.toThrow('SHA-256 verification is unavailable')
    // LAN HTTP exports without WebCrypto already omit hashes; their length check still works.
    await expect(validateImageResourceBytes({ kind: 'image', id: 'one', path: 'one.png',
      sizeBytes: bytes.byteLength }, bytes)).resolves.toBe('ok')
    await expect(validateImageResourceBytes({ kind: 'image', id: 'one', path: 'one.png',
      sizeBytes: 1 }, bytes)).resolves.toBe('corrupt')
  })

  it('rejects invalid declared sizes even when the bytes are nonempty', async () => {
    for (const sizeBytes of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0]) {
      await expect(validateImageResourceBytes({ kind: 'image', id: 'one', path: 'one.png', sizeBytes },
        new Uint8Array([1]))).resolves.toBe('corrupt')
    }
  })

  it('checks the union capacity before writes and accounts for duplicate and existing IDs', async () => {
    const entry = (id: string, text: string) => createFullImageDataFromResource({kind: 'image', id, path: `${id}.png`},
      new TextEncoder().encode(text))
    const existing = entry('old', '1234')
    const storage = {
      getImage: vi.fn(async () => null), saveImage: vi.fn(),
      getConfig: () => ({ maxCount: 2, maxCacheSize: 8, quotaStrategy: 'evict' as const }),
      getStorageStats: async () => ({ count: 1, totalBytes: 4, oldestAt: 1, newestAt: 1 }),
      getMetadata: async (id: string) => id === 'old' ? existing.metadata : null,
    }
    await expect(assertImageRestoreCapacity([entry('new', '1234'), entry('new', '1234'), existing], storage))
      .resolves.toBeUndefined()
    await expect(assertImageRestoreCapacity([entry('new', '1234'), entry('another', '1')], storage))
      .rejects.toThrow('3 images exceeds 2')
    await expect(assertImageRestoreCapacity([entry('new', '12345')], storage))
      .rejects.toThrow('9 bytes exceeds 8')
    expect(storage.saveImage).not.toHaveBeenCalled()
  })

  it('restores under the cap without age-evicting retained target images; ordinary saves still clean up', async () => {
    let now = 1
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const storage = new ImageStorageService({ dbName: `restore-age-${Math.random()}`,
      maxCount: 3, maxCacheSize: 10000, maxAge: 10, autoCleanupThreshold: 0.5, quotaStrategy: 'evict' })
    const entry = (id: string) => ({ kind: 'image' as const, id, path: `${id}.png` })
    try {
      await storage.saveImage(createFullImageDataFromResource(entry('retained'), new Uint8Array([1])))
      now = 100
      await restoreImageResource(entry('restored'), new Uint8Array([2]), storage)
      expect((await storage.listAllMetadata()).map(image => image.id).sort()).toEqual(['restored', 'retained'])
      await storage.saveImage(createFullImageDataFromResource(entry('ordinary'), new Uint8Array([3])))
      expect((await storage.listAllMetadata()).map(image => image.id).sort()).toEqual(['ordinary', 'restored'])
    } finally { await storage.clearAll(); await storage.close() }
  })

  it('rejects guarded saves over the cap without evicting or writing even under an evict configuration', async () => {
    const storage = new ImageStorageService({ dbName: `restore-quota-${Math.random()}`,
      maxCount: 1, maxCacheSize: 10000, maxAge: undefined, quotaStrategy: 'evict' })
    const entry = (id: string) => ({ kind: 'image' as const, id, path: `${id}.png` })
    try {
      await storage.saveImage(createFullImageDataFromResource(entry('retained'), new Uint8Array([1])))
      await expect(restoreImageResource(entry('new'), new Uint8Array([2]), storage))
        .rejects.toThrow('Image storage quota exceeded')
      expect((await storage.listAllMetadata()).map(image => image.id)).toEqual(['retained'])
    } finally { await storage.clearAll(); await storage.close() }
  })
})
