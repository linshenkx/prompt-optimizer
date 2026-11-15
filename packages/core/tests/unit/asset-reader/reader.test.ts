import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspect } from 'node:util'

// These throw if the reader ever imports initialization/default/environment paths.
vi.mock('../../../src/services/model/manager', () => { throw new Error('ModelManager must not load') })
vi.mock('../../../src/services/favorite/manager', () => { throw new Error('FavoriteManager must not load') })
vi.mock('../../../src/services/model/defaults', () => { throw new Error('Model defaults must not load') })
vi.mock('../../../src/utils/environment', () => { throw new Error('Environment must not load') })
vi.mock('../../../src/services/llm/adapters/registry', () => { throw new Error('SDK registry must not load') })

import { AssetReadError, createReadonlyAssetReader, type AssetReadStorage } from '../../../src/services/asset-reader'
import { createPromptContract } from '../../../src/services/prompt-model/mode'
import type { AssetReadErrorCode } from '../../../src/services/asset-reader'

const secret = 'SYNTHETIC_PRIVATE_SENTINEL'
const model = (name = 'Saved model') => ({
  id: 'internal-id', name, enabled: true, providerId: 'openai-compatible', modelId: 'saved-real-model',
  providerMeta: { id: 'openai-compatible', name: 'Saved provider', requiresApiKey: false, private: secret },
  modelMeta: { id: 'saved-real-model', providerId: 'openai-compatible', name: 'Saved metadata',
    parameterDefinitions: [], capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 16000, private: secret } },
  connectionConfig: { apiKey: secret, headers: { Authorization: secret }, baseURL: `https://private.invalid/?token=${secret}` },
  paramOverrides: { temperature: 0.3, arbitrary: secret }, metadata: { private: secret },
})
const favorite = (id = 'fav-a', content = 'Summarize {{topic}}') => ({
  id, title: `Title ${id}`, content, tags: ['summary'], createdAt: 1, updatedAt: 2, useCount: 0,
  functionMode: 'context', optimizationMode: 'user',
  metadata: { private: secret, sourceURL: `https://private.invalid/${secret}`, reproducibility: {
    variables: [{ name: 'topic', required: true, type: 'string', defaultValue: secret, description: secret, source: secret }],
    examples: [{ text: secret, outputText: secret }],
  } },
})
function fixture(values: Record<string, unknown> = { models: { saved: model() }, favorites: [favorite()] }, sourceId = 'profile-a') {
  const data = new Map(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]))
  const reads: string[] = []
  const writes: string[] = []
  const storage = new Proxy({}, {
    get(_target, key) {
      if (key === 'getItem') return async (key: string) => {
        reads.push(key)
        if (!['models', 'favorites'].includes(key)) throw new Error(secret)
        return data.get(key) ?? null
      }
      writes.push(String(key))
      throw new Error(`Forbidden provider access: ${String(key)}`)
    },
  }) as AssetReadStorage
  const reader = createReadonlyAssetReader(storage, { sourceId, sourceEpoch: 'schema-epoch-1' })
  return { reader, data, reads, writes }
}
async function rejectsSafely(promise: Promise<unknown>, code: AssetReadErrorCode) {
  let caught: unknown
  try { await promise } catch (error) { caught = error }
  expect(caught).toBeInstanceOf(AssetReadError)
  expect((caught as AssetReadError).code).toBe(code)
  expect(inspect(caught, { showHidden: true })).not.toContain(secret)
  expect(caught).not.toHaveProperty('cause')
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('source-bound readonly asset discovery', () => {
  it('uses only getItem, does not initialize managers, and ignores synthetic environment defaults', async () => {
    vi.stubEnv('VITE_OPENAI_API_KEY', secret)
    vi.stubEnv('VITE_CUSTOM_MODEL', 'environment-replacement')
    const f = fixture()
    const before = Array.from(f.data)
    const models = await f.reader.listModels()
    const assets = await f.reader.listAssets()
    const detail = await f.reader.getAssetVersion({ favoriteId: 'fav-a', assetId: assets.items[0].assetId, versionId: assets.items[0].currentVersionId })
    expect(models.items.map(m => m.modelId)).toEqual(['saved-real-model'])
    expect(detail.content.text).toBe('Summarize {{topic}}')
    expect(Array.from(f.data)).toEqual(before)
    expect(f.writes).toEqual([])
    expect(f.reads).toEqual(['models', 'favorites', 'favorites'])
  })

  it('projects models with an exact public whitelist, preserving actual configured identity and map key', async () => {
    const f = fixture()
    const item = (await f.reader.listModels()).items[0]
    expect(item).toEqual({ configKey: 'saved', name: 'Saved model', enabled: true,
      providerId: 'openai-compatible', modelId: 'saved-real-model',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 16000 },
      revision: expect.any(String), executable: false, unavailableReason: 'EXECUTION_NOT_CONNECTED' })
    expect(JSON.stringify(item)).not.toContain(secret)
    expect(item).not.toHaveProperty('connectionConfig')
    expect(item).not.toHaveProperty('metadata')
    expect(item).not.toHaveProperty('paramOverrides')
  })

  it('uses authoritative identity while withholding stale metadata capabilities', async () => {
    const raw = model()
    raw.modelId = 'new-selected-model'
    const item = (await fixture({ models: { saved: raw } }).reader.listModels()).items[0]
    expect(item).toMatchObject({ modelId: 'new-selected-model', capabilities: {}, unavailableReason: 'MODEL_METADATA_MISMATCH' })
  })

  it('identifies legacy models without unknown-provider fallback or invented capabilities', async () => {
    const legacy = { name: 'Legacy', provider: 'private-provider', defaultModel: 'private-model', enabled: true, baseURL: '', apiKey: secret }
    const item = (await fixture({ models: { old: legacy } }).reader.listModels()).items[0]
    expect(item).toMatchObject({ providerId: 'private-provider', modelId: 'private-model', capabilities: {}, executable: false, unavailableReason: 'MODEL_REQUIRES_MIGRATION' })
    expect(JSON.stringify(item)).not.toContain(secret)
    legacy.provider = 'custom'
    expect((await fixture({ models: { old: legacy } }).reader.listModels()).items[0].providerId).toBe('openai-compatible')
  })

  it('purely projects an old favorite current version without persisting synthetic history', async () => {
    const raw = favorite()
    delete (raw as Partial<typeof raw>).functionMode
    delete (raw as Partial<typeof raw>).optimizationMode
    const f = fixture({ favorites: [raw] })
    const before = f.data.get('favorites')
    const assets = await f.reader.listAssets()
    expect(assets.items[0]).toMatchObject({ assetId: 'favorite:fav-a', currentVersionId: 'favorite:fav-a:current', modeKey: 'basic-system', versionCount: 1 })
    const detail = await f.reader.getAssetVersion({ favoriteId: 'fav-a', assetId: 'favorite:fav-a', versionId: 'favorite:fav-a:current', expectedRevision: assets.items[0].revision })
    expect(detail.variables).toEqual([{ name: 'topic', required: true, type: 'string', options: [] }])
    expect(JSON.stringify(assets)).not.toContain(secret)
    expect(JSON.stringify(detail)).not.toContain(secret)
    expect(f.data.get('favorites')).toBe(before)
    expect(f.writes).toEqual([])
    await rejectsSafely(f.reader.getAssetVersion({ favoriteId: 'fav-a', assetId: 'favorite:fav-a', versionId: 'previous' }), 'ASSET_VERSION_NOT_FOUND')
  })

  it('reads the exact embedded historical version, never current text or arbitrary metadata', async () => {
    const raw: Record<string, unknown> = favorite()
    const asset = {
      schemaVersion: 'prompt-model/v1', id: 'real-asset', title: 'Real asset', tags: ['real'],
      contract: createPromptContract('pro-variable', { variables: [{ name: 'topic', required: true, defaultValue: secret }] }),
      currentVersionId: 'version-b', createdAt: 1, updatedAt: 2, examples: [], metadata: { private: secret },
      versions: [
        { id: 'version-a', version: 4, createdAt: 1, content: { kind: 'text', text: 'Actual historical text' }, metadata: { private: secret } },
        { id: 'version-b', version: 7, createdAt: 2, content: { kind: 'text', text: 'Actual current text' } },
      ],
    }
    raw.metadata = { promptAsset: asset }
    const f = fixture({ favorites: [raw] })
    const detail = await f.reader.getAssetVersion({ favoriteId: 'fav-a', assetId: 'real-asset', versionId: 'version-a' })
    expect(detail).toMatchObject({ versionId: 'version-a', version: 4, currentVersionId: 'version-b', content: { kind: 'text', text: 'Actual historical text' } })
    expect(JSON.stringify(detail)).not.toContain(secret)
    await rejectsSafely(f.reader.getAssetVersion({ favoriteId: 'fav-a', assetId: 'wrong-asset', versionId: 'version-a' }), 'ASSET_VERSION_NOT_FOUND')
  })

  it('binds records, revisions and cursors to the selected profile and reader lifetime', async () => {
    const a = fixture({ models: { a: model('Profile A'), b: model('Second') }, favorites: [favorite()] }, 'profile-a')
    const b = fixture({ models: { a: model('Profile B'), b: model('Second') }, favorites: [favorite('fav-a', 'Profile B prompt')] }, 'profile-b')
    const first = await a.reader.listModels({ limit: 1 })
    expect((await b.reader.listModels()).items[0].name).toBe('Profile B')
    await rejectsSafely(b.reader.listModels({ cursor: first.nextCursor }), 'INVALID_CURSOR')
    const summary = (await a.reader.listAssets()).items[0]
    await rejectsSafely(b.reader.getAssetVersion({ favoriteId: summary.favoriteId, assetId: summary.assetId, versionId: summary.currentVersionId, expectedRevision: summary.revision }), 'REVISION_CONFLICT')
    expect((await a.reader.listModels({ cursor: first.nextCursor })).items[0].configKey).toBe('b')
  })

  it('derives stable opaque revisions from the exact canonical snapshot and detects changes without timestamp changes', async () => {
    const f = fixture()
    const revision = (await f.reader.listModels()).items[0].revision
    const raw = model()
    f.data.set('models', JSON.stringify({ saved: Object.fromEntries(Object.entries(raw).reverse()) }))
    expect((await f.reader.listModels()).items[0].revision).toBe(revision)
    raw.connectionConfig.apiKey = 'DIFFERENT_SYNTHETIC_KEY'
    f.data.set('models', JSON.stringify({ saved: raw }))
    expect((await f.reader.listModels()).items[0].revision).not.toBe(revision)
    expect((await fixture().reader.listModels()).items[0].revision).not.toBe(revision)
    const summary = (await f.reader.listAssets()).items[0]
    f.data.set('favorites', JSON.stringify([favorite('fav-a', 'Changed at same timestamp')]))
    await rejectsSafely(f.reader.getAssetVersion({ favoriteId: summary.favoriteId, assetId: summary.assetId, versionId: summary.currentVersionId, expectedRevision: summary.revision }), 'REVISION_CONFLICT')
  })

  it('paginates explicit data and rejects stale or mismatched filter cursors', async () => {
    const f = fixture({ favorites: [favorite('b'), favorite('a'), favorite('c')] })
    const first = await f.reader.listAssets({ query: 'Title', modeKey: 'pro-variable', limit: 1 })
    expect(first.items[0].favoriteId).toBe('a')
    expect((await f.reader.listAssets({ query: 'Title', modeKey: 'pro-variable', limit: 1, cursor: first.nextCursor })).items[0].favoriteId).toBe('b')
    await rejectsSafely(f.reader.listAssets({ query: 'different', cursor: first.nextCursor }), 'INVALID_CURSOR')
    f.data.set('favorites', JSON.stringify([favorite('a'), favorite('b')]))
    await rejectsSafely(f.reader.listAssets({ query: 'Title', modeKey: 'pro-variable', cursor: first.nextCursor }), 'INVALID_CURSOR')
    await rejectsSafely(f.reader.listAssets({ limit: 101 }), 'INVALID_INPUT')
    await rejectsSafely(f.reader.listModels({ limit: 0 }), 'INVALID_INPUT')
  })

  it('accepts explicitly stored empty collections and never invents defaults', async () => {
    const f = fixture({ models: {}, favorites: [] })
    expect((await f.reader.listModels()).items).toEqual([])
    expect((await f.reader.listAssets()).items).toEqual([])
    expect(f.writes).toEqual([])
  })

  it('captures the source binding and returns detached public snapshots', async () => {
    const scope = { sourceId: 'chosen-profile', sourceEpoch: 'epoch-1' }
    const storage = { getItem: async () => JSON.stringify([favorite()]) }
    const reader = createReadonlyAssetReader(storage, scope)
    scope.sourceId = 'other-profile'
    const first = await reader.listAssets()
    first.items[0].tags.push('caller-edit')
    expect((await reader.listAssets()).sourceId).toBe('chosen-profile')
    expect((await reader.listAssets()).items[0].tags).toEqual(['summary'])
  })

  it.each(['models', 'favorites'])('rejects missing and invalid %s without publishing data or parser errors', async key => {
    const f = fixture({})
    const run = () => key === 'models' ? f.reader.listModels() : f.reader.listAssets()
    await rejectsSafely(run(), 'SOURCE_DATA_MISSING')
    for (const raw of [secret, 'null', '42', '"SYNTHETIC_PRIVATE_SENTINEL"', '{"secret":1e400}']) {
      f.data.set(key, raw)
      await rejectsSafely(run(), 'SOURCE_DATA_INVALID')
    }
    f.data.set(key, JSON.stringify({ schemaVersion: `${secret}/v99` }))
    await rejectsSafely(run(), 'SCHEMA_UNSUPPORTED')
    expect(f.writes).toEqual([])
  })

  it('rejects malformed models, duplicate assets and broken embedded versions instead of partial/default discovery', async () => {
    const raw = model()
    await rejectsSafely(fixture({ models: { good: raw, bad: { name: secret } } }).reader.listModels(), 'SOURCE_DATA_INVALID')
    await rejectsSafely(fixture({ favorites: [favorite(), favorite()] }).reader.listAssets(), 'SOURCE_DATA_INVALID')
    await rejectsSafely(fixture({ favorites: [{ ...favorite(), functionMode: ['context'] }] }).reader.listAssets(), 'SOURCE_DATA_INVALID')
    for (const embedded of [null, { schemaVersion: `${secret}/v99` }, { schemaVersion: 'prompt-model/v1', id: secret }]) {
      const fav = { ...favorite(), metadata: { promptAsset: embedded } }
      await rejectsSafely(fixture({ favorites: [fav] }).reader.listAssets(), embedded && embedded.schemaVersion !== 'prompt-model/v1' ? 'SCHEMA_UNSUPPORTED' : 'SOURCE_DATA_INVALID')
    }
  })

  it('sanitizes provider failures without retaining raw causes or logging secrets', async () => {
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const reader = createReadonlyAssetReader({ getItem: async () => { throw new Error(secret) } }, { sourceId: 'test', sourceEpoch: '1' })
    await rejectsSafely(reader.listModels(), 'SOURCE_READ_FAILED')
    await rejectsSafely(reader.listAssets(), 'SOURCE_READ_FAILED')
    expect([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]).toEqual([])
  })
})
