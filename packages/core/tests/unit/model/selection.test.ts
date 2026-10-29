import { describe, expect, it, vi } from 'vitest'
import { ModelManager } from '../../../src/services/model/manager'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { CORE_SERVICE_KEYS } from '../../../src/constants/storage-keys'
import { decodeTextModelSelection, encodeTextModelSelection } from '../../../src/services/model/selection'
import { LLMService } from '../../../src/services/llm/service'
import { ElectronModelManagerProxy } from '../../../src/services/model/electron-proxy'

async function setup() {
  const registry = new TextAdapterRegistry()
  const adapter = registry.getAdapter('openai')
  const models = adapter.getModels()
  const storage = new MemoryStorageProvider()
  const manager = new ModelManager(storage, registry)
  await manager.ensureInitialized()
  await manager.addModel('connection', {
    id: 'connection', name: 'Office gateway', enabled: true,
    providerId: 'openai', modelId: models[0].id,
    providerMeta: adapter.getProvider(), modelMeta: models[0],
    connectionConfig: { apiKey: 'test-only-key', baseURL: 'http://localhost:9999/v1' },
  })
  return { registry, adapter, models, storage, manager }
}

describe('workspace-local text model selections', () => {
  it('resolves the same local selection in the Electron renderer without an IPC configuration write', async () => {
    const { manager, models } = await setup()
    const config = await manager.getModel('connection')
    const updateModel = vi.fn()
    vi.stubGlobal('window', { electronAPI: { model: { getAllModels: async () => [config], updateModel } } })
    try {
      const proxy = new ElectronModelManagerProxy()
      expect((await proxy.getModel(encodeTextModelSelection('connection', models[1].id)))?.modelMeta.id).toBe(models[1].id)
      expect(updateModel).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('round-trips private IDs without embedding credentials; malformed references stay invalid', () => {
    const key = encodeTextModelSelection('工作/配置:#1', 'private/model:latest')
    expect(decodeTextModelSelection(key)).toEqual({ configId: '工作/配置:#1', modelId: 'private/model:latest' })
    expect(decodeTextModelSelection('ordinary-config')).toBeNull()
    expect(decodeTextModelSelection('text-selection:v1:%broken')).toBeNull()
    expect(decodeTextModelSelection('text-selection:v1:%5B1%2C2%5D')).toBeNull()
  })

  it('resolves simultaneous column choices independently without writing or changing the saved configuration', async () => {
    const { manager, models, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    const [a, b] = await Promise.all([
      manager.getModel(encodeTextModelSelection('connection', models[0].id)),
      manager.getModel(encodeTextModelSelection('connection', models[1].id)),
    ])
    expect(a?.modelId).toBe(models[0].id)
    expect(b?.modelId).toBe(models[1].id)
    expect(b?.modelMeta.id).toBe(models[1].id)
    expect(b?.connectionConfig).toEqual(a?.connectionConfig)
    expect((await manager.getModel('connection'))?.modelId).toBe(models[0].id)
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
    expect((await manager.exportData()).some(model => model.id.startsWith('text-selection:'))).toBe(false)
    const reloaded = new ModelManager(storage)
    expect((await reloaded.getModel(encodeTextModelSelection('connection', models[1].id)))?.modelId).toBe(models[1].id)
  })

  it('passes the selected model to the actual LLM adapter and honors disabled/deleted connections', async () => {
    const { registry, adapter, manager, models } = await setup()
    const key = encodeTextModelSelection('connection', models[1].id)
    const send = vi.spyOn(adapter, 'sendMessage').mockResolvedValue({ content: 'ok' })
    const llm = new LLMService(manager, registry)
    await llm.sendMessage([{ role: 'user', content: 'hello' }], key)
    expect(send.mock.calls[0][1]).toMatchObject({ modelId: models[1].id, modelMeta: { id: models[1].id } })
    await manager.disableModel('connection')
    await expect(llm.sendMessage([{ role: 'user', content: 'hello' }], key)).rejects.toThrow()
    expect(send).toHaveBeenCalledTimes(1)
    await manager.deleteModel('connection')
    expect(await manager.getModel(key)).toBeUndefined()
  })
})
