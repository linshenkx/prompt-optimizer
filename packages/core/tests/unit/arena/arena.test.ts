import { describe, it, expect, vi } from 'vitest'
import { createArenaState, createArenaContestant, isArenaState, normalizeArenaState, arenaFingerprint } from '../../../src/services/arena/types'
import { resolveRuntimeTextModel, resolveRuntimeImageModel, describeRuntimeModel } from '../../../src/services/model/runtime-selection'
import { createTextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { createImageAdapterRegistry } from '../../../src/services/image/adapters/registry'
import { WorkspaceSessionTransfer } from '../../../src/services/data/workspace-session-transfer'
import { ImageService } from '../../../src/services/image/service'
import { LLMService } from '../../../src/services/llm/service'

describe('arena runtime contracts', () => {
  it('creates unique columns when the secure-context-only randomUUID API is absent', () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    try {
      const state = createArenaState()
      state.contestants.push(createArenaContestant())
      expect(isArenaState(state)).toBe(true)
      expect(new Set(state.contestants.map(c => c.id)).size).toBe(3)
      expect(state.contestants[0].id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i)
    } finally { vi.unstubAllGlobals() }
  })

  it('accepts dynamic columns and rejects duplicate IDs and detached results', () => {
    const state = createArenaState()
    while (state.contestants.length < 6) state.contestants.push(createArenaContestant())
    expect(isArenaState(state)).toBe(true)
    expect(isArenaState({ ...state, contestants: [state.contestants[0], state.contestants[0]] })).toBe(false)
    expect(isArenaState({ ...state, results: { detached: {} } })).toBe(false)
    expect(state).not.toHaveProperty('concurrency')
  })
  it('fingerprints image order and resolved inherited settings, ignoring property insertion order', () => {
    const registry = createTextAdapterRegistry(); const adapter = registry.getAdapter('openai')
    const base = { id: 'text', name: 'Text', enabled: true, providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('gpt-4o-mini'),
      connectionConfig: { apiKey: 'secret', baseURL: 'https://user:password@example.test/v1?api_key=secret', headers: { Authorization: 'private' } }, paramOverrides: { temperature: 0.2 } }
    const c = createArenaContestant(); const images = [{ id: 'one', _type: 'image-ref' as const }, { id: 'two', _type: 'image-ref' as const }]
    const first = describeRuntimeModel(base)
    expect(JSON.stringify(first)).not.toMatch(/secret|password|private/)
    expect(arenaFingerprint('p', images, c, first)).not.toBe(arenaFingerprint('p', images, c, describeRuntimeModel({ ...base, paramOverrides: { temperature: 0.8 } })))
    expect(arenaFingerprint('p', images, c, { ...first, connection: { region: 'a', endpoint: 'b' } })).toBe(arenaFingerprint('p', images, c, { ...first, connection: { endpoint: 'b', region: 'a' } }))
    expect(arenaFingerprint('p', images, c, first)).not.toBe(arenaFingerprint('p', [...images].reverse(), c, first))
  })
  it('executes the selected model with frozen saved parameters without mutating the connection', async () => {
    const registry = createTextAdapterRegistry(); const adapter = registry.getAdapter('openai')
    const base = { id: 'text', name: 'Text', enabled: true, providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('first'), connectionConfig: { apiKey: 'secret' }, paramOverrides: { temperature: 0.2, obsolete: 1 } }
    const before = JSON.stringify(base)
    const config = resolveRuntimeTextModel(base, { modelId: 'second' }, registry)
    const send = vi.spyOn(adapter, 'sendMessageStream').mockResolvedValue()
    const lookup = vi.fn(async () => { throw new Error('must not lookup changed connection') })
    const service = new LLMService({ getModel: lookup } as any, registry)
    await service.sendMessageStream([{ role: 'user', content: 'test' }], 'text', { onToken() {}, onComplete() {}, onError() {} }, { configSnapshot: config })
    expect(lookup).not.toHaveBeenCalled()
    expect(send.mock.calls[0][1]).toMatchObject({ modelMeta: { id: 'second' }, paramOverrides: { temperature: 0.2 } })
    expect(config.paramOverrides.obsolete).toBeUndefined()
    expect(JSON.stringify(base)).toBe(before)
  })
  it('uses the selected image model capabilities and frozen inherited parameters', async () => {
    const registry = createImageAdapterRegistry(); const adapter = registry.getAdapter('openai')
    const base = { id: 'image', name: 'Image', enabled: true, providerId: 'openai', modelId: 'first', provider: adapter.getProvider(), model: adapter.buildDefaultModel('first'), connectionConfig: { apiKey: 'secret' }, paramOverrides: {} }
    const config = resolveRuntimeImageModel(base, { modelId: 'gpt-image-2.5-flare' }, registry)
    const generate = vi.spyOn(adapter, 'generate').mockResolvedValue({ images: [{ b64: 'aW1hZ2U=' }] })
    const service = new ImageService({ getConfig: vi.fn(async () => { throw new Error('must use snapshot') }) } as any, registry)
    const result = await service.generateImage2Image({ configId: base.id, configSnapshot: config, prompt: 'redraw', inputImage: { b64: 'aW1hZ2U=', mimeType: 'image/png' } })
    expect(generate.mock.calls[0][1].modelId).toBe('gpt-image-2.5-flare')
    expect(result.metadata?.modelId).toBe('gpt-image-2.5-flare')
    expect(base.modelId).toBe('first')
  })
  it('exports and imports the independent arena payload with more than four columns', async () => {
    const state = createArenaState()
    while (state.contestants.length < 6) state.contestants.push(createArenaContestant())
    state.images = [{ id: 'reference', _type: 'image-ref' }]
    const prefs = { get: vi.fn(async (key, fallback) => key === 'session/v1/arena' ? state : fallback), set: vi.fn(async () => {}) }
    const transfer = new WorkspaceSessionTransfer(prefs as any)
    const data = await transfer.exportData(); await transfer.importData(data)
    expect(data.sessions.arena).toEqual(state)
    expect(prefs.set).toHaveBeenCalledWith('session/v1/arena', state)
    expect(await transfer.validateData({ ...data, sessions: { arena: { ...state, contestants: [] } } })).toBe(false)
  })
  it('normalizes old sessions without carrying retired controls into new saves', () => {
    const legacy = { ...createArenaState(), concurrency: 1 }
    legacy.contestants = legacy.contestants.map(c => ({ ...c, parameters: { temperature: 0.9 } }))
    expect(isArenaState(legacy)).toBe(true)
    const restored = normalizeArenaState(legacy)
    expect(restored).not.toHaveProperty('concurrency')
    expect(restored.contestants[0]).not.toHaveProperty('parameters')
    expect(restored.contestants.map(c => c.id)).toEqual(legacy.contestants.map(c => c.id))
  })
})
