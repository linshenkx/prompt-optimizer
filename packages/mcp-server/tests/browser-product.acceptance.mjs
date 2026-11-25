import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces, tmpdir } from 'node:os';
import { chromium, firefox } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TextAdapterRegistry } from '@prompt-optimizer/core';
import { openDesktopStorage } from '@prompt-optimizer/core/node';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(root, '.codex-run/unified-mcp/browser');
await mkdir(output, { recursive: true });
const records = [];
const modelRequests = [];
const openPages = [];
const browsers = [];
let evaluationReply = false;
const evaluation = { score: { overall: 88, dimensions: [{ name: 'Clarity', score: 88 }] },
  improvements: ['State the expected output'], summary: 'Local evaluation fixture', patchPlan: [] };
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
      const text = evaluationReply ? JSON.stringify(evaluation) : `LOCAL_RESULT ${input.messages.at(-1).content} temperature=${input.temperature}`;
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
const desktopProfile = await mkdtemp(resolve(tmpdir(), 'po-mcp-product-profile-'));
const desktopFixture = await openDesktopStorage(desktopProfile);
await desktopFixture.provider.close();
const defaultOrigin = `http://127.0.0.1:${port}`;
const cli = resolve(root, 'packages/mcp-server/bin/prompt-optimizer-product-mcp.cjs');
const profileHome = resolve(desktopProfile, 'browser-home');
const env = { HOME: profileHome, APPDATA: resolve(profileHome, 'Roaming'), LOCALAPPDATA: resolve(profileHome, 'Local'),
  XDG_CONFIG_HOME: resolve(profileHome, '.config') };
const diagnostics = [];
async function connectMcp(args = ['--product-url=' + defaultOrigin]) {
  const transport = new StdioClientTransport({ command: process.execPath, env,
    args: [cli, ...args], cwd: root, stderr: 'pipe' });
  const mcp = new Client({ name: 'codex-browser-acceptance', version: '1' });
  transport.stderr?.on('data', chunk => diagnostics.push(chunk.toString()));
  await mcp.connect(transport);
  return mcp;
}
let client = await connectMcp(['--desktop-profile=' + desktopProfile]);
const tools = (await client.listTools()).tools.map(tool => tool.name);
assert.deepEqual([...tools].sort(), ['po_sources_list', 'po_sources_open', 'po_sources_authorize', 'po_sources_close', 'po_catalog',
  'po_query', 'po_mutate', 'po_runs_start', 'po_runs_get', 'po_runs_list', 'po_runs_cancel', 'po_runs_save', 'po_runs_delete',
  'po_resources', 'po_data_export_file'].sort());
async function call(name, args = {}, allowedError) {
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 20_000 });
  const result = response.structuredContent ?? JSON.parse(response.content[0].text);
  if (response.isError && result.error?.code !== allowedError) throw new Error(`${name}: ${result.error?.code}`);
  return result;
}

const initial = await call('po_sources_list');
assert.equal(initial.browserRegistryAvailable, true);
const desktopSourceId = initial.sources.find(source => source.kind === 'desktop').sourceId;
assert.equal(initial.defaultSourceId, desktopSourceId);
const simultaneous = await Promise.all(['read', 'write'].map(access =>
  call('po_sources_open', { access }, 'ACCESS_MISMATCH')));
assert.equal(simultaneous.filter(result => result.error?.code === 'ACCESS_MISMATCH').length, 1);
const desktop = simultaneous.find(result => result.connectionId);
const catalog = await call('po_catalog');
assert(catalog.runKinds.includes('evaluate'));
assert(Array.isArray((await call('po_query', { connectionId: desktop.connectionId, domain: 'templates', operation: 'listTemplates' })).result));
await call('po_sources_close', { connectionId: desktop.connectionId });
await client.close();
client = await connectMcp();
const webOnly = await call('po_sources_list');
assert.equal(webOnly.defaultProductUrl, defaultOrigin + '/');
assert.equal(webOnly.defaultSourceId, undefined);
assert.equal((await call('po_sources_open', {}, 'SOURCE_NOT_READY')).error.code, 'SOURCE_NOT_READY');

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
    await page.getByTestId('workspace').waitFor();
    assert.equal(await page.getByTestId('browser-bridge-panel').count(), 0);
    assert.equal(await page.getByTestId('browser-bridge-revoke').count(), 0);
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
    if (name === 'chromium-loopback') {
      const before = (await call('po_sources_list')).sources;
      const declined = await call('po_sources_authorize', { access: 'read' });
      await page.goto(declined.authorizationUrl, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('browser-bridge-cancel').click();
      await page.getByTestId('browser-bridge-panel').waitFor({ state: 'hidden' });
      assert.deepEqual((await call('po_sources_list')).sources, before);
      assert.equal(await page.getByTestId('browser-bridge-revoke').count(), 0);
      record.cancelledBeforeConnecting = true;
    }
    if (name === 'chromium-loopback-second-profile') {
      const original = openPages.find(item => item.record.name === 'chromium-loopback');
      const wrongProfile = await call('po_sources_authorize', { access: 'read' });
      assert.equal(wrongProfile.sourceId, original.source.sourceId);
      await page.goto(wrongProfile.authorizationUrl, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('browser-bridge-authorize').click();
      await page.getByTestId('browser-bridge-error').waitFor();
      await page.keyboard.press('Escape');
      await page.getByTestId('browser-bridge-panel').waitFor({ state: 'hidden' });
      record.wrongProfileRejected = true;
    }
    const ticket = await call('po_sources_authorize', { productUrl: origin, access: 'write' });
    record.operations.push('po_sources_authorize');
    await page.goto(ticket.authorizationUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await page.getByTestId('browser-bridge-authorize').waitFor();
    assert(!page.url().includes('poBridge='), 'One-use token must be removed from page history');
    assert(!(await call('po_sources_list')).sources.some(source => source.label === name), 'Approval must precede discovery');
    if (name === 'chromium-loopback') {
      const panel = page.getByTestId('browser-bridge-panel');
      await panel.screenshot({ path: resolve(output, 'authorization-desktop.png'), animations: 'disabled' });
      await page.setViewportSize({ width: 375, height: 740 });
      await panel.screenshot({ path: resolve(output, 'authorization-mobile.png'), animations: 'disabled' });
      assert(await panel.evaluate(element => element.scrollWidth <= element.clientWidth));
      await page.setViewportSize({ width: 1440, height: 1100 });
    }
    const expectedLabel = name === 'firefox-custom-domain' ? 'Firefox' : name;
    if (expectedLabel === name) {
      await page.getByTestId('browser-bridge-label-toggle').click();
      await page.getByTestId('browser-bridge-label').locator('input').fill(name);
    } else {
      record.usedDefaultLabel = true;
    }
    await page.getByTestId('browser-bridge-authorize').click();
    await page.getByTestId('browser-bridge-revoke').waitFor({ timeout: 12_000 });
    const source = (await call('po_sources_list')).sources.find(source => source.origin === origin && source.label === expectedLabel);
    assert(source, 'Authorized real product page must be discovered');
    assert.equal(source.origin, origin);
    const connection = await call('po_sources_open', name === 'chromium-loopback' ? { access: 'write' } : { sourceId: source.sourceId, access: 'write' });
    record.operations.push('po_sources_list', 'po_sources_open');
    assert(Array.isArray((await call('po_query', { connectionId: connection.connectionId, domain: 'templates', operation: 'listTemplates' })).result));
    const query = await call('po_query', { connectionId: connection.connectionId, domain: 'favorites', operation: 'getFavorites' });
    const created = await call('po_mutate', { connectionId: connection.connectionId, domain: 'favorites', operation: 'addFavorite',
      arguments: [{ title: `MCP ${name}`, content: 'Summarize {{subject}}.', tags: ['browser-acceptance'], functionMode: 'context', optimizationMode: 'user',
        metadata: { reproducibility: { variables: [{ name: 'subject', required: true }] } } }], expectedRevision: query.revision, requestKey: `create-${name}` });
    record.operations.push('po_query', 'po_desktop_mutate:addFavorite');
    const queryProduct = async (domain, operation, args = []) => (await call('po_query', {
      connectionId: connection.connectionId, domain, operation, arguments: args,
    })).result;
    const assets = await queryProduct('assets', 'listAssets');
    const asset = assets.items.find(asset => asset.favoriteId === created.result);
    assert(asset);
    const selection = { favoriteId: asset.favoriteId, assetId: asset.assetId, versionId: asset.currentVersionId, expectedRevision: asset.revision };
    const version = await queryProduct('assets', 'getAssetVersion', [selection]);
    assert.equal(version.content.text, 'Summarize {{subject}}.');
    record.operations.push('assets.listAssets', 'assets.getAssetVersion');
    const listedModels = await queryProduct('models', 'getEnabledModels');
    assert(!JSON.stringify(listedModels).includes('LOCAL_ONLY_SYNTHETIC_KEY'));
    const { revision: runRevision } = await call('po_query', { connectionId: connection.connectionId, domain: 'favorites', operation: 'getFavorites' });
    async function textRun(requestKey, input) {
      const started = await call('po_runs_start', { connectionId: connection.connectionId, expectedRevision: runRevision, requestKey, input });
      for (let attempt = 0; attempt < 60; attempt++) {
        const run = await call('po_runs_get', { connectionId: connection.connectionId, runId: started.id });
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
    await call('po_runs_save', { connectionId: connection.connectionId, runId: singleTest.id });
    assert((await call('po_runs_list', { connectionId: connection.connectionId, savedOnly: true })).runs.some(run => run.id === singleTest.id));
    record.textRuns = { optimizationId: optimized.id, testId: singleTest.id, usedOptimizedPrompt: true };
    if (name === 'chromium-loopback') {
      evaluationReply = true;
      try {
        const evaluated = await textRun('evaluate-browser', {
          kind: 'evaluate', inputRunId: singleTest.id, request: {
            type: 'result', evaluationModelKey: 'local-a', mode: { functionMode: 'basic', subMode: 'system' },
          },
        });
        assert.equal(evaluated.output.score.overall, 88);
      } finally { evaluationReply = false; }
      const batch = await textRun('batch-browser', { kind: 'test-batch', request: { candidates: [
        { systemPrompt: 'Version A', userPrompt: 'Shared input', modelKey: 'local-a' },
        { systemPrompt: 'Version B', userPrompt: 'Shared input', modelKey: 'local-b' },
      ] } });
      assert.deepEqual(batch.output.map(candidate => candidate.status), ['succeeded', 'succeeded']);
      record.evaluationAndBatch = true;
      const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZwAAAABJRU5ErkJggg==', 'base64');
      const imageFile = resolve(desktopProfile, 'pixel.png');
      const readBack = resolve(desktopProfile, 'pixel-read-back.png');
      await writeFile(imageFile, pixel);
      const resource = (operation, fields) => call('po_resources', { connectionId: connection.connectionId, operation, ...fields });
      const image = { store: 'favoriteImages', id: 'browser-test-pixel' };
      const saveImage = { ...image, requestKey: 'save-pixel', file: imageFile, mimeType: 'image/png' };
      const savedImage = await resource('images.save', saveImage);
      assert.deepEqual(await resource('images.save', saveImage), savedImage);
      await resource('images.get', { ...image, requestKey: 'get-pixel', file: readBack });
      assert.deepEqual(await readFile(readBack), pixel);
      await resource('images.delete', { ...image, requestKey: 'delete-pixel', expectedDigest: savedImage.digest });
      record.resourceRoundTrip = true;
      const file = resolve(desktopProfile, 'browser-backup.zip');
      const exported = await call('po_resources', { connectionId: connection.connectionId, operation: 'package.export', requestKey: 'browser-backup', includeCredentials: true, file });
      assert.equal(exported.written, true);
      assert.equal((await readFile(file)).subarray(0, 2).toString(), 'PK');
    }
    record.operations.push('po_runs_start:optimize', 'po_runs_get', 'po_runs_start:test', 'po_runs_get');
    const candidates = ['local-a', 'local-b'].map(modelKey => {
      assert(listedModels.some(model => model.id === modelKey));
      return { modelKey, source: selection, promptField: 'userPrompt', variables: { subject: name } };
    });
    const tested = await textRun('compare-' + name, { kind: 'test-batch', request: { candidates } });
    assert.deepEqual(tested.output.map(run => run.status), ['succeeded', 'succeeded']);
    assert(tested.output.every(run => run.output.includes(`LOCAL_RESULT Summarize ${name}.`)));
    const save = () => call('po_runs_save', { connectionId: connection.connectionId, runId: tested.id });
    const saved = await save();
    assert.deepEqual(await save(), saved);
    record.saveRetryDeduplicated = true;
    const reread = await call('po_runs_get', { connectionId: connection.connectionId, runId: saved.id });
    assert.deepEqual(reread.output, tested.output);
    record.operations.push('models.getEnabledModels', 'po_runs_start:test-batch', 'po_runs_save', 'po_runs_get');
    await page.keyboard.press('Escape');
    await page.getByTestId('header-favorites-page-action').click();
    await page.getByText(`MCP ${name}`, { exact: true }).first().waitFor();
    record.favoriteVisibleInOriginalPage = true;
    assert.equal(await page.getByTestId('header-desktop-runs').count(), 0);
    assert((await call('po_runs_list', { connectionId: connection.connectionId, savedOnly: true })).runs.some(run => run.id === saved.id));
    record.operations.push('po_runs_list:savedOnly');
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: false });
    record.status = 'passed';
    record.source = { sourceId: source.sourceId, contextId: source.browserContextId, pageId: source.pageId };
    record.favoriteId = asset.favoriteId;
    record.comparisonId = saved.id;
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
      if (engineName === 'chromium' && kind === 'loopback' && (!filters || filters === 'loopback')) await workflow(browser, origin, 'chromium-loopback-second-profile');
    }
  }
  const sameOrigin = openPages.filter(item => item.record.name.includes('loopback'));
  if (sameOrigin.length >= 2) {
    assert.equal((await call('po_sources_open', {}, 'SOURCE_AMBIGUOUS')).error.code, 'SOURCE_AMBIGUOUS');
    assert.equal((await call('po_sources_authorize', {}, 'SOURCE_AMBIGUOUS')).error.code, 'SOURCE_AMBIGUOUS');
    assert.equal(new Set(sameOrigin.map(item => item.source.browserContextId)).size, sameOrigin.length);
    for (const item of sameOrigin) {
      const assets = (await call('po_query', { domain: 'assets', operation: 'listAssets', connectionId: item.connection.connectionId })).result;
      assert.deepEqual(assets.items.map(asset => asset.favoriteId), [item.asset.favoriteId]);
      item.record.sameOriginStorageIsolation = true;
    }
  }
  for (const item of openPages) {
    await item.page.keyboard.press('Escape');
    await item.page.getByTestId('browser-bridge-revoke').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await call('po_query', { domain: 'assets', operation: 'listAssets', connectionId: item.connection.connectionId }, 'CONNECTION_CLOSED')).error.code, 'CONNECTION_CLOSED');
    const offline = (await call('po_sources_list')).sources.find(source => source.sourceId === item.source.sourceId);
    assert.equal(offline?.availability, 'offline');
    assert.equal(offline.authorizedAccess, undefined);
    assert.equal((await call('po_sources_open', { sourceId: item.source.sourceId }, 'SOURCE_OFFLINE')).error.code, 'SOURCE_OFFLINE');
    item.record.revokedConnectionInvalid = true;
    await item.page.reload({ waitUntil: 'domcontentloaded', timeout: 25_000 });
    await item.page.getByTestId('workspace').waitFor();
    assert.equal(await item.page.getByTestId('browser-bridge-revoke').count(), 0);
    const ticket = await call('po_sources_authorize', { sourceId: item.source.sourceId, access: 'read' });
    await item.page.goto(ticket.authorizationUrl, { waitUntil: 'domcontentloaded' });
    await item.page.getByTestId('browser-bridge-panel').getByText(item.source.label, { exact: true }).waitFor();
    await item.page.getByTestId('browser-bridge-authorize').click();
    await item.page.getByTestId('browser-bridge-revoke').waitFor();
    const source = (await call('po_sources_list')).sources.find(source => source.origin === item.record.origin && source.browserContextId === item.source.browserContextId && source.pageId !== item.source.pageId);
    assert(source);
    assert.equal(source.sourceId, item.source.sourceId);
    assert.equal(source.label, item.source.label);
    const reopened = await call('po_sources_open', { sourceId: source.sourceId, access: 'read' });
    assert.equal((await call('po_sources_open', { sourceId: source.sourceId, access: 'write' }, 'BUSINESS_ACCESS_REQUIRED')).error.code, 'BUSINESS_ACCESS_REQUIRED');
    assert.equal((await call('po_mutate', { connectionId: reopened.connectionId, domain: 'favorites', operation: 'deleteFavorite', arguments: [item.record.favoriteId],
      expectedRevision: 'denied', requestKey: `denied-${item.record.name}` }, 'BUSINESS_ACCESS_REQUIRED')).error.code, 'BUSINESS_ACCESS_REQUIRED');
    assert.equal((await call('po_runs_get', { connectionId: reopened.connectionId, runId: item.record.comparisonId })).id, item.record.comparisonId);
    assert.equal((await call('po_runs_get', { connectionId: reopened.connectionId, runId: item.record.textRuns.testId })).saved, true);
    item.record.persistedAfterPageReload = true;
    item.record.readonlyWriteDenied = true;
    await item.context.close();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await call('po_query', { domain: 'assets', operation: 'listAssets', connectionId: reopened.connectionId }, 'CONNECTION_CLOSED')).error.code, 'CONNECTION_CLOSED');
    item.record.closedPageConnectionInvalid = true;
  }
  for (const browser of browsers.splice(0)) await browser.close();
  await client.close();
  client = await connectMcp();
  const restarted = await call('po_sources_list');
  for (const item of openPages) {
    const source = restarted.sources.find(source => source.sourceId === item.source.sourceId);
    assert.equal(source?.availability, 'offline');
    assert.equal(source.label, item.source.label);
    assert.equal(source.productUrl, item.record.origin + '/');
    assert.equal(source.pageId, undefined);
    item.record.offlineAfterMcpRestart = true;
  }
} finally {
  for (const browser of browsers) await browser.close();
  await client.close();
  await new Promise(resolve => server.close(resolve));
  const target = await realpath(desktopProfile);
  assert.equal(dirname(target), await realpath(tmpdir()));
  assert(basename(target).startsWith('po-mcp-product-profile-'));
  await rm(target, { force: true, recursive: true });
  const evidence = { date: new Date().toISOString(), node: process.version, product: 'built packages/web/dist (not a sample page)',
    model: 'real browser product LLMService + local deterministic SSE endpoint; no paid models', tools, records, modelRequests,
    mcpDiagnostics: diagnostics.join('').slice(0, 4000) };
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(records.map(({ name, status, failure, ...details }) => ({ name, status, failure })), null, 2));
  console.log(`Local model requests: ${modelRequests.length}; evidence: ${output}`);
}
if (!records.length || records.some(record => record.status !== 'passed')) process.exitCode = 1;
