import { describe, it, expect } from 'vitest'

import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { runStorageStartupSafetyCheck } from '../../../src/services/storage/startup-safety-check'

const buildFavorite = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `收藏 ${id}`,
  content: '有效内容',
  tags: [],
  functionMode: 'basic' as const,
  optimizationMode: 'system' as const,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  useCount: 0,
  ...overrides,
})

describe('runStorageStartupSafetyCheck', () => {
  it('removes a broken global-settings key and keeps the app bootable', async () => {
    const storage = new MemoryStorageProvider()
    await storage.setItem('pref:global-settings/v1', '{invalid json')

    const report = await runStorageStartupSafetyCheck(storage)

    expect(await storage.getItem('pref:global-settings/v1')).toBeNull()
    expect(report.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'pref:global-settings/v1',
          action: 'removed',
        }),
      ]),
    )
  })

  it('removes a broken ctx:store key and preserves unrelated data', async () => {
    const storage = new MemoryStorageProvider()
    await storage.setItem(
      'ctx:store',
      JSON.stringify({
        currentId: 123,
      }),
    )
    await storage.setItem(
      'pref:global-settings/v1',
      JSON.stringify({
        version: 1,
        theme: 'light',
      }),
    )

    await runStorageStartupSafetyCheck(storage)

    expect(await storage.getItem('ctx:store')).toBeNull()
    expect(await storage.getItem('pref:global-settings/v1')).not.toBeNull()
  })

  it('removes only the oversized session snapshot and leaves other sessions untouched', async () => {
    const storage = new MemoryStorageProvider()
    await storage.setItem(
      'pref:session/v1/image-multiimage',
      JSON.stringify({
        payload: 'x'.repeat(1024 * 1024 + 128),
      }),
    )
    await storage.setItem(
      'pref:session/v1/basic-system',
      JSON.stringify({
        prompt: 'safe',
      }),
    )

    const report = await runStorageStartupSafetyCheck(storage)

    expect(await storage.getItem('pref:session/v1/image-multiimage')).toBeNull()
    expect(await storage.getItem('pref:session/v1/basic-system')).toBe(
      JSON.stringify({
        prompt: 'safe',
      }),
    )
    expect(report.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'pref:session/v1/image-multiimage',
          action: 'removed',
          reason: 'budget_exceeded',
        }),
      ]),
    )
  })

  it('salvages valid favorites and drops invalid, inline-image, and oversized entries', async () => {
    const storage = new MemoryStorageProvider()
    await storage.setItem(
      'favorites',
      JSON.stringify([
        buildFavorite('fav-valid'),
        'bad-item',
        buildFavorite('fav-inline', {
          metadata: {
            media: {
              coverUrl: 'data:image/png;base64,AAAA',
            },
          },
        }),
        buildFavorite('fav-too-large', {
          content: 'x'.repeat(520 * 1024),
        }),
      ]),
    )

    const report = await runStorageStartupSafetyCheck(storage)
    const repairedRaw = await storage.getItem('favorites')
    const repairedFavorites = repairedRaw ? JSON.parse(repairedRaw) : []

    expect(repairedFavorites).toHaveLength(1)
    expect(repairedFavorites[0].id).toBe('fav-valid')
    expect(report.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'favorites',
          action: 'rewritten',
          droppedCount: 3,
        }),
      ]),
    )
  })

  it('trims an oversized favorites payload by keeping the newest entries first', async () => {
    const storage = new MemoryStorageProvider()
    const favorites = Array.from({ length: 20 }, (_, index) =>
      buildFavorite(`fav-${index + 1}`, {
        content: 'x'.repeat(500 * 1024),
        createdAt: 1_700_000_000_000 + index,
        updatedAt: 1_700_000_000_000 + index,
      }),
    )
    await storage.setItem('favorites', JSON.stringify(favorites))

    const report = await runStorageStartupSafetyCheck(storage)
    const repairedRaw = await storage.getItem('favorites')
    const repairedFavorites = repairedRaw ? JSON.parse(repairedRaw) : []

    expect(repairedFavorites.length).toBeLessThan(favorites.length)
    expect(repairedFavorites[0].updatedAt).toBeGreaterThan(repairedFavorites[repairedFavorites.length - 1].updatedAt)
    expect(repairedFavorites.some((favorite: { id: string }) => favorite.id === 'fav-20')).toBe(true)
    expect(repairedFavorites.some((favorite: { id: string }) => favorite.id === 'fav-1')).toBe(false)
    expect(report.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'favorites',
          action: 'rewritten',
          reason: 'budget_trimmed',
        }),
      ]),
    )
  })

  it('preserves video and arena global settings and never auto-deletes video-create session snapshots', async () => {
    const storage = new MemoryStorageProvider()
    for (const functionMode of ['video', 'arena'] as const) {
      const settings = JSON.stringify({
        selectedThemeId: 'dark',
        preferredLanguage: 'zh-CN',
        functionMode,
        lastActiveAt: 1_700_000_000_000,
      })
      await storage.setItem('pref:global-settings/v1', settings)
      const report = await runStorageStartupSafetyCheck(storage)
      expect(await storage.getItem('pref:global-settings/v1')).toBe(settings)
      expect(report.actions).toEqual([])
    }

    const brokenVideoSession = '{invalid-json-with-paid-task-id'
    await storage.setItem('pref:session/v1/video-create', brokenVideoSession)
    const report = await runStorageStartupSafetyCheck(storage)
    expect(await storage.getItem('pref:session/v1/video-create')).toBe(brokenVideoSession)
    expect(report.actions).toEqual([])
  })
})
