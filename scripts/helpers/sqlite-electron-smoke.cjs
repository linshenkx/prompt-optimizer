const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createRequire } = require('node:module');
const { app } = require('electron');

const [directory, appArchive] = process.argv.slice(2);
if (!directory) throw new Error('An isolated test directory is required');
assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
assert.ok(path.basename(directory).startsWith('po-electron-storage-'));
app.setPath('userData', directory);
app.setPath('sessionData', directory);
assert.equal(app.getPath('userData'), directory);
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const core = appArchive
    ? createRequire(path.join(appArchive, 'main.js'))('@prompt-optimizer/core/node')
    : createRequire(path.resolve(__dirname, '../../packages/desktop/main.js'))('@prompt-optimizer/core/node');
  const source = path.join(directory, core.LEGACY_STORAGE_FILENAME);
  const original = fs.readFileSync(source, 'utf8');
  const { provider, migration } = await core.openDesktopStorage(app.getPath('userData'));
  try {
    assert.equal(migration.source, 'json');
    assert.equal(await provider.getItem('synthetic'), 'desktop-main');
    await provider.updateData('counter', n => (n ?? 0) + 1);
    assert.equal(await provider.getItem('counter'), '1');
    assert.equal(fs.readFileSync(source, 'utf8'), original);
    assert.equal(fs.existsSync(`${source}.backup`), false);
  } finally { await provider.close(); }
  console.log(JSON.stringify({ ok: true, packaged: !!appArchive, node: process.versions.node, electron: process.versions.electron, sqlite: process.versions.sqlite }));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
