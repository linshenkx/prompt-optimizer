import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, existsSync, writeFileSync, rmSync, copyFileSync, cpSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, DEFAULT_INHERITED_ENV_VARS } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

const binary = fileURLToPath(new URL('../bin/prompt-optimizer-mcp.cjs', import.meta.url));
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
const args = paths => [binary, '--mode=desktop-readonly', ...paths.map(path => `--desktop-profile=${path}`)];
async function connect(t, paths, context) {
  const transport = new StdioClientTransport({ command: process.execPath, args: context.commandArgs ?? args(paths), cwd: context.cwd ?? context.root, env: context.env, stderr: 'pipe' });
  let stderr = ''; transport.stderr.on('data', chunk => { stderr += chunk; });
  const client = new Client({ name: 'isolated-desktop-acceptance', version: '1' });
  const errors = []; client.onerror = error => errors.push(error);
  context.cleanups.push(async () => { await client.close(); });
  try { await client.connect(transport, { timeout: context.timeout ?? 5000 }); }
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
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['po_assets_get_version', 'po_assets_list', 'po_models_list', 'po_sources_close', 'po_sources_list', 'po_sources_open']);
  assert.ok(tools.every(tool => tool.annotations.readOnlyHint && tool.inputSchema.additionalProperties === false));
  const listed = data(await mcp.call('po_sources_list'));
  assert.equal(listed.sources.length, 6); assert.ok(listed.sources.every(source => source.availability === 'disconnected')); assert.equal(existsSync(missing), false);
  const open = async i => data(await mcp.call('po_sources_open', { sourceId: listed.sources[i].sourceId, access: 'read' }));
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[0].sourceId, access: 'save' }), 'INVALID_INPUT');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[0].sourceId, access: 'read', userDataPath: missing }), 'INVALID_INPUT');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[2].sourceId, access: 'read' }), 'SOURCE_NOT_READY');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[3].sourceId, access: 'read' }), 'SOURCE_NOT_READY');
  failure(await mcp.call('po_sources_open', { sourceId: listed.sources[5].sourceId, access: 'read' }), 'SOURCE_NOT_READY');
  assert.equal(existsSync(missing), false);
  const first = await open(0), second = await open(1), emptyConnection = await open(4);
  assert.deepEqual(first.capabilities, { read: true, execute: false, save: false });
  assert.equal(first.schemaVersion, 'prompt-model/v1');
  assert.equal((await open(0)).connectionId, first.connectionId);
  const modelsA = data(await mcp.call('po_models_list', { connectionId: first.connectionId, limit: 1 }));
  assert.equal(modelsA.items[0].name, 'Profile A'); assert.equal(modelsA.items[0].executable, false); assert.ok(modelsA.nextCursor);
  const modelKeys = ['capabilities', 'configKey', 'enabled', 'executable', 'modelId', 'name', 'providerId', 'revision', 'unavailableReason'];
  assert.deepEqual(Object.keys(modelsA.items[0]).sort(), modelKeys.sort());
  assert.equal(data(await mcp.call('po_models_list', { connectionId: second.connectionId })).items[0].name, 'Profile B');
  failure(await mcp.call('po_models_list', { connectionId: second.connectionId, cursor: modelsA.nextCursor }), 'INVALID_CURSOR');
  assert.deepEqual(data(await mcp.call('po_models_list', { connectionId: emptyConnection.connectionId })).items, []);
  assert.deepEqual(data(await mcp.call('po_assets_list', { connectionId: emptyConnection.connectionId })).items, []);
  const assets = data(await mcp.call('po_assets_list', { connectionId: first.connectionId })).items;
  assert.deepEqual(assets.map(item => [item.favoriteId, item.assetId]), [['favorite-shared', 'asset-shared'], ['favorite-shared-copy', 'asset-shared']]);
  const summary = assets[0], copy = assets[1];
  const selection = { favoriteId: summary.favoriteId, assetId: summary.assetId, versionId: 'version-a', expectedRevision: summary.revision };
  const history = data(await mcp.call('po_assets_get_version', { connectionId: first.connectionId, ...selection }));
  assert.equal(history.content.text, 'Profile A historical'); assert.equal(history.version, 4);
  assert.deepEqual(history.variables, [{ name: 'topic', required: true }]);
  const copySelection = { ...selection, favoriteId: copy.favoriteId, expectedRevision: copy.revision };
  const copiedHistory = data(await mcp.call('po_assets_get_version', { connectionId: first.connectionId, ...copySelection }));
  assert.equal(copiedHistory.content.text, 'Profile A copy historical'); assert.equal(copiedHistory.version, 14);
  failure(await mcp.call('po_assets_get_version', { connectionId: first.connectionId, ...copySelection, expectedRevision: summary.revision }), 'REVISION_CONFLICT');
  failure(await mcp.call('po_assets_get_version', { connectionId: second.connectionId, ...selection }), 'REVISION_CONFLICT');
  failure(await mcp.call('po_assets_get_version', { connectionId: first.connectionId, ...selection, versionId: 'does-not-exist' }), 'ASSET_VERSION_NOT_FOUND');
  data(await mcp.call('po_sources_close', { connectionId: first.connectionId }));
  failure(await mcp.call('po_models_list', { connectionId: first.connectionId }), 'CONNECTION_CLOSED');
  const reopened = await open(0);
  assert.notEqual(reopened.connectionId, first.connectionId); assert.notEqual(reopened.source.sourceEpoch, first.source.sourceEpoch);
  failure(await mcp.call('po_assets_get_version', { connectionId: reopened.connectionId, ...selection }), 'REVISION_CONFLICT');
  await mcp.client.close();
  assert.deepEqual([a, b, notMigrated, empty, future].map(snapshot), before);
  assert.equal(existsSync(missing), false); assert.deepEqual(mcp.errors, []);
  noPrivateOutput(JSON.stringify(mcp.transcript) + mcp.stderr(), paths);
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

test('default legacy stdio still discovers its original three tools with JSON-RPC-only stdout', { timeout: 20000 }, async t => {
  const context = isolated(t);
  // Copy built CLI/preloader only. All eight legacy dotenv search paths are now
  // inside this fresh fixture; its dependency junction contains installed code.
  const project = join(context.root, 'project'), packages = join(project, 'packages'), pkg = join(packages, 'mcp-server');
  mkdirSync(join(pkg, 'dist'), { recursive: true }); mkdirSync(join(pkg, 'bin'));
  copyFileSync(binary, join(pkg, 'bin', basename(binary)));
  cpSync(fileURLToPath(new URL('../dist', import.meta.url)), join(pkg, 'dist'), { recursive: true });
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ type: 'module' }));
  copyFileSync(fileURLToPath(new URL('../preload-env.cjs', import.meta.url)), join(pkg, 'preload-env.cjs'));
  const dependencies = join(pkg, 'node_modules');
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), dependencies, process.platform === 'win32' ? 'junction' : 'dir');
  context.cleanups.push(() => { assert.ok(resolve(dependencies).startsWith(resolve(context.root) + sep)); unlinkSync(dependencies); });
  for (const path of [project, packages, pkg]) for (const file of ['.env', '.env.local']) writeFileSync(join(path, file), `VITE_OPENAI_API_KEY=${secret}\n`);
  const mcp = await connect(t, [], { ...context, timeout: 10000, cwd: pkg, commandArgs: [join(pkg, 'bin', basename(binary)), '--transport=stdio'],
    env: { ...context.env, DEBUG: 'mcp:*' } });
  const tools = (await mcp.client.listTools({}, { timeout: 5000 })).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['iterate-prompt', 'optimize-system-prompt', 'optimize-user-prompt']);
  assert.deepEqual(mcp.errors, []);
  assert.match(mcp.stderr(), /Environment variables loaded for MCP server/);
  assert.ok(!mcp.stderr().includes(secret));
  await mcp.client.close();
});
