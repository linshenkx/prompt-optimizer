import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, symlink, rm, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createBoundary } = require('./helpers/desktop-main-isolation.cjs');
const helper = fileURLToPath(new URL('./helpers/desktop-main-isolation.cjs', import.meta.url));

test('filesystem boundary rejects parent, sibling, symlink and environment-file escapes', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'po-main-guard-'));
  assert.equal(dirname(parent), tmpdir());
  try {
    const root = join(parent, 'fixture');
    const sources = join(parent, 'sources');
    await mkdir(root);
    await mkdir(sources);
    await symlink(sources, join(root, 'dependencies'), process.platform === 'win32' ? 'junction' : 'dir');
    const boundary = createBoundary(root, [sources]);
    assert.equal(boundary.writable(join(root, 'profile/new/file')), join(root, 'profile/new/file'));
    assert.equal(boundary.readable(join(sources, 'code.js')), join(sources, 'code.js'));
    assert.throws(() => boundary.writable(join(parent, 'outside')), /outside fixture/);
    assert.throws(() => boundary.writable(`${root}-sibling/file`), /outside fixture/);
    assert.throws(() => boundary.writable(join(root, 'dependencies/file')), /outside fixture/);
    assert.throws(() => boundary.readable(join(sources, '.env.local')), /read outside/);
    assert.throws(() => boundary.readable(join(parent, 'private-data.json')), /read outside/);
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const path = require('node:path');
      const { createBoundary, installFilesystemGuards } = require(process.argv[1]);
      const root = process.argv[2], sources = process.argv[3], outside = process.argv[4];
      const audit = { readable: 0, writable: 0, violations: [] };
      installFilesystemGuards(createBoundary(root, [sources]), audit);
      fs.writeFileSync(path.join(root, 'safe'), 'synthetic');
      assert.equal(fs.readFileSync(path.join(root, 'safe'), 'utf8'), 'synthetic');
      assert.throws(() => fs.writeFileSync(outside, 'refused'), /outside fixture/);
      assert.throws(() => fs.openSync(outside, 'w'), /outside fixture/);
      assert.throws(() => fs.readFileSync(path.join(sources, '.env.local')), /read outside/);
      assert.throws(() => fs.promises.writeFile(outside, 'refused'), /outside fixture/);
      assert.equal(audit.violations.length, 4);
    `, helper, root, sources, join(parent, 'must-not-exist')], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(access(join(parent, 'must-not-exist')));
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('actual-main runner refuses arbitrary executable or profile arguments before launching', () => {
  const runner = fileURLToPath(new URL('./desktop-main-isolated.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [runner, 'PromptOptimizer.exe'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /accepts no executable, profile or environment arguments/);
});
