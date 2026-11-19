import { afterEach, describe, expect, it, vi } from 'vitest'
import { Blob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import '../../../../core/node_modules/fake-indexeddb/auto/index.mjs'
import { createImageStorageService, createDataManager, createModelManager, createTemplateManager,
  createTemplateLanguageService, createHistoryManager, createPreferenceService, createContextRepo, FavoriteManager, MemoryStorageProvider } from '@prompt-optimizer/core'
import type { AppServices } from '../../../src/types/services'
import { startDesktopResourceWorker } from '../../../src/utils/desktop-resource-worker'

describe('desktop resource worker using real product services and IndexedDB', () => {
  let close: (() => void) | undefined
  let imageStorage: ReturnType<typeof createImageStorageService>
  afterEach(() => { close?.(); imageStorage?.close(); vi.unstubAllGlobals(); delete window.electronAPI })
  it('roundtrips real images and full ZIP packages, preserves IDs and rejects referenced deletion', async () => {
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('Blob', Blob)
    const storage = new MemoryStorageProvider()
    const preferences = createPreferenceService(storage)
    const models = createModelManager(storage)
    const language = createTemplateLanguageService(preferences)
    await language.initialize()
    const templates = createTemplateManager(storage, language)
    const history = createHistoryManager(storage, models)
    const favorites = new FavoriteManager(storage)
    const dataManager = createDataManager(models, templates, history, preferences, createContextRepo(storage))
    imageStorage = createImageStorageService({ dbName: 'po-mcp-resource-test-' + crypto.randomUUID(), quotaStrategy: 'reject' })
    let receive: (packet: { id: string; operation: string; arguments: Record<string, unknown> }) => void
    const pending = new Map<string, (packet: { ok: boolean; result?: unknown }) => void>()
    window.electronAPI = { desktopResources: {
      register: async () => true, onRequest: handler => { receive = handler; return () => {} },
      complete: async packet => { pending.get(packet.id)?.(packet); pending.delete(packet.id); return true },
    } } as NonNullable<Window['electronAPI']>
    const release = Object.assign(vi.fn(), { complete: vi.fn() })
    close = startDesktopResourceWorker({ services: { dataManager, favoriteManager: favorites, imageStorageService: imageStorage } as AppServices,
      flush: async () => true, prepareRestore: async () => release })
    const call = (operation: string, args: Record<string, unknown>) => new Promise<{ ok: boolean; result?: any }>(resolve => {
      const id = crypto.randomUUID(); pending.set(id, resolve); receive({ id, operation, arguments: args })
    })
    const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZwAAAABJRU5ErkJggg=='
    const saved = await call('images.save', { store: 'imageCache', id: 'mcp-image-1', mimeType: 'image/png', data: image })
    expect(saved.ok).toBe(true); expect(saved.result.digest).toHaveLength(64)
    expect((await call('images.get', { store: 'imageCache', id: 'mcp-image-1' })).result.data).toBe(image)
    expect((await call('images.list', { store: 'imageCache' })).result.statistics.count).toBe(1)
    await preferences.set('session/v1/image-text2image', { originalPrompt: 'Original image prompt', optimizedPrompt: 'Image prompt', generatedImages: [{ _type: 'image-ref', id: 'mcp-image-1' }] })
    expect((await call('images.delete', { store: 'imageCache', id: 'mcp-image-1', expectedDigest: saved.result.digest })).ok).toBe(false)
    const exported = await call('package.export', {})
    expect(exported.ok).toBe(true); expect(exported.result.data.length).toBeGreaterThan(100)
    expect(exported.result.missingResources).toEqual([])
    await preferences.delete('session/v1/image-text2image')
    expect((await call('images.delete', { store: 'imageCache', id: 'mcp-image-1', expectedDigest: saved.result.digest })).ok).toBe(true)
    expect(await imageStorage.getImage('mcp-image-1')).toBe(null)
    const restored = await call('package.import', { data: exported.result.data })
    expect(restored.ok).toBe(true)
    expect(release.complete).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
    expect((await imageStorage.getImage('mcp-image-1'))?.data).toBe(image)
    expect(await preferences.get('session/v1/image-text2image', null)).toMatchObject({ optimizedPrompt: 'Image prompt' })
  })
})
