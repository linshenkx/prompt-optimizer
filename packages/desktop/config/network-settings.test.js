const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { NetworkSettingsStore, normalizeNetworkSettings, matchesBypassRule } = require('./network-settings');

test('validates proxy origin and bounded hostname rules without accepting credentials or URLs as rules', () => {
  assert.deepEqual(normalizeNetworkSettings({ mode: 'manual', proxyUrl: ' http://localhost:7890/ ',
    bypassRules: [' LLM.Company.COM. ', '*.Company.com', '*.company.com'] }), {
    mode: 'manual', proxyUrl: 'http://localhost:7890', bypassRules: ['llm.company.com', '*.company.com'],
  });
  for (const proxyUrl of ['', 'socks5://localhost:7890', 'https://localhost:7890', 'http://user:secret@localhost:7890',
    'http://localhost:7890/path', 'http://localhost:7890/?token=secret']) {
    assert.throws(() => normalizeNetworkSettings({ mode: 'manual', proxyUrl, bypassRules: [] }),
      error => error.code === 'networkSettings.errors.invalidProxy' && !error.message.includes('secret'));
  }
  for (const bypassRules of [['https://company.com'], ['foo*.company.com'], ['*.'], ['company.com:8000'],
    ['bad_host'], new Array(101).fill('company.com')]) {
    assert.throws(() => normalizeNetworkSettings({ mode: 'system', proxyUrl: '', bypassRules }),
      error => error.code === 'networkSettings.errors.invalidRules');
  }
  assert.throws(() => normalizeNetworkSettings({ mode: 'unknown' }));
});

test('bypass rules match complete hosts or subdomains without matching lookalike suffixes', () => {
  const rules = ['llm.company.com', '*.internal.company.com'];
  assert.equal(matchesBypassRule('LLM.COMPANY.COM.', rules), true);
  assert.equal(matchesBypassRule('a.internal.company.com', rules), true);
  assert.equal(matchesBypassRule('deep.a.internal.company.com', rules), true);
  for (const host of ['company.com', 'internal.company.com', 'evilinternal.company.com', 'llm.company.com.evil']) {
    assert.equal(matchesBypassRule(host, rules), false);
  }
});

test('persists only machine settings, keeps the running snapshot until restart and supports reverting', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-network-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new NetworkSettingsStore(directory);
  assert.equal((await store.load()).saved.mode, 'system');
  const snapshot = await store.save({ mode: 'manual', proxyUrl: 'http://localhost:7890', bypassRules: ['llm.company.com'] });
  assert.equal(snapshot.active.mode, 'system');
  assert.equal(snapshot.restartRequired, true);
  snapshot.saved.bypassRules.push('unwanted.example');
  assert.deepEqual(store.snapshot().saved.bypassRules, ['llm.company.com']);
  assert.deepEqual(await fs.readdir(directory), ['model-network-settings.json']);
  const restarted = new NetworkSettingsStore(directory);
  assert.equal((await restarted.load()).active.mode, 'manual');
  assert.equal(restarted.snapshot().restartRequired, false);
  await store.save({ mode: 'system', proxyUrl: 'http://localhost:7890', bypassRules: [] });
  assert.equal(store.snapshot().restartRequired, false);
});

test('invalid settings leave the previous file untouched and concurrent saves are serialized', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-network-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new NetworkSettingsStore(directory);
  await Promise.all([
    store.save({ mode: 'direct', proxyUrl: '', bypassRules: [] }),
    store.save({ mode: 'manual', proxyUrl: 'http://localhost:7890', bypassRules: [] }),
  ]);
  const before = await fs.readFile(store.filePath, 'utf8');
  await assert.rejects(store.save({ mode: 'manual', proxyUrl: 'invalid', bypassRules: [] }));
  assert.equal(await fs.readFile(store.filePath, 'utf8'), before);
  assert.equal(store.snapshot().saved.mode, 'manual');
});
