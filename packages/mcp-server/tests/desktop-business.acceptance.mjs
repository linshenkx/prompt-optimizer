import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, DEFAULT_INHERITED_ENV_VARS } from '@modelcontextprotocol/sdk/client/stdio.js';
import { openDesktopStorage } from '@prompt-optimizer/core/node';

const cli = fileURLToPath(new URL('../bin/prompt-optimizer-desktop-mcp.cjs', import.meta.url));
const credential = 'SYNTHETIC_BUSINESS_SECRET_NEVER_RETURN';
const evaluation = { score: { overall: 88, dimensions: [{ name: 'Clarity', score: 88 }] }, improvements: ['State the expected output'], summary: 'Clear synthetic test', patchPlan: [] };

test('independent desktop stdio: favorite → optimization → test → evaluation → save → reopen, cancellation and redaction', { timeout: 120000 }, async context => {
  const root = await mkdtemp(join(tmpdir(), 'po-mcp-business-stdio-'));
  const profiles = await openDesktopStorage(root);
  let evaluate = false;
  let hold = false;
  let fail = false;
  const requests = [];
  const endpoint = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const bytes = Buffer.concat(chunks).toString('utf8');
      const body = bytes ? JSON.parse(bytes) : {};
      requests.push(body);
      assert.equal(request.headers.authorization, `Bearer ${credential}`);
      if (request.url === '/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ object: 'list', data: [{ id: 'fixture-model', object: 'model' }] })); return;
      }
      if (fail) {
        response.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: credential } }));
        return;
      }
      const answer = evaluate ? JSON.stringify(evaluation) : hold ? 'partial retained' : 'Synthetic optimized prompt';
      if (!body.stream) {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: 'fixture', model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: answer }, finish_reason: 'stop' }] })); return;
      }
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write('data: ' + JSON.stringify({ id: 'fixture', model: body.model, choices: [{ index: 0, delta: { content: answer } }] }) + '\n\n');
      if (!hold) response.end('data: [DONE]\n\n');
    } catch { response.destroy(); }
  });
  endpoint.listen(0, '127.0.0.1'); await once(endpoint, 'listening');
  const origin = `http://127.0.0.1:${endpoint.address().port}`;
  await profiles.provider.setItem('models', JSON.stringify({ fixture: {
    id: 'fixture', name: 'Isolated model', enabled: true, providerId: 'openai-compatible', modelId: 'fixture-model',
    providerMeta: { id: 'openai-compatible', requiresApiKey: false },
    modelMeta: { id: 'fixture-model', providerId: 'openai-compatible', parameterDefinitions: [], capabilities: { supportsTools: false, supportsReasoning: false } },
    connectionConfig: { apiKey: credential, baseURL: origin + '/v1' }, paramOverrides: {},
  } }));
  await profiles.provider.setItem('unrelated-existing-data', 'must stay exact');
  const modelConfigs = JSON.parse(await profiles.provider.getItem('models'));
  modelConfigs.second = { ...modelConfigs.fixture, id: 'second', name: 'Second isolated model', modelId: 'fixture-second',
    modelMeta: { ...modelConfigs.fixture.modelMeta, id: 'fixture-second' } };
  await profiles.provider.setItem('models', JSON.stringify(modelConfigs));
  const guard = join(root, 'loopback.cjs');
  await writeFile(guard, `const original = global.fetch; global.fetch = (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== ${JSON.stringify(origin)}) throw new Error('Only isolated loopback traffic is allowed');
    return original(input, { ...options, redirect: 'error' });
  };`);
  const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(key => [key, '']));
  Object.assign(env, { PATH: dirname(process.execPath), SYSTEMROOT: process.env.SYSTEMROOT ?? 'C:\\Windows',
    APPDATA: root, LOCALAPPDATA: root, USERPROFILE: root, HOME: root, TEMP: root, TMP: root, NODE_OPTIONS: '' });
  let client;
  let transport;
  let diagnostics = '';
  const connect = async () => {
    client = new Client({ name: 'Codex desktop business acceptance', version: '1' });
    transport = new StdioClientTransport({ command: process.execPath, args: ['--require', guard, cli, `--desktop-profile=${root}`], env, stderr: 'pipe' });
    transport.stderr?.on('data', bytes => { diagnostics += bytes.toString(); });
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, 'prompt-optimizer');
    return (await call('po_sources_open', { access: 'write' })).connectionId;
  };
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const payload = result.structuredContent ?? JSON.parse(result.content[0].text);
    assert.equal(JSON.stringify(payload).includes(credential), false, `credential escaped ${name}`);
    return result.isError ? { failed: true, ...payload } : payload;
  };
  context.after(async () => {
    await client?.close(); await transport?.close();
    endpoint.closeAllConnections(); await new Promise(resolve => endpoint.close(resolve));
    await profiles.provider.close();
    const target = await realpath(root);
    assert.equal(dirname(target), await realpath(tmpdir()));
    assert.ok(basename(target).startsWith('po-mcp-business-stdio-'));
    await rm(target, { force: true, recursive: true });
  });
  let connectionId = await connect();
  const tools = (await client.listTools()).tools.map(tool => tool.name);
  assert.ok(tools.includes('po_mutate')); assert.ok(tools.includes('po_runs_start'));
  const query = (domain, operation, args = []) => call('po_query', { connectionId, domain, operation, arguments: args });
  const mutate = async (domain, operation, args, key) => {
    const { revision } = await query('favorites', 'getFavorites');
    const result = await call('po_mutate', { connectionId, domain, operation, arguments: args, expectedRevision: revision, requestKey: key });
    assert.equal(result.failed, undefined, JSON.stringify(result)); return result;
  };
  const created = await mutate('favorites', 'addFavorite', [{ title: 'Codex created favorite', content: 'Summarize the supplied text',
    tags: ['codex'], functionMode: 'basic', optimizationMode: 'system' }], 'create-favorite');
  const found = await query('favorites', 'searchFavorites', ['Codex created']);
  assert.equal(found.result[0].id, created.result);
  const assets = await query('assets', 'listAssets');
  const asset = assets.result.items.find(item => item.favoriteId === created.result);
  assert.ok(asset);
  const source = { favoriteId: asset.favoriteId, assetId: asset.assetId, versionId: asset.currentVersionId, expectedRevision: asset.revision };
  const templates = await query('templates', 'listTemplatesByType', ['optimize']);
  const models = await query('models', 'getModel', ['fixture']);
  assert.equal(models.result.connectionConfig, '[REDACTED]');
  const start = async (input, requestKey) => {
    const { revision } = await query('favorites', 'getFavorites');
    const run = await call('po_runs_start', { connectionId, input, requestKey, expectedRevision: revision });
    assert.equal(run.failed, undefined, JSON.stringify(run)); return run;
  };
  const finish = async id => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const run = await call('po_runs_get', { connectionId, runId: id });
      if (run.status !== 'running') return run;
      await delay(30);
    }
    throw new Error('Synthetic run did not terminate');
  };
  const optimized = await start({ kind: 'optimize', source, request: {
    optimizationMode: 'system', modelKey: 'fixture', templateId: templates.result[0].id,
  } }, 'optimize-once');
  const optimizedResult = await finish(optimized.id);
  assert.equal(optimizedResult.status, 'succeeded', JSON.stringify(optimizedResult));
  assert.equal(optimizedResult.output, 'Synthetic optimized prompt');
  const savedHistory = await call('po_runs_save', { connectionId, runId: optimized.id, target: 'history' });
  assert.ok(savedHistory.historyChainId);
  assert.equal((await call('po_runs_save', { connectionId, runId: optimized.id, target: 'history' })).historyChainId, savedHistory.historyChainId);
  assert.equal((await query('history', 'getChain', [savedHistory.historyChainId])).result.currentRecord.optimizedPrompt, optimizedResult.output);
  assert.ok(JSON.stringify(requests[0]).includes('Summarize the supplied text'));
  const tested = await start({ kind: 'test', inputRunId: optimized.id, request: { modelKey: 'fixture', userPrompt: 'A short test input' } }, 'test-once');
  assert.equal((await finish(tested.id)).status, 'succeeded');
  assert.ok(JSON.stringify(requests.at(-1)).includes(optimizedResult.output));
  evaluate = true;
  const evaluated = await start({ kind: 'evaluate', inputRunId: tested.id, request: {
    type: 'result', evaluationModelKey: 'fixture', mode: { functionMode: 'basic', subMode: 'system' },
  } }, 'evaluate-once');
  const evaluatedResult = await finish(evaluated.id);
  assert.equal(evaluatedResult.status, 'succeeded', JSON.stringify(evaluatedResult));
  assert.equal(evaluatedResult.output.score.overall, 88);
  evaluate = false;
  const batch = await start({ kind: 'test-batch', request: { candidates: [
    { systemPrompt: 'Version one', userPrompt: 'Same input', modelKey: 'fixture' },
    { systemPrompt: 'Version two', userPrompt: 'Same input', modelKey: 'fixture' },
  ] } }, 'batch-once');
  const batchResult = await finish(batch.id);
  assert.equal(batchResult.status, 'succeeded'); assert.equal(batchResult.output.length, 2);
  assert.ok(batchResult.output.every(candidate => candidate.status === 'succeeded' && candidate.output === optimizedResult.output));
  const versionRequestsStart = requests.length;
  await mutate('favorites', 'updateFavorite', [created.result, { content: 'Updated prompt for {{audience}}' }], 'favorite-second-version');
  const updatedAsset = (await query('assets', 'listAssets')).result.items.find(item => item.favoriteId === created.result);
  const versions = await query('assets', 'listAssetVersions', [{ favoriteId: updatedAsset.favoriteId, assetId: updatedAsset.assetId }]);
  assert.ok(versions.result.items.length >= 2);
  const historical = { favoriteId: updatedAsset.favoriteId, assetId: updatedAsset.assetId, versionId: source.versionId, expectedRevision: updatedAsset.revision };
  const current = { ...historical, versionId: updatedAsset.currentVersionId };
  const versionBatch = await start({ kind: 'test-batch', request: { candidates: [
    { source: historical, userPrompt: 'Same synthetic input', modelKey: 'fixture', variables: { audience: 'reader' } },
    { source: current, userPrompt: 'Same synthetic input', modelKey: 'second', variables: { audience: 'reader' } },
  ] } }, 'versions-models-once');
  const versionResult = await finish(versionBatch.id);
  assert.equal(versionResult.status, 'succeeded', JSON.stringify(versionResult));
  assert.ok(versionResult.output.every(candidate => candidate.status === 'succeeded'));
  assert.equal(versionResult.input.executionModels.length, 2);
  const sent = requests.slice(versionRequestsStart);
  assert.ok(sent.some(request => request.model === 'fixture-model' && JSON.stringify(request.messages).includes('Summarize the supplied text')));
  assert.ok(sent.some(request => request.model === 'fixture-second' && JSON.stringify(request.messages).includes('Updated prompt for reader')));
  const connected = await finish((await start({ kind: 'model-test', request: { modelKey: 'fixture' } }, 'model-test-once')).id);
  assert.equal(connected.status, 'succeeded'); assert.equal(connected.output.connected, true);
  const discovered = await finish((await start({ kind: 'model-list', request: { modelKey: 'fixture' } }, 'model-list-once')).id);
  assert.equal(discovered.status, 'succeeded', JSON.stringify(discovered));
  for (const runId of [optimized.id, tested.id, evaluated.id]) assert.equal((await call('po_runs_save', { connectionId, runId })).saved, true);
  await client.close(); await transport.close(); connectionId = await connect();
  assert.equal((await call('po_runs_list', { connectionId, savedOnly: true })).runs.length, 3);
  assert.equal((await call('po_runs_get', { connectionId, runId: evaluated.id })).output.score.overall, 88);
  hold = true;
  const cancelled = await start({ kind: 'test', request: { systemPrompt: 'Hold', userPrompt: 'Partial', modelKey: 'fixture' } }, 'cancel-once');
  const partialDeadline = Date.now() + 10000;
  while (!(await call('po_runs_get', { connectionId, runId: cancelled.id })).partial && Date.now() < partialDeadline) await delay(30);
  await call('po_runs_cancel', { connectionId, runId: cancelled.id });
  const cancelledResult = await finish(cancelled.id);
  assert.equal(cancelledResult.status, 'cancelled'); assert.equal(cancelledResult.partial, 'partial retained');
  hold = false; fail = true;
  const failed = await start({ kind: 'test', request: { systemPrompt: 'Fail', userPrompt: 'No secret error', modelKey: 'fixture' } }, 'fail-once');
  assert.equal((await finish(failed.id)).status, 'failed');
  assert.equal(diagnostics.includes(credential), false);
  assert.equal(await profiles.provider.getItem('unrelated-existing-data'), 'must stay exact');
});
