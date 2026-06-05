import { describe, expect, it, vi } from 'vitest'

import {
  estimateJsonBytes,
  resolveDataManagerStorageBreakdown,
} from '../../../src/utils/data-manager-storage'

const createServices = () => ({
  modelManager: {
    exportData: vi.fn().mockResolvedValue([{ id: 'model-1', name: '主模型' }]),
  },
  templateManager: {
    exportData: vi.fn().mockResolvedValue([{ id: 'template-1', title: '模板' }]),
  },
  historyManager: {
    exportData: vi.fn().mockResolvedValue([{ id: 'history-1', prompt: '历史记录' }]),
  },
  contextRepo: {
    exportData: vi.fn().mockResolvedValue({
      type: 'context-bundle',
      version: '1.0.0',
      currentId: 'ctx-1',
      contexts: [{ id: 'ctx-1', title: '上下文' }],
    }),
  },
  preferenceService: {
    exportData: vi.fn().mockResolvedValue({ language: 'zh-CN', theme: 'light' }),
  },
  imageStorageService: {
    getStorageStats: vi.fn().mockResolvedValue({
      count: 3,
      totalBytes: 2048,
      oldestAt: 1,
      newestAt: 2,
    }),
  },
  favoriteImageStorageService: {
    getStorageStats: vi.fn().mockResolvedValue({
      count: 1,
      totalBytes: 1024,
      oldestAt: 3,
      newestAt: 4,
    }),
  },
})

describe('data-manager storage helpers', () => {
  it('estimates bytes from minified JSON instead of formatted JSON', () => {
    const payload = { nested: { title: '小词', count: 2 } }

    const minifiedBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength
    const prettyBytes = new TextEncoder().encode(JSON.stringify(payload, null, 2)).byteLength

    expect(estimateJsonBytes(payload)).toBe(minifiedBytes)
    expect(estimateJsonBytes(payload)).not.toBe(prettyBytes)
  })

  it('combines models, templates, history, contexts and settings into the main data estimate', async () => {
    const services = createServices()

    const summary = await resolveDataManagerStorageBreakdown({
      services: services as any,
      includeBackupData: false,
    })

    const expectedMainBytes =
      estimateJsonBytes(await services.modelManager.exportData.mock.results[0]?.value) +
      estimateJsonBytes(await services.templateManager.exportData.mock.results[0]?.value) +
      estimateJsonBytes(await services.historyManager.exportData.mock.results[0]?.value) +
      estimateJsonBytes(await services.contextRepo.exportData.mock.results[0]?.value) +
      estimateJsonBytes(await services.preferenceService.exportData.mock.results[0]?.value)

    expect(summary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'appMainData',
          estimated: true,
          bytes: expectedMainBytes,
        }),
      ]),
    )
  })

  it('adds estimated main data and actual image stats into the total bytes', async () => {
    const services = createServices()
    const electronDataApi = {
      getStorageInfo: vi.fn().mockResolvedValue({
        userDataPath: '/tmp/prompt-optimizer',
        mainFilePath: '/tmp/prompt-optimizer/data.json',
        mainSizeBytes: 4096,
        backupFilePath: '/tmp/prompt-optimizer/data.backup.json',
        backupSizeBytes: 512,
        totalBytes: 4608,
      }),
    }

    const summary = await resolveDataManagerStorageBreakdown({
      services: services as any,
      includeBackupData: true,
      electronDataApi: electronDataApi as any,
    })

    const appMainData = summary.items.find(item => item.key === 'appMainData')?.bytes ?? 0
    const imageCache = summary.items.find(item => item.key === 'imageCache')?.bytes ?? 0
    const favoriteImages = summary.items.find(item => item.key === 'favoriteImages')?.bytes ?? 0
    const backups = summary.items.find(item => item.key === 'backupData')?.bytes ?? 0

    expect(summary.totalBytes).toBe(appMainData + imageCache + favoriteImages + backups)
    expect(backups).toBe(512)
  })

  it('preserves image counts for cache and favorite breakdown items', async () => {
    const services = createServices()

    const summary = await resolveDataManagerStorageBreakdown({
      services: services as any,
      includeBackupData: false,
    })

    expect(summary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'imageCache',
          bytes: 2048,
          count: 3,
        }),
        expect.objectContaining({
          key: 'favoriteImages',
          bytes: 1024,
          count: 1,
        }),
      ]),
    )
  })

  it('keeps missing image services as unknown instead of throwing', async () => {
    const services = createServices()
    delete (services as any).imageStorageService
    delete (services as any).favoriteImageStorageService

    await expect(
      resolveDataManagerStorageBreakdown({
        services: services as any,
        includeBackupData: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ key: 'imageCache', bytes: null }),
          expect.objectContaining({ key: 'favoriteImages', bytes: null }),
        ]),
      }),
    )
  })
})
