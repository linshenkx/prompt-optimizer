import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DexieStorageProvider } from '../../../src/services/storage/dexieStorageProvider'
import { FavoriteManager } from '../../../src/services/favorite/manager'
import type { IPromptService } from '../../../src/services/prompt/types'
import { createBrowserBridgeHost, type BrowserSourceSession } from '../../../src/services/browser-bridge/session'

const providers: DexieStorageProvider[] = []
const sessions: BrowserSourceSession[] = []
const favorite = { title: 'Browser favorite', content: 'Summarize {{subject}}', tags: [], functionMode: 'context' as const, optimizationMode: 'user' as const }

async function fixture(access: 'read' | 'compare' = 'compare') {
  vi.stubGlobal('window', { __TEST_DB_NAME__: `bridge-${crypto.randomUUID()}` })
  const storage = new DexieStorageProvider()
  providers.push(storage)
  const favoriteManager = new FavoriteManager(storage)
  await favoriteManager.getFavorites()
  const promptService = {
    optimizePromptStream: vi.fn<IPromptService['optimizePromptStream']>(async (request, callbacks) => {
      callbacks.onToken('Improved: ' + request.targetPrompt)
      await callbacks.onComplete()
    }),
    testPromptStream: vi.fn<IPromptService['testPromptStream']>(async (systemPrompt, userPrompt, _modelKey, callbacks) => {
      callbacks.onToken(systemPrompt + ' | ' + userPrompt)
      await callbacks.onComplete()
    }),
  }
  const host = createBrowserBridgeHost({ storage, favoriteManager, promptService })
  const contextId = await host.contextId()
  const source = { kind: 'browser' as const, sourceId: crypto.randomUUID(), sourceEpoch: crypto.randomUUID(), connectionGeneration: crypto.randomUUID(), label: 'Isolated browser' }
  const session = host.open(source, access, contextId)
  sessions.push(session)
  const query = () => session.call('po_desktop_query', { domain: 'favorites', operation: 'getFavorites' }) as Promise<{ result: unknown[]; revision: string }>
  return { storage, favoriteManager, session, query, host, contextId, promptService }
}

afterEach(() => {
  for (const session of sessions.splice(0)) session.dispose()
  for (const storage of providers.splice(0)) (storage as unknown as { db: { close(): void } }).db.close()
  vi.unstubAllGlobals()
})

describe('real page service session', () => {
  it('binds the initialized manager, writes atomically, and deduplicates an exact retry', async () => {
    const { session, query, favoriteManager } = await fixture()
    const spy = vi.spyOn(favoriteManager, 'addFavorite')
    const before = await query()
    const input = { domain: 'favorites', operation: 'addFavorite', arguments: [favorite], expectedRevision: before.revision, requestKey: 'create-1' }
    const created = await session.call('po_desktop_mutate', input) as { result: string }
    expect(await session.call('po_desktop_mutate', input)).toEqual(created)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(await favoriteManager.getFavorite(created.result)).toMatchObject(favorite)
    expect((await query()).result).toHaveLength(1)
    await expect(session.call('po_desktop_mutate', { ...input, arguments: [{ ...favorite, title: 'Changed' }] })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('refuses stale revisions after an original page edit', async () => {
    const { session, query, favoriteManager } = await fixture()
    const before = await query()
    await favoriteManager.addFavorite({ ...favorite, title: 'Original page edit' })
    await expect(session.call('po_desktop_mutate', { domain: 'favorites', operation: 'addFavorite', arguments: [favorite],
      expectedRevision: before.revision, requestKey: 'stale' })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
    expect((await query()).result).toHaveLength(1)
  })

  it('does not initialize or migrate anything while listing real saved assets', async () => {
    const { session, storage, favoriteManager } = await fixture()
    await favoriteManager.addFavorite(favorite)
    const before = await storage.getAllEntries()
    const assets = await session.call('po_assets_list', {}) as { items: Array<{ favoriteId: string; assetId: string; currentVersionId: string; revision: string }> }
    const asset = assets.items[0]
    const version = await session.call('po_assets_get_version', { ...asset, versionId: asset.currentVersionId, expectedRevision: asset.revision })
    expect(version).toMatchObject({ content: { text: favorite.content } })
    expect(await storage.getAllEntries()).toEqual(before)
  })

  it('enforces read-only authorization and rejects arbitrary service dispatch', async () => {
    const { session, query } = await fixture('read')
    const before = await query()
    await expect(session.call('po_desktop_mutate', { domain: 'favorites', operation: 'addFavorite', arguments: [favorite],
      expectedRevision: before.revision, requestKey: 'blocked' })).rejects.toMatchObject({ code: 'COMPARISON_ACCESS_REQUIRED' })
    await expect(session.call('po_desktop_query', { domain: 'models', operation: 'getModel', arguments: ['secret'] })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(session.call('po_desktop_query', { domain: 'favorites', operation: 'constructor' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('starts an actual page text service once per request and tests the optimized prompt', async () => {
    const { storage, session, query, promptService } = await fixture()
    await storage.setItem('models', JSON.stringify({ selected: { enabled: true } }))
    const { revision } = await query()
    const start = {
      expectedRevision: revision, requestKey: 'optimize-1',
      input: { kind: 'optimize', request: { targetPrompt: 'Summarize', optimizationMode: 'system', modelKey: 'selected' } },
    }
    const [first, retry] = await Promise.all([session.call('po_runs_start', start), session.call('po_runs_start', start)]) as Array<{ id: string }>
    expect(first.id).toEqual(retry.id)
    expect(promptService.optimizePromptStream).toHaveBeenCalledTimes(1)
    expect(await session.call('po_runs_get', { runId: first.id })).toMatchObject({ status: 'succeeded', output: 'Improved: Summarize' })

    const tested = await session.call('po_runs_start', {
      expectedRevision: revision, requestKey: 'test-1',
      input: { kind: 'test', inputRunId: first.id, request: { userPrompt: 'This article', modelKey: 'selected' } },
    }) as { id: string }
    expect(await session.call('po_runs_get', { runId: tested.id })).toMatchObject({ status: 'succeeded', output: 'Improved: Summarize | This article' })
    await expect(session.call('po_runs_start', {
      ...start, input: { ...start.input, request: { ...start.input.request, targetPrompt: 'Changed' } },
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('rejects model runs from a read-only source', async () => {
    const { session } = await fixture('read')
    await expect(session.call('po_runs_start', {})).rejects.toMatchObject({ code: 'COMPARISON_ACCESS_REQUIRED' })
  })

  it('invalidates the disposed session and changed data context without closing page storage', async () => {
    const { session, storage, host, contextId } = await fixture()
    await storage.setItem('mcp:browser-context/v1', crypto.randomUUID())
    await expect(session.call('po_assets_list', {})).rejects.toMatchObject({ code: 'SOURCE_CONTEXT_CHANGED' })
    expect(await host.contextId()).not.toBe(contextId)
    session.dispose()
    await expect(session.call('po_assets_list', {})).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' })
    await storage.setItem('page-remains-open', 'yes')
    expect(await storage.getItem('page-remains-open')).toBe('yes')
  })

  it('rolls back synchronous comparison transactions across multiple keys', async () => {
    const { storage } = await fixture()
    await storage.setItem('record', 'before')
    await expect(storage.withWriteTransaction(store => {
      store.setItem('record', 'after'); store.setItem('index', 'after'); throw new Error('stop')
    })).rejects.toThrow('stop')
    expect(await storage.getItem('record')).toBe('before')
    expect(await storage.getItem('index')).toBeNull()
    await expect(storage.withWriteTransaction(async store => { store.setItem('record', 'bad') })).rejects.toThrow('Asynchronous')
    expect(await storage.getItem('record')).toBe('before')
  })
})
