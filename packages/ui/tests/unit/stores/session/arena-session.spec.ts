import { beforeEach, describe, it, expect, vi } from 'vitest'
import { createTestPinia, createPreferenceServiceStub } from '../../../utils/pinia-test-helpers'
import { useArenaSession } from '../../../../src/stores/session/useArenaSession'
import { collectBackupImageReferences } from '../../../../src/utils/image-resource-references'
import { createArenaState, isArenaState, createTextAdapterRegistry, createImageAdapterRegistry, type TextModelConfig, type StreamHandlers } from '@prompt-optimizer/core'
import { getOutputDocument } from '../../../../src/utils/output-document'
import { getPiniaServices } from '../../../../src/plugins/pinia'
import { pauseSessionWrites } from '../../../../src/stores/session/sessionPersistence'

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r }); return { promise, resolve } }
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
describe('arena execution and persistence', () => {
  let store: ReturnType<typeof useArenaSession>
  let preferences: Map<string, unknown>
  let calls: Array<{ handlers: StreamHandlers; selection: any; gate: ReturnType<typeof deferred> }>
  let base: TextModelConfig
  beforeEach(async () => {
    preferences = new Map(); calls = []
    const registry = createTextAdapterRegistry()
    const adapter = registry.getAdapter('openai')
    base = { id: 'connection', name: 'Connection', enabled: true, providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('gpt-4o-mini'),
      connectionConfig: { apiKey: 'private-credential', baseURL: 'https://example.test/v1' }, paramOverrides: { temperature: 0.2 } }
    const { pinia } = createTestPinia({
      preferenceService: createPreferenceServiceStub({ get: async (key, fallback) => (preferences.get(key) ?? fallback) as any,
        set: async (key, value) => { preferences.set(key, JSON.parse(JSON.stringify(value))) } }),
      modelManager: { getAllModels: async () => [base], getModel: async () => base } as any,
      textAdapterRegistry: registry,
      llmService: { sendMessageStream: vi.fn(async (_messages, _config, handlers, selection) => {
        const gate = deferred(); calls.push({ handlers, selection, gate }); await gate.promise
      }) } as any,
    })
    store = useArenaSession(pinia)
    await store.restoreSession(); await store.refreshConfigs()
    store.state.prompt = 'Shared task'
    store.state.contestants.forEach(c => { c.configKey = base.id; c.modelId = base.modelMeta.id })
  })
  const finish = (index: number, text = `answer ${index}`) => { calls[index].handlers.onToken(text); calls[index].gate.resolve() }

  it('replaces imported input without changing models, results or starting a request', async () => {
    const id = store.state.contestants[0].id
    const run = store.run(id); await tick(); finish(0); await run
    const columns = JSON.stringify(store.state.contestants)
    const results = JSON.stringify(store.state.results)
    expect(await store.replaceInput('Garden benchmark')).toBe(true)
    expect(store.state.prompt).toBe('Garden benchmark')
    expect(JSON.stringify(store.state.contestants)).toBe(columns)
    expect(JSON.stringify(store.state.results)).toBe(results)
    expect(calls).toHaveLength(1)
    expect((preferences.get('session/v1/arena') as any).prompt).toBe('Garden benchmark')
  })

  it('rejects imported input while a model request is running', async () => {
    const run = store.run(store.state.contestants[0].id); await tick()
    await expect(store.replaceInput('replacement')).rejects.toThrow('arena.inputBusy')
    expect(store.state.prompt).toBe('Shared task')
    finish(0); await run
  })

  it('starts runs and adds columns without the secure-context-only randomUUID API', async () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    try {
      const id = store.addContestant()
      const run = store.run(id); await tick()
      expect(calls).toHaveLength(1)
      finish(0); await run
      expect(store.state.results[id].status).toBe('success')
      expect(store.state.results[id].runId).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i)
    } finally { vi.unstubAllGlobals() }
  })

  it('keeps six independent IDs and results through middle deletion and addition', async () => {
    while (store.state.contestants.length < 6) store.addContestant()
    const ids = store.state.contestants.map(c => c.id)
    expect(new Set(ids).size).toBe(6)
    const run = store.run(ids[2]); await tick(); finish(0); await run
    const result = store.state.results[ids[2]]
    store.removeContestant(ids[1]); const added = store.addContestant()
    expect(ids).not.toContain(added)
    expect(store.state.results[ids[2]]).toBe(result)
    expect(store.state.contestants[1].id).toBe(ids[2])
    expect(isArenaState(store.state)).toBe(true)
  })

  it('starts every batch request immediately with no concurrency limit and ignores duplicate clicks', async () => {
    while (store.state.contestants.length < 12) store.addContestant()
    const ids = store.state.contestants.map(c => c.id)
    const batch = store.runAll(); await tick()
    expect(calls).toHaveLength(12)
    expect(Object.values(store.state.results).every(result => result.status === 'running')).toBe(true)
    await store.run(ids[0])
    expect(calls).toHaveLength(12)
    store.stop(ids[2])
    expect(store.state.results[ids[2]].status).toBe('cancelled')
    calls.forEach((_, index) => finish(index))
    await batch
    expect(store.running).toBe(false)
    expect(Object.values(store.state.results).filter(r => r.status === 'success')).toHaveLength(11)
  })

  it('uses saved model parameters for every column and detects connection drift', async () => {
    const [a] = store.state.contestants
    const batch = store.runAll(); await tick()
    expect(calls.map(c => c.selection.configSnapshot.paramOverrides.temperature)).toEqual([0.2, 0.2])
    expect(base.paramOverrides.temperature).toBe(0.2)
    finish(0); finish(1); await batch
    expect(store.isStale(a.id)).toBe(false)
    const run = store.run(a.id); await tick()
    base = { ...base, paramOverrides: { temperature: 0.8 } }
    await store.refreshConfigs()
    expect(calls[2].selection.configSnapshot.paramOverrides.temperature).toBe(0.2)
    finish(2); await run
    expect(store.isStale(a.id)).toBe(true)
    const snapshot = JSON.stringify(preferences.get('session/v1/arena'))
    expect(snapshot).not.toContain('private-credential')
    expect(snapshot).toContain('"temperature":0.2')
  })

  it('uses the shared output channel for reasoning, snapshots, and capacity', async () => {
    const id = store.state.contestants[0].id
    const run = store.run(id); await tick()
    calls[0].handlers.onToken('x'.repeat(160_000))
    calls[0].handlers.onReasoningToken?.('reasoning')
    expect(store.state.results[id].output.result).toBe('')
    expect(getOutputDocument(store.state.results[id].output)?.length).toBe(160_000)
    await store.saveSession()
    expect((preferences.get('session/v1/arena') as any).results[id].output.result).toHaveLength(160_000)
    expect(() => calls[0].handlers.onToken('y'.repeat(1_100_000))).toThrow('capacity')
    calls[0].gate.resolve(); await run
    expect(store.state.results[id]).toMatchObject({ status: 'error', error: 'arena.capacity', output: { reasoning: 'reasoning', status: 'capacity' } })
    expect(store.state.results[id].output.result).toHaveLength(160_000)
  })

  it('starts a retry immediately and isolates callbacks from the cancelled transport', async () => {
    const id = store.state.contestants[0].id
    const first = store.run(id); await tick()
    store.stop(id)
    expect(calls[0].handlers.signal?.aborted).toBe(true)
    const second = store.run(id); await tick()
    expect(calls).toHaveLength(2)
    calls[0].handlers.onToken('late'); calls[0].handlers.onError(new Error('late failure'))
    finish(1, 'new result'); await second
    expect(store.running).toBe(true)
    calls[0].handlers.onToken('later')
    calls[0].gate.resolve(); await first
    expect(store.running).toBe(false)
    expect(store.state.results[id]).toMatchObject({ status: 'success', output: { result: 'new result' } })
  })

  it('handles stop initiated by the common OutputDisplay document', async () => {
    const id = store.state.contestants[0].id
    const run = store.run(id); await tick()
    calls[0].handlers.onToken('partial')
    getOutputDocument(store.state.results[id].output)?.interrupt()
    finish(0, 'late'); await run
    expect(store.state.results[id]).toMatchObject({ status: 'cancelled', output: { result: 'partial', status: 'cancelled' } })
  })

  it('isolates failures, refuses an incomplete batch, and rejects missing media', async () => {
    const [a, b] = store.state.contestants
    const run = store.runAll(); await tick()
    calls[0].handlers.onError(new Error('provider failed')); calls[0].gate.resolve()
    finish(1); await run
    expect(store.state.results[a.id].status).toBe('error')
    expect(store.state.results[b.id].status).toBe('success')
    b.modelId = ''
    await expect(store.runAll()).rejects.toThrow('arena.incomplete')
    store.state.images = [{ id: 'missing', _type: 'image-ref' }]
    await store.run(a.id)
    expect(store.state.results[a.id].error).toBe('arena.missingImage')
    expect(calls).toHaveLength(2)
  })

  it('preserves active tasks across restore and restores running results as interrupted', async () => {
    const id = store.state.contestants[0].id
    const run = store.run(id); await tick()
    await store.saveSession()
    const snapshot = structuredClone(preferences.get('session/v1/arena')) as any
    preferences.set('session/v1/arena', createArenaState())
    await store.restoreSession()
    expect(store.state.prompt).toBe('Shared task')
    finish(0); await run
    preferences.set('session/v1/arena', snapshot)
    await store.restoreSession()
    expect(store.state.results[id]).toMatchObject({ status: 'error', error: 'arena.interrupted' })
    expect(isArenaState(store.state)).toBe(true)
  })

  it('protects malformed sessions and respects the shared backup write boundary', async () => {
    preferences.set('session/v1/arena', { broken: true })
    await expect(store.restoreSession()).rejects.toThrow('arena.invalidSession')
    expect(await store.saveSession()).toBe(false)
    expect(preferences.get('session/v1/arena')).toEqual({ broken: true })
    preferences.set('session/v1/arena', createArenaState()); await store.restoreSession()
    const release = pauseSessionWrites(getPiniaServices()!.preferenceService!)
    store.state.prompt = 'blocked write'
    await store.saveSession()
    expect((preferences.get('session/v1/arena') as any).prompt).toBe('')
    release.release(); await store.saveSession()
    expect((preferences.get('session/v1/arena') as any).prompt).toBe('blocked write')
  })

  it('drops retired column overrides and concurrency from legacy sessions while retaining results', async () => {
    const id = store.state.contestants[0].id
    const run = store.run(id); await tick(); finish(0); await run
    const legacy = structuredClone(preferences.get('session/v1/arena')) as any
    legacy.concurrency = 1
    legacy.contestants.forEach(c => { c.parameters = { temperature: 0.9 } })
    legacy.results[id].model.parameters = { temperature: 0.9 }
    legacy.results[id].status = 'queued'
    preferences.set('session/v1/arena', legacy)
    await store.restoreSession()
    expect(store.state).not.toHaveProperty('concurrency')
    expect(store.state.contestants[0]).not.toHaveProperty('parameters')
    expect(store.state.results[id].model).not.toHaveProperty('parameters')
    expect(store.state.results[id]).toMatchObject({ status: 'error', error: 'arena.interrupted', output: { result: 'answer 0' } })
    const batch = store.runAll(); await tick()
    expect(calls).toHaveLength(3)
    expect(calls.slice(1).map(c => c.selection.configSnapshot.paramOverrides.temperature)).toEqual([0.2, 0.2])
    finish(1); finish(2); await batch
    expect(preferences.get('session/v1/arena')).not.toHaveProperty('concurrency')
  })

  it('persists ordered image inputs and generated media, retaining historical references for backup', async () => {
    const services = getPiniaServices()!
    const assets = new Map<string, any>()
    services.imageStorageService = { getImage: async id => assets.get(id), getMetadata: async id => assets.get(id)?.metadata,
      saveImage: async image => { assets.set(image.metadata.id, image) } } as any
    const registry = createImageAdapterRegistry(); const adapter = registry.getAdapter('openai')
    const model = adapter.buildDefaultModel('gpt-image-1')
    services.imageAdapterRegistry = registry
    services.imageModelManager = { getAllConfigs: async () => [], getConfig: async () => ({ id: 'image', name: 'Image', enabled: true, providerId: 'openai', modelId: model.id, model, provider: adapter.getProvider(), paramOverrides: {}, connectionConfig: { apiKey: 'image-secret' } }) } as any
    const multi = vi.fn(async () => ({ text: 'illustration', images: [{ b64: 'b3V0cHV0', mimeType: 'image/png' }] }))
    services.imageService = { generateMultiImage: multi } as any
    await store.addImages([{ b64: 'aW5wdXQx', mimeType: 'image/png' }, { b64: 'aW5wdXQy', mimeType: 'image/png' }])
    const c = store.state.contestants[0]; c.kind = 'image'; c.configKey = 'image'; c.modelId = model.id
    await store.run(c.id)
    expect(multi.mock.calls[0][0].inputImages.map(i => i.b64)).toEqual(['aW5wdXQx', 'aW5wdXQy'])
    expect(store.state.results[c.id].status).toBe('success')
    store.state.images = []
    const refs = collectBackupImageReferences({ workspaceSessions: { sessions: { arena: store.state } } }, null)
    expect(refs.imageCache.size).toBe(3)
    expect(JSON.stringify(preferences.get('session/v1/arena'))).not.toContain('image-secret')
    expect(assets.get(store.state.results[c.id].images[0].id).data).toBe('b3V0cHV0')
  })
})
