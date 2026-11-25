import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const secret = 'SYNTHETIC_DOCKER_HTTP_KEY';

test('Docker HTTP /mcp retains initialization, sessions and its original three tools', { timeout: 30000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'po-docker-http-'));
  const cleanups = [];
  t.after(async () => {
    for (const close of cleanups.reverse()) await close();
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('po-docker-http-'));
    rmSync(root, { recursive: true, force: true });
  });
  const project = join(root, 'project'), pkg = join(project, 'packages/mcp-server');
  mkdirSync(pkg, { recursive: true });
  cpSync(fileURLToPath(new URL('../dist/docker/', import.meta.url)), join(pkg, 'dist'), { recursive: true });
  copyFileSync(fileURLToPath(new URL('../preload-env.cjs', import.meta.url)), join(pkg, 'preload-env.cjs'));
  const dependencies = join(pkg, 'node_modules');
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), dependencies, process.platform === 'win32' ? 'junction' : 'dir');
  cleanups.push(() => unlinkSync(dependencies));
  for (const directory of [project, join(project, 'packages'), pkg]) for (const file of ['.env', '.env.local']) {
    writeFileSync(join(directory, file), `VITE_OPENAI_API_KEY=${secret}\n`);
  }
  const listener = createNetServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(resolveClose => listener.close(resolveClose));
  const guard = join(root, 'http-loopback.cjs');
  writeFileSync(guard, `const net = require('node:net'); const listen = net.Server.prototype.listen;
    net.Server.prototype.listen = function(port, callback) { return listen.call(this, port, '127.0.0.1', callback); };
    global.fetch = () => { throw new Error('No provider traffic in HTTP compatibility acceptance'); };`);
  const child = spawn(process.execPath, ['--require', guard, '--require', './preload-env.cjs', 'dist/start.cjs', '--transport=http', '--port=' + port], {
    cwd: pkg, env: { PATH: dirname(process.execPath), HOME: root, USERPROFILE: root, SYSTEMROOT: process.env.SYSTEMROOT, DEBUG: 'mcp:*' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = ''; child.stdout.on('data', bytes => { diagnostics += bytes; }); child.stderr.on('data', bytes => { diagnostics += bytes; });
  const closed = once(child, 'close');
  cleanups.push(async () => { if (child.exitCode === null) { child.kill(); await closed; } });
  const deadline = Date.now() + 15000;
  while (!diagnostics.includes('MCP Server running on HTTP port')) {
    assert.equal(child.exitCode, null, diagnostics.replaceAll(secret, '[SYNTHETIC]'));
    assert.ok(Date.now() < deadline, 'Isolated HTTP startup timed out');
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  const client = new Client({ name: 'legacy-http-compatibility', version: '1' });
  cleanups.push(() => client.close());
  await client.connect(transport);
  assert.ok(transport.sessionId);
  assert.equal(client.getServerVersion().version, JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version);
  assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ['iterate-prompt', 'optimize-system-prompt', 'optimize-user-prompt']);
  await transport.terminateSession(); await client.close();
  assert.ok(!diagnostics.includes(secret));
});
