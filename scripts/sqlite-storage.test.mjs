import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SQLiteStorageProvider } from '../packages/core/dist/node.js';
import {
  StorageFactory,
  CORE_SERVICE_KEYS,
  HistoryManager,
  PreferenceService,
  RecordNotFoundError,
} from '../packages/core/dist/index.js';

const workerUrl = new URL('./helpers/sqlite-storage-worker.mjs', import.meta.url);
const cleanups = new WeakMap();
const waitEvent = (child, event) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { cleanup(); reject(new Error(`Worker timed out: ${event}`)); }, 10000);
  const onMessage = value => { if (value.event === event) { cleanup(); resolve(value); } };
  const onExit = code => { cleanup(); reject(new Error(`Worker exited: ${code}`)); };
  function cleanup() { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); }
  child.on('message', onMessage);
  child.once('exit', onExit);
});

async function worker(t, file, options = {}) {
  const child = fork(workerUrl, [file, JSON.stringify(options)], {
    execPath: process.env.SQLITE_TEST_EXECUTABLE || process.execPath,
    execArgv: [],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  cleanups.get(t).push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  });
  const info = await waitEvent(child, 'ready').catch(error => { throw new Error(`${error.message}: ${errors}`); });
  t.diagnostic(JSON.stringify(info));
  let nextId = 0;
  const call = (command, args = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Worker call timed out: ${command}`)); }, 15000);
    const onMessage = message => {
      if (message.id !== id) return;
      cleanup();
      if (message.error) reject(Object.assign(new Error(message.error.message), { name: message.error.name }));
      else resolve(message.result);
    };
    const onExit = () => { cleanup(); reject(new Error('Worker exited during call')); };
    function cleanup() { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); }
    child.on('message', onMessage);
    child.once('exit', onExit);
    child.send({ id, command, ...args });
  });
  return { child, call, info };
}

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'po-sqlite-'));
  const file = join(dir, 'data.sqlite');
  const provider = new SQLiteStorageProvider(file);
  const workers = [];
  cleanups.set(t, workers);
  t.after(async () => {
    await Promise.all(workers.map(cleanup => cleanup()));
    await provider.close();
    await rm(dir, { recursive: true, force: true });
  });
  await provider.flush();
  return { dir, file, provider };
}

test('SQLite strings, lifecycle and rollback preserve existing data', async t => {
  const { file, provider } = await fixture(t);
  assert.throws(() => StorageFactory.create('sqlite'), /core\/node/);
  await provider.setItem('', '');
  await provider.setItem('unicode', '中文 👋 " \\ null');
  assert.equal(await provider.getItem(''), '');
  assert.equal(await provider.getItem('unicode'), '中文 👋 " \\ null');
  await provider.setItem('lone-surrogate', 'test\ud83d');
  assert.equal(await provider.getItem('lone-surrogate'), 'test\ufffd');
  await provider.updateData('json-surrogate', () => ({ text: 'test\ud83d' }));
  assert.deepEqual(JSON.parse(await provider.getItem('json-surrogate')), { text: 'test\ud83d' });
  await provider.setItem('counter', '1');
  const domainError = new Error('Domain validation failed');
  await assert.rejects(provider.updateData('counter', () => { throw domainError; }), error => error === domainError);
  await assert.rejects(provider.updateData('counter', () => undefined), /serializable/);
  await assert.rejects(provider.updateData('counter', async () => 3), /synchronous/);
  await provider.setItem('invalid-json', 'broken');
  await assert.rejects(provider.updateData('invalid-json', () => 1), SyntaxError);
  assert.equal(await provider.getItem('invalid-json'), 'broken');
  assert.equal(await provider.getItem('counter'), '1');
  await assert.rejects(provider.batchUpdate([{ key: 'counter', operation: 'remove' }, { key: 'bad', operation: 'set' }]), /Invalid/);
  assert.equal(await provider.getItem('counter'), '1');
  await provider.updateData('counter', n => n + 1);
  assert.equal(await provider.compareAndSetItem('absent', null, ''), true);
  assert.equal(await provider.compareAndSetItem('absent', null, 'no'), false);
  assert.equal(await provider.compareAndSetItem('absent', '', null), true);
  await provider.removeItem('invalid-json');
  const pending = provider.setItem('queued', 'durable');
  await provider.close();
  await pending;
  await provider.close();
  await assert.rejects(provider.getItem('queued'), /closed/);
  const reopened = new SQLiteStorageProvider(file);
  try {
    assert.equal(await reopened.getItem('queued'), 'durable');
    assert.equal(await reopened.getItem('counter'), '2');
    assert.ok((await reopened.getAllKeys()).includes('unicode'));
  } finally { await reopened.close(); }
});

test('two independent processes: no lost updates and exactly one CAS winner', async t => {
  const { file, provider } = await fixture(t);
  const [a, b] = await Promise.all([worker(t, file), worker(t, file)]);
  assert.notEqual(a.info.pid, b.info.pid);
  assert.notEqual(a.info.pid, process.pid);
  await Promise.all([a.call('increment', { count: 250 }), b.call('increment', { count: 250 })]);
  assert.equal(await provider.getItem('counter'), '500');
  const results = await Promise.all([a.call('cas', { key: 'winner', expected: null, value: 'a' }), b.call('cas', { key: 'winner', expected: null, value: 'b' })]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.ok(['a', 'b'].includes(await provider.getItem('winner')));
});

test('cross-process batch visibility and SQL failure rollback', async t => {
  const { file, provider } = await fixture(t);
  await provider.batchUpdate([{ key: 'left', operation: 'set', value: '0' }, { key: 'right', operation: 'set', value: '0' }]);
  const [a, b] = await Promise.all([worker(t, file), worker(t, file)]);
  const observing = waitEvent(b.child, 'observing');
  const observation = b.call('observe-batches', { ms: 500 });
  await observing;
  const [, snapshots] = await Promise.all([a.call('batch-loop', { count: 250 }), observation]);
  assert.ok(snapshots.samples > 0 && snapshots.generations > 1, 'Reader must overlap the actual writes');
  t.diagnostic(`Consistent batch snapshots: ${JSON.stringify(snapshots)}`);
  const db = new DatabaseSync(file);
  db.exec("CREATE TRIGGER reject_test_write BEFORE INSERT ON storage_kv WHEN NEW.key = 'blocked' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
  db.close();
  await assert.rejects(a.call('batch-fail'), /SQLite operation failed/);
  assert.equal(await b.call('get', { key: 'left' }), '250');
  assert.equal(await b.call('get', { key: 'blocked' }), null);
  await a.call('set', { key: 'after-failure', value: 'ok' });
  assert.equal(await b.call('get', { key: 'after-failure' }), 'ok');
});

test('complete provider KV snapshots never mix commits from an independent writer', async t => {
  const { file, provider } = await fixture(t);
  await provider.batchUpdate([{ key: 'left', operation: 'set', value: '0' }, { key: 'right', operation: 'set', value: '0' }]);
  const [a, b] = await Promise.all([worker(t, file), worker(t, file)]);
  const observing = waitEvent(b.child, 'observing');
  const observation = b.call('observe-provider-snapshots', { ms: 500 });
  await observing;
  const [, snapshots] = await Promise.all([a.call('batch-loop', { count: 250 }), observation]);
  assert.ok(snapshots.samples > 0 && snapshots.generations > 1, 'Snapshot reads must overlap the actual writes');
  assert.deepEqual(await provider.getAllEntries(), [['left', '250'], ['right', '250']]);
  t.diagnostic(`Consistent complete KV snapshots: ${JSON.stringify(snapshots)}`);
});

test('writer contention is bounded, WAL reads proceed, and killed writer rolls back', async t => {
  const { file, provider } = await fixture(t);
  const a = await worker(t, file);
  const b = await worker(t, file, { busyTimeoutMs: 20, maxRetries: 2, retryDelayMs: 10 });
  const locked = waitEvent(a.child, 'locked');
  const holding = a.call('hold', { ms: 500 });
  await locked;
  const start = Date.now();
  assert.equal(await b.call('get', { key: 'held' }), null);
  await assert.rejects(b.call('set', { key: 'contended', value: 'no' }), /busy/);
  const duration = Date.now() - start;
  assert.ok(duration >= 40 && duration < 1500, `bounded wait: ${duration}ms`);
  await holding;
  t.diagnostic(`Contended write rejected in ${duration}ms`);
  await b.call('set', { key: 'contended', value: 'yes' });
  const again = waitEvent(a.child, 'locked');
  const interrupted = a.call('hold', { ms: 10000 });
  const rejected = assert.rejects(interrupted, /exited/);
  await again;
  const exited = once(a.child, 'exit');
  a.child.kill();
  await exited;
  await rejected;
  assert.equal(await provider.getItem('held'), '1');
  await b.call('set', { key: 'post-crash', value: 'ok' });
  const c = await worker(t, file);
  const acquired = waitEvent(c.child, 'locked');
  const shortHold = c.call('hold', { ms: 150 });
  await acquired;
  await provider.updateData('counter', n => (n ?? 0) + 1);
  await shortHold;
  assert.equal(await provider.getItem('counter'), '1');
});

test('real template and history managers preserve concurrent additions and deletions', async t => {
  const { file, provider } = await fixture(t);
  const [a, b] = await Promise.all([worker(t, file), worker(t, file)]);
  await Promise.all([a.call('templates', { prefix: 'test-a', count: 15 }), b.call('templates', { prefix: 'test-b', count: 15 })]);
  assert.equal(JSON.parse(await provider.getItem(CORE_SERVICE_KEYS.USER_TEMPLATES)).length, 30);
  await Promise.all([a.call('delete-template', { key: 'test-a-0' }), b.call('templates', { prefix: 'test-c', count: 5 })]);
  assert.equal(JSON.parse(await provider.getItem(CORE_SERVICE_KEYS.USER_TEMPLATES)).length, 34);
  await Promise.all([a.call('history', { prefix: 'a', count: 10 }), b.call('history', { prefix: 'b', count: 10 })]);
  assert.equal(JSON.parse(await provider.getItem(CORE_SERVICE_KEYS.PROMPT_HISTORY)).length, 20);
  await Promise.all([a.call('delete-chain', { key: 'a' }), b.call('history', { prefix: 'c', count: 5 })]);
  assert.equal(JSON.parse(await provider.getItem(CORE_SERVICE_KEYS.PROMPT_HISTORY)).length, 15);
});

test('SQLiteStorageProvider updateData consumes rejected async modifier without unhandledRejection', async t => {
  const { provider } = await fixture(t);
  await provider.setItem('async-guard', '1');
  let unhandled = 0;
  const onUnhandled = () => { unhandled++; };
  process.on('unhandledRejection', onUnhandled);
  t.after(() => process.off('unhandledRejection', onUnhandled));

  await assert.rejects(
    provider.updateData('async-guard', async () => {
      throw new Error('async-boom');
    }),
    /synchronous/,
  );
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(unhandled, 0);
  assert.equal(await provider.getItem('async-guard'), '1');
});

test('HistoryManager addIteration serializes concurrent iterations and detects deleted chains', async t => {
  const { file, provider } = await fixture(t);
  const peer = new SQLiteStorageProvider(file);
  try {
    const stubModelManager = { getModel: async () => undefined };
    const managerA = new HistoryManager(provider, stubModelManager);
    const managerB = new HistoryManager(peer, stubModelManager);

    const created = await managerA.createNewChain({
      id: 'root-1',
      originalPrompt: 'Original',
      optimizedPrompt: 'Optimized v1',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });

    const [resA, resB] = await Promise.all([
      managerA.addIteration({
        chainId: created.chainId,
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized iter A',
        modelKey: 'openai',
        templateId: 'tpl-1',
      }),
      managerB.addIteration({
        chainId: created.chainId,
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized iter B',
        modelKey: 'openai',
        templateId: 'tpl-1',
      }),
    ]);

    const finalChain = await managerA.getChain(created.chainId);
    assert.deepEqual(finalChain.versions.map(v => v.version), [1, 2, 3]);
    assert.equal(finalChain.versions[1].previousId, 'root-1');
    assert.equal(finalChain.versions[2].previousId, finalChain.versions[1].id);
    assert.notEqual(resA.currentRecord.version, resB.currentRecord.version);

    // Deleting the chain mid-flight prevents adding an orphaned iteration.
    await managerA.deleteChain(created.chainId);
    await assert.rejects(
      managerB.addIteration({
        chainId: created.chainId,
        originalPrompt: 'Original',
        optimizedPrompt: 'Should fail',
        modelKey: 'openai',
        templateId: 'tpl-1',
      }),
      error => error instanceof RecordNotFoundError,
    );
  } finally {
    await peer.close();
  }
});

test('PreferenceService clear removes persisted untouched and cross-connection keys', async t => {
  const { file, provider } = await fixture(t);
  const peer = new SQLiteStorageProvider(file);
  try {
    await provider.setItem('pref:untouched', JSON.stringify('preexisting'));
    const peerPref = new PreferenceService(peer);
    await peerPref.set('other-conn', 'from-peer');

    const freshPref = new PreferenceService(provider);
    await freshPref.set('touched', 'local');
    await freshPref.clear();

    assert.deepEqual(await freshPref.keys(), []);
    assert.equal(await provider.getItem('pref:untouched'), null);
    assert.equal(await provider.getItem('pref:other-conn'), null);
    assert.equal(await provider.getItem('pref:touched'), null);
  } finally {
    await peer.close();
  }
});

test('HistoryManager addIteration preserves root and chain consistency at 50-record retention limit on SQLite', async t => {
  const { provider } = await fixture(t);
  const manager = new HistoryManager(provider, { getModel: async () => undefined });
  const created = await manager.createNewChain({
    id: 'root-limit-1',
    originalPrompt: 'Original',
    optimizedPrompt: 'v1',
    type: 'optimize',
    modelKey: 'openai',
    templateId: 'tpl-1',
  });

  let chain = created;
  for (let version = 2; version <= 51; version++) {
    chain = await manager.addIteration({
      chainId: created.chainId,
      originalPrompt: 'Original',
      optimizedPrompt: `v${version}`,
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
  }

  assert.equal(chain.rootRecord.version, 1);
  assert.equal(chain.currentRecord.version, 51);
  assert.equal(chain.versions.length, 50);
  assert.equal(chain.versions[0].version, 1);
  assert.deepEqual(await manager.getChain(created.chainId), chain);
  assert.deepEqual(await manager.getIterationChain(chain.currentRecord.id), chain.versions);
  const allChains = await manager.getAllChains();
  assert.equal(allChains.length, 1);
  assert.equal(allChains[0].currentRecord.version, 51);
});

test('PreferenceService clear is atomic against concurrent SQLite peer batch updates', async t => {
  const { file, provider } = await fixture(t);
  const peer = new SQLiteStorageProvider(file);
  try {
    await provider.setItem('models', '["keep-me"]');
    const prefA = new PreferenceService(provider);

    for (let round = 0; round < 40; round++) {
      await provider.setItem('pref:a', JSON.stringify(`seed-${round}`));
      await provider.removeItem('pref:b');

      await Promise.all([
        prefA.clear(),
        peer.batchUpdate([
          { operation: 'set', key: 'pref:a', value: '"2"' },
          { operation: 'set', key: 'pref:b', value: '"2"' },
        ]),
      ]);

      const state = [await provider.getItem('pref:a'), await provider.getItem('pref:b')];
      const bothSurvived = state[0] === '"2"' && state[1] === '"2"';
      const bothCleared = state[0] === null && state[1] === null;
      assert.ok(bothSurvived || bothCleared, `Torn clear state at round ${round}: ${JSON.stringify(state)}`);
    }

    assert.equal(await provider.getItem('models'), '["keep-me"]');
  } finally {
    await peer.close();
  }
});

test('HistoryManager preserves roots of both active chains across 48 alternating iterations and record 51 on SQLite', async t => {
  const { provider } = await fixture(t);
  const manager = new HistoryManager(provider, { getModel: async () => undefined });
  const chainA = await manager.createNewChain({
    id: 'root-alt-a',
    originalPrompt: 'Original A',
    optimizedPrompt: 'A v1',
    type: 'optimize',
    modelKey: 'openai',
    templateId: 'tpl-1',
  });
  const chainB = await manager.createNewChain({
    id: 'root-alt-b',
    originalPrompt: 'Original B',
    optimizedPrompt: 'B v1',
    type: 'optimize',
    modelKey: 'openai',
    templateId: 'tpl-1',
  });

  for (let i = 0; i < 24; i++) {
    await manager.addIteration({
      chainId: chainA.chainId,
      originalPrompt: 'Original A',
      optimizedPrompt: `A v${i + 2}`,
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
    await manager.addIteration({
      chainId: chainB.chainId,
      originalPrompt: 'Original B',
      optimizedPrompt: `B v${i + 2}`,
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
  }

  assert.equal((await manager.getRecords()).length, 50);
  await manager.addIteration({
    chainId: chainA.chainId,
    originalPrompt: 'Original A',
    optimizedPrompt: 'A v26',
    modelKey: 'openai',
    templateId: 'tpl-1',
  });

  assert.equal((await manager.getRecords()).length, 50);
  const readA = await manager.getChain(chainA.chainId);
  const readB = await manager.getChain(chainB.chainId);
  assert.equal(readA.rootRecord.version, 1);
  assert.equal(readA.currentRecord.version, 26);
  assert.equal(readB.rootRecord.version, 1);
  assert.equal(readB.currentRecord.version, 25);
  const allChains = await manager.getAllChains();
  assert.deepEqual(allChains.map(c => c.chainId).sort(), [chainA.chainId, chainB.chainId].sort());
});
