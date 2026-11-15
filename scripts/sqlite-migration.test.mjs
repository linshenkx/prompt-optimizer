import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { SQLiteStorageProvider, openDesktopStorage, DESKTOP_DATABASE_FILENAME, LEGACY_STORAGE_FILENAME } from '../packages/core/dist/node.js';

const sample = {
  models: JSON.stringify({ synthetic: { name: 'Synthetic model', apiKey: 'test-only-placeholder' } }),
  user_templates: JSON.stringify([{ id: 'test-template', content: '测试 👋' }]),
  'pref:theme': 'dark',
  empty: '',
  'pref:legacy-object': { enabled: true },
  'pref:legacy-null': null,
};

test('Electron smoke runner rejects packaged executables before launching anything', () => {
  for (const args of [['PromptOptimizer.exe'], ['PromptOptimizer.exe', 'resources/app.asar']]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./sqlite-electron-smoke.mjs', import.meta.url)), ...args], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /packaged executables must never be launched/);
  }
});

async function fixture(t, data = sample) {
  const directory = await mkdtemp(join(tmpdir(), 'po-migration-'));
  const providers = [];
  const children = [];
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
    }
    await Promise.all(providers.map(provider => provider.close()));
    await rm(directory, { recursive: true, force: true });
  });
  const legacy = join(directory, LEGACY_STORAGE_FILENAME);
  const database = join(directory, DESKTOP_DATABASE_FILENAME);
  if (data !== undefined && data !== false) await writeFile(legacy, JSON.stringify(data, null, 2));
  const open = async () => {
    const result = await openDesktopStorage(directory);
    providers.push(result.provider);
    return result;
  };
  const child = command => {
    const processChild = fork(new URL('./helpers/sqlite-migration-worker.cjs', import.meta.url), [directory, command], {
      execPath: process.env.SQLITE_TEST_EXECUTABLE || process.execPath,
      execArgv: [],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    });
    children.push(processChild);
    return processChild;
  };
  return { directory, legacy, database, open, child };
}

function message(child, event) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const onData = chunk => { stderr += chunk; };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Migration worker timed out: ${event}`)); }, 10000);
    const onMessage = value => { if (value.event === event) { cleanup(); resolve(value); } };
    const onExit = code => { cleanup(); reject(new Error(`Migration worker exited ${code}: ${stderr}`)); };
    function cleanup() { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); child.stderr.off('data', onData); }
    child.stderr.on('data', onData);
    child.on('message', onMessage);
    child.once('exit', onExit);
  });
}

test('real legacy JSON: every key/value migrates, restart is idempotent and clear does not resurrect it', async t => {
  const f = await fixture(t);
  const original = await readFile(f.legacy, 'utf8');
  const { provider, migration } = await f.open();
  assert.deepEqual(migration, { version: 1, source: 'json', itemCount: Object.keys(sample).length });
  assert.equal((await provider.getAllKeys()).length, Object.keys(sample).length);
  for (const [key, value] of Object.entries(sample)) {
    assert.equal(await provider.getItem(key), typeof value === 'string' ? value : JSON.stringify(value));
  }
  assert.equal(await readFile(f.legacy, 'utf8'), original);
  assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.backup')).length, 0);
  await provider.setItem('pref:theme', 'light');
  await provider.close();
  // Once switched, even a corrupt/stale source must never replace newer SQLite data.
  await writeFile(f.legacy, 'invalid');
  const reopened = (await f.open()).provider;
  assert.equal(await reopened.getItem('pref:theme'), 'light');
  await reopened.clearAll();
  await reopened.close();
  assert.deepEqual(await (await f.open()).provider.getAllKeys(), []);
});

test('fresh startup and existing legacy backup are distinguished without creating or rewriting backups', async t => {
  const fresh = await fixture(t, false);
  const empty = await fresh.open();
  assert.deepEqual(empty.migration, { version: 1, source: 'empty', itemCount: 0 });
  assert.equal((await readdir(fresh.directory)).includes(LEGACY_STORAGE_FILENAME), false);
  const recovered = await fixture(t, false);
  const backup = JSON.stringify(sample);
  await writeFile(recovered.legacy, '{broken');
  await writeFile(`${recovered.legacy}.backup`, backup);
  const migrated = await recovered.open();
  assert.equal(migrated.migration.source, 'backup');
  assert.equal(await readFile(recovered.legacy, 'utf8'), '{broken');
  assert.equal(await readFile(`${recovered.legacy}.backup`, 'utf8'), backup);
  const missingMain = await fixture(t, false);
  await writeFile(`${missingMain.legacy}.backup`, backup);
  assert.equal((await missingMain.open()).migration.source, 'backup');
});

test('invalid legacy input or SQL failure never marks completion or changes the source; retry succeeds', async t => {
  const invalid = await fixture(t, false);
  await writeFile(invalid.legacy, '["invalid root"]');
  await assert.rejects(invalid.open(), /invalid/);
  await writeFile(invalid.legacy, JSON.stringify(sample));
  assert.equal((await invalid.open()).migration.source, 'json');
  const f = await fixture(t);
  const original = await readFile(f.legacy, 'utf8');
  const provider = new SQLiteStorageProvider(f.database);
  await provider.flush();
  await provider.close();
  const db = new DatabaseSync(f.database);
  try {
    db.exec("CREATE TRIGGER reject_migration BEFORE INSERT ON storage_kv WHEN NEW.key = 'pref:theme' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    await assert.rejects(f.open(), /SQLite operation failed/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM storage_kv').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM storage_metadata').get().n, 0);
    assert.equal(await readFile(f.legacy, 'utf8'), original);
    // The retained file remains a valid legacy source after failure.
    assert.deepEqual(JSON.parse(await readFile(f.legacy, 'utf8')), sample);
    db.exec('DROP TRIGGER reject_migration');
  } finally { db.close(); }
  assert.equal((await f.open()).migration.itemCount, Object.keys(sample).length);
});

test('simultaneous cold starts migrate exactly once in two actual processes', async t => {
  const f = await fixture(t);
  const a = f.child('migrate');
  const b = f.child('migrate');
  const [first, second] = await Promise.all([message(a, 'complete'), message(b, 'complete')]);
  assert.notEqual(first.pid, second.pid);
  assert.deepEqual(first.migration, second.migration);
  t.diagnostic(JSON.stringify({ first, second }));
  const { provider } = await f.open();
  assert.equal((await provider.getAllKeys()).length, Object.keys(sample).length);
});

test('killing migration after its first insertion rolls back rows and marker, then restart imports real source', async t => {
  const f = await fixture(t);
  const original = await readFile(f.legacy, 'utf8');
  const child = f.child('interrupt');
  await message(child, 'partial');
  const db = new DatabaseSync(f.database);
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM storage_kv').get().n, 0);
    const exited = once(child, 'exit');
    child.kill();
    await exited;
    assert.equal(db.prepare('SELECT count(*) AS n FROM storage_kv').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM storage_metadata').get().n, 0);
  } finally { db.close(); }
  const { provider, migration } = await f.open();
  assert.equal(migration.source, 'json');
  assert.equal(await provider.getItem('first'), null);
  assert.equal(await readFile(f.legacy, 'utf8'), original);
});

test('ambiguous, future, locked or corrupt SQLite is never overwritten or silently replaced with old JSON', async t => {
  const ambiguous = await fixture(t);
  const raw = new SQLiteStorageProvider(ambiguous.database);
  await raw.setItem('new-only', 'keep');
  await raw.close();
  await assert.rejects(ambiguous.open(), /reconciliation/);
  const corrupt = await fixture(t);
  await writeFile(corrupt.database, 'not a database');
  await assert.rejects(corrupt.open());
  assert.equal(await readFile(corrupt.database, 'utf8'), 'not a database');
  const future = await fixture(t);
  await (await future.open()).provider.close();
  const futureDb = new DatabaseSync(future.database);
  futureDb.prepare('UPDATE storage_metadata SET value = ?').run(JSON.stringify({ version: 2 }));
  futureDb.close();
  await assert.rejects(future.open(), /Unsupported/);
  const locked = await fixture(t);
  const empty = new SQLiteStorageProvider(locked.database);
  await empty.flush();
  await empty.close();
  const db = new DatabaseSync(locked.database);
  try {
    db.exec('BEGIN IMMEDIATE');
    await assert.rejects(openDesktopStorage(locked.directory, { busyTimeoutMs: 10, maxRetries: 1, retryDelayMs: 5 }), /busy/);
    db.exec('ROLLBACK');
  } finally { db.close(); }
  assert.equal((await locked.open()).migration.source, 'json');
});
