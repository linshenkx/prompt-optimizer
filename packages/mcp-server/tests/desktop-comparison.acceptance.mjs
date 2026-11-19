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

async function open(mcp, access = 'compare') {
  const { sources: [source] } = data(await mcp.call('po_sources_list'));
  return data(await mcp.call('po_sources_open', { sourceId: source.sourceId, access }));
}

test('independent desktop MCP shares the source across business and comparison tools and reopens durable results', { timeout: 45000 }, async t => {
  const fixture = isolated(t);
  const recording = await recordModelRequests(fixture);
  const { directory, source, original } = await createProfile(fixture.root, recording.origin);
  const before = snapshot(directory);
  const mcp = await connect(fixture, directory, recording.networkGuard, 'desktop');
  const { tools } = await mcp.client.listTools({}, { timeout: 8000 });
  const names = tools.map(tool => tool.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(['po_desktop_query', 'po_runs_start', 'po_tests_execute', 'po_comparisons_save'].every(name => names.includes(name)));

  const { sources: [sourceEntry] } = data(await mcp.call('po_sources_list'));
  const readBusinessFavorite = async () => data(await mcp.call('po_desktop_query', {
    sourceId: sourceEntry.sourceId, domain: 'favorites', operation: 'searchFavorites', arguments: ['Variable comparison'],
  })).result[0].id;
  assert.equal(await readBusinessFavorite(), 'favorite-fixture');
  const opened = await open(mcp);
  const { connectionId } = opened;
  assert.equal(opened.source.sourceId, sourceEntry.sourceId);
  assert.deepEqual(opened.capabilities, { read: true, execute: true, save: true });

  const { items: models } = data(await mcp.call('po_models_list', { connectionId }));
  assert.deepEqual(models.map(model => [model.name, model.executable]), [['Chat setting', true], ['Responses setting', true]]);
  const { items: [asset] } = data(await mcp.call('po_assets_list', { connectionId, modeKey: 'pro-variable' }));
  assert.equal(asset.currentVersionId, 'version-current');
  const assetSelection = { favoriteId: asset.favoriteId, assetId: asset.assetId };
  const savedVersions = data(await mcp.call('po_assets_list_versions', { connectionId, ...assetSelection, expectedRevision: asset.revision }));
  const selectedVersion = savedVersions.items.find(item => item.version === 1);
  assert.equal(selectedVersion?.versionId, 'version-selected');
  const selection = {
    connectionId,
    source: { ...assetSelection, versionId: selectedVersion.versionId, expectedRevision: savedVersions.revision },
    variables: { topic: 'literal {{style}}' },
    candidates: models.map((model, index) => ({ id: index === 0 ? 'a' : 'b', configKey: model.configKey, expectedRevision: model.revision })),
  };
  const prepare = async () => data(await mcp.call('po_tests_prepare', selection));
  const execute = async prepared => data(await mcp.call('po_tests_execute', {
    connectionId, preparedId: prepared.preparedId, previewRevision: prepared.previewRevision,
  }));
  const status = async prepared => data(await mcp.call('po_tests_get', { connectionId, preparedId: prepared.preparedId }));
  const save = async (prepared, saveKey) => data(await mcp.call('po_comparisons_save', { connectionId, preparedId: prepared.preparedId, saveKey }));

  const preview = await prepare();
  assert.equal(preview.source.versionId, 'version-selected');
  assert.deepEqual(preview.request, {
    rawPrompt, messages: [{ role: 'user', content: renderedPrompt }],
    variables: { style: 'saved-style', topic: 'literal {{style}}' },
  });
  assert.deepEqual(preview.runs.map(run => run.effective.preview), [
    { modelId: 'fixture-model', api: 'chat-completions', parameters: { temperature: 0.2 }, omittedParameterNames: ['other'] },
    { modelId: 'fixture-model', api: 'responses', parameters: { max_output_tokens: 49, 'reasoning.effort': 'high', temperature: 0.7 }, omittedParameterNames: [] },
  ]);
  failure(await mcp.call('po_comparisons_save', { connectionId, preparedId: preview.preparedId, saveKey: 'early' }), 'COMPARISON_NOT_COMPLETE');
  failure(await mcp.call('po_tests_execute', { connectionId, preparedId: preview.preparedId, previewRevision: 'wrong-revision' }), 'REVISION_CONFLICT');
  assert.equal(recording.calls.length, 0);
  assert.deepEqual(snapshot(directory), before);

  await execute(preview);
  const completed = await eventually(() => status(preview),
    view => view.runs.every(run => run.completedAt !== undefined), 'Both fixture model requests must finish');
  assert.deepEqual(completed.runs.map(run => [run.status, run.output, run.reasoning]), [
    ['success', 'Chat answer', 'Chat reasoning'], ['success', 'Responses answer', 'Responses reasoning'],
  ]);
  assert.deepEqual(completed.runs.map(run => run.effective.request), preview.runs.map(run => run.effective.preview));
  assert.ok(completed.runs.every(run => run.effective.requestEvidence === 'captured'));
  assert.equal(recording.calls.length, 2);
  const chat = recording.calls.find(call => call.path === '/v1/chat/completions');
  const responses = recording.calls.find(call => call.path === '/v1/responses');
  assert.ok(chat?.authorized && responses?.authorized);
  assert.deepEqual(chat.body.messages, preview.request.messages);
  assert.deepEqual(responses.body.input, preview.request.messages);
  assert.equal(chat.body.model, responses.body.model);
  assert.equal(chat.body.temperature, 0.2);
  assert.equal(chat.body.vendor_note, privateText);
  assert.equal(responses.body.temperature, 0.7);
  assert.equal(responses.body.max_output_tokens, 49);
  assert.deepEqual(responses.body.reasoning, { effort: 'high' });
  assert.equal(Object.hasOwn(responses.body, 'max_completion_tokens'), false);

  const saved = await save(preview, 'fixture-save');
  const [retried, sameGroup] = await Promise.all([save(preview, 'fixture-save'), save(preview, 'fixture-another-save-key')]);
  assert.deepEqual(retried, saved);
  assert.deepEqual(sameGroup, saved);
  assert.equal(saved.comparisonId, preview.comparisonId);
  assert.equal(saved.viewTarget.comparisonId, preview.comparisonId);
  const savedRead = data(await mcp.call('po_comparisons_get', { connectionId, comparisonId: saved.comparisonId }));
  assert.equal(savedRead.revision, saved.revision);
  assert.equal(savedRead.comparison.schemaVersion, 'saved-comparison/v1');
  assert.deepEqual(savedRead.comparison.request, preview.request);
  assert.deepEqual(savedRead.comparison.runs, completed.runs);
  assert.equal(recording.calls.length, 2);

  recording.holdNextResponsesRequest();
  const second = await prepare();
  await execute(second);
  await eventually(() => status(second), view => view.runs[0].status === 'success' &&
    view.runs[1].status === 'running' && view.runs[1].output === 'Responses partial', 'Both streams must reach the cancellation fixture');
  const cancelled = data(await mcp.call('po_tests_cancel', { connectionId, preparedId: second.preparedId, runId: second.runs[1].runId }));
  assert.deepEqual(cancelled.runs.map(run => [run.status, run.output]), [
    ['success', 'Chat answer'], ['cancelled', 'Responses partial'],
  ]);
  await eventually(() => recording.calls.slice(2).some(call => call.path === '/v1/responses' && call.cancelled), Boolean,
    'Cancelling a run must close the held SDK connection');
  const secondSaved = await save(second, 'fixture-partial-save');
  assert.equal(recording.calls.length, 4);

  recording.rejectChatRequests();
  const failed = await prepare();
  await execute(failed);
  const failureStatus = await eventually(() => status(failed), view => view.runs.every(run => run.completedAt !== undefined),
    'One provider failure must still allow the other result to finish');
  assert.deepEqual(failureStatus.runs.map(run => run.status), ['error', 'success']);
  assert.equal(failureStatus.runs[0].errorCode, 'MODEL_REQUEST_FAILED');
  assert.equal(recording.calls.length, 6, 'one explicit execution sends at most one request per candidate');
  data(await mcp.call('po_sources_close', { connectionId }));
  failure(await mcp.call('po_comparisons_get', { connectionId, comparisonId: saved.comparisonId }), 'CONNECTION_CLOSED');
  assert.equal(await readBusinessFavorite(), asset.favoriteId);
  await mcp.close();

  const restarted = await connect(fixture, directory, recording.networkGuard, 'desktop');
  const reopened = await open(restarted);
  assert.notEqual(reopened.connectionId, connectionId);
  const list = data(await restarted.call('po_comparisons_list', { connectionId: reopened.connectionId, favoriteId: asset.favoriteId }));
  assert.deepEqual(new Map(list.items.map(item => [item.id, item.statuses])), new Map([
    [saved.comparisonId, ['success', 'success']], [secondSaved.comparisonId, ['success', 'cancelled']],
  ]));
  assert.deepEqual(data(await restarted.call('po_comparisons_get', {
    connectionId: reopened.connectionId, comparisonId: saved.comparisonId,
  })), savedRead);
  const reopenedPartial = data(await restarted.call('po_comparisons_get', {
    connectionId: reopened.connectionId, comparisonId: secondSaved.comparisonId,
  }));
  assert.equal(reopenedPartial.comparison.runs[1].output, 'Responses partial');
  await restarted.close();

  const readOnly = await connect(fixture, directory, recording.networkGuard, 'desktop-readonly');
  const listTools = await readOnly.client.listTools({}, { timeout: 8000 });
  assert.ok(!listTools.tools.some(tool => tool.name.startsWith('po_tests_') || tool.name.startsWith('po_comparisons_')));
  const { sources: [readOnlySource] } = data(await readOnly.call('po_sources_list'));
  failure(await readOnly.call('po_sources_open', { access: 'compare', sourceId: readOnlySource.sourceId }), 'INVALID_INPUT');
  const readOnlyOpened = await open(readOnly, 'read');
  assert.deepEqual(readOnlyOpened.capabilities, { read: true, execute: false, save: false });
  await readOnly.close();
  assert.equal(recording.calls.length, 6);

  const after = snapshot(directory);
  const comparisonKeys = after.kv.filter(row => row.key.startsWith('comparison/v1/'));
  assert.equal(comparisonKeys.filter(row => row.key.startsWith('comparison/v1/records/')).length, 2);
  assert.deepEqual({ ...after, kv: after.kv.filter(row => !row.key.startsWith('comparison/v1/')) }, before);
  assert.equal(readFileSync(source, 'utf8'), original);
  for (const session of [mcp, restarted, readOnly]) {
    for (const secret of [credential, privateText, directory, JSON.stringify(directory).slice(1, -1), recording.origin]) {
      assert.ok(!session.publicOutput().includes(secret), 'MCP output must omit private fixture values');
    }
    assert.deepEqual(session.errors, []);
  }
});

test('built comparison MCP compares a draft or another favorite version under the same saved model', { timeout: 45000 }, async t => {
  const fixture = isolated(t);
  const recording = await recordModelRequests(fixture);
  const { directory, source, original } = await createProfile(fixture.root, recording.origin);
  const before = snapshot(directory);
  const mcp = await connect(fixture, directory, recording.networkGuard);
  const { connectionId } = await open(mcp);
  const { items: [model] } = data(await mcp.call('po_models_list', { connectionId }));
  const { items: [asset] } = data(await mcp.call('po_assets_list', { connectionId, modeKey: 'pro-variable' }));
  const versions = data(await mcp.call('po_assets_list_versions', {
    connectionId, favoriteId: asset.favoriteId, assetId: asset.assetId, expectedRevision: asset.revision,
  }));
  const base = versions.items.find(version => version.version === 1);
  const alternate = versions.items.find(version => version.version === 2);
  assert.ok(base && alternate);

  const selectedModel = { configKey: model.configKey, expectedRevision: model.revision };
  const input = {
    connectionId,
    source: { favoriteId: asset.favoriteId, assetId: asset.assetId, versionId: base.versionId, expectedRevision: versions.revision },
    variables: { topic: 'literal {{style}}' },
    candidates: [{ id: 'a', ...selectedModel }, { id: 'b', ...selectedModel }],
  };
  const saved = [];
  for (const [candidatePrompt, expected] of [
    [{ kind: 'draft', text: 'Summarize {{topic}} as {{style}}' }, 'Summarize literal {{style}} as saved-style'],
    [{ kind: 'saved-version', versionId: alternate.versionId }, 'Current version'],
  ]) {
    const callCount = recording.calls.length;
    const preview = data(await mcp.call('po_tests_prepare', { ...input, candidatePrompt }));
    assert.equal(recording.calls.length, callCount);
    assert.equal(preview.request.messages[0].content, renderedPrompt);
    assert.equal(preview.candidatePrompt.kind, candidatePrompt.kind);
    assert.equal(preview.candidatePrompt.request.messages[0].content, expected);
    assert.deepEqual(preview.runs[0].effective.preview, preview.runs[1].effective.preview);

    data(await mcp.call('po_tests_execute', { connectionId, preparedId: preview.preparedId, previewRevision: preview.previewRevision }));
    const completed = await eventually(
      async () => data(await mcp.call('po_tests_get', { connectionId, preparedId: preview.preparedId })),
      view => view.runs.every(run => run.completedAt !== undefined),
      'Both requests for the saved model must finish',
    );
    assert.deepEqual(completed.runs.map(run => run.status), ['success', 'success']);
    const calls = recording.calls.slice(callCount);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.authorized && call.path === '/v1/chat/completions'));
    const baselineCall = calls.find(call => call.body.messages[0].content === renderedPrompt);
    const candidateCall = calls.find(call => call.body.messages[0].content === expected);
    assert.ok(baselineCall && candidateCall);
    assert.deepEqual(candidateCall.body, { ...baselineCall.body, messages: preview.candidatePrompt.request.messages });

    const saveInput = { connectionId, preparedId: preview.preparedId, saveKey: 'same-model-' + candidatePrompt.kind };
    const result = data(await mcp.call('po_comparisons_save', saveInput));
    assert.deepEqual(data(await mcp.call('po_comparisons_save', saveInput)), result);
    saved.push({ result, preview, runs: completed.runs });
  }

  await mcp.close();
  const restarted = await connect(fixture, directory, recording.networkGuard);
  const second = await open(restarted);
  for (const { result, preview, runs } of saved) {
    const reloaded = data(await restarted.call('po_comparisons_get', {
      connectionId: second.connectionId, comparisonId: result.comparisonId,
    }));
    assert.equal(reloaded.comparison.schemaVersion, 'saved-comparison/v2');
    assert.deepEqual(reloaded.comparison.candidatePrompt, preview.candidatePrompt);
    assert.deepEqual(reloaded.comparison.request, preview.request);
    assert.deepEqual(reloaded.comparison.runs, runs);
  }
  assert.equal(recording.calls.length, 4);
  const after = snapshot(directory);
  assert.deepEqual({ ...after, kv: after.kv.filter(row => !row.key.startsWith('comparison/v1/')) }, before);
  assert.equal(readFileSync(source, 'utf8'), original);
  for (const session of [mcp, restarted]) {
    for (const secret of [credential, privateText, directory, JSON.stringify(directory).slice(1, -1), recording.origin]) {
      assert.ok(!session.publicOutput().includes(secret), 'MCP output must omit private fixture values');
    }
    assert.deepEqual(session.errors, []);
  }
});
