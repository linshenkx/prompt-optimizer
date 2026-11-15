import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { main } from '../src/index.js';
import { selectLaunchMode } from '../src/cli.js';
import { createDesktopReadonlyRouter, DesktopSourceError, publicDesktopError } from '../src/desktop-router.js';
import { createDesktopReadonlyServer } from '../src/desktop.js';
import type { DesktopReadonlyLease } from '../src/desktop-router.js';

vi.mock('../src/legacy.js', () => { throw new Error('Legacy must not load in desktop mode'); });
vi.mock('../src/config/environment.js', () => { throw new Error('dotenv configuration must not load'); });
vi.mock('@prompt-optimizer/core', () => { throw new Error('Core default-model barrel must not load'); });

const secret = 'SYNTHETIC_PRIVATE_KEY';
const pathA = resolve('synthetic-profile-a');
const pathB = resolve('synthetic-profile-b');
const profiles = [{ label: 'A', userDataPath: pathA }, { label: 'B', userDataPath: pathB }];
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function lease(label: string): DesktopReadonlyLease & { close: ReturnType<typeof vi.fn>; writes: string[] } {
  const writes: string[] = [];
  const close = vi.fn(async () => {});
  const models = { saved: { id: 'saved', name: label, enabled: false,
    providerId: 'private-provider', modelId: label,
    providerMeta: { id: 'private-provider' }, modelMeta: { id: label, providerId: 'private-provider', capabilities: { supportsTools: false } },
    connectionConfig: { apiKey: secret, headers: { auth: secret } } } };
  const provider = new Proxy({}, { get(_target, key) {
    if (key === 'getItem') return async (key: string) => key === 'models' ? JSON.stringify(models) : '[]';
    if (key === 'close') return close;
    writes.push(String(key)); throw new Error(secret);
  } }) as DesktopReadonlyLease['provider'];
  return { provider, migration: { version: 1 }, close, writes };
}
afterEach(() => vi.restoreAllMocks());

describe('desktop launch and source routing', () => {
  it('chooses desktop before legacy/env initialization and preserves a lazy legacy branch', async () => {
    const legacyMain = vi.fn(async () => {});
    const desktopMain = vi.fn(async () => {});
    const openDesktop = vi.fn(async () => lease('A'));
    await main([`--mode=desktop-readonly`, `--desktop-profile=${pathA}`], { legacyMain, desktopMain, openDesktop });
    expect(legacyMain).not.toHaveBeenCalled();
    expect(desktopMain).toHaveBeenCalledWith([{ label: 'Desktop profile 1', userDataPath: pathA }], openDesktop);
    expect(openDesktop).not.toHaveBeenCalled();
    await main([], { legacyMain });
    expect(legacyMain).toHaveBeenCalledOnce();
  });
  it('rejects HTTP, relative/missing profiles, ambiguous modes and paths without explicit desktop mode', () => {
    for (const args of [
      ['--mode=desktop-readonly', `--desktop-profile=${pathA}`, '--transport=http'],
      ['--mode=desktop-readonly', '--desktop-profile=relative'], ['--mode=desktop-readonly'],
      [`--desktop-profile=${pathA}`], ['--mode'], ['--mode=typo'], ['--mode=legacy', '--mode=desktop-readonly'],
    ]) expect(() => selectLaunchMode(args)).toThrow(DesktopSourceError);
  });
  it('lists without opening, isolates profiles, deduplicates opens and invalidates old handles', async () => {
    const a = lease('A'), b = lease('B');
    const opener = vi.fn(async (path: string) => path === pathA ? a : b);
    const router = createDesktopReadonlyRouter(profiles, opener);
    const list = router.listSources();
    expect(opener).not.toHaveBeenCalled();
    expect(JSON.stringify(list)).not.toContain(pathA);
    const first = await router.open(list.sources[0].sourceId, 'read');
    expect((await router.open(list.sources[0].sourceId, 'read')).connectionId).toBe(first.connectionId);
    const second = await router.open(list.sources[1].sourceId, 'read');
    expect((await router.listModels(first.connectionId, {})).items[0].name).toBe('A');
    expect((await router.listModels(second.connectionId, {})).items[0].name).toBe('B');
    const anotherOwner = createDesktopReadonlyRouter(profiles, opener);
    await expect(anotherOwner.listModels(first.connectionId, {})).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' });
    await router.close(first.connectionId);
    await expect(router.listModels(first.connectionId, {})).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' });
    await router.dispose(); await anotherOwner.dispose();
    expect(opener).toHaveBeenCalledTimes(2); expect(a.close).toHaveBeenCalledOnce(); expect(b.close).toHaveBeenCalledOnce();
    expect([...a.writes, ...b.writes]).toEqual([]);
  });
  it('cleans a late opener when the owner disconnects and does not publish a connection', async () => {
    const pending = deferred<DesktopReadonlyLease>();
    const a = lease('A');
    const router = createDesktopReadonlyRouter([profiles[0]], async () => pending.promise);
    const opening = router.open(router.listSources().sources[0].sourceId, 'read');
    const checked = expect(opening).rejects.toMatchObject({ code: 'OWNER_CLOSED' });
    const closing = router.dispose(); pending.resolve(a);
    await checked; await closing;
    expect(a.close).toHaveBeenCalledOnce();
    expect(() => router.listSources()).toThrow(DesktopSourceError);
  });
  it('waits for reads already in flight, rejects their late result, and closes exactly once', async () => {
    const value = deferred<string>();
    const entered = deferred<void>();
    const close = vi.fn(async () => {});
    const router = createDesktopReadonlyRouter([profiles[0]], async () => ({ migration: { version: 1 }, provider: {
      getItem: async () => { entered.resolve(); return value.promise; }, close,
    } }));
    const connection = await router.open(router.listSources().sources[0].sourceId, 'read');
    const reading = router.listModels(connection.connectionId, {});
    const checked = expect(reading).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' });
    await entered.promise;
    const closing = router.close(connection.connectionId);
    const disposal = router.dispose();
    expect(close).not.toHaveBeenCalled();
    value.resolve('{}'); await checked; await closing; await disposal;
    expect(close).toHaveBeenCalledOnce();
  });
  it('closes incompatible leases and never exposes opener or close exceptions', async () => {
    const a = lease('A'); a.migration.version = 99;
    const router = createDesktopReadonlyRouter([profiles[0]], async () => a);
    await expect(router.open(router.listSources().sources[0].sourceId, 'read')).rejects.toMatchObject({ code: 'SCHEMA_UNSUPPORTED' });
    expect(a.close).toHaveBeenCalledOnce(); await router.dispose();
    expect(JSON.stringify(publicDesktopError(new Error(`${pathA} ${secret}`)))).not.toContain(secret);
    expect(JSON.stringify(publicDesktopError(new Error(pathA)))).not.toContain(pathA);
  });
  it('reports late-open cleanup failure safely when the owner has already disconnected', async () => {
    const pending = deferred<DesktopReadonlyLease>(); const a = lease('A');
    a.close.mockRejectedValue(new Error(`${pathA} ${secret}`));
    const router = createDesktopReadonlyRouter([profiles[0]], async () => pending.promise);
    const opening = router.open(router.listSources().sources[0].sourceId, 'read');
    const checked = expect(opening).rejects.toMatchObject({ code: 'SOURCE_CLOSE_FAILED' });
    const closing = router.dispose();
    const disposed = expect(closing).rejects.toMatchObject({ code: 'SOURCE_CLOSE_FAILED' });
    pending.resolve(a); await checked; await disposed;
    expect(a.close).toHaveBeenCalledOnce();
  });
  it('discovers six real MCP tools and rejects write access and path injection', async () => {
    const a = lease('A'); const opener = vi.fn(async () => a);
    const { server, router } = createDesktopReadonlyServer([profiles[0]], opener);
    const client = new Client({ name: 'test', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport); await client.connect(clientTransport);
    try {
      const tools = (await client.listTools()).tools;
      expect(tools).toHaveLength(6); expect(tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);
      const sources = (await client.callTool({ name: 'po_sources_list', arguments: {} })).structuredContent as { sources: Array<{ sourceId: string }> };
      expect(opener).not.toHaveBeenCalled();
      for (const args of [{ sourceId: sources.sources[0].sourceId, access: 'save' }, { sourceId: sources.sources[0].sourceId, access: 'read', userDataPath: pathB }]) {
        expect((await client.callTool({ name: 'po_sources_open', arguments: args })).isError).toBe(true);
      }
      expect(opener).not.toHaveBeenCalled();
      const opened = (await client.callTool({ name: 'po_sources_open', arguments: { sourceId: sources.sources[0].sourceId, access: 'read' } })).structuredContent as { connectionId: string };
      const models = await client.callTool({ name: 'po_models_list', arguments: { connectionId: opened.connectionId } });
      expect(JSON.stringify(models)).not.toContain(secret);
    } finally { await client.close(); await server.close(); await router.dispose(); }
    expect(a.close).toHaveBeenCalledOnce(); expect(a.writes).toEqual([]);
  });
});
