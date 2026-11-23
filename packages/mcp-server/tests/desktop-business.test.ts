import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { openDesktopStorage } from '@prompt-optimizer/core/node';
import { createDesktopBusinessServer } from '../src/desktop-business';
import { BusinessStage, businessOperations } from '@prompt-optimizer/core/bridge-protocol';
import { createDesktopRunRepository } from '@prompt-optimizer/core';

describe('desktop business services against isolated real SQLite', () => {
  let directory: string;
  let host: ReturnType<typeof createDesktopBusinessServer>;
  let sourceId: string;
  let peer: Awaited<ReturnType<typeof openDesktopStorage>>;
  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    directory = await mkdtemp(join(tmpdir(), 'po-mcp-business-'));
    peer = await openDesktopStorage(directory);
    await peer.provider.setItem('sentinel', 'preserve-this-exact-value');
    host = createDesktopBusinessServer([{ label: 'Synthetic only', userDataPath: directory }]);
    sourceId = ((await host.call('po_sources_list', {}) as { sources: Array<{ sourceId: string }> }).sources[0]).sourceId;
  });
  afterEach(async () => {
    await host?.close(); await peer?.provider.close(); vi.restoreAllMocks();
    expect(dirname(resolve(directory))).toBe(resolve(tmpdir()));
    expect(basename(directory).startsWith('po-mcp-business-')).toBe(true);
    await rm(directory, { recursive: true, force: true });
  });
  const favorite = () => ({ title: 'MCP favorite', content: 'Summarize this text', tags: [], functionMode: 'basic', optimizationMode: 'system' });
  const query = (domain: string, operation: string, parameters: unknown[] = []) =>
    host.call('po_desktop_query', { sourceId, domain, operation, arguments: parameters }) as Promise<{ revision: string; result: unknown }>;
  const mutate = async (domain: string, operation: string, parameters: unknown[]) => host.call('po_desktop_mutate', {
    sourceId, domain, operation, arguments: parameters, expectedRevision: (await query('favorites', 'getFavorites')).revision,
    requestKey: crypto.randomUUID(),
  });

  it('every advertised operation resolves to a real product service method', async () => {
    const stage = new BusinessStage(new Map());
    for (const operation of businessOperations) expect(typeof (await stage.service(operation.domain))[operation.operation],
      `${operation.domain}.${operation.operation}`).toBe('function');
  });
  it('creates, finds and edits a favorite, replays a write without duplication, and rejects key reuse', async () => {
    const { revision } = await query('favorites', 'getFavorites');
    const request = { sourceId, domain: 'favorites', operation: 'addFavorite', arguments: [favorite()], expectedRevision: revision, requestKey: 'add-1' };
    const created = await host.call('po_desktop_mutate', request) as { result: string };
    expect(await host.call('po_desktop_mutate', request)).toEqual(created);
    expect((await query('favorites', 'getFavorites')).result).toHaveLength(1);
    expect((await query('favorites', 'getFavorite', [created.result])).result).toMatchObject(favorite());
    await expect(host.call('po_desktop_mutate', { ...request, arguments: [{ ...favorite(), title: 'changed' }] })).rejects.toMatchObject({ code: 'REQUEST_KEY_REUSED' });
    expect(await peer.provider.getItem('sentinel')).toBe('preserve-this-exact-value');
  });
  it('does not overwrite peer desktop edits after a stale revision or an in-flight conflict', async () => {
    const { revision } = await query('favorites', 'getFavorites');
    await peer.provider.setItem('favorites', '[]');
    await expect(host.call('po_desktop_mutate', { sourceId, domain: 'favorites', operation: 'addFavorite', arguments: [favorite()],
      expectedRevision: revision, requestKey: 'conflict' })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    const stage = new BusinessStage(new Map(await peer.provider.getAllEntries()));
    await stage.invoke('favorites', 'addFavorite', [favorite()], 'write');
    await peer.provider.setItem('favorites', '[{"id":"desktop-won"}]');
    await expect(stage.commit(peer.provider)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(await peer.provider.getItem('favorites')).toBe('[{"id":"desktop-won"}]');
  });
  it('does not write when reading and does not create missing profiles', async () => {
    const before = await peer.provider.getAllEntries();
    await query('models', 'getAllModels'); await query('templates', 'listTemplates'); await query('contexts', 'list');
    expect(await peer.provider.getAllEntries()).toEqual(before);
    const missing = join(directory, 'missing');
    const other = createDesktopBusinessServer([{ label: 'Missing', userDataPath: missing }]);
    const listing = await other.call('po_sources_list', {}) as { sources: Array<{ sourceId: string }> };
    await expect(other.call('po_desktop_query', { sourceId: listing.sources[0].sourceId, domain: 'models', operation: 'getAllModels' }))
      .rejects.toMatchObject({ code: 'SOURCE_NOT_READY' });
    await mkdir(missing);
    await other.close();
  });
  it('rejects corrupt data without repairing or replacing it', async () => {
    await peer.provider.setItem('models', 'broken-secret-model-json');
    await expect(query('models', 'getAllModels')).rejects.toMatchObject({ code: 'SOURCE_DATA_INVALID' });
    expect(await peer.provider.getItem('models')).toBe('broken-secret-model-json');
  });
  it('lists external settings and keeps string settings readable', async () => {
    await peer.provider.setItem('pref:custom.value', JSON.stringify('some text'));
    expect((await query('settings', 'get', ['custom.value', null])).result).toBe('some text');
    expect((await query('settings', 'keys')).result).toContain('custom.value');
  });
  it('redacts scalar and JSON-encoded credentials in all configuration reads', async () => {
    await peer.provider.setItem('pref:custom.apiKey', JSON.stringify('synthetic-credential'));
    await peer.provider.setItem('pref:remote.config', JSON.stringify({ secretAccessKey: 'synthetic-credential', nested: { token: 'synthetic-credential' } }));
    expect(JSON.stringify((await query('settings', 'getAll')).result)).not.toContain('synthetic-credential');
    expect((await query('settings', 'get', ['custom.apiKey', null])).result).toBe('[REDACTED]');
  });
  it('refuses uncoordinated state replacement while a desktop renderer is active', async () => {
    await peer.provider.setItem('mcp:renderer:resources', JSON.stringify({ pid: process.pid }));
    await expect(mutate('variables', 'set', ['audience', 'must not replace live state'])).rejects.toMatchObject({ code: 'DESKTOP_STATE_IN_USE' });
    expect(await peer.provider.getItem('pref:variableManager.storage')).toBe(null);
  });
  it('persists typed global variables and validated multi-message workspace snapshots', async () => {
    await mutate('variables', 'set', ['audience', 'A synthetic reader']);
    expect((await query('variables', 'get', ['audience'])).result).toBe('A synthetic reader');
    await expect(mutate('variables', 'set', ['1invalid', 'bad'])).rejects.toMatchObject({ code: 'INVALID_VARIABLE_NAME' });
    const data = { version: 1, sessions: { 'pro-multi': { optimizedPrompt: 'Edited prompt', conversationMessagesSnapshot: [{ id: 'message-1', role: 'user', content: 'Hello {{audience}}' }] } } };
    await mutate('workspaces', 'importData', [data]);
    expect((await query('workspaces', 'exportData')).result).toMatchObject(data);
    await mutate('variables', 'delete', ['audience']);
    expect((await query('variables', 'get', ['audience'])).result).toBe(null);
  });
  it('archives survive export/import, refuses stale deletion and never revives a tombstone', async () => {
    const repository = createDesktopRunRepository(peer.provider);
    const run = { id: crypto.randomUUID(), requestKey: 'repo-fixture', requestHash: 'hash', ownerId: '0:fixture',
      kind: 'test', status: 'succeeded' as const, createdAt: 1700000000000, updatedAt: 1700000000000, saved: true, input: {}, output: 'Complete' };
    await repository.create(run);
    const backup = await repository.exportData();
    expect(await repository.validateData(backup)).toBe(true);
    await repository.importData(backup);
    expect((await repository.list()).length).toBe(1);
    const data = JSON.parse((await query('data', 'exportAllData')).result as string);
    expect(data.data.desktopRuns.runs[0].id).toBe(run.id);
    await expect(repository.delete(run.id, 0)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await repository.delete(run.id, run.updatedAt);
    expect(await repository.validateData(backup)).toBe(false);
    await expect(repository.create(run)).rejects.toMatchObject({ code: 'RUN_DELETED' });
    expect((await repository.exportData()).runs[0]).toMatchObject({ deleted: true, input: null });
  });
});
