import assert from 'node:assert/strict';
import { copyFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const tarball = resolve(process.argv[2]);

test('npx starts the packed product MCP with a single package specifier', async () => {
  const temp = await realpath(tmpdir());
  const root = await mkdtemp(join(temp, 'po-npx-'));
  const client = new Client({ name: 'npm-package-test', version: '1' });
  try {
    await copyFile(tarball, join(root, basename(tarball)));
    const transport = new StdioClientTransport({
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['-y', 'file:./' + basename(tarball)],
      cwd: root,
      env: {
        HOME: root, USERPROFILE: root, APPDATA: root, LOCALAPPDATA: root, XDG_CONFIG_HOME: root,
        npm_config_cache: join(root, 'npm-cache'), npm_config_offline: 'true', npm_config_update_notifier: 'false',
      },
    });
    await client.connect(transport, { timeout: 30000 });
    const names = (await client.listTools()).tools.map(tool => tool.name);
    for (const name of ['po_sources_open', 'po_query', 'po_runs_start']) assert.ok(names.includes(name));
    assert.ok(!names.includes('optimize-user-prompt'));
    assert.ok(!names.includes('po_models_list'));
    const sources = await client.callTool({ name: 'po_sources_list', arguments: {} });
    assert.ok(sources.structuredContent.sources.some(source => source.kind === 'desktop'));
  } finally {
    await client.close();
    assert.equal(dirname(root), temp);
    assert.ok(basename(root).startsWith('po-npx-'));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
});
