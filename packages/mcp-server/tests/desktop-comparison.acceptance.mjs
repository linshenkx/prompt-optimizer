import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DEFAULT_INHERITED_ENV_VARS, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DESKTOP_DATABASE_FILENAME, LEGACY_STORAGE_FILENAME, openDesktopStorage } from '@prompt-optimizer/core/node';

const cli = fileURLToPath(new URL('../bin/prompt-optimizer-mcp.cjs', import.meta.url));
const desktopCli = fileURLToPath(new URL('../bin/prompt-optimizer-desktop-mcp.cjs', import.meta.url));
const credential = 'SYNTHETIC_COMPARISON_MCP_CREDENTIAL';
const privateText = 'SYNTHETIC_COMPARISON_PRIVATE_SETTING';
const rawPrompt = 'Use {{style}} for {{topic}}';
const renderedPrompt = 'Use saved-style for literal {{style}}';

function isolated(t) {
  const root = mkdtempSync(join(tmpdir(), 'po-mcp-compare-'));
  const closeResources = [];
  const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(key => [key, '']));
  Object.assign(env, {
    PATH: dirname(process.execPath), SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows',
    SYSTEMDRIVE: process.env.SYSTEMDRIVE ?? 'C:', APPDATA: root, LOCALAPPDATA: root,
    USERPROFILE: root, HOME: root, HOMEPATH: root, TEMP: root, TMP: root,
    USERNAME: 'synthetic-mcp-comparison', NODE_OPTIONS: '', OPENAI_LOG: 'debug',
  });
  t.after(async () => {
    for (const close of closeResources.reverse()) await close();
    const target = realpathSync(root);
    assert.equal(dirname(target), realpathSync(tmpdir()));
    assert.ok(basename(target).startsWith('po-mcp-compare-'));
    rmSync(target, { force: true, recursive: true });
  });
  return { root, closeResources, env };
}

async function recordModelRequests(context) {
  const calls = [];
  let holdResponse = false;
  let rejectChat = false;
  const server = createServer(async (request, response) => {
    try {
      const buffers = [];
      for await (const chunk of request) buffers.push(chunk);
      const body = JSON.parse(Buffer.concat(buffers).toString('utf8'));
      const path = request.url;
      const call = { body, path, authorized: request.headers.authorization === 'Bearer ' + credential, cancelled: false };
      calls.push(call);
      const responses = path === '/v1/responses';
      if (request.method !== 'POST' || !call.authorized ||
        (!responses && path !== '/v1/chat/completions')) {
        response.writeHead(403).end();
        return;
      }

      if (!responses && rejectChat) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: privateText, type: 'server_error' } }));
        return;
      }

      response.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = event => response.write('data: ' + JSON.stringify(event) + '\n\n');
      if (responses) {
        send({ type: 'response.reasoning_summary_text.delta', delta: 'Responses reasoning' });
        send({ type: 'response.output_text.delta', delta: holdResponse ? 'Responses partial' : 'Responses answer' });
        if (holdResponse) {
          holdResponse = false;
          response.on('close', () => { call.cancelled = !response.writableEnded; });
          return;
        }
        send({ type: 'response.completed', response: { output_text: 'Responses answer' } });
      } else {
        send({ id: 'fixture-completion', model: body.model, choices: [{
          index: 0, delta: { content: 'Chat answer', reasoning_content: 'Chat reasoning' },
        }] });
      }
      response.end('data: [DONE]\n\n');
    } catch {
      response.destroy();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.closeResources.push(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const origin = 'http://127.0.0.1:' + server.address().port;

  // Limit the child SDK to the fixture origin, even if a model endpoint regresses.
  const networkGuard = join(context.root, 'loopback-fetch.cjs');
  writeFileSync(networkGuard, [
    'const fetch = globalThis.fetch.bind(globalThis);',
    'globalThis.fetch = (input, options) => {',
    '  const url = new URL(input instanceof Request ? input.url : input);',
    '  if (url.origin !== ' + JSON.stringify(origin) + ') throw new Error("Fixture permits only loopback requests");',
    '  return fetch(input, { ...options, redirect: "error" });',
    '};',
  ].join('\n'));
  return {
    origin, calls, networkGuard,
    holdNextResponsesRequest() { holdResponse = true; },
    rejectChatRequests() { rejectChat = true; },
  };
}

async function createProfile(root, origin) {
  const directory = join(root, 'desktop profile');
  mkdirSync(directory);
  const model = (name, requestStyle, paramOverrides) => ({
    id: 'saved-' + requestStyle, name, enabled: true,
    providerId: 'openai-compatible', modelId: 'fixture-model',
    providerMeta: { id: 'openai-compatible', requiresApiKey: false },
    modelMeta: {
      id: 'fixture-model', providerId: 'openai-compatible',
      parameterDefinitions: [{
        name: 'max_completion_tokens', type: 'integer', description: 'Maximum output tokens', min: 1, max: 1000000,
      }],
      capabilities: { supportsTools: false, supportsReasoning: true },
    },
    connectionConfig: { apiKey: credential, baseURL: origin + '/v1', requestStyle },
    paramOverrides,
  });
  const favorite = {
    id: 'favorite-fixture', title: 'Variable comparison', content: 'Current version', tags: ['fixture'],
    createdAt: 1, updatedAt: 2, useCount: 0,
    metadata: { promptAsset: {
      schemaVersion: 'prompt-model/v1', id: 'asset-fixture', title: 'Variable comparison', tags: ['fixture'],
      createdAt: 1, updatedAt: 2, currentVersionId: 'version-current', examples: [],
      contract: { family: 'pro', subMode: 'variable', modeKey: 'pro-variable', variables: [
        { name: 'style', required: true }, { name: 'topic', required: true },
      ] },
      versions: [
        { id: 'version-selected', version: 1, createdAt: 1, content: { kind: 'text', text: rawPrompt } },
        { id: 'version-current', version: 2, createdAt: 2, content: { kind: 'text', text: 'Current version' } },
      ],
    } },
  };
  const existing = {
    models: {
      chat: model('Chat setting', 'chat_completions', { temperature: 0.2, vendor_note: privateText }),
      responses: model('Responses setting', 'responses', { temperature: 0.7, max_completion_tokens: 49, reasoning_effort: 'high' }),
    },
    favorites: [favorite],
    'pref:variableManager.storage': { customVariables: { style: 'saved-style', unused: privateText }, advancedModeEnabled: true },
    'pref:session/v1/pro-variable': { draft: 'keep my variable workspace draft' },
    'pref:session/v1/arena': { draft: 'keep my Arena draft' },
    history: [{ id: 'previous-history' }],
    untouched: { legacy: true },
  };
  const source = join(directory, LEGACY_STORAGE_FILENAME);
  const original = JSON.stringify(Object.fromEntries(Object.entries(existing).map(([key, value]) => [key, JSON.stringify(value)])));
  writeFileSync(source, original);
  const { provider } = await openDesktopStorage(directory);
  try {
    assert.deepEqual(Object.fromEntries(await provider.getAllEntries()), JSON.parse(original));
  } finally {
    await provider.close();
  }
  return { directory, source, original };
}

function snapshot(profile) {
  const db = new DatabaseSync(join(profile, DESKTOP_DATABASE_FILENAME), { readOnly: true });
  try {
    return {
      kv: db.prepare('SELECT key, value FROM storage_kv ORDER BY key').all(),
      metadata: db.prepare('SELECT key, value FROM storage_metadata ORDER BY key').all(),
      schema: db.prepare('SELECT type, name, sql FROM sqlite_schema ORDER BY type, name').all(),
    };
  } finally {
    db.close();
  }
}

async function connect(context, profile, networkGuard, mode = 'desktop-comparison') {
  const entry = mode === 'desktop' ? [desktopCli] : [cli, '--mode=' + mode];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--require', networkGuard, ...entry, '--desktop-profile=' + profile],
    cwd: context.root, env: context.env, stderr: 'pipe',
  });
  const client = new Client({ name: 'isolated-comparison-acceptance', version: '1' });
  let stderr = '';
  transport.stderr.on('data', chunk => { stderr += chunk; });
  const errors = [];
  const transcript = [];
  client.onerror = error => errors.push(error);
  let closing;
  const close = () => closing ??= client.close();
  context.closeResources.push(close);
  await client.connect(transport, { timeout: 8000 });
  return {
    client, close, errors,
    async call(name, args = {}) {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 8000 });
      transcript.push(result);
      return result;
    },
    publicOutput: () => JSON.stringify(transcript) + stderr,
  };
}

function data(result) {
  assert.notEqual(result.isError, true, result.structuredContent?.error?.code);
  assert.ok(result.structuredContent);
  return result.structuredContent;
}

function failure(result, code) {
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent?.error?.code, code);
}

async function eventually(read, predicate, message) {
  const deadline = Date.now() + 5000;
  do {
    const value = await read();
    if (predicate(value)) return value;
    await delay(30);
  } while (Date.now() < deadline);
  assert.fail(message);
}

test('desktop aliases use the same product batch for model and prompt comparisons', { timeout: 60000 }, async t => {
  const fixture = isolated(t);
  const recording = await recordModelRequests(fixture);
  const { directory, source, original } = await createProfile(fixture.root, recording.origin);
  const initial = snapshot(directory);
  let savedId;
  for (const mode of ['desktop', 'desktop-comparison']) {
    const mcp = await connect(fixture, directory, recording.networkGuard, mode);
    const names = (await mcp.client.listTools()).tools.map(tool => tool.name);
    assert.equal(names.length, 15);
    assert(!names.some(name => /^po_(assets|models|tests|comparisons)_/.test(name)));
    const { connectionId } = data(await mcp.call('po_sources_open', { access: 'write' }));
    const call = async (name, fields = {}) => data(await mcp.call(name, { connectionId, ...fields }));
    failure(await mcp.call('po_tests_prepare', { connectionId }), 'UNKNOWN_TOOL');
    const { revision, result } = await call('po_query', { domain: 'assets', operation: 'listAssets' });
    const asset = result.items[0];
    const selection = { favoriteId: asset.favoriteId, assetId: asset.assetId, versionId: 'version-selected', expectedRevision: asset.revision };
    const first = { modelKey: 'chat', source: selection, promptField: 'userPrompt', variables: { topic: 'orbits' } };
    const second = mode === 'desktop' ? { ...first, modelKey: 'responses' } :
      { modelKey: 'chat', userPrompt: 'Short answer about {{topic}}', variables: first.variables };
    if (savedId) assert.equal((await call('po_runs_get', { runId: savedId })).saved, true);
    const start = { requestKey: mode, expectedRevision: revision, input: { kind: 'test-batch', request: { candidates: [first, second] } } };
    const run = await call('po_runs_start', start);
    assert.equal((await call('po_runs_start', start)).id, run.id);
    const done = await eventually(() => call('po_runs_get', { runId: run.id }), value => value.status !== 'running', 'batch did not finish');
    assert.deepEqual(done.output.map(item => item.status), ['succeeded', 'succeeded']);
    assert.deepEqual(done.output.map(item => item.output), ['Chat answer', mode === 'desktop' ? 'Responses answer' : 'Chat answer']);
    assert.equal(done.input.request.candidates[0].userPrompt, 'Use saved-style for orbits');
    assert.equal(done.input.request.candidates[0].rawUserPrompt, rawPrompt);
    assert.deepEqual(done.input.request.candidates[0].variables, { style: 'saved-style', topic: 'orbits' });
    assert.equal(done.output[0].reasoning, 'Chat reasoning');
    savedId = (await call('po_runs_save', { runId: run.id })).id;
    assert((await call('po_runs_list', { savedOnly: true })).runs.some(item => item.id === savedId));
    assert(!mcp.publicOutput().includes(credential));
    await call('po_sources_close');
    await mcp.close();
  }
  const final = snapshot(directory);
  assert.deepEqual(final.kv.filter(row => row.key !== 'mcp:runs:v1'), initial.kv);
  assert.deepEqual(final.metadata, initial.metadata);
  assert.deepEqual(final.schema, initial.schema);
  assert.equal(readFileSync(source, 'utf8'), original);
});
