import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, DEFAULT_INHERITED_ENV_VARS } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

const binary = fileURLToPath(new URL('../bin/prompt-optimizer-product-mcp.cjs', import.meta.url));
const secret = 'SYNTHETIC_STDIO_PRIVATE_SENTINEL';
const dbName = 'prompt-optimizer-data.sqlite';
function isolated(t) {
  const root = mkdtempSync(join(tmpdir(), 'po-mcp-r4-'));
  const cleanups = [];
  const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(key => [key, '']));
  Object.assign(env, { PATH: dirname(process.execPath), SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows', SYSTEMDRIVE: 'C:',
    APPDATA: root, LOCALAPPDATA: root, USERPROFILE: root, HOME: root, HOMEPATH: root,
    TEMP: root, TMP: root, USERNAME: 'synthetic-mcp-test', NODE_OPTIONS: '',
    VITE_OPENAI_API_KEY: secret, VITE_CUSTOM_MODEL: 'must-not-be-invented' });
  // Only this synthetic working directory can be considered by accidental dotenv calls.
  writeFileSync(join(root, '.env'), `VITE_CUSTOM_API_KEY=${secret}\n`);
  t.after(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    const target = resolve(root), parent = resolve(tmpdir());
    assert.ok(isAbsolute(target) && target.startsWith(parent + sep) && basename(target).startsWith('po-mcp-r4-'));
    rmSync(target, { recursive: true, force: true });
  });
  return { root, env, cleanups };
}
function createProfile(root, name, label, { migrated = true, empty = false, migrationVersion = 1, sharedAssetFavorites = false } = {}) {
  const path = join(root, name); mkdirSync(path);
  const model = { id: 'stored-id', name: label, enabled: true, providerId: 'openai-compatible', modelId: 'stored-model',
    providerMeta: { id: 'openai-compatible', requiresApiKey: true },
    modelMeta: { id: 'stored-model', providerId: 'openai-compatible', parameterDefinitions: [], capabilities: { supportsTools: true } },
    connectionConfig: { apiKey: secret, baseURL: `https://private.invalid/${secret}`, headers: { auth: secret } }, metadata: { private: secret } };
  const favorite = { id: 'favorite-shared', title: label, content: `${label} current`, tags: ['test'], createdAt: 1, updatedAt: 2, useCount: 0,
    metadata: { private: secret, promptAsset: {
      schemaVersion: 'prompt-model/v1', id: 'asset-shared', title: label, tags: ['test'], createdAt: 1, updatedAt: 2,
      contract: { family: 'pro', subMode: 'variable', modeKey: 'pro-variable', variables: [{ name: 'topic', required: true, defaultValue: secret }] },
      currentVersionId: 'version-b', examples: [{ input: secret }], metadata: { private: secret },
      versions: [{ id: 'version-a', version: 4, createdAt: 1, content: { kind: 'text', text: `${label} historical` } },
        { id: 'version-b', version: 7, createdAt: 2, content: { kind: 'text', text: `${label} current` } }],
    } } };
  const favorites = empty ? [] : [favorite];
  if (sharedAssetFavorites && !empty) {
    const copy = structuredClone(favorite);
    copy.id = 'favorite-shared-copy'; copy.title = `${label} copy`; copy.content = `${label} copy current`;
    copy.metadata.promptAsset.title = copy.title;
    for (const version of copy.metadata.promptAsset.versions) {
      version.version += 10;
      version.content.text = `${label} copy ${version.id === 'version-a' ? 'historical' : 'current'}`;
    }
    favorites.push(copy);
  }
  const db = new DatabaseSync(join(path, dbName));
  try {
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('CREATE TABLE storage_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT; CREATE TABLE storage_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;');
    for (const [key, value] of Object.entries({ models: empty ? {} : { saved: model, second: { ...model, name: `${label} second` } }, favorites, untouched: { private: secret } })) {
      db.prepare('INSERT INTO storage_kv VALUES (?, ?)').run(key, JSON.stringify(value));
    }
    if (migrated) db.prepare('INSERT INTO storage_metadata VALUES (?, ?)').run('legacy-json-migration', JSON.stringify({ version: migrationVersion, source: 'json', itemCount: 3 }));
  } finally { db.close(); }
  return path;
}
function snapshot(path) {
  const db = new DatabaseSync(join(path, dbName), { readOnly: true });
  try { return {
    kv: db.prepare('SELECT key, value FROM storage_kv ORDER BY key').all(),
    metadata: db.prepare('SELECT key, value FROM storage_metadata ORDER BY key').all(),
    schema: db.prepare('SELECT type, name, sql FROM sqlite_schema ORDER BY type, name').all(),
    userVersion: db.prepare('PRAGMA user_version').get(),
  }; } finally { db.close(); }
}
const args = paths => [binary, ...paths.map(path => `--desktop-profile=${path}`)];
async function connect(t, paths, context) {
  const transport = new StdioClientTransport({ command: process.execPath, args: args(paths), cwd: context.root, env: context.env, stderr: 'pipe' });
  let stderr = ''; transport.stderr.on('data', chunk => { stderr += chunk; });
  const client = new Client({ name: 'isolated-desktop-acceptance', version: '1' });
  const errors = []; client.onerror = error => errors.push(error);
  context.cleanups.push(async () => { await client.close(); });
  try { await client.connect(transport, { timeout: 5000 }); }
  catch (error) { throw new Error(`Synthetic MCP handshake failed: ${stderr.replaceAll(secret, '[SYNTHETIC]')}`, { cause: error }); }
  const transcript = [];
  const call = async (name, arguments_ = {}) => {
    const response = await client.callTool({ name, arguments: arguments_ }, undefined, { timeout: 5000 });
    transcript.push(response); return response;
  };
  return { client, call, errors, transcript, stderr: () => stderr };
}
function data(response) { assert.notEqual(response.isError, true, JSON.stringify(response)); return response.structuredContent; }
function failure(response, code) { assert.equal(response.isError, true); assert.equal(response.structuredContent.error.code, code); }
function noPrivateOutput(text, paths) {
  assert.ok(!text.includes(secret)); assert.ok(!text.includes('private.invalid'));
  for (const path of paths) { assert.ok(!text.includes(path)); assert.ok(!text.includes(JSON.stringify(path).slice(1, -1))); }
}

test('built MCP stdio discovers and reads actual SQLite profiles without mutation or disclosure', { timeout: 20000 }, async t => {
  const context = isolated(t);
  const a = createProfile(context.root, 'profile a 中文', 'Profile A', { sharedAssetFavorites: true });
  const b = createProfile(context.root, 'profile b', 'Profile B');
  const missing = join(context.root, 'missing', 'profile');
  const notMigrated = createProfile(context.root, 'unmigrated', 'Unmigrated', { migrated: false });
  const empty = createProfile(context.root, 'empty', 'Empty', { empty: true });
  const future = createProfile(context.root, 'future', 'Future', { migrationVersion: 99 });
  const paths = [a, b, missing, notMigrated, empty, future];
  const before = [a, b, notMigrated, empty, future].map(snapshot);
  const mcp = await connect(t, paths, context);
  const tools = (await mcp.client.listTools()).tools;
  assert.ok(tools.some(tool => tool.name === 'po_query'));
  assert.ok(tools.some(tool => tool.name === 'po_runs_start'));
  assert.ok(!tools.some(tool => tool.name === 'optimize-user-prompt'));
  const listed = data(await mcp.call('po_sources_list'));
  assert.equal(listed.sources.length, 6); assert.ok(listed.sources.every(source => source.kind === 'desktop')); assert.equal(existsSync(missing), false);
  const open = async i => data(await mcp.call('po_sources_open', { sourceId: listed.sources[i].sourceId, access: 'read' }));
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[0].sourceId, access: 'save' }), 'INVALID_INPUT');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[0].sourceId, access: 'read', userDataPath: missing }), 'INVALID_INPUT');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[2].sourceId, access: 'read' }), 'SOURCE_NOT_READY');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[3].sourceId, access: 'read' }), 'SOURCE_NOT_READY');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[5].sourceId, access: 'read' }), 'SOURCE_NOT_READY');
  assert.equal(existsSync(missing), false);
  const first = await open(0), second = await open(1), emptyConnection = await open(4);
  assert.equal(first.access, 'read');
  assert.equal((await open(0)).connectionId, first.connectionId);
  const query = (connection, domain, operation, ...parameters) => mcp.call('po_query', {
    connectionId: connection.connectionId, domain, operation, arguments: parameters,
  });
  const assetsQuery = (connection, operation, ...parameters) => query(connection, 'assets', operation, ...parameters);
  const models = data(await query(first, 'models', 'getEnabledModels')).result;
  assert.ok(models.some(model => model.name === 'Profile A'));
  assert.ok(data(await query(second, 'models', 'getEnabledModels')).result.some(model => model.name === 'Profile B'));
  assert.deepEqual(data(await assetsQuery(emptyConnection, 'listAssets')).result.items, []);
  const assets = data(await assetsQuery(first, 'listAssets')).result.items;
  assert.deepEqual(assets.map(item => [item.favoriteId, item.assetId]), [['favorite-shared', 'asset-shared'], ['favorite-shared-copy', 'asset-shared']]);
  const summary = assets[0], copy = assets[1];
  const assetSelection = { favoriteId: summary.favoriteId, assetId: summary.assetId };
  const listInput = { ...assetSelection, expectedRevision: summary.revision };
  const firstVersions = data(await assetsQuery(first, 'listAssetVersions', listInput, { limit: 1 })).result;
  assert.equal(firstVersions.currentVersionId, summary.currentVersionId);
  assert.equal(firstVersions.versionCount, 2);
  assert.equal(firstVersions.revision, summary.revision);
  assert.deepEqual(firstVersions.items, [{ versionId: 'version-b', version: 7, createdAt: 2 }]);
  assert.ok(firstVersions.nextCursor);
  const moreVersions = data(await assetsQuery(first, 'listAssetVersions', listInput, { cursor: firstVersions.nextCursor })).result;
  assert.deepEqual(moreVersions.items, [{ versionId: 'version-a', version: 4, createdAt: 1 }]);
  assert.equal(moreVersions.nextCursor, undefined);
  failure(await assetsQuery(second, 'listAssetVersions', assetSelection, { cursor: firstVersions.nextCursor }), 'INVALID_CURSOR');
  failure(await assetsQuery(first, 'listAssetVersions', { favoriteId: copy.favoriteId, assetId: copy.assetId }, { cursor: firstVersions.nextCursor }), 'INVALID_CURSOR');

  const selection = { ...assetSelection, versionId: moreVersions.items[0].versionId, expectedRevision: moreVersions.revision };
  const history = data(await assetsQuery(first, 'getAssetVersion', selection)).result;
  assert.equal(history.content.text, 'Profile A historical'); assert.equal(history.version, 4);
  assert.deepEqual(history.variables, [{ name: 'topic', required: true }]);
  const copySelection = { ...selection, favoriteId: copy.favoriteId, expectedRevision: copy.revision };
  const copiedHistory = data(await assetsQuery(first, 'getAssetVersion', copySelection)).result;
  assert.equal(copiedHistory.content.text, 'Profile A copy historical'); assert.equal(copiedHistory.version, 14);
  failure(await assetsQuery(first, 'getAssetVersion', { ...copySelection, expectedRevision: summary.revision }), 'REVISION_CONFLICT');
  failure(await assetsQuery(second, 'getAssetVersion', selection), 'REVISION_CONFLICT');
  failure(await assetsQuery(first, 'getAssetVersion', { ...selection, versionId: 'does-not-exist' }), 'ASSET_VERSION_NOT_FOUND');
  data(await mcp.call('po_sources_close', { connectionId: first.connectionId }));
  failure(await query(first, 'models', 'getAllModels'), 'CONNECTION_CLOSED');
  const reopened = await open(0);
  assert.notEqual(reopened.connectionId, first.connectionId);
  assert.equal(data(await assetsQuery(reopened, 'getAssetVersion', selection)).result.version, 4);
  await mcp.client.close();
  assert.deepEqual([a, b, notMigrated, empty, future].map(snapshot), before);
  assert.equal(existsSync(missing), false); assert.deepEqual(mcp.errors, []);
  noPrivateOutput(JSON.stringify(mcp.transcript) + mcp.stderr(), paths);
});

test('unified desktop read access supports product queries while another process holds the SQLite writer lock', { timeout: 20000 }, async t => {
  const context = isolated(t);
  const profile = createProfile(context.root, 'product', 'Product fixture');
  const before = snapshot(profile);
  const mcp = await connect(t, [profile], context);
  const listed = data(await mcp.call('po_sources_list'));
  const writer = new DatabaseSync(join(profile, dbName));
  writer.exec('BEGIN IMMEDIATE');
  try {
    const { connectionId, access } = data(await mcp.call('po_sources_open', { access: 'read' }));
    assert.equal(access, 'read');
    failure(await mcp.call('po_sources_open', { sourceId: listed.defaultSourceId, access: 'write' }), 'ACCESS_MISMATCH');
    const models = data(await mcp.call('po_query', { connectionId, domain: 'models', operation: 'getAllModels' })).result;
    assert.ok(models.some(model => model.name === 'Product fixture'));
    const templates = data(await mcp.call('po_query', { connectionId, domain: 'templates', operation: 'listTemplates' }));
    assert.ok(Array.isArray(templates.result));
    assert.deepEqual(data(await mcp.call('po_runs_list', { connectionId })).runs, []);
    failure(await mcp.call('po_comparisons_list', { connectionId }), 'UNKNOWN_TOOL');
    failure(await mcp.call('po_mutate', { connectionId, domain: 'favorites', operation: 'deleteFavorite',
      arguments: ['favorite-shared'], expectedRevision: templates.revision, requestKey: 'readonly' }), 'BUSINESS_ACCESS_REQUIRED');
    data(await mcp.call('po_sources_close', { connectionId }));
    failure(await mcp.call('po_runs_list', { connectionId }), 'CONNECTION_CLOSED');
  } finally {
    writer.exec('ROLLBACK');
    writer.close();
  }
  assert.deepEqual(snapshot(profile), before);
  noPrivateOutput(JSON.stringify(mcp.transcript) + mcp.stderr(), [profile]);
});

test('actual stdio EOF closes the owner and exits normally with an open SQLite lease', { timeout: 15000 }, async t => {
  const context = isolated(t), profile = createProfile(context.root, 'eof', 'EOF');
  const before = snapshot(profile);
  const child = spawn(process.execPath, args([profile]), { cwd: context.root, env: context.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  context.cleanups.push(async () => { if (child.exitCode === null) { child.kill('SIGKILL'); await once(child, 'close'); } });
  const exited = once(child, 'exit');
  let buffer = '', stderr = ''; const pending = new Map(), output = [];
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\n')) {
      const end = buffer.indexOf('\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      const message = JSON.parse(line); output.push(message); pending.get(message.id)?.(message);
    }
  });
  let id = 0;
  const rpc = (method, params) => new Promise(done => {
    pending.set(++id, done); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const initialized = await rpc('initialize', { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'eof-test', version: '1' } });
  assert.ok(initialized.result.serverInfo);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const listed = await rpc('tools/call', { name: 'po_sources_list', arguments: {} });
  const sourceId = listed.result.structuredContent.sources[0].sourceId;
  const opened = await rpc('tools/call', { name: 'po_sources_open', arguments: { sourceId, access: 'read' } });
  assert.equal(opened.result.isError, undefined); assert.ok(opened.result.structuredContent.connectionId);
  child.stdin.end();
  const [code, signal] = await exited;
  assert.equal(code, 0); assert.equal(signal, null); assert.equal(buffer, '');
  assert.deepEqual(snapshot(profile), before); noPrivateOutput(JSON.stringify(output) + stderr, [profile]);
});

test('desktop startup rejects HTTP and keeps invalid private arguments out of stdout/stderr', { timeout: 10000 }, async t => {
  const context = isolated(t), missing = join(context.root, secret);
  const child = spawn(process.execPath, [...args([missing]), '--transport=http'], { cwd: context.root, env: context.env, windowsHide: true });
  context.cleanups.push(async () => { if (child.exitCode === null) { child.kill('SIGKILL'); await once(child, 'close'); } });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  const [code] = await once(child, 'close');
  assert.equal(code, 1); assert.equal(stdout, ''); assert.match(stderr, /^MCP startup failed \(INVALID_CONFIGURATION_OR_SOURCE\)\./);
  noPrivateOutput(stderr, [missing]); assert.equal(existsSync(missing), false);
});
