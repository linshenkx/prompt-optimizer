import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DexieStorageProvider } from '../../../src/services/storage/dexieStorageProvider'
import { FavoriteManager } from '../../../src/services/favorite/manager'
import { DESKTOP_RUNS_KEY } from '../../../src/services/desktop-runs/repository'
import { BusinessStage } from '../../../src/services/mcp-business/services'
import { createBrowserBridgeHost, type BrowserSourceSession } from '../../../src/services/browser-bridge/session'

const providers: DexieStorageProvider[] = []
const sessions: BrowserSourceSession[] = []
const favorite = { title: 'Browser favorite', content: 'Summarize {{subject}}', tags: [], functionMode: 'context' as const, optimizationMode: 'user' as const }

async function fixture(access: 'read' | 'business' = 'business') {
  vi.stubGlobal('window', { __TEST_DB_NAME__: `bridge-${crypto.randomUUID()}` })
  const storage = new DexieStorageProvider()
  providers.push(storage)
  const favoriteManager = new FavoriteManager(storage)
  await favoriteManager.getFavorites()
  const host = createBrowserBridgeHost({ storage })
  const contextId = await host.contextId()
  const source = { kind: 'browser' as const, sourceId: crypto.randomUUID(), sourceEpoch: crypto.randomUUID(), connectionGeneration: crypto.randomUUID(), label: 'Isolated browser' }
  const session = host.open(source, access, contextId)
  sessions.push(session)
  const call = (name: string, args: Record<string, unknown>) => session.call('product', { name, args })
  const query = () => call('po_desktop_query', { domain: 'favorites', operation: 'getFavorites' }) as Promise<{ result: unknown[]; revision: string }>
  return { storage, favoriteManager, session, call, query, host, contextId, source }
}

afterEach(() => {
  for (const session of sessions.splice(0)) session.dispose()
  for (const storage of providers.splice(0)) (storage as unknown as { db: { close(): void } }).db.close()
  vi.unstubAllGlobals()
})

describe('real page service session', () => {
  it('commits a mutation with its retry receipt and rejects a stale edit', async () => {
    const { call, query, favoriteManager } = await fixture()
    const before = await query()
    const input = { domain: 'favorites', operation: 'addFavorite', arguments: [favorite], expectedRevision: before.revision, requestKey: 'create-1' }
    const created = await call('po_desktop_mutate', input) as { result: string }
    expect(await call('po_desktop_mutate', input)).toEqual(created)
    expect(await favoriteManager.getFavorite(created.result)).toMatchObject(favorite)
    expect((await query()).result).toHaveLength(1)
    await expect(call('po_desktop_mutate', { ...input, arguments: [{ ...favorite, title: 'Changed' }] }))
      .rejects.toMatchObject({ code: 'REQUEST_KEY_REUSED' })
    await expect(call('po_desktop_mutate', { ...input, requestKey: 'new' })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('reads an exact saved asset version through the product catalog without changing storage', async () => {
    const { call, storage, favoriteManager } = await fixture('read')
    await favoriteManager.addFavorite(favorite)
    const before = await storage.getAllEntries()
    const { result } = await call('po_desktop_query', { domain: 'assets', operation: 'listAssets' }) as {
      result: { items: Array<{ favoriteId: string; assetId: string; currentVersionId: string; revision: string }> }
    }
    const asset = result.items[0]
    const version = await call('po_desktop_query', { domain: 'assets', operation: 'getAssetVersion', arguments: [{
      favoriteId: asset.favoriteId, assetId: asset.assetId, versionId: asset.currentVersionId, expectedRevision: asset.revision,
    }] })
    expect(version).toMatchObject({ result: { content: { text: favorite.content } } })
    expect(await storage.getAllEntries()).toEqual(before)
  })

  it('allows queries and refuses writes and unlisted operations on read-only connections', async () => {
    const { session, call, query } = await fixture('read')
    await query()
    for (const name of ['po_desktop_mutate', 'po_runs_start', 'po_runs_cancel', 'po_resources']) {
      await expect(call(name, {})).rejects.toMatchObject({ code: 'BUSINESS_ACCESS_REQUIRED' })
    }
    await expect(call('po_desktop_query', { domain: 'favorites', operation: 'constructor' })).rejects.toMatchObject({ code: 'UNKNOWN_OPERATION' })
    await expect(session.call('po_desktop_query', {})).rejects.toMatchObject({ code: 'UNKNOWN_TOOL' })
  })

  it('invalidates disposed sessions and changed data contexts', async () => {
    const { session, query, storage, host, contextId } = await fixture()
    await storage.setItem('mcp:browser-context/v1', crypto.randomUUID())
    await expect(query()).rejects.toMatchObject({ code: 'SOURCE_CONTEXT_CHANGED' })
    expect(await host.contextId()).not.toBe(contextId)
    session.dispose()
    await expect(query()).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' })
  })

  it.each(['start', 'list', 'delete', 'cancel'])('recovers interrupted owners on %s after reload', async operation => {
    const { storage, call, query, source, contextId } = await fixture()
    const other = createBrowserBridgeHost({ storage })
    const liveOwner = crypto.randomUUID()
    const live = other.open({ ...source, connectionGeneration: liveOwner }, 'business', contextId)
    sessions.push(live)
    await live.call('product', { name: 'po_runs_list', args: {} })
    const crashedGeneration = crypto.randomUUID()
    const records = Array.from({ length: 4 }, (_, index) => ({
      id: crypto.randomUUID(), ownerId: index === 0 ? liveOwner : crashedGeneration, requestKey: 'old-' + index,
      requestHash: 'old', kind: 'test', input: {}, status: 'running', saved: false, createdAt: 10, updatedAt: 10,
    }))
    const orphan = records[1]
    await storage.setItem(DESKTOP_RUNS_KEY, JSON.stringify(records))
    if (operation === 'list') {
      const read = other.open({ ...source, connectionGeneration: crypto.randomUUID() }, 'read', contextId)
      sessions.push(read)
      const projected = await read.call('product', { name: 'po_runs_list', args: {} })
      expect(projected).toMatchObject({ runs: expect.arrayContaining([expect.objectContaining({ id: orphan.id, status: 'interrupted' })]) })
      expect(await storage.getItem(DESKTOP_RUNS_KEY)).toBe(JSON.stringify(records))
      await call('po_runs_list', {})
    } else if (operation === 'start') {
      // Four records from the previous page occupy all slots.
      records[0].ownerId = crashedGeneration
      await storage.setItem(DESKTOP_RUNS_KEY, JSON.stringify(records))
      await storage.setItem('models', JSON.stringify({ fixture: {} }))
      const { revision } = await query()
      const service = vi.spyOn(BusinessStage.prototype, 'service').mockResolvedValue({
        getModel: async () => ({ name: 'fixture' }), testPromptStream: async () => {},
      })
      try {
        const run = await call('po_runs_start', { requestKey: 'new', expectedRevision: revision,
          input: { kind: 'test', request: { modelKey: 'fixture', userPrompt: 'test' } } }) as { id: string }
        await vi.waitFor(async () => expect(await call('po_runs_get', { runId: run.id })).toMatchObject({ status: 'succeeded' }))
      } finally { service.mockRestore() }
    } else if (operation === 'cancel') {
      expect(await call('po_runs_cancel', { runId: orphan.id })).toMatchObject({ status: 'interrupted', error: { code: 'RUN_INTERRUPTED' } })
    } else {
      expect(await call('po_runs_delete', { runId: orphan.id, expectedUpdatedAt: orphan.updatedAt })).toEqual({ deleted: true })
    }
    const stored = JSON.parse((await storage.getItem(DESKTOP_RUNS_KEY))!)
    expect(stored[1]).toMatchObject({ status: 'interrupted', ...(operation === 'delete' ? { deleted: true } : { error: { code: 'RUN_INTERRUPTED' } }) })
    if (operation === 'start') expect(stored.slice(0, 4).every((run: { status: string }) => run.status === 'interrupted')).toBe(true)
    else expect(stored[0]).toMatchObject({ ownerId: liveOwner, status: 'running' })
  })

  it('preserves another HTTP page owner until its connection closes without Web Locks', async () => {
    vi.stubGlobal('navigator', {})
    const { storage, call, contextId, source } = await fixture()
    const generation = crypto.randomUUID()
    const other = createBrowserBridgeHost({ storage }).open({ ...source, connectionGeneration: generation }, 'business', contextId)
    sessions.push(other)
    await other.call('product', { name: 'po_runs_list', args: {} })
    const run = { id: crypto.randomUUID(), kind: 'test', ownerId: generation, requestKey: 'other', requestHash: 'hash',
      createdAt: 10, updatedAt: 10, status: 'running', saved: false, input: {} }
    await storage.setItem(DESKTOP_RUNS_KEY, JSON.stringify([run]))
    expect(await call('po_runs_get', { runId: run.id })).toMatchObject({ status: 'running' })
    other.dispose()
    await vi.waitFor(async () => expect(await call('po_runs_get', { runId: run.id }))
      .toMatchObject({ status: 'interrupted', error: { code: 'RUN_INTERRUPTED' } }))
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
