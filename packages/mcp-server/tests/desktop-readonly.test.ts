import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { main } from '../src/index.js';
import { selectLaunchMode } from '../src/cli.js';
import { createDesktopComparisonRouter, createDesktopReadonlyRouter, DesktopSourceError, publicDesktopError } from '../src/desktop-router.js';
import { createDesktopComparisonServer, createDesktopReadonlyServer } from '../src/desktop.js';
import type { DesktopComparisonLease, DesktopReadonlyLease } from '../src/desktop-router.js';
import { createReadonlyAssetReader } from '@prompt-optimizer/core/asset-reader';
import type { AssetReadPagination } from '@prompt-optimizer/core/asset-reader';
import type {
  ComparisonExecutionSource, ComparisonListOptions, CompletedTextComparison, PreparedTextComparison, PrepareTextComparison,
  SavedComparisonResult, TextComparisonRequest,
} from '@prompt-optimizer/core/desktop-comparison';

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

describe('desktop comparison tools', () => {
  const selection = {
    source: { favoriteId: 'favorite', assetId: 'asset', versionId: 'v1', expectedRevision: 'asset-revision' },
    variables: { topic: 'synthetic topic' },
    candidates: [
      { id: 'a', configKey: 'saved', expectedRevision: 'rev-a' },
      { id: 'b', configKey: 'another', expectedRevision: 'rev-b' },
    ],
  } as PrepareTextComparison;

  function comparisonLease(source: ComparisonExecutionSource) {
    const base = lease('A');
    const reader = createReadonlyAssetReader(base.provider, source);
    const request: TextComparisonRequest = { rawPrompt: '{{topic}}', variables: selection.variables,
      messages: [{ role: 'user', content: selection.variables.topic }] };
    const preparedId = 'prepared-a';
    const comparisonId = 'comparison-a';
    const run = (id: 'a' | 'b'): CompletedTextComparison['runs'][number] => ({
      id, runId: `run-${id}`, model: { configKey: id, name: id, providerId: 'openai', modelId: id },
      effective: { parameterCoverage: 'declared', parameters: {}, omittedParameterNames: [], requestEvidence: 'captured' },
      status: 'success', output: id, reasoning: '', startedAt: 10, completedAt: 20,
    });
    const runs: CompletedTextComparison['runs'] = [run('a'), run('b')];
    const asset = { ...selection.source, title: 'Synthetic favorite' };
    const draft: CompletedTextComparison = { id: comparisonId, executionSource: source, source: asset, request, runs };
    const preview: PreparedTextComparison = { preparedId, comparisonId, previewRevision: 'preview-revision',
      expiresAt: 300, executionSource: source, source: asset, request, runs };
    const revision = 'saved-revision';
    const result: SavedComparisonResult = { comparison: { ...draft, schemaVersion: 'saved-comparison/v1', savedAt: 30 }, revision };
    const privateError = new Error(`Sensitive SDK exception: ${secret} ${pathA}`);
    const runner = {
      reader,
      listModels: vi.fn(async (options?: AssetReadPagination) => {
        const models = await reader.listModels(options);
        return { ...models, items: models.items.map(model => ({ ...model, executable: true, unavailableReason: undefined })) };
      }),
      prepare: vi.fn(async (_input: PrepareTextComparison) => preview),
      execute: vi.fn(async (_preparedId: string, _previewRevision: string) => preview),
      get: vi.fn((_preparedId: string) => preview),
      cancel: vi.fn((_preparedId: string, _runId?: string) => preview),
      completed: vi.fn((_preparedId: string) => draft),
      dispose: vi.fn(() => {}),
    };
    const repository = {
      save: vi.fn(async (_completed: CompletedTextComparison, _saveKey: string) => result),
      list: vi.fn(async (_options?: ComparisonListOptions) => ({ items: [] })),
      get: vi.fn(async (_id: string) => result),
      delete: vi.fn(async (_id: string, _revision: string) => ({ deleted: true, alreadyDeleted: false })),
    };
    const comparison = {
      runner, repository,
      errorCode: (error: unknown) => error === privateError ? 'COMPARISON_NOT_FOUND' : undefined,
    };
    return { ...base, comparison, privateError, draft, preview, result } satisfies DesktopComparisonLease & {
      privateError: Error; draft: CompletedTextComparison; preview: PreparedTextComparison; result: SavedComparisonResult;
      close: ReturnType<typeof vi.fn>; writes: string[];
    };
  }

  it('selects explicit stdio comparison mode without initializing a store or importing legacy', async () => {
    const legacyMain = vi.fn(async () => {});
    const desktopComparisonMain = vi.fn(async () => {});
    const openDesktopComparison = vi.fn(async (_path: string, source: ComparisonExecutionSource) => comparisonLease(source));
    const args = ['--mode=desktop-comparison', `--desktop-profile=${pathA}`, '--transport=stdio'];
    await main(args, { legacyMain, desktopComparisonMain, openDesktopComparison });
    expect(desktopComparisonMain).toHaveBeenCalledWith([{ label: 'Desktop profile 1', userDataPath: pathA }], openDesktopComparison);
    expect(legacyMain).not.toHaveBeenCalled();
    expect(openDesktopComparison).not.toHaveBeenCalled();
    for (const invalid of [
      ['--mode=desktop-comparison', '--desktop-profile=relative'], ['--mode=desktop-comparison'],
      args.map(arg => arg === '--transport=stdio' ? '--transport=http' : arg),
      [...args, '--mode=legacy'], [...args, '--port=3000'],
    ]) expect(() => selectLaunchMode(invalid)).toThrow(DesktopSourceError);
  });

  it('validates nested inputs, routes the explicit lifecycle, and reports only public error codes', async () => {
    const attached = new Map<string, ReturnType<typeof comparisonLease>>();
    const opener = vi.fn(async (_path: string, source: ComparisonExecutionSource) => {
      const created = comparisonLease(source);
      attached.set(source.sourceId, created);
      return created;
    });
    const { server, router } = createDesktopComparisonServer(profiles, opener);
    const client = new Client({ name: 'test', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const call = async (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });
    const ok = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await call(name, args);
      expect(result.isError).toBeFalsy();
      return result.structuredContent;
    };
    const rejected = async (name: string, args: Record<string, unknown>, code: string) => {
      const result = await call(name, args);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ error: { code } });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain(pathA);
    };
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(14);
      expect(tools.find(tool => tool.name === 'po_tests_execute')?.annotations).toMatchObject({ readOnlyHint: false, openWorldHint: true });
      expect(tools.find(tool => tool.name === 'po_comparisons_delete')?.annotations).toMatchObject({ destructiveHint: true });
      const { sources } = await ok('po_sources_list') as ReturnType<typeof router.listSources>;
      expect(opener).not.toHaveBeenCalled();
      const sourceId = sources[0].sourceId;
      await rejected('po_sources_open', { sourceId, access: 'read' }, 'INVALID_INPUT');
      await rejected('po_sources_open', { sourceId, access: 'compare', userDataPath: pathA }, 'INVALID_INPUT');
      expect(opener).not.toHaveBeenCalled();

      const opened = await ok('po_sources_open', { sourceId, access: 'compare' }) as Awaited<ReturnType<typeof router.open>>;
      const { connectionId } = opened;
      expect(opened.capabilities).toEqual({ read: true, execute: true, save: true });
      const { comparison, draft, preview, result, privateError } = attached.get(sourceId)!;
      const models = await ok('po_models_list', { connectionId });
      expect(models).toMatchObject({ items: [{ executable: true }] });
      expect(JSON.stringify(models)).not.toContain(secret);
      for (const malformed of [
        { ...selection, source: { ...selection.source, path: pathA } },
        { ...selection, candidates: [{ ...selection.candidates[0], connectionConfig: { apiKey: secret } }, selection.candidates[1]] },
        { ...selection, variables: { topic: { value: 'nested' } } },
        { ...selection, variables: JSON.parse('{"__proto__":"forbidden"}') },
        { ...selection, candidates: [selection.candidates[0]] },
      ]) await rejected('po_tests_prepare', { connectionId, ...malformed }, 'INVALID_INPUT');
      expect(comparison.runner.prepare).not.toHaveBeenCalled();

      expect(await ok('po_tests_prepare', { connectionId, ...selection })).toEqual(preview);
      expect(comparison.runner.prepare).toHaveBeenCalledWith(selection);
      const { preparedId, previewRevision, comparisonId } = preview;
      expect(comparison.runner.execute).not.toHaveBeenCalled();
      await rejected('po_tests_execute', { connectionId, preparedId, previewRevision, model: 'replacement' }, 'INVALID_INPUT');
      await ok('po_tests_execute', { connectionId, preparedId, previewRevision });
      expect(comparison.runner.execute).toHaveBeenCalledWith(preparedId, previewRevision);
      await ok('po_tests_get', { connectionId, preparedId });
      expect(comparison.runner.get).toHaveBeenCalledWith(preparedId);
      await ok('po_tests_cancel', { connectionId, preparedId, runId: preview.runs[0].runId });
      expect(comparison.runner.cancel).toHaveBeenCalledWith(preparedId, preview.runs[0].runId);

      const saveArguments = { connectionId, preparedId, saveKey: 'test-intent' };
      const save = await ok('po_comparisons_save', saveArguments);
      expect(comparison.repository.save).toHaveBeenCalledWith(draft, 'test-intent');
      expect(save).toMatchObject({ comparisonId, viewTarget: { kind: 'saved-comparison', sourceId, comparisonId } });
      expect(await ok('po_comparisons_save', saveArguments)).toEqual(save);
      await ok('po_comparisons_list', { connectionId, favoriteId: 'favorite', limit: 2 });
      expect(comparison.repository.list).toHaveBeenCalledWith(expect.objectContaining({ favoriteId: 'favorite', limit: 2 }));
      expect(await ok('po_comparisons_get', { connectionId, comparisonId })).toEqual(result);
      comparison.repository.get.mockRejectedValueOnce(privateError);
      await rejected('po_comparisons_get', { connectionId, comparisonId }, 'COMPARISON_NOT_FOUND');
      comparison.repository.get.mockRejectedValueOnce(new Error(secret));
      await rejected('po_comparisons_get', { connectionId, comparisonId }, 'COMPARISON_REQUEST_FAILED');
      await rejected('po_comparisons_delete', { connectionId, comparisonId }, 'INVALID_INPUT');
      await ok('po_comparisons_delete', { connectionId, comparisonId, expectedRevision: result.revision });
      expect(comparison.repository.delete).toHaveBeenCalledWith(comparisonId, result.revision);

      await ok('po_sources_close', { connectionId });
      await rejected('po_tests_get', { connectionId, preparedId }, 'CONNECTION_CLOSED');
      expect(comparison.runner.dispose).toHaveBeenCalledOnce();
      expect(attached.get(sourceId)!.close).toHaveBeenCalledOnce();
    } finally {
      await client.close(); await server.close(); await router.dispose();
    }
  });

  it.each(['save', 'delete'] as const)('aborts the runner and reports an unacknowledged %s before closing the lease', async operation => {
    let attached: ReturnType<typeof comparisonLease> | undefined;
    const router = createDesktopComparisonRouter([profiles[0]], async (_path, source) => attached = comparisonLease(source));
    const { connectionId } = await router.open(router.listSources().sources[0].sourceId, 'compare');
    const { comparison, close, result, preview } = attached!;
    const entered = deferred<void>();
    const persisted = deferred<void>();
    const awaitWrite = async () => { entered.resolve(); await persisted.promise; };
    comparison.repository.save.mockImplementationOnce(async () => { await awaitWrite(); return result; });
    comparison.repository.delete.mockImplementationOnce(async () => { await awaitWrite(); return { deleted: true, alreadyDeleted: false }; });
    const writing = operation === 'save'
      ? router.saveComparison(connectionId, preview.preparedId, 'test-intent')
      : router.deleteComparison(connectionId, preview.comparisonId, result.revision);
    const rejected = expect(writing).rejects.toMatchObject({ code: 'WRITE_OUTCOME_UNKNOWN' });
    await entered.promise;
    const closing = router.close(connectionId);
    const dispose = router.dispose();
    expect(comparison.runner.dispose).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    persisted.resolve();
    await rejected; await closing; await dispose;
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps a save from reaching the repository if the lease closes during preparation', async () => {
    let attached: ReturnType<typeof comparisonLease> | undefined;
    const router = createDesktopComparisonRouter([profiles[0]], async (_path, source) => attached = comparisonLease(source));
    const { connectionId } = await router.open(router.listSources().sources[0].sourceId, 'compare');
    const { comparison, preview, draft } = attached!;
    let close: Promise<{ closed: boolean }> | undefined;
    comparison.runner.completed.mockImplementationOnce(() => {
      close = router.close(connectionId);
      return draft;
    });
    await expect(router.saveComparison(connectionId, preview.preparedId, 'test-intent')).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' });
    await close; await router.dispose();
    expect(comparison.repository.save).not.toHaveBeenCalled();
  });

  it('disposes active sources on EOF while a different source is still opening', async () => {
    let active: ReturnType<typeof comparisonLease> | undefined;
    let late: ReturnType<typeof comparisonLease> | undefined;
    const notYet = deferred<void>();
    const router = createDesktopComparisonRouter(profiles, async (path, source) => {
      if (path === pathA) return active = comparisonLease(source);
      late = comparisonLease(source);
      await notYet.promise;
      return late;
    });
    const { sources } = router.listSources();
    await router.open(sources[0].sourceId, 'compare');
    const opening = router.open(sources[1].sourceId, 'compare');
    const rejected = expect(opening).rejects.toMatchObject({ code: 'OWNER_CLOSED' });
    const closing = router.dispose();
    expect(active!.comparison.runner.dispose).toHaveBeenCalledOnce();
    notYet.resolve();
    await rejected; await closing;
    expect(active!.close).toHaveBeenCalledOnce();
    expect(late!.comparison.runner.dispose).toHaveBeenCalledOnce();
    expect(late!.close).toHaveBeenCalledOnce();
  });
});
