const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the registered main-process handler without starting Electron.
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const start = source.indexOf("app.on('before-quit', async (event) => {");
const end = source.indexOf('// Quit when all windows are closed', start);
assert.ok(start >= 0 && end > start);

function harness(flush, updater = false) {
  let handler;
  let flushCount = 0;
  let exitCount = 0;
  const pending = [];
  const immediates = [];
  const context = {
    app: {
      on(name, callback) { assert.equal(name, 'before-quit'); handler = callback; },
      quit() {
        let prevented = false;
        const result = handler({preventDefault() { prevented = true; }});
        if (!prevented) exitCount++;
        pending.push(result);
      },
    },
    isUpdaterQuitting: updater,
    isQuitting: false,
    storageProvider: {flush() { flushCount++; return flush(); }},
    setupEmergencyExit() {},
    MAX_SAVE_TIME: 5000,
    emergencyExitTimer: null,
    setTimeout() { return {}; },
    clearTimeout() {},
    setImmediate(callback) { immediates.push(callback); },
    console: {log() {}, warn() {}, error() {}},
    process: {exit() { exitCount++; }},
  };
  vm.runInNewContext(source.slice(start, end), context);
  return {
    quit: context.app.quit,
    get flushCount() { return flushCount; },
    get exitCount() { return exitCount; },
    async settle() { for (const operation of pending) await operation; },
    async resumeQuit() {
      assert.equal(immediates.length, 1);
      immediates.shift()();
      for (const operation of pending) await operation;
      assert.equal(immediates.length, 0, 'quit must not schedule another save cycle');
    },
  };
}

test('normal quit saves once and allows the resumed quit to exit', async () => {
  const app = harness(async () => {});
  app.quit();
  await app.settle();
  await app.resumeQuit();
  assert.equal(app.flushCount, 1);
  assert.equal(app.exitCount, 1);
});

test('a failed save still allows the resumed quit to exit', async () => {
  const app = harness(async () => { throw new Error('disk unavailable'); });
  app.quit();
  await app.settle();
  await app.resumeQuit();
  assert.equal(app.flushCount, 1);
  assert.equal(app.exitCount, 1);
});

test('another quit during a pending save does not start another save', async () => {
  let finish;
  const app = harness(() => new Promise(resolve => { finish = resolve; }));
  app.quit();
  app.quit();
  assert.equal(app.flushCount, 1);
  finish();
  await app.settle();
  await app.resumeQuit();
  assert.equal(app.flushCount, 1);
});

test('updater quit exits immediately without another storage save', async () => {
  const app = harness(async () => {}, true);
  app.quit();
  await app.settle();
  assert.equal(app.flushCount, 0);
  assert.equal(app.exitCount, 1);
});
