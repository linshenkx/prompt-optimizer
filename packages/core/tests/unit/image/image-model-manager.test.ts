import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
      openrouter: await modelManager.getConfig('image-openrouter-nanobanana'),
      gemini: await modelManager.getConfig('image-gemini-nanobanana'),
      openai: await modelManager.getConfig('image-openai-gpt'),
      dashscope: await modelManager.getConfig('image-dashscope'),
      seedream: await modelManager.getConfig('image-seedream-50-lite'),
      grok: await modelManager.getConfig('image-grok-imagine')
    }
    expect(
      defaults.openrouter
      && defaults.gemini
      && defaults.openai
      && defaults.dashscope
      && defaults.seedream
      && defaults.grok
    ).toBeTruthy()

    await storageProvider.setItem(CORE_SERVICE_KEYS.IMAGE_MODELS, JSON.stringify({
      'image-openrouter-nanobanana': {
        ...defaults.openrouter,
        modelId: 'google/gemini-2.5-flash-image',
        model: { ...defaults.openrouter!.model, id: 'google/gemini-2.5-flash-image' }
      },
      'image-gemini-nanobanana': {
        ...defaults.gemini,
        modelId: 'gemini-2.5-flash-image',
        model: { ...defaults.gemini!.model, id: 'gemini-2.5-flash-image' }
      },
      'image-openai-gpt': {
        ...defaults.openai,
        modelId: 'gpt-image-2',
        model: { ...defaults.openai!.model, id: 'gpt-image-2' }
      },
      'image-dashscope': {
        ...defaults.dashscope,
        modelId: 'qwen-image-2.0',
        model: { ...defaults.dashscope!.model, id: 'qwen-image-2.0' }
      },
      'image-seedream-50-lite': {
        ...defaults.seedream,
        modelId: 'doubao-seedream-5-0-260128',
        model: { ...defaults.seedream!.model, id: 'doubao-seedream-5-0-260128' }
      },
      'image-grok-imagine': {
        ...defaults.grok,
        modelId: 'grok-imagine-image-quality',
        model: { ...defaults.grok!.model, id: 'grok-imagine-image-quality' }
      }
    }))

    const reloadedManager = new ImageModelManager(storageProvider, new ImageAdapterRegistry())
    await reloadedManager.ensureInitialized()

    expect((await reloadedManager.getConfig('image-openrouter-nanobanana'))?.modelId).toBe('google/gemini-3.1-flash-image')
    expect((await reloadedManager.getConfig('image-gemini-nanobanana'))?.modelId).toBe('gemini-3.1-flash-image')
    expect((await reloadedManager.getConfig('image-openai-gpt'))?.modelId).toBe('gpt-image-2.5-flare')
    expect((await reloadedManager.getConfig('image-dashscope'))?.modelId).toBe('qwen-image-3.0-pro')
    expect((await reloadedManager.getConfig('image-seedream-50-lite'))?.modelId).toBe('doubao-seedream-5-0-lite-260128')
    expect((await reloadedManager.getConfig('image-grok-imagine'))?.modelId).toBe('grok-imagine-image-2.0')
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

  it('should reject invalid import entries before changing earlier configs', async () => {
    const valid = {
      id: 'not-written', name: 'Valid', providerId: 'openai', modelId: 'gpt-image-2',
      enabled: false, connectionConfig: {}, paramOverrides: {},
    }
    const before = await modelManager.exportData()
    expect(await modelManager.validateData([valid, { ...valid, id: 'broken', name: '' }])).toBe(false)
    await expect(modelManager.importData([valid, { ...valid, id: 'broken', name: '' }]))
      .rejects.toThrow('Invalid image model configuration at index 1')
    expect(await modelManager.exportData()).toEqual(before)
  })

  it('should propagate image model storage failures', async () => {
    const valid = {
      id: 'write-failed', name: 'Valid', providerId: 'openai', modelId: 'gpt-image-2',
      enabled: false, connectionConfig: {}, paramOverrides: {},
    }
    vi.spyOn(modelManager, 'addConfig').mockRejectedValueOnce(new Error('Storage write failed'))
    await expect(modelManager.importData([valid])).rejects.toThrow('Failed to import 1 image model configurations')
    expect(await modelManager.getConfig(valid.id)).toBeNull()
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
