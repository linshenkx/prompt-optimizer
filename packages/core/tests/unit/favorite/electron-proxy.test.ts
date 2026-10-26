import { afterEach, describe, expect, it, vi } from 'vitest'
import { FavoriteManagerElectronProxy } from '../../../src/services/favorite/electron-proxy'

describe('FavoriteManagerElectronProxy', () => {
  it('passes identity restore options through the read-only preflight bridge', async () => {
    const validateImportData = vi.fn().mockResolvedValue(undefined)
    const importFavorites = vi.fn().mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    vi.stubGlobal('window', { electronAPI: { favoriteManager: { validateImportData, importFavorites } } })
    const proxy = new FavoriteManagerElectronProxy()
    const options = { matchBy: 'id' as const, mergeStrategy: 'overwrite' as const }
    await proxy.validateImportData('{"favorites":[]}', options)
    await proxy.importFavorites('{"favorites":[]}', options)
    expect(validateImportData).toHaveBeenCalledWith('{"favorites":[]}', options)
    expect(importFavorites).toHaveBeenCalledWith('{"favorites":[]}', options)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  })

  it('serializes favorite payloads before sending them over Electron IPC', async () => {
    const addFavorite = vi.fn().mockResolvedValue('favorite-1')
    ;(globalThis as typeof globalThis & { window?: unknown }).window = {
      electronAPI: {
        favoriteManager: {
          addFavorite,
        },
      },
    }

    const nonCloneableMetadata = {
      media: {
        coverUrl: 'data:image/png;base64,abc',
        assetIds: ['asset-1'],
      },
      droppedCallback: () => 'not cloneable',
    }
    const proxiedMetadata = new Proxy(nonCloneableMetadata, {})

    const manager = new FavoriteManagerElectronProxy()
    const id = await manager.addFavorite({
      title: 'Garden image prompt',
      content: 'A quiet botanical workspace',
      tags: ['garden'],
      functionMode: 'image',
      imageSubMode: 'text2image',
      metadata: proxiedMetadata,
    })

    expect(id).toBe('favorite-1')
    expect(addFavorite).toHaveBeenCalledOnce()
    expect(addFavorite).toHaveBeenCalledWith({
      title: 'Garden image prompt',
      content: 'A quiet botanical workspace',
      tags: ['garden'],
      functionMode: 'image',
      imageSubMode: 'text2image',
      metadata: {
        media: {
          coverUrl: 'data:image/png;base64,abc',
          assetIds: ['asset-1'],
        },
      },
    })
  })
})
