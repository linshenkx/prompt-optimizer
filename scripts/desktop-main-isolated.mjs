import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// There is deliberately no executable or external profile argument.
assert.equal(process.argv.length, 2, 'This test accepts no executable, profile or environment arguments');
assert.equal(process.platform, 'win32', 'This bounded acceptance currently covers Windows only');
const sourceRoot = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const electron = await realpath(require('../packages/desktop/node_modules/electron'));
assert.equal(electron.toLowerCase().endsWith(`${String.raw`\electron.exe`}`), true, 'Only development electron.exe is allowed');
assert.equal(electron.startsWith(join(sourceRoot, 'node_modules')), true);
const evidenceParent = join(sourceRoot, '.codex-run');
await mkdir(evidenceParent, { recursive: true });
const root = await mkdtemp(join(evidenceParent, 'po-desktop-main-r2-'));
const desktop = join(root, 'app/packages/desktop');
const launcher = join(root, 'launcher');
await mkdir(join(desktop, 'config'), { recursive: true });
await mkdir(join(desktop, 'web-dist'), { recursive: true });
await mkdir(join(desktop, 'icons'), { recursive: true });
await mkdir(launcher, { recursive: true });

// Only explicit runtime code/assets are copied. Never copy .env files or user data.
const copied = ['main.js', 'preload.js', 'stream-runtime.js', 'remote-storage.js', 'package.json'];
for (const entry of await readdir(join(sourceRoot, 'packages/desktop/config'))) {
  if (entry.endsWith('.js') && !entry.endsWith('.test.js')) copied.push(`config/${entry}`);
}
copied.push('icons/app-icon.ico');
const hashes = {};
for (const relative of copied) {
  const from = join(sourceRoot, 'packages/desktop', relative);
  const to = join(desktop, relative);
  await copyFile(from, to);
  hashes[relative] = createHash('sha256').update(await readFile(to)).digest('hex');
  assert.equal(hashes[relative], createHash('sha256').update(await readFile(from)).digest('hex'));
}
for (const helper of ['desktop-main-bootstrap.cjs', 'desktop-main-isolation.cjs', 'desktop-main-business.cjs']) {
  await copyFile(join(sourceRoot, 'scripts/helpers', helper), join(launcher, helper));
}
await writeFile(join(launcher, 'package.json'), JSON.stringify({ name: 'po-storage-main-r2-fixture', version: '2.15.2', main: 'desktop-main-bootstrap.cjs' }));
await writeFile(join(root, 'app/.env.local'), '');
await writeFile(join(desktop, '.env'), '');
await writeFile(join(root, '.env'), '');
await writeFile(join(desktop, 'web-dist/index.html'), '<!DOCTYPE html><meta charset="utf-8"><title>Storage acceptance fixture</title><body>Hidden synthetic IPC fixture</body>');
const dependencyRoot = await realpath(join(sourceRoot, 'packages/desktop/node_modules'));
await symlink(dependencyRoot, join(desktop, 'node_modules'), 'junction');
await writeFile(join(root, 'manifest.json'), JSON.stringify({ sourceRoot, dependencyRoot, mainSha256: hashes['main.js'], copiedSha256: hashes }, null, 2));

// Prelaunch environment also isolates Electron/Chromium activity before JS runs.
const env = {};
for (const name of ['SystemRoot', 'WINDIR', 'ComSpec']) if (process.env[name]) env[name] = process.env[name];
env.PATH = [dirname(electron), join(process.env.SystemRoot, 'System32'), process.env.SystemRoot].join(';');
for (const [name, relative] of Object.entries({ APPDATA: 'appData', LOCALAPPDATA: 'localAppData', USERPROFILE: 'home', HOME: 'home', TEMP: 'temp', TMP: 'temp', XDG_CONFIG_HOME: 'appData', XDG_CACHE_HOME: 'cache' })) {
  env[name] = join(root, 'profile', relative);
  await mkdir(env[name], { recursive: true });
}
env.NODE_ENV = 'production';
env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
const userData = join(root, 'profile/userData');
await mkdir(userData, { recursive: true });
const legacy = join(userData, 'prompt-optimizer-data.json');
const database = join(userData, 'prompt-optimizer-data.sqlite');
const legacyBytes = JSON.stringify({ 'pref:storage-main-r2': JSON.stringify({ origin: 'synthetic-legacy-json' }) }, null, 2);
await writeFile(legacy, legacyBytes);
const retiredLegacyKey = 'pref:legacy-only-after-migration';
let expectedLegacy = legacyBytes;
let migrationMarker;

const phases = [];
for (const phase of ['first', 'restart']) {
  if (phase === 'restart') {
    expectedLegacy = JSON.stringify({ ...JSON.parse(legacyBytes), [retiredLegacyKey]: JSON.stringify(true) }, null, 2);
    await writeFile(legacy, expectedLegacy);
  }
  const stdout = createWriteStream(join(root, `${phase}-stdout.log`));
  const stderr = createWriteStream(join(root, `${phase}-stderr.log`));
  const started = Date.now();
  const child = spawn(electron, [launcher, root, phase, `--user-data-dir=${userData}`, `--disk-cache-dir=${join(root, 'profile/cache')}`, `--crash-dumps-dir=${join(root, 'profile/crashDumps')}`, '--disable-background-networking', '--disable-component-update', '--no-proxy-server', '--disable-gpu'], {
    cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
  const result = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolveExit({ code, signal }));
  });
  clearTimeout(timeout);
  await Promise.all([new Promise(resolveClose => stdout.end(resolveClose)), new Promise(resolveClose => stderr.end(resolveClose))]);
  assert.equal(timedOut, false, `Timed out; evidence retained at ${root}`);
  assert.equal(result.code, 0, `Main failed; inspect ${phase}-stderr.log in ${root}`);
  const report = JSON.parse(await readFile(join(root, `${phase}-report.json`), 'utf8'));
  assert.equal(report.ok, true);
  assert.equal(report.requests, 0);
  assert.equal(await readFile(legacy, 'utf8'), expectedLegacy);
  assert.equal((await readdir(userData)).includes('prompt-optimizer-data.json.backup'), false);
  const phaseResult = {
    phase, code: result.code, durationMs: Date.now() - started, mainSha256: report.mainSha256,
    closeCompleted: report.closeCompleted, ipcVerified: report.ipcVerified,
    requests: report.requests, runtime: report.runtime,
  };
  assert.equal(report.closeCompleted, true);
  assert.equal(report.business.ok, true);
  assert.equal(report.migration.source, 'json');
  assert.equal(report.migration.itemCount, 1);
  if (phase === 'restart') assert.ok(report.business.checked.includes('legacy mcp backup sections ignored'));
  const db = new DatabaseSync(database);
  try {
    assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.equal(db.prepare('SELECT value FROM storage_kv WHERE key = ?').get('pref:storage-main-r2-written').value, JSON.stringify('persisted-through-real-ipc'));
    const marker = db.prepare('SELECT value FROM storage_metadata WHERE key = ?').get('legacy-json-migration').value;
    assert.equal(JSON.parse(marker).version, 1);
    if (phase === 'first') migrationMarker = marker;
    else assert.equal(marker, migrationMarker);
    assert.equal(db.prepare('SELECT value FROM storage_kv WHERE key = ?').get(retiredLegacyKey), undefined);
    db.exec('BEGIN IMMEDIATE');
    db.exec('ROLLBACK');
  } finally { db.close(); }
  phases.push({ ...phaseResult, business: report.business });
}
await writeFile(join(root, 'summary.json'), JSON.stringify({ ok: true, phases, scope: 'Actual desktop main, preload business IPC, and legacy JSON retention in an isolated profile' }, null, 2));
console.log(JSON.stringify({ ok: true, evidence: root, phases }, null, 2));
