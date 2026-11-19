import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { chromium, firefox } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TextAdapterRegistry } from '@prompt-optimizer/core';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(root, 'experiments/mcp-chrome-bridge/evidence/20261119');
await mkdir(output, { recursive: true });
const records = [];
const modelRequests = [];
const openPages = [];
const browsers = [];
const filters = process.argv.find(value => value.startsWith('--case='))?.slice(7);
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://local');
    if (url.pathname === '/mock/v1/chat/completions' && request.method === 'POST') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks).toString());
      modelRequests.push({ host: request.headers.host, model: input.model, messages: input.messages, temperature: input.temperature, stream: input.stream });
      const text = `LOCAL_RESULT ${input.messages.at(-1).content} temperature=${input.temperature}`;
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
      response.write(`data: ${JSON.stringify({ id: 'local', object: 'chat.completion.chunk', model: input.model, choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }] })}\n\n`);
      response.end(`data: ${JSON.stringify({ id: 'local', object: 'chat.completion.chunk', model: input.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`);
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const path = resolve(root, 'packages/web/dist', relative);
    const base = resolve(root, 'packages/web/dist');
    if (!path.startsWith(base + '/') && !path.startsWith(base + '\\') && path !== base) { response.writeHead(403).end(); return; }
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const port = server.address().port;
const clientTransport = new StdioClientTransport({ command: process.execPath,
  args: [resolve(root, 'packages/mcp-server/dist/start.js'), '--mode=browser'], cwd: root, stderr: 'pipe' });
const client = new Client({ name: 'codex-browser-acceptance', version: '1' });
const diagnostics = [];
clientTransport.stderr?.on('data', chunk => diagnostics.push(chunk.toString()));
await client.connect(clientTransport);
const tools = (await client.listTools()).tools.map(tool => tool.name);
async function call(name, args = {}, allowedError) {
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 20_000 });
  const result = response.structuredContent ?? JSON.parse(response.content[0].text);
  if (response.isError && result.error?.code !== allowedError) throw new Error(`${name}: ${result.error?.code}`);
  return result;
}

const adapter = new TextAdapterRegistry().getAdapter('openai-compatible');
function models(origin) {
  return Object.fromEntries(['a', 'b'].map((side, index) => [`local-${side}`, {
    id: `local-${side}`, name: `Local ${side}`, enabled: true,
    providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('bridge-test'),
    connectionConfig: { apiKey: 'LOCAL_ONLY_SYNTHETIC_KEY', baseURL: `${origin}/mock/v1` }, paramOverrides: { temperature: index ? 0.8 : 0.2 },
  }]));
}

async function workflow(browser, origin, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-US' });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 300)); });
  const record = { name, origin, browserVersion: browser.version(), status: 'running', operations: [], errors };
  records.push(record);
  try {
    await page.goto(`${origin}/#/pro/variable`, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await page.getByTestId('browser-bridge-entry').waitFor();
    await page.evaluate(async savedModels => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('PromptOptimizerDB');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('Product database was not initialized')); };
      });
      try {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction('storage', 'readwrite');
          transaction.objectStore('storage').put({ key: 'models', value: JSON.stringify(savedModels) });
          transaction.oncomplete = resolve;
          transaction.onabort = () => reject(transaction.error);
        });
      } finally { database.close(); }
    }, models(origin));
    const ticket = await call('po_sources_authorize', { productUrl: origin, access: 'compare' });
    record.operations.push('po_sources_authorize');
    await page.goto(ticket.authorizationUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await page.getByTestId('browser-bridge-authorize').waitFor();
    assert(!page.url().includes('poBridge='), 'One-use token must be removed from page history');
    assert(!(await call('po_sources_list')).sources.some(source => source.label === name), 'Approval must precede discovery');
    await page.getByTestId('browser-bridge-label').locator('input').fill(name);
    await page.getByTestId('browser-bridge-authorize').click();
    await page.getByTestId('browser-bridge-state').filter({ hasText: /authorized|已授权|已授權/ }).waitFor({ timeout: 12_000 });
    const source = (await call('po_sources_list')).sources.find(source => source.label === name);
    assert(source, 'Authorized real product page must be discovered');
    assert.equal(source.origin, origin);
    const connection = await call('po_sources_open', { sourceId: source.sourceId, access: 'compare' });
    record.operations.push('po_sources_list', 'po_sources_open');
    const query = await call('po_desktop_query', { sourceId: source.sourceId, domain: 'favorites', operation: 'getFavorites' });
    const created = await call('po_desktop_mutate', { sourceId: source.sourceId, domain: 'favorites', operation: 'addFavorite',
      arguments: [{ title: `MCP ${name}`, content: 'Summarize {{subject}}.', tags: ['browser-acceptance'], functionMode: 'context', optimizationMode: 'user',
        metadata: { reproducibility: { variables: [{ name: 'subject', required: true }] } } }], expectedRevision: query.revision, requestKey: `create-${name}` });
    record.operations.push('po_desktop_query', 'po_desktop_mutate:addFavorite');
    const assets = await call('po_assets_list', { connectionId: connection.connectionId });
    const asset = assets.items.find(asset => asset.favoriteId === created.result);
    assert(asset, 'MCP-written favorite must be readable via shared asset contract');
    const version = await call('po_assets_get_version', { connectionId: connection.connectionId, favoriteId: asset.favoriteId, assetId: asset.assetId,
      versionId: asset.currentVersionId, expectedRevision: asset.revision });
    assert.equal(version.content.text, 'Summarize {{subject}}.');
    record.operations.push('po_assets_list', 'po_assets_get_version');
    const listedModels = await call('po_models_list', { connectionId: connection.connectionId });
    assert(!JSON.stringify(listedModels).includes('LOCAL_ONLY_SYNTHETIC_KEY'));
    const { revision: runRevision } = await call('po_desktop_query', { sourceId: source.sourceId, domain: 'favorites', operation: 'getFavorites' });
    async function textRun(requestKey, input) {
      const started = await call('po_runs_start', { sourceId: source.sourceId, expectedRevision: runRevision, requestKey, input });
      for (let attempt = 0; attempt < 60; attempt++) {
        const run = await call('po_runs_get', { sourceId: source.sourceId, runId: started.id });
        if (run.status !== 'running') {
          assert.equal(run.status, 'succeeded', JSON.stringify(run.error ?? {}));
          return run;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Text run timed out');
    }
    const optimized = await textRun('optimize-' + name, {
      kind: 'optimize', request: { targetPrompt: 'Summarize the subject ' + name, optimizationMode: 'system', modelKey: 'local-a' },
    });
    assert(optimized.output.includes('Summarize the subject ' + name));
    const singleTest = await textRun('test-' + name, {
      kind: 'test', inputRunId: optimized.id, request: { userPrompt: 'A test article for ' + name, modelKey: 'local-a' },
    });
    assert(singleTest.output.includes('LOCAL_RESULT A test article for ' + name));
    assert(modelRequests.some(entry => entry.messages.some(message => message.role === 'system' && message.content === optimized.output)),
      'The browser must send the actual optimized prompt in its test request');
    record.textRuns = { optimizationId: optimized.id, testId: singleTest.id, usedOptimizedPrompt: true };
    record.operations.push('po_runs_start:optimize', 'po_runs_get', 'po_runs_start:test', 'po_runs_get');
    const candidates = ['a', 'b'].map(id => { const model = listedModels.items.find(item => item.configKey === `local-${id}`); assert(model?.executable); return { id, configKey: model.configKey, expectedRevision: model.revision }; });
    const prepared = await call('po_tests_prepare', { connectionId: connection.connectionId,
      source: { favoriteId: asset.favoriteId, assetId: asset.assetId, versionId: asset.currentVersionId, expectedRevision: asset.revision }, variables: { subject: name }, candidates });
    await call('po_tests_execute', { connectionId: connection.connectionId, preparedId: prepared.preparedId, previewRevision: prepared.previewRevision });
    let tested;
    for (let attempt = 0; attempt < 30; attempt++) {
      tested = await call('po_tests_get', { connectionId: connection.connectionId, preparedId: prepared.preparedId });
      if (tested.runs.every(run => !['prepared', 'running'].includes(run.status))) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepEqual(tested.runs.map(run => run.status), ['success', 'success']);
    assert(tested.runs.every(run => run.output.includes(`LOCAL_RESULT Summarize ${name}.`)));
    const saved = await call('po_comparisons_save', { connectionId: connection.connectionId, preparedId: prepared.preparedId, saveKey: `save-${name}` });
    assert.equal((await call('po_comparisons_save', { connectionId: connection.connectionId, preparedId: prepared.preparedId, saveKey: `save-${name}` })).comparisonId, saved.comparisonId);
    record.saveRetryDeduplicated = true;
    const reread = await call('po_comparisons_get', { connectionId: connection.connectionId, comparisonId: saved.comparisonId });
    assert.equal(reread.comparison.executionSource.kind, 'browser');
    record.operations.push('po_models_list', 'po_tests_prepare', 'po_tests_execute', 'po_tests_get', 'po_comparisons_save', 'po_comparisons_get');
    await page.keyboard.press('Escape');
    await page.getByTestId('header-favorites-page-action').click();
    await page.getByText(`MCP ${name}`, { exact: true }).first().waitFor();
    record.favoriteVisibleInOriginalPage = true;
    await page.evaluate(() => { window.location.hash = '/pro/variable'; });
    await page.getByTestId('open-saved-comparisons').first().click();
    await page.getByTestId('saved-comparison-id').locator('input').fill(saved.comparisonId);
    await page.getByTestId('saved-comparison-open').click();
    await page.getByText(`LOCAL_RESULT Summarize ${name}. temperature=0.2`, { exact: true }).first().waitFor();
    await page.getByText(`LOCAL_RESULT Summarize ${name}. temperature=0.8`, { exact: true }).first().waitFor();
    record.comparisonReopenedInOriginalPage = true;
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: false });
    record.status = 'passed';
    record.source = { sourceId: source.sourceId, contextId: source.browserContextId, pageId: source.pageId };
    record.favoriteId = asset.favoriteId;
    record.comparisonId = saved.comparisonId;
    openPages.push({ page, context, source, connection, asset, record });
  } catch (error) {
    record.status = 'failed'; record.failure = error.message;
    await page.screenshot({ path: resolve(output, `${name}-failed.png`) }).catch(() => {});
    await context.close();
  }
}

try {
  const engines = [['chromium', chromium], ['firefox', firefox]];
  const localIp = Object.values(networkInterfaces()).flat().find(address => address?.family === 'IPv4' && address.address.startsWith('192.168.31.'))?.address;
  const origins = [['loopback', `http://127.0.0.1:${port}`], ['custom-domain', `http://po-bridge.localhost:${port}`], ...(localIp ? [['lan-ip', `http://${localIp}:${port}`]] : [])];
  for (const [engineName, engine] of engines) {
    if (!existsSync(engine.executablePath())) { records.push({ name: engineName, status: 'blocked', failure: 'Browser runtime not installed' }); continue; }
    const browser = await engine.launch({ headless: true });
    browsers.push(browser);
    for (const [kind, origin] of origins) {
      const name = `${engineName}-${kind}`;
      if (filters && !name.includes(filters)) continue;
      await workflow(browser, origin, name);
      if (engineName === 'chromium' && kind === 'loopback' && !filters) await workflow(browser, origin, 'chromium-loopback-second-profile');
    }
  }
  const sameOrigin = openPages.filter(item => item.record.name.includes('loopback'));
  if (sameOrigin.length >= 2) {
    assert.equal(new Set(sameOrigin.map(item => item.source.browserContextId)).size, sameOrigin.length);
    for (const item of sameOrigin) {
      const assets = await call('po_assets_list', { connectionId: item.connection.connectionId });
      assert.deepEqual(assets.items.map(asset => asset.favoriteId), [item.asset.favoriteId]);
      item.record.sameOriginStorageIsolation = true;
    }
  }
  for (const item of openPages) {
    await item.page.keyboard.press('Escape');
    await item.page.getByTestId('browser-bridge-entry').click();
    await item.page.getByTestId('browser-bridge-revoke').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await call('po_assets_list', { connectionId: item.connection.connectionId }, 'CONNECTION_CLOSED')).error.code, 'CONNECTION_CLOSED');
    assert(!(await call('po_sources_list')).sources.some(source => source.sourceId === item.source.sourceId));
    item.record.revokedConnectionInvalid = true;
    await item.page.reload({ waitUntil: 'domcontentloaded', timeout: 25_000 });
    await item.page.getByTestId('browser-bridge-entry').waitFor();
    const ticket = await call('po_sources_authorize', { productUrl: item.record.origin, access: 'read' });
    await item.page.goto(ticket.authorizationUrl, { waitUntil: 'domcontentloaded' });
    await item.page.getByTestId('browser-bridge-authorize').click();
    await item.page.getByTestId('browser-bridge-state').filter({ hasText: /authorized|已授权|已授權/ }).waitFor();
    const source = (await call('po_sources_list')).sources.find(source => source.origin === item.record.origin && source.browserContextId === item.source.browserContextId && source.pageId !== item.source.pageId);
    assert(source);
    const reopened = await call('po_sources_open', { sourceId: source.sourceId, access: 'read' });
    assert.equal((await call('po_sources_open', { sourceId: source.sourceId, access: 'compare' }, 'COMPARISON_ACCESS_REQUIRED')).error.code, 'COMPARISON_ACCESS_REQUIRED');
    assert.equal((await call('po_desktop_mutate', { sourceId: source.sourceId, domain: 'favorites', operation: 'deleteFavorite', arguments: [item.record.favoriteId],
      expectedRevision: 'denied', requestKey: `denied-${item.record.name}` }, 'COMPARISON_ACCESS_REQUIRED')).error.code, 'COMPARISON_ACCESS_REQUIRED');
    assert.equal((await call('po_comparisons_get', { connectionId: reopened.connectionId, comparisonId: item.record.comparisonId })).comparison.id, item.record.comparisonId);
    item.record.persistedAfterPageReload = true;
    item.record.readonlyWriteDenied = true;
    await item.context.close();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await call('po_assets_list', { connectionId: reopened.connectionId }, 'CONNECTION_CLOSED')).error.code, 'CONNECTION_CLOSED');
    item.record.closedPageConnectionInvalid = true;
  }
} finally {
  for (const browser of browsers) await browser.close();
  await client.close();
  await new Promise(resolve => server.close(resolve));
  const evidence = { date: new Date().toISOString(), node: process.version, product: 'built packages/web/dist (not a sample page)',
    model: 'real browser product LLMService + local deterministic SSE endpoint; no paid models', tools, records, modelRequests,
    mcpDiagnostics: diagnostics.join('').slice(0, 4000) };
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(records.map(({ name, status, failure, ...details }) => ({ name, status, failure })), null, 2));
  console.log(`Local model requests: ${modelRequests.length}; evidence: ${output}`);
}
if (!records.length || records.some(record => record.status !== 'passed')) process.exitCode = 1;
