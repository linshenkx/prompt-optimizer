import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, stat, symlink, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.argv.length, 2);
assert.equal(process.platform, 'win32');
const sourceRoot = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const desktopRequire = createRequire(join(sourceRoot, 'packages/desktop/package.json'));
const webRequire = createRequire(join(sourceRoot, 'packages/web/package.json'));
const mcpRequire = createRequire(join(sourceRoot, 'packages/mcp-server/package.json'));
const { Client } = await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/sdk/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const { openDesktopStorage } = desktopRequire('@prompt-optimizer/core/node');
const { build } = await import(pathToFileURL(webRequire.resolve('vite')));
const { default: vue } = await import(pathToFileURL(webRequire.resolve('@vitejs/plugin-vue')));
const evidenceParent = join(sourceRoot, '.codex-run');
await mkdir(evidenceParent, { recursive: true });
const root = await mkdtemp(join(evidenceParent, 'po-desktop-main-r2-product-'));
const desktop = join(root, 'app/packages/desktop');
const launcher = join(root, 'launcher');
for (const directory of ['config', 'icons', 'web-dist']) await mkdir(join(desktop, directory), { recursive: true });
await mkdir(launcher, { recursive: true });
const copied = ['main.js', 'preload.js', 'stream-runtime.js', 'remote-storage.js', 'package.json', 'icons/app-icon.ico'];
for (const entry of await readdir(join(sourceRoot, 'packages/desktop/config'))) if (entry.endsWith('.js') && !entry.endsWith('.test.js')) copied.push(`config/${entry}`);
const hashes = {};
for (const entry of copied) {
  await copyFile(join(sourceRoot, 'packages/desktop', entry), join(desktop, entry));
  hashes[entry] = createHash('sha256').update(await readFile(join(desktop, entry))).digest('hex');
}
for (const helper of ['desktop-main-bootstrap.cjs', 'desktop-main-isolation.cjs', 'desktop-main-business.cjs', 'desktop-product-ui.cjs']) {
  await copyFile(join(sourceRoot, 'scripts/helpers', helper), join(launcher, helper));
}
await writeFile(join(launcher, 'package.json'), JSON.stringify({ name: 'po-desktop-product-fixture', version: '2.15.2', main: 'desktop-main-bootstrap.cjs' }));
for (const file of [join(root, '.env'), join(root, 'app/.env.local'), join(desktop, '.env')]) await writeFile(file, '');
const dependencyRoot = await realpath(join(sourceRoot, 'packages/desktop/node_modules'));
await symlink(dependencyRoot, join(desktop, 'node_modules'), 'junction');
await writeFile(join(root, 'manifest.json'), JSON.stringify({ sourceRoot, dependencyRoot, mainSha256: hashes['main.js'], copiedSha256: hashes }, null, 2));
await build({ configFile: false, root: join(sourceRoot, 'packages/web'), envDir: false, envPrefix: 'PO_SYNTHETIC_', base: './',
  plugins: [vue()], publicDir: 'public', define: { 'process.env': JSON.stringify({ NODE_ENV: 'production', VITE_ENABLE_PROMPT_GARDEN_IMPORT: '0' }) },
  resolve: { alias: [
    { find: '@prompt-optimizer/ui/dist/style.css', replacement: join(sourceRoot, 'packages/ui/src/styles/index.css') },
    { find: '@prompt-optimizer/ui', replacement: join(sourceRoot, 'packages/ui/src/index.ts') },
    { find: /^@prompt-optimizer\/core$/, replacement: join(sourceRoot, 'packages/core') },
    { find: '@', replacement: join(sourceRoot, 'packages/web/src') },
  ] }, build: { outDir: join(desktop, 'web-dist'), emptyOutDir: true, reportCompressedSize: false } });
const electron = await realpath(desktopRequire('electron'));
assert.ok(electron.startsWith(join(sourceRoot, 'node_modules')) && electron.endsWith('electron.exe'));
const env = { NODE_ENV: 'production', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' };
for (const key of ['SystemRoot', 'WINDIR', 'ComSpec']) if (process.env[key]) env[key] = process.env[key];
env.PATH = [dirname(process.execPath), dirname(electron), join(process.env.SystemRoot, 'System32'), process.env.SystemRoot].join(';');
for (const [key, directory] of Object.entries({ APPDATA: 'appData', LOCALAPPDATA: 'localAppData', USERPROFILE: 'home', HOME: 'home', TEMP: 'temp', TMP: 'temp' })) {
  env[key] = join(root, 'profile', directory); await mkdir(env[key], { recursive: true });
}
const profile = join(root, 'profile/userData');
await mkdir(profile, { recursive: true });
const storage = await openDesktopStorage(profile);
const credential = 'SYNTHETIC_PRODUCT_UI_CREDENTIAL';
let evaluation = false;
let modelRequests = 0;
const endpoint = createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(request.headers.authorization, `Bearer ${credential}`); modelRequests++;
  const content = evaluation ? JSON.stringify({ score: { overall: 88, dimensions: [{ name: 'Clarity', score: 88 }] }, improvements: [], summary: 'UI acceptance', patchPlan: [] }) : 'Synthetic desktop optimized prompt';
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end('data: ' + JSON.stringify({ id: 'ui-fixture', model: body.model, choices: [{ index: 0, delta: { content } }] }) + '\n\ndata: [DONE]\n\n');
});
endpoint.listen(0, '127.0.0.1'); await once(endpoint, 'listening');
const origin = `http://127.0.0.1:${endpoint.address().port}`;
await storage.provider.setItem('models', JSON.stringify({ fixture: { id: 'fixture', name: 'Synthetic UI model', enabled: true,
  providerId: 'openai-compatible', modelId: 'fixture-model', providerMeta: { id: 'openai-compatible', requiresApiKey: false },
  modelMeta: { id: 'fixture-model', providerId: 'openai-compatible', parameterDefinitions: [], capabilities: { supportsTools: false, supportsReasoning: false } },
  connectionConfig: { apiKey: credential, baseURL: origin + '/v1' }, paramOverrides: {} } }));
await storage.provider.setItem('pref:ui.theme', JSON.stringify('dark'));
const guard = join(root, 'mcp-loopback.cjs');
await writeFile(guard, `const original = global.fetch; global.fetch = (input, options) => { const url = new URL(input instanceof Request ? input.url : input); if (url.origin !== ${JSON.stringify(origin)}) throw new Error('Only synthetic loopback allowed'); return original(input, { ...options, redirect: 'error' }); };`);
const transport = new StdioClientTransport({ command: process.execPath, args: ['--require', guard, join(sourceRoot, 'packages/mcp-server/bin/prompt-optimizer-desktop-mcp.cjs'), `--desktop-profile=${profile}`], env, stderr: 'pipe' });
let diagnostics = '';
transport.stderr?.on('data', bytes => { diagnostics += bytes.toString(); });
const client = new Client({ name: 'Isolated desktop product UI acceptance', version: '1' });
let child;
try {
  await client.connect(transport);
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const value = result.structuredContent ?? JSON.parse(result.content[0].text);
    assert.equal(result.isError, undefined, JSON.stringify(value));
    assert.equal(JSON.stringify(value).includes(credential), false);
    return value;
  };
  const { connectionId } = await call('po_sources_open', { access: 'write' });
  const query = (domain, operation, args = []) => call('po_query', { connectionId, domain, operation, arguments: args });
  const mutate = async (operation, args, requestKey) => call('po_mutate', { connectionId, domain: 'favorites', operation, arguments: args, requestKey,
    expectedRevision: (await query('favorites', 'getFavorites')).revision });
  const start = async (kind, request, inputRunId) => {
    const revision = (await query('models', 'getAllModels')).revision;
    const input = { kind, request }; if (inputRunId) input.inputRunId = inputRunId;
    const started = await call('po_runs_start', { connectionId, requestKey: `ui-${kind}`, expectedRevision: revision, input });
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const run = await call('po_runs_get', { connectionId, runId: started.id });
      if (run.status !== 'running') { assert.equal(run.status, 'succeeded', JSON.stringify(run)); await call('po_runs_save', { connectionId, runId: run.id, ...(kind === 'optimize' ? { target: 'history' } : {}) }); return run; }
      await delay(50);
    }
    throw new Error('Model fixture timed out');
  };
  const templates = await query('templates', 'listTemplatesByType', ['optimize']);
  const optimized = await start('optimize', { targetPrompt: 'Summarize synthetic text', optimizationMode: 'system', modelKey: 'fixture', templateId: templates.result[0].id });
  const tested = await start('test', { userPrompt: 'A synthetic input', modelKey: 'fixture' }, optimized.id);
  evaluation = true;
  const evaluated = await start('evaluate', { type: 'result', evaluationModelKey: 'fixture', mode: { functionMode: 'basic', subMode: 'system' } }, tested.id);
  const runs = [optimized, tested, evaluated].map(run => ({ id: run.id, kind: run.kind, contains: run.kind === 'evaluate' ? '88' : 'Synthetic desktop optimized prompt' }));
  await writeFile(join(root, 'product-fixture.json'), JSON.stringify({ runs }));
  const phases = [];
  for (const phase of ['product', 'product-restart']) {
    const stdout = createWriteStream(join(root, `${phase}-stdout.log`));
    const stderr = createWriteStream(join(root, `${phase}-stderr.log`));
    child = spawn(electron, [launcher, root, phase, `--user-data-dir=${profile}`, '--disable-gpu'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(stdout); child.stderr.pipe(stderr);
    const exited = once(child, 'close');
    const timeout = setTimeout(() => child.kill(), 90000);
    try {
      {
        const deadline = Date.now() + 60000;
        while (!await stat(join(root, `${phase}-ui-ready.json`)).catch(() => null)) {
          if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Product UI not ready; evidence: ${root}`);
          await delay(100);
        }
        const resource = (operation, values = {}) => call('po_resources', { connectionId, requestKey: `${phase}-${operation}`, operation, ...values });
        const image = join(root, 'pixel.png');
        if (phase === 'product') {
          await writeFile(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZwAAAABJRU5ErkJggg==', 'base64'));
          const saved = await resource('images.save', { store: 'favoriteImages', id: 'product-pixel', file: image, mimeType: 'image/png' });
          await resource('images.get', { store: 'favoriteImages', id: 'product-pixel', file: join(root, 'pixel-roundtrip.png') });
          assert.deepEqual(await readFile(image), await readFile(join(root, 'pixel-roundtrip.png')));
          assert.ok((await resource('images.list', { store: 'favoriteImages' })).statistics.count >= 1);
          const favorite = await mutate('addFavorite', [{ title: 'Synthetic image reference', content: 'Synthetic image prompt', tags: [], functionMode: 'image', imageSubMode: 'text2image',
            metadata: { media: { coverAssetId: 'product-pixel', assetIds: ['product-pixel'] } } }], 'ui-add-image-favorite');
          await resource('package.export', { file: join(root, 'complete-package.zip'), includeCredentials: true });
          await mutate('deleteFavorite', [favorite.result], 'ui-delete-image-favorite');
          await resource('images.delete', { store: 'favoriteImages', id: 'product-pixel', expectedDigest: saved.digest });
          await resource('package.import', { file: join(root, 'complete-package.zip'), includeCredentials: true });
        } else {
          await resource('images.get', { store: 'favoriteImages', id: 'product-pixel', file: join(root, 'pixel-after-restart.png') });
          assert.deepEqual(await readFile(image), await readFile(join(root, 'pixel-after-restart.png')));
        }
        await writeFile(join(root, `${phase}-resources-complete.json`), JSON.stringify({ ok: true, checks: ['real IndexedDB save/get/list/delete', 'full resource ZIP export/import', 'image restored after restart'], containsCredentials: true }));
      }
      const [code] = await exited; assert.equal(code, 0, `Desktop failed; evidence: ${root}`);
      const report = JSON.parse(await readFile(join(root, `${phase}-report.json`), 'utf8'));
      assert.equal(report.ok, true); assert.equal(report.business.completeProductUi, true); assert.equal(report.requests, 0);
      phases.push({ phase, visible: report.business.visible, requests: report.requests, runtime: report.runtime });
    } finally { clearTimeout(timeout); if (child.exitCode === null) child.kill(); stdout.end(); stderr.end(); }
  }
  assert.equal(modelRequests, 3); assert.equal(diagnostics.includes(credential), false);
  await writeFile(join(root, 'product-summary.json'), JSON.stringify({ ok: true, modelRequests, realProvider: false, phases, screenshot: 'product-restart.png' }, null, 2));
  console.log(JSON.stringify({ ok: true, evidence: root, modelRequests, phases }, null, 2));
} finally {
  if (child?.exitCode === null) child.kill();
  await client.close(); await transport.close(); await storage.provider.close();
  endpoint.closeAllConnections(); await new Promise(resolve => endpoint.close(resolve));
}
