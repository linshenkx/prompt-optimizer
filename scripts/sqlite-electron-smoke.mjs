import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Optional arg: resources/app.asar. Always use the development Electron executable;
// a packaged application ignores script arguments and starts its own main entry.
const require = createRequire(import.meta.url);
const [archive] = process.argv.slice(2);
if (process.argv.length > 3 || (archive && !archive.endsWith('.asar'))) {
  throw new Error('Only a single app.asar path is accepted; packaged executables must never be launched by this test');
}
const electron = require('../packages/desktop/node_modules/electron');
const directory = await mkdtemp(join(tmpdir(), 'po-electron-storage-'));
try {
  await writeFile(join(directory, 'prompt-optimizer-data.json'), JSON.stringify({ synthetic: 'desktop-main' }));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [fileURLToPath(new URL('./helpers/sqlite-electron-smoke.cjs', import.meta.url)), directory, ...(archive ? [resolve(archive)] : [])], {
    env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timeout = setTimeout(() => child.kill(), 20000);
  const code = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('exit', resolveExit); });
  clearTimeout(timeout);
  assert.equal(code, 0, stderr);
  assert.match(stdout, /"ok":true/);
  process.stdout.write(stdout);
} finally { await rm(directory, { recursive: true, force: true }); }
