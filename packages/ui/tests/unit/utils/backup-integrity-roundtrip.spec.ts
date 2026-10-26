import { describe, expect, it } from 'vitest'
import '../../../../core/node_modules/fake-indexeddb/auto/index.mjs'
import { DataManager } from '../../../../core/src/services/data/manager'
import { FavoriteManager } from '../../../../core/src/services/favorite/manager'
import { HistoryManager } from '../../../../core/src/services/history/manager'
import { ModelManager } from '../../../../core/src/services/model/manager'
import { ImageModelManager } from '../../../../core/src/services/image-model/manager'
import { createImageAdapterRegistry } from '../../../../core/src/services/image/adapters/registry'
import { ImageStorageService } from '../../../../core/src/services/image/storage'
import { PreferenceService } from '../../../../core/src/services/preference/service'
import { MemoryStorageProvider } from '../../../../core/src/services/storage/memoryStorageProvider'
import { TemplateManager } from '../../../../core/src/services/template/manager'
import { TemplateLanguageService } from '../../../../core/src/services/template/languageService'
import { createContextRepo } from '../../../../core/src/services/context/repo'
import { LEGACY_SESSION_SUB_MODE_KEYS } from '../../../../core/src/services/prompt-model/session'
import type { FullImageData } from '../../../../core/src/services/image/types'
import type { RemoteObjectStore } from '../../../src/utils/remote-backup'
import { createDataManagerResourcePackage, importDataManagerResourcePackage } from '../../../src/utils/data-manager-resource-package'
import { createRemoteSnapshotBackup, restoreRemoteSnapshotBackup } from '../../../src/utils/remote-snapshot-backup'

let sequence = 0
const createServices = async () => {
  const storage = new MemoryStorageProvider()
  const preferences = new PreferenceService(storage)
  const models = new ModelManager(storage)
  await models.ensureInitialized()
  const imageModels = new ImageModelManager(storage, createImageAdapterRegistry())
  await imageModels.ensureInitialized()
  const language = new TemplateLanguageService(preferences)
  await language.initialize()
  const templates = new TemplateManager(storage, language)
  const history = new HistoryManager(storage, models)
  const contexts = createContextRepo(storage)
  const favorites = new FavoriteManager(storage)
  const name = `BackupRoundtrip-${Date.now()}-${++sequence}`
  const sessionImages = new ImageStorageService({ dbName: `${name}-session`, maxAge: undefined })
  const favoriteImages = new ImageStorageService({ dbName: `${name}-favorite`, maxAge: undefined, quotaStrategy: 'reject' })
  return { storage, preferences, models, imageModels, templates, history, contexts, favorites, sessionImages, favoriteImages,
    data: new DataManager(models, templates, history, preferences, contexts, imageModels) }
}
const image = (id: string): FullImageData => ({
  metadata: { id, mimeType: 'image/png', sizeBytes: id.length, createdAt: 1, source: 'uploaded' }, data: btoa(id),
})
const objectStore = (): RemoteObjectStore => {
  const objects = new Map<string, Uint8Array>()
  return {
    provider: 'google-drive', detect: async () => ({ ok: true, provider: 'google-drive', steps: [] }),
    exists: async path => objects.has(path),
    put: async (path, body) => {
      const bytes = typeof body === 'string' ? new TextEncoder().encode(body)
        : body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : new Uint8Array(body)
      objects.set(path, bytes)
      return { path, sizeBytes: bytes.byteLength }
    },
    get: async path => { const bytes = objects.get(path); if (!bytes) throw new Error('not found'); return bytes.slice().buffer },
    getText: async path => { const bytes = objects.get(path); if (!bytes) throw new Error('not found'); return new TextDecoder().decode(bytes) },
    list: async prefix => [...objects].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => ({ path, sizeBytes: bytes.byteLength })),
  }
}

describe('full backup integrity with real services', () => {
  it.each(['zip', 'remote'] as const)('restores seven workspaces, identities, variables, tools, models and image bytes through %s', async route => {
    const source = await createServices()
    const target = await createServices()
    try {
      const baseModel = (await source.models.exportData()).find(model => model.providerId === 'openai')!
      await source.models.addModel('audit-text', { ...baseModel, id: 'audit-text', name: 'Audit text', enabled: true,
        connectionConfig: { ...baseModel.connectionConfig, apiKey: 'sample-only-text-key' } })
      const baseImageModel = (await source.imageModels.exportData()).find(model => model.providerId === 'openai')!
      await source.imageModels.addConfig({ ...baseImageModel, id: 'audit-image', name: 'Audit image', enabled: true,
        connectionConfig: { ...baseImageModel.connectionConfig, apiKey: 'sample-only-image-key' } })
      await source.templates.saveTemplate({ id: 'audit-template', name: 'Audit template', content: 'Use {{globalSubject}}',
        metadata: { version: '1.0.0', lastModified: 1, templateType: 'optimize' } })
      await source.history.addRecord({ id: 'audit-record', originalPrompt: 'original', optimizedPrompt: 'optimized',
        type: 'optimize', chainId: 'audit-chain', version: 1, timestamp: 1, modelKey: 'audit-text', templateId: 'audit-template' })
      await source.preferences.set('variableManager.storage', { customVariables: { globalSubject: 'science\nsecond line' },
        advancedModeEnabled: false, lastConversationMessages: [] })
      await source.preferences.set('global-settings/v1', JSON.stringify({ preferredLanguage: 'en-US', selectedThemeId: 'auto',
        builtinTemplateLanguage: 'en-US', functionMode: 'image', basicSubMode: 'user', proSubMode: 'multi', imageSubMode: 'multiimage', lastActiveAt: 1 }))
      const contextId = await source.contexts.getCurrentId()
      const messages = [{ id: 'context-message', role: 'user' as const, content: 'Explain {{globalSubject}}' }]
      const tools = [{ type: 'function' as const, function: { name: 'lookup', description: 'Sample only', parameters: { type: 'object', properties: {} } } }]
      await source.contexts.update(contextId, { messages, tools, variables: { contextSubject: 'context value' } })
      const parentId = await source.favorites.addCategory({ name: 'Parent', sortOrder: 0 })
      const childId = await source.favorites.addCategory({ name: 'Child', parentId, sortOrder: 1 })
      const favoriteInput = { content: 'shared content', title: 'First', tags: ['sample'], category: childId,
        functionMode: 'basic' as const, optimizationMode: 'system' as const,
        metadata: { media: { coverAssetId: 'favorite-cover', assetIds: ['favorite-cover'] } } }
      const firstId = await source.favorites.addFavorite(favoriteInput)
      const secondId = await source.favorites.addFavorite({ ...favoriteInput, title: 'Second' })
      await source.favorites.updateFavorite(firstId, { content: 'previous content' })
      await source.favorites.updateFavorite(firstId, { content: 'shared content' })
      await source.favorites.addTag('unused-tag')
      const originalFirst = await source.favorites.getFavorite(firstId)
      const asset = originalFirst.metadata!.promptAsset
      const snapshots = new Map<string, Record<string, unknown>>()
      for (const mode of LEGACY_SESSION_SUB_MODE_KEYS) {
        const snapshot = {
          ...(mode === 'pro-multi' ? { conversationMessagesSnapshot: messages, selectedMessageId: 'context-message', messageChainMap: { 'context-message': 'audit-chain' } }
            : mode.startsWith('image-') ? { originalPrompt: `original ${mode}` } : { prompt: `draft ${mode}`, testContent: 'test input' }),
          optimizedPrompt: `optimized ${mode}\nlast line`, reasoning: 'reasoning', chainId: 'audit-chain', versionId: 'audit-record',
          temporaryVariables: { localSubject: `local ${mode}` },
          selectedOptimizeModelKey: 'audit-text', selectedTestModelKey: 'audit-text', selectedTextModelKey: 'audit-text', selectedImageModelKey: 'audit-image',
          selectedTemplateId: 'audit-template', selectedIterateTemplateId: null,
          testVariantResults: mode.startsWith('image-') ? { a: { images: [{ _type: 'image-ref', id: 'session-output' }], text: 'image result' } }
            : { a: { result: 'complete test result', reasoning: 'test reasoning', requestPrompt: 'request' } },
          evaluationResults: { prompt: { score: 91 } },
          assetBinding: { assetId: asset.id, versionId: asset.currentVersionId, status: 'linked' }, origin: { kind: 'favorite', id: firstId },
          ...(mode === 'basic-system' ? { testImageAssetId: 'session-input' } : {}),
          ...(mode === 'image-image2image' ? { inputImageId: 'session-input' } : {}),
          ...(mode === 'image-multiimage' ? { inputImages: [{ id: 'runtime-input', assetId: 'session-input' }] } : {}),
        }
        snapshots.set(mode, snapshot)
        await source.preferences.set(`session/v1/${mode}`, snapshot)
      }
      for (const id of ['session-input', 'session-output']) await source.sessionImages.saveImage(image(id))
      await source.favoriteImages.saveImage(image('favorite-cover'))
      const targetExistingId = await target.favorites.addFavorite({ content: 'shared content', title: 'Target existing', tags: [], functionMode: 'basic', optimizationMode: 'system' })
      const exportOptions = { dataManager: source.data, favoriteManager: source.favorites, imageStorageService: source.sessionImages, favoriteImageStorageService: source.favoriteImages }
      const importOptions = { dataManager: target.data, favoriteManager: target.favorites, imageStorageService: target.sessionImages, favoriteImageStorageService: target.favoriteImages }
      if (route === 'zip') {
        const backup = await createDataManagerResourcePackage(exportOptions)
        expect(backup.missingResources).toEqual([])
        await importDataManagerResourcePackage(await backup.blob.arrayBuffer(), importOptions)
      } else {
        const store = objectStore()
        const backup = await createRemoteSnapshotBackup({ ...exportOptions, objectStore: store })
        expect(backup.missingAssets).toEqual([])
        await restoreRemoteSnapshotBackup({ ...importOptions, objectStore: store, snapshotId: backup.entry.id })
      }
      // A fresh preference instance verifies persistence, without relying on the exporting instance's key cache.
      const persisted = new PreferenceService(target.storage)
      expect(await persisted.get('variableManager.storage', null)).toEqual(await source.preferences.get('variableManager.storage', null))
      expect(JSON.parse(await persisted.get('global-settings/v1', '{}')).imageSubMode).toBe('multiimage')
      for (const [mode, snapshot] of snapshots) expect(await persisted.get(`session/v1/${mode}`, null)).toEqual(snapshot)
      expect((await target.contexts.get(contextId)).tools).toEqual(tools)
      expect((await target.contexts.get(contextId)).messages).toEqual(messages)
      expect((await target.history.getRecords()).map(record => [record.id, record.chainId])).toEqual([['audit-record', 'audit-chain']])
      expect((await target.templates.getTemplate('audit-template')).content).toBe('Use {{globalSubject}}')
      expect((await target.models.getModel('audit-text'))?.connectionConfig.apiKey).toBe('sample-only-text-key')
      expect((await target.imageModels.getConfig('audit-image'))?.connectionConfig?.apiKey).toBe('sample-only-image-key')
      const favorites = await target.favorites.getFavorites()
      expect(new Set(favorites.map(favorite => favorite.id))).toEqual(new Set([targetExistingId, firstId, secondId]))
      expect((await target.favorites.getFavorite(firstId)).metadata?.promptAsset).toEqual(originalFirst.metadata?.promptAsset)
      expect((await target.favorites.getCategories()).find(category => category.id === childId)?.parentId).toBe(parentId)
      expect((await target.favorites.getAllTags()).map(tag => tag.tag)).toContain('unused-tag')
      for (const id of ['session-input', 'session-output']) expect((await target.sessionImages.getImage(id))?.data).toBe(image(id).data)
      expect((await target.favoriteImages.getImage('favorite-cover'))?.data).toBe(image('favorite-cover').data)
    } finally {
      for (const services of [source, target]) {
        await services.sessionImages.clearAll(); await services.sessionImages.close()
        await services.favoriteImages.clearAll(); await services.favoriteImages.close()
      }
    }
  }, 20_000)
})
