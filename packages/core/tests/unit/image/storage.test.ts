import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ImageStorageService,
  createImageStorageService,
} from '../../../src/services/image/storage'
import type { FullImageData, ImageStorageConfig } from '../../../src/services/image/types'

const dbNames = new Set<string>()
let dateNowSpy: ReturnType<typeof vi.spyOn>

const setNow = (isoTimestamp: string) => {
  dateNowSpy.mockReturnValue(new Date(isoTimestamp).getTime())
}

const createDbName = (name: string) => {
  const dbName = `ImageStorageServiceTest_${name}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`
  dbNames.add(dbName)
  return dbName
}

const createService = (name: string, config: Partial<ImageStorageConfig> = {}) => {
  return new ImageStorageService({
    dbName: createDbName(name),
    maxCacheSize: 10_000,
    maxAge: 60_000,
    maxCount: 20,
    autoCleanupThreshold: 1,
    quotaStrategy: 'evict',
    ...config,
  })
}

const image = (
  id: string,
  overrides: Partial<FullImageData['metadata']> = {},
  data = `base64-${id}`,
): FullImageData => ({
  metadata: {
    id,
    mimeType: 'image/png',
    sizeBytes: data.length,
    createdAt: Date.now(),
    accessedAt: Date.now(),
    source: 'generated',
    metadata: {
      prompt: `prompt-${id}`,
      modelId: 'image-model',
      configId: 'image-config',
    },
    ...overrides,
  },
  data,
})

describe('ImageStorageService', () => {
  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now')
    setNow('2026-06-06T00:00:00.000Z')
  })

  afterEach(async () => {
    for (const dbName of dbNames) {
      await Dexie.delete(dbName)
    }
    dbNames.clear()
    vi.restoreAllMocks()
  })

  it('persists image metadata separately from base64 data and exposes stats', async () => {
    const service = createService('crud')
    const firstImage = image('img-crud-1', { width: 128, height: 64 })

    await expect(service.saveImage(firstImage)).resolves.toBe('img-crud-1')

    await expect(service.getImage('img-crud-1')).resolves.toEqual(firstImage)
    await expect(service.getMetadata('img-crud-1')).resolves.toEqual(firstImage.metadata)
    await expect(service.getImage('missing')).resolves.toBeNull()
    await expect(service.getMetadata('missing')).resolves.toBeNull()
    await expect(service.listAllIds()).resolves.toEqual(['img-crud-1'])
    await expect(service.listAllMetadata()).resolves.toEqual([firstImage.metadata])
    await expect(service.getStorageStats()).resolves.toEqual({
      count: 1,
      totalBytes: firstImage.metadata.sizeBytes,
      oldestAt: Date.now(),
      newestAt: Date.now(),
    })

    await service.close()
  })

  it('supports single delete, batch delete, and clear all', async () => {
    const service = createService('delete')

    await service.saveImage(image('img-delete-1'))
    await service.saveImage(image('img-delete-2'))
    await service.saveImage(image('img-delete-3'))

    await service.deleteImage('img-delete-1')
    await expect(service.listAllIds()).resolves.toEqual(['img-delete-2', 'img-delete-3'])

    await service.deleteImages(['img-delete-2', 'missing'])
    await expect(service.listAllIds()).resolves.toEqual(['img-delete-3'])

    await service.clearAll()
    await expect(service.getStorageStats()).resolves.toEqual({
      count: 0,
      totalBytes: 0,
      oldestAt: null,
      newestAt: null,
    })

    await service.close()
  })

  it('cleans up expired images by last access time', async () => {
    const service = createService('cleanup', { maxAge: 1_000 })

    setNow('2026-06-06T00:00:00.000Z')
    await service.saveImage(image('img-old'))

    setNow('2026-06-06T00:00:02.000Z')
    await service.saveImage(image('img-new'))

    await expect(service.cleanupOldImages()).resolves.toBe(1)
    await expect(service.listAllIds()).resolves.toEqual(['img-new'])

    await service.close()
  })

  it('rejects new or larger saves when reject quota strategy would exceed limits', async () => {
    const service = createService('reject', {
      quotaStrategy: 'reject',
      maxCount: 1,
      maxCacheSize: 20,
    })

    await service.saveImage(image('img-quota-1', { sizeBytes: 10 }, '1234567890'))
    await expect(service.saveImage(image('img-quota-2', { sizeBytes: 5 }, '12345'))).rejects.toThrow(
      'projected count 2 exceeds maxCount 1',
    )
    await expect(
      service.saveImage(image('img-quota-1', { sizeBytes: 21 }, '123456789012345678901')),
    ).rejects.toThrow('projected size 21 exceeds maxCacheSize 20')
    await expect(service.getImage('img-quota-1')).resolves.toEqual(
      image('img-quota-1', { sizeBytes: 10 }, '1234567890'),
    )

    await service.close()
  })

  it('evicts least recently used images when count quota is enforced', async () => {
    const service = createService('evict-count', {
      maxCount: 2,
      autoCleanupThreshold: 1,
      maxCacheSize: 10_000,
    })

    setNow('2026-06-06T00:00:00.000Z')
    await service.saveImage(image('img-1'))
    setNow('2026-06-06T00:00:01.000Z')
    await service.saveImage(image('img-2'))
    setNow('2026-06-06T00:00:02.000Z')
    await service.saveImage(image('img-3'))

    await expect(service.listAllIds()).resolves.toEqual(['img-2', 'img-3'])
    await expect(service.getImage('img-1')).resolves.toBeNull()

    await service.close()
  })

  it('evicts oldest images until cache size falls below the target size', async () => {
    const service = createService('evict-size', {
      maxCount: 10,
      maxCacheSize: 100,
      autoCleanupThreshold: 1,
    })

    setNow('2026-06-06T00:00:00.000Z')
    await service.saveImage(image('img-size-1', { sizeBytes: 40 }, 'x'.repeat(40)))
    setNow('2026-06-06T00:00:01.000Z')
    await service.saveImage(image('img-size-2', { sizeBytes: 40 }, 'x'.repeat(40)))
    setNow('2026-06-06T00:00:02.000Z')
    await service.saveImage(image('img-size-3', { sizeBytes: 40 }, 'x'.repeat(40)))

    await expect(service.listAllIds()).resolves.toEqual(['img-size-2', 'img-size-3'])
    await expect(service.getStorageStats()).resolves.toMatchObject({
      count: 2,
      totalBytes: 80,
    })

    await service.close()
  })

  it('updates runtime config without switching databases and enforces new quota', async () => {
    const service = createService('update-config', {
      maxCount: 5,
      autoCleanupThreshold: 1,
    })
    const initialDbName = service.getConfig().dbName
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await service.saveImage(image('img-config-1'))
    await service.saveImage(image('img-config-2'))
    await service.updateConfig({ dbName: 'ignored-db', maxCount: 1 })

    expect(service.getConfig().dbName).toBe(initialDbName)
    expect(warn).toHaveBeenCalledWith(
      '[ImageStorageService] Ignoring dbName update after initialization',
    )
    await expect(service.listAllIds()).resolves.toEqual(['img-config-2'])

    await service.close()
  })

  it('creates image storage service instances through the factory', async () => {
    const dbName = createDbName('factory')
    const service = createImageStorageService({ dbName })

    expect(service).toBeInstanceOf(ImageStorageService)
    expect(service.getConfig().dbName).toBe(dbName)

    await service.close()
  })
})
