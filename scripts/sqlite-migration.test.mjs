import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdir, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { SQLiteStorageProvider, openDesktopStorage, openExistingDesktopStorage, exportDesktopStorageAsLegacyJSON, DESKTOP_DATABASE_FILENAME, LEGACY_STORAGE_FILENAME } from '../packages/core/dist/node.js';

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
  const existing = async () => {
    const result = await openExistingDesktopStorage(directory);
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
  return { directory, legacy, database, open, existing, child };
}

function databaseContents(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const schema = db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY name').all();
    const result = { schema, userVersion: db.prepare('PRAGMA user_version').get(), journalMode: db.prepare('PRAGMA journal_mode').get() };
    for (const table of ['storage_kv', 'storage_metadata']) {
      if (schema.some(row => row.type === 'table' && row.name === table)) {
        result[table] = db.prepare(`SELECT * FROM ${table} ORDER BY key`).all();
      }
    }
    return result;
  } finally { db.close(); }
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

test('existing-only access rejects missing directories/files and never falls back to legacy JSON', async t => {
  const f = await fixture(t);
  const original = await readFile(f.legacy, 'utf8');
  const before = await readdir(f.directory);
  const missingDirectory = join(f.directory, 'missing', 'nested');
  await assert.rejects(openExistingDesktopStorage(missingDirectory), /does not exist/);
  await assert.rejects(access(join(f.directory, 'missing')));
  await assert.rejects(f.existing(), /does not exist/);
  await assert.rejects(exportDesktopStorageAsLegacyJSON(f.directory), /does not exist/);
  assert.deepEqual(await readdir(f.directory), before);
  assert.equal(await readFile(f.legacy, 'utf8'), original);
  await assert.rejects(openExistingDesktopStorage('relative-profile'), /absolute/);
  await assert.rejects(SQLiteStorageProvider.openExistingReadOnly('relative.sqlite'), /absolute/);
  await mkdir(f.database);
  await assert.rejects(f.existing(), /database file/);
  assert.deepEqual(await readdir(f.database), []);
});

test('existing read-only access refuses every mutation before callbacks and preserves complete KV/metadata', async t => {
  const f = await fixture(t);
  const { provider: writer } = await f.open();
  await writer.setItem('after-migration', 'new-current-value');
  await writer.close();
  const before = databaseContents(f.database);
  const { provider, migration } = await f.existing();
  assert.equal(provider.readOnly, true);
  assert.deepEqual(provider.getCapabilities(), { supportsAtomic: false, supportsBatch: false, readOnly: true });
  assert.equal(migration.itemCount, Object.keys(sample).length);
  assert.equal(await provider.getItem('after-migration'), 'new-current-value');
  assert.ok((await provider.getAllKeys()).includes('after-migration'));
  assert.equal(new Map(await provider.getAllEntries()).get('after-migration'), 'new-current-value');
  let callbacks = 0;
  for (const mutate of [
    () => provider.setItem('forbidden', 'value'),
    () => provider.removeItem('after-migration'),
    () => provider.clearAll(),
    () => provider.compareAndSetItem('after-migration', 'new-current-value', 'forbidden'),
    () => provider.batchUpdate([{ key: 'forbidden', operation: 'set', value: 'value' }]),
    () => provider.updateData('pref:legacy-object', () => { callbacks++; return {}; }),
    () => provider.initializeFromLegacy(() => { callbacks++; return { source: 'empty', entries: new Map() }; }),
    () => provider.flush(),
  ]) await assert.rejects(mutate(), /read-only/);
  assert.equal(callbacks, 0);
  // Inspect the private native handle only here to verify SQLite itself enforces readOnly,
  // independently of the provider's public method checks. This is not a supported API.
  assert.throws(() => provider.db.exec("INSERT INTO storage_kv(key, value) VALUES ('native-forbidden', 'value')"), /readonly|read-only/i);
  await provider.close();
  await provider.close();
  await assert.rejects(provider.getAllEntries(), /closed/);
  assert.deepEqual(databaseContents(f.database), before);
});

test('existing readers observe legitimate desktop writes and export the current complete KV without writing a file', async t => {
  const f = await fixture(t);
  const { provider: writer } = await f.open();
  const { provider: reader } = await f.existing();
  await writer.setItem('new-after-upgrade', 'not-in-historical-json');
  await writer.batchUpdate([
    { operation: 'set', key: '', value: '' },
    { operation: 'set', key: '__proto__', value: 'opaque-prototype-key' },
    { operation: 'set', key: 'opaque-nul', value: 'test\u0000中文' },
  ]);
  assert.equal(await reader.getItem('new-after-upgrade'), 'not-in-historical-json');
  assert.equal(await writer.compareAndSetItem('new-after-upgrade', 'not-in-historical-json', 'latest'), true);
  assert.equal(await reader.getItem('new-after-upgrade'), 'latest');
  const entries = await writer.getAllEntries();
  const before = databaseContents(f.database);
  const legacyBefore = await readFile(f.legacy, 'utf8');
  const exported = await exportDesktopStorageAsLegacyJSON(f.directory);
  assert.deepEqual(JSON.parse(exported), Object.fromEntries(entries));
  assert.equal(Object.hasOwn(JSON.parse(exported), '__proto__'), true);
  assert.equal(JSON.parse(exported)['new-after-upgrade'], 'latest');
  assert.equal(Object.hasOwn(JSON.parse(legacyBefore), 'new-after-upgrade'), false);
  assert.equal(await readFile(f.legacy, 'utf8'), legacyBefore);
  assert.deepEqual(databaseContents(f.database), before);
  assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.backup')).length, 0);
  assert.equal(Object.hasOwn(JSON.parse(exported), 'legacy-json-migration'), false);
  await writer.close();
  assert.equal(await reader.getItem('new-after-upgrade'), 'latest');
  t.diagnostic('Native read-only reader shared committed desktop writes; current complete KV exported in memory');
});

test('existing-only access and desktop bootstrap reject incompatible schema without repair', async t => {
  const cases = [
    ['missing-table', 'DROP TABLE storage_kv'],
    ['missing-metadata', 'DROP TABLE storage_metadata'],
    ['view', "DROP TABLE storage_kv; CREATE VIEW storage_kv AS SELECT 'key' AS key, 'value' AS value"],
    ['wrong-types', 'DROP TABLE storage_kv; CREATE TABLE storage_kv(key TEXT PRIMARY KEY, value BLOB NOT NULL) STRICT'],
    ['extra-column', 'ALTER TABLE storage_kv ADD COLUMN future TEXT'],
    ['non-strict', 'DROP TABLE storage_kv; CREATE TABLE storage_kv(key TEXT PRIMARY KEY, value TEXT NOT NULL)'],
    ['future-user-version', 'PRAGMA user_version=2'],
    ['wrong-journal', 'PRAGMA journal_mode=DELETE'],
  ];
  for (const [name, sql] of cases) {
    await t.test(name, async child => {
      const f = await fixture(child);
      await (await f.open()).provider.close();
      const db = new DatabaseSync(f.database);
      try { db.exec(sql); } finally { db.close(); }
      const before = databaseContents(f.database);
      const legacyBefore = await readFile(f.legacy, 'utf8');
      await assert.rejects(f.existing(), /schema|incompatible/);
      assert.deepEqual(databaseContents(f.database), before);
      await assert.rejects(f.open(), /schema|incompatible/);
      assert.deepEqual(databaseContents(f.database), before, 'Desktop bootstrap must not recreate missing tables or repair schema');
      assert.equal(await readFile(f.legacy, 'utf8'), legacyBefore);
    });
  }
});

test('existing-only access rejects missing, corrupt and unknown migration states without changing them', async t => {
  for (const marker of [undefined, '{broken', 'null', '[]', '{}', '{"version":2}',
    '{"version":1,"source":"other","itemCount":0}', '{"version":1,"source":"json","itemCount":-1}',
    '{"version":1,"source":"json","itemCount":"1"}', '{"version":1,"source":"empty","itemCount":3}']) {
    const f = await fixture(t);
    await (await f.open()).provider.close();
    const db = new DatabaseSync(f.database);
    try {
      if (marker === undefined) db.exec('DELETE FROM storage_metadata');
      else db.prepare('UPDATE storage_metadata SET value = ?').run(marker);
    } finally { db.close(); }
    const before = databaseContents(f.database);
    await assert.rejects(f.existing(), /migration state/);
    assert.deepEqual(databaseContents(f.database), before);
    await assert.rejects(f.open(), /migration state|Unmarked/);
    assert.deepEqual(databaseContents(f.database), before);
  }
  const corrupt = await fixture(t);
  await writeFile(corrupt.database, 'corrupt-synthetic-database');
  await assert.rejects(corrupt.existing(), /corrupt|incompatible/);
  await assert.rejects(corrupt.open(), /SQLite operation failed/);
  assert.equal(await readFile(corrupt.database, 'utf8'), 'corrupt-synthetic-database');
  const empty = await fixture(t);
  await writeFile(empty.database, '');
  await assert.rejects(empty.existing(), /schema|incompatible/);
  await assert.rejects(openDesktopStorage(empty.directory, { maxRetries: 1, retryDelayMs: 1 }), /empty or truncated/);
  assert.equal((await readFile(empty.database)).length, 0);
});

test('desktop bootstrap accepts rolled-back initial DDL but refuses fully dropped or foreign schemas', async t => {
  const interrupted = await fixture(t);
  const initial = new DatabaseSync(interrupted.database);
  try {
    initial.exec('PRAGMA journal_mode=WAL');
    initial.exec('BEGIN IMMEDIATE');
    initial.exec('CREATE TABLE partial (key TEXT)');
    initial.exec('ROLLBACK');
    assert.equal(initial.prepare('PRAGMA schema_version').get().schema_version, 0);
  } finally { initial.close(); }
  assert.equal((await interrupted.open()).migration.itemCount, Object.keys(sample).length);

  for (const sql of [
    'DROP TABLE storage_kv; DROP TABLE storage_metadata',
    'DROP TABLE storage_kv; DROP TABLE storage_metadata; CREATE TABLE unrelated (id INTEGER)',
  ]) {
    const f = await fixture(t);
    await (await f.open()).provider.close();
    const db = new DatabaseSync(f.database);
    try { db.exec(sql); } finally { db.close(); }
    const before = databaseContents(f.database);
    const legacyBefore = await readFile(f.legacy, 'utf8');
    await assert.rejects(f.open(), /schema|incompatible/);
    assert.deepEqual(databaseContents(f.database), before);
    assert.equal(await readFile(f.legacy, 'utf8'), legacyBefore);
  }
});

test('a cleared migrated database stays valid and exports empty current data, never old JSON', async t => {
  const f = await fixture(t);
  const { provider: writer, migration } = await f.open();
  await writer.clearAll();
  await writer.close();
  const before = databaseContents(f.database);
  await writeFile(f.legacy, '{now-corrupt-historical-source');
  const existing = await f.existing();
  assert.deepEqual(existing.migration, migration); // itemCount describes the migration, not today's row count.
  assert.deepEqual(await existing.provider.getAllEntries(), []);
  assert.equal(await exportDesktopStorageAsLegacyJSON(f.directory), '{}');
  assert.deepEqual(databaseContents(f.database), before);
  await existing.provider.close();
  assert.deepEqual(await (await f.open()).provider.getAllEntries(), []);
});

test('legacy EACCES/EIO errors fail safely instead of importing a possibly stale backup', async t => {
  for (const code of ['EACCES', 'EIO']) {
    const f = await fixture(t);
    const source = await readFile(f.legacy, 'utf8');
    const backup = JSON.stringify({ stale: 'synthetic-backup' });
    await writeFile(`${f.legacy}.backup`, backup);
    const child = f.child(`io-${code}`);
    const result = await message(child, 'io-refused');
    assert.equal(result.code, code);
    assert.equal(result.backupReads, 0);
    const db = new DatabaseSync(f.database, { readOnly: true });
    try {
      assert.equal(db.prepare('SELECT count(*) AS n FROM storage_kv').get().n, 0);
      assert.equal(db.prepare('SELECT count(*) AS n FROM storage_metadata').get().n, 0);
    } finally { db.close(); }
    assert.equal(await readFile(f.legacy, 'utf8'), source);
    assert.equal(await readFile(`${f.legacy}.backup`, 'utf8'), backup);
    assert.equal((await f.open()).migration.source, 'json');
  }
});
