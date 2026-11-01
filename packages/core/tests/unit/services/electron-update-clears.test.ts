import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FavoriteManager } from '../../../src/services/favorite/manager'
import { FavoriteManagerElectronProxy } from '../../../src/services/favorite/electron-proxy'
import { ModelManager } from '../../../src/services/model/manager'
import { ElectronModelManagerProxy } from '../../../src/services/model/electron-proxy'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { createDesktopServiceBridge } from '../../utils/desktop-service-bridge'
import { CORE_SERVICE_KEYS } from '../../../src/constants/storage-keys'
import { ImageModelManager } from '../../../src/services/image-model/manager'
import { ImageAdapterRegistry } from '../../../src/services/image/adapters/registry'
import { ElectronImageModelManagerProxy } from '../../../src/services/image/electron-proxy'
import { createContextRepo } from '../../../src/services/context/repo'
import { ElectronContextRepoProxy } from '../../../src/services/context/electron-proxy'

describe('desktop updates through renderer proxy, preload and main handler', () => {
  let storage: MemoryStorageProvider
  let manager: FavoriteManager
  let proxy: FavoriteManagerElectronProxy
  beforeEach(() => {
    storage = new MemoryStorageProvider()
    manager = new FavoriteManager(storage)
    vi.stubGlobal('window', { electronAPI: createDesktopServiceBridge({ favoriteManager: manager }) })
    proxy = new FavoriteManagerElectronProxy()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('moves a category with descendants to the root and round-trips the backup after reopening', async () => {
    const parentId = await manager.addCategory({ name: 'Parent', sortOrder: 1 })
    const childId = await manager.addCategory({ name: 'Child', parentId, sortOrder: 2 })
    const leafId = await manager.addCategory({ name: 'Leaf', parentId: childId, sortOrder: 3 })
    await proxy.updateCategory(childId, { parentId: undefined })
    const reopened = new FavoriteManager(storage)
    expect((await reopened.getCategories()).find(category => category.id === childId)?.parentId).toBeUndefined()
    expect((await reopened.getCategories()).find(category => category.id === leafId)?.parentId).toBe(childId)
    const restored = new FavoriteManager(new MemoryStorageProvider())
    await restored.importFavorites(await reopened.exportFavorites(), { matchBy: 'id', mergeStrategy: 'overwrite' })
    expect(await restored.getCategories()).toEqual(await reopened.getCategories())
  })

  it('keeps an omitted category parent and still applies nonempty parent changes', async () => {
    const parentId = await manager.addCategory({ name: 'Parent', sortOrder: 1 })
    const otherId = await manager.addCategory({ name: 'Other', sortOrder: 2 })
    const childId = await manager.addCategory({ name: 'Child', parentId, sortOrder: 3 })
    await proxy.updateCategory(childId, { name: 'Renamed' })
    expect((await manager.getCategories()).find(category => category.id === childId)?.parentId).toBe(parentId)
    await proxy.updateCategory(childId, { parentId: otherId })
    expect((await manager.getCategories()).find(category => category.id === childId)?.parentId).toBe(otherId)
  })

  it('clears a favorite category and description without losing its prompt or tags', async () => {
    const category = await manager.addCategory({ name: 'Category', sortOrder: 1 })
    const id = await manager.addFavorite({ title: 'Saved', content: 'Prompt', category, description: 'Old', tags: ['keep'], functionMode: 'basic', optimizationMode: 'system' })
    await proxy.updateFavorite(id, { category: undefined, description: undefined })
    expect(await new FavoriteManager(storage).getFavorite(id)).toMatchObject({ content: 'Prompt', tags: ['keep'] })
    const saved = await manager.getFavorite(id)
    expect(saved.category).toBeUndefined()
    expect(saved.description).toBeUndefined()
  })

  it('clears nested text-model custom headers while retaining omitted connection fields', async () => {
    vi.unstubAllGlobals()
    const registry = new TextAdapterRegistry()
    const adapter = registry.getAdapter('openai-compatible')
    const config = {
      id: 'headers', name: 'Headers', enabled: false,
      providerId: adapter.getProvider().id, modelId: 'custom-model',
      providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('custom-model'),
      connectionConfig: { apiKey: 'fixture-key', baseURL: 'https://example.invalid/v1', customHeaders: { 'X-Old': 'value' } },
    }
    await storage.setItem(CORE_SERVICE_KEYS.MODELS, JSON.stringify({ [config.id]: config }))
    const modelManager = new ModelManager(storage, registry)
    await modelManager.ensureInitialized()
    vi.stubGlobal('window', { electronAPI: createDesktopServiceBridge({ modelManager }) })
    const modelProxy = new ElectronModelManagerProxy()
    await modelProxy.updateModel(config.id, { connectionConfig: { customHeaders: undefined } })
    vi.unstubAllGlobals()
    const saved = await new ModelManager(storage, registry).getModel(config.id)
    expect(saved?.connectionConfig).toEqual({ apiKey: 'fixture-key', baseURL: 'https://example.invalid/v1' })
  })

  it('resets image-model parameter overrides without altering its connection', async () => {
    const registry = new ImageAdapterRegistry()
    const adapter = registry.getAdapter('openai')
    const model = registry.getStaticModels('openai')[0]
    const imageModelManager = new ImageModelManager(storage, registry)
    const connectionConfig = { apiKey: 'fixture-key', baseURL: 'https://example.invalid/v1' }
    await imageModelManager.addConfig({
      id: 'image-overrides', name: 'Image', enabled: false,
      providerId: 'openai', modelId: model.id, providerMeta: adapter.getProvider(), modelMeta: model,
      connectionConfig, paramOverrides: { n: 2 },
    })
    vi.stubGlobal('window', { electronAPI: createDesktopServiceBridge({ imageModelManager }) })
    const imageProxy = new ElectronImageModelManagerProxy()
    await imageProxy.updateConfig('image-overrides', { paramOverrides: undefined })
    const saved = await new ImageModelManager(storage, registry).getConfig('image-overrides')
    expect(saved?.paramOverrides).toEqual({})
    expect(saved?.connectionConfig).toEqual(connectionConfig)
  })

  it('retains context updates that intentionally ignore undefined while clearing empty arrays', async () => {
    const contextRepo = createContextRepo(storage)
    const id = await contextRepo.create({ title: 'Context' })
    await contextRepo.update(id, { description: 'Keep description', tags: ['old'] })
    vi.stubGlobal('window', { electronAPI: createDesktopServiceBridge({ contextRepo }) })
    await new ElectronContextRepoProxy().update(id, { description: undefined, tags: [] })
    expect(await contextRepo.get(id)).toMatchObject({ description: 'Keep description', tags: [] })
  })
})
