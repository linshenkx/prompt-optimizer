import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CORE_SERVICE_KEYS } from '../../../src/constants/storage-keys'
import { ImageAdapterRegistry } from '../../../src/services/image/adapters/registry'
import { ImageModelManager } from '../../../src/services/image-model/manager'
import type { ImageModelConfig } from '../../../src/services/image/types'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import type { IStorageProvider } from '../../../src/services/storage/types'

describe('ImageModelManager initialization behavior', () => {
  let storageProvider: IStorageProvider
  let registry: ImageAdapterRegistry
  let modelManager: ImageModelManager

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider()
    registry = new ImageAdapterRegistry()
    await storageProvider.clearAll()
    modelManager = new ImageModelManager(storageProvider, registry)
  })

  afterEach(async () => {
    await storageProvider.clearAll()
  })

  it('should auto-enable cloudflare when missing required connection fields become available from env', async () => {
    const originalCloudflareToken = process.env.VITE_CF_API_TOKEN
    const originalCloudflareAccountId = process.env.VITE_CF_ACCOUNT_ID
    process.env.VITE_CF_API_TOKEN = 'env_cloudflare_token'
    process.env.VITE_CF_ACCOUNT_ID = 'env_cloudflare_account'

    try {
      await modelManager.ensureInitialized()
      const existing = await modelManager.getConfig('image-cloudflare-flux-klein')
      expect(existing).toBeDefined()

      const storedCloudflare: ImageModelConfig = {
        ...existing!,
        enabled: false,
        connectionConfig: {
          ...existing!.connectionConfig,
          apiKey: '',
          accountId: ''
        }
      }

      await storageProvider.setItem(
        CORE_SERVICE_KEYS.IMAGE_MODELS,
        JSON.stringify({ 'image-cloudflare-flux-klein': storedCloudflare })
      )

      const reloadedManager = new ImageModelManager(storageProvider, new ImageAdapterRegistry())
      await reloadedManager.ensureInitialized()
      const reloaded = await reloadedManager.getConfig('image-cloudflare-flux-klein')

      expect(reloaded?.enabled).toBe(true)
      expect(reloaded?.connectionConfig?.apiKey).toBe('env_cloudflare_token')
      expect(reloaded?.connectionConfig?.accountId).toBe('env_cloudflare_account')
    } finally {
      if (originalCloudflareToken === undefined) {
        delete process.env.VITE_CF_API_TOKEN
      } else {
        process.env.VITE_CF_API_TOKEN = originalCloudflareToken
      }

      if (originalCloudflareAccountId === undefined) {
        delete process.env.VITE_CF_ACCOUNT_ID
      } else {
        process.env.VITE_CF_ACCOUNT_ID = originalCloudflareAccountId
      }
    }
  })

  it('should refresh stored static model metadata to the latest adapter capabilities', async () => {
    await modelManager.ensureInitialized()
    const existing = await modelManager.getConfig('image-seedream')
    expect(existing).toBeDefined()

    const storedSeedream: ImageModelConfig = {
      ...existing!,
      model: {
        ...existing!.model,
        capabilities: {
          ...existing!.model.capabilities,
          multiImage: false
        }
      }
    }

    await storageProvider.setItem(
      CORE_SERVICE_KEYS.IMAGE_MODELS,
      JSON.stringify({ 'image-seedream': storedSeedream })
    )

    const reloadedManager = new ImageModelManager(storageProvider, new ImageAdapterRegistry())
    const reloaded = await reloadedManager.getConfig('image-seedream')

    expect(reloaded?.model.capabilities.multiImage).toBe(true)
  })

  it('should migrate exact legacy builtin image model ids', async () => {
    await modelManager.ensureInitialized()
    const defaults = {
      gemini: await modelManager.getConfig('image-gemini-nanobanana'),
      dashscope: await modelManager.getConfig('image-dashscope'),
      seedream: await modelManager.getConfig('image-seedream-50-lite')
    }
    expect(defaults.gemini && defaults.dashscope && defaults.seedream).toBeTruthy()

    await storageProvider.setItem(CORE_SERVICE_KEYS.IMAGE_MODELS, JSON.stringify({
      'image-gemini-nanobanana': {
        ...defaults.gemini,
        modelId: 'gemini-2.5-flash-image',
        model: { ...defaults.gemini!.model, id: 'gemini-2.5-flash-image' }
      },
      'image-dashscope': {
        ...defaults.dashscope,
        modelId: 'qwen-image',
        model: { ...defaults.dashscope!.model, id: 'qwen-image' }
      },
      'image-seedream-50-lite': {
        ...defaults.seedream,
        modelId: 'doubao-seedream-5-0-260128',
        model: { ...defaults.seedream!.model, id: 'doubao-seedream-5-0-260128' }
      }
    }))

    const reloadedManager = new ImageModelManager(storageProvider, new ImageAdapterRegistry())
    await reloadedManager.ensureInitialized()

    expect((await reloadedManager.getConfig('image-gemini-nanobanana'))?.modelId).toBe('gemini-3.1-flash-image')
    expect((await reloadedManager.getConfig('image-dashscope'))?.modelId).toBe('qwen-image-2.0')
    expect((await reloadedManager.getConfig('image-seedream-50-lite'))?.modelId).toBe('doubao-seedream-5-0-lite-260128')
  })

  it('should refresh embedded provider and model metadata when providerId/modelId are updated directly', async () => {
    await modelManager.ensureInitialized()
    const existing = await modelManager.getConfig('image-seedream')
    expect(existing).toBeDefined()
    expect(existing?.providerId).toBe('seedream')

    await modelManager.updateConfig(existing!.id, {
      providerId: 'openai',
      modelId: 'gpt-image-2',
      connectionConfig: {
        apiKey: 'openai-key',
        baseURL: 'https://api.openai.com/v1'
      }
    })

    const updated = await modelManager.getConfig(existing!.id)

    expect(updated?.providerId).toBe('openai')
    expect(updated?.provider.id).toBe('openai')
    expect(updated?.modelId).toBe('gpt-image-2')
    expect(updated?.model.id).toBe('gpt-image-2')
    expect(updated?.model.providerId).toBe('openai')
  })

  it('should add configs from identity fields without UI-provided metadata snapshots', async () => {
    await modelManager.addConfig({
      id: 'image-identity-only',
      name: 'Identity Only',
      providerId: 'openai',
      modelId: 'gpt-image-2',
      enabled: true,
      connectionConfig: {
        apiKey: 'openai-key',
        baseURL: 'https://api.openai.com/v1'
      },
      paramOverrides: {}
    })

    const stored = await modelManager.getConfig('image-identity-only')

    expect(stored?.providerId).toBe('openai')
    expect(stored?.provider.id).toBe('openai')
    expect(stored?.modelId).toBe('gpt-image-2')
    expect(stored?.model.id).toBe('gpt-image-2')
    expect(stored?.model.providerId).toBe('openai')
  })

  it('should import identity-only configs and export resolved snapshots', async () => {
    await modelManager.importData([{
      id: 'image-import-identity-only',
      name: 'Image Import Identity Only',
      providerId: 'openai',
      modelId: 'gpt-image-2',
      enabled: true,
      connectionConfig: {
        apiKey: 'openai-key',
        baseURL: 'https://api.openai.com/v1'
      },
      paramOverrides: {}
    }])

    const exported = await modelManager.exportData()
    const imported = exported.find(config => config.id === 'image-import-identity-only')

    expect(imported?.providerId).toBe('openai')
    expect(imported?.provider.id).toBe('openai')
    expect(imported?.modelId).toBe('gpt-image-2')
    expect(imported?.model.id).toBe('gpt-image-2')
    expect(imported?.model.providerId).toBe('openai')
  })

  it('should infer identity from legacy provider/model snapshots on read', async () => {
    await modelManager.ensureInitialized()
    const existing = await modelManager.getConfig('image-seedream')
    expect(existing).toBeDefined()

    const legacySnapshot = {
      ...existing!,
      providerId: undefined,
      modelId: undefined
    }

    await storageProvider.setItem(
      CORE_SERVICE_KEYS.IMAGE_MODELS,
      JSON.stringify({ 'legacy-image-snapshot': legacySnapshot })
    )

    const restored = await modelManager.getConfig('legacy-image-snapshot')

    expect(restored?.providerId).toBe(existing?.provider.id)
    expect(restored?.modelId).toBe(existing?.model.id)
    expect(restored?.provider.id).toBe(existing?.provider.id)
    expect(restored?.model.providerId).toBe(existing?.provider.id)
  })

  it('should export legacy provider/model snapshots with repaired identity fields', async () => {
    await modelManager.ensureInitialized()
    const existing = await modelManager.getConfig('image-seedream')
    expect(existing).toBeDefined()

    const legacySnapshot = {
      ...existing!,
      providerId: undefined,
      modelId: undefined
    }

    await storageProvider.setItem(
      CORE_SERVICE_KEYS.IMAGE_MODELS,
      JSON.stringify({ 'legacy-image-export': legacySnapshot })
    )

    const exported = await modelManager.exportData()
    const repaired = exported.find(config => config.id === 'legacy-image-export')

    expect(repaired?.providerId).toBe(existing?.provider.id)
    expect(repaired?.modelId).toBe(existing?.model.id)
    expect(repaired?.provider.id).toBe(existing?.provider.id)
    expect(repaired?.model.providerId).toBe(existing?.provider.id)
  })
})
