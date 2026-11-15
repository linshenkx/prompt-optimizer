const { SQLiteStorageProvider, openDesktopStorage } = require('../../packages/core/dist/node.cjs');
const path = require('node:path');

async function main() {
  const [directory, command] = process.argv.slice(2);
  if (command === 'io-EACCES' || command === 'io-EIO') {
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const source = path.join(directory, 'prompt-optimizer-data.json');
    const originalRead = fs.readFileSync;
    let backupReads = 0;
    fs.readFileSync = (file, ...args) => {
      if (file === source) throw Object.assign(new Error('Synthetic filesystem fault'), { code: command.slice(3) });
      if (file === `${source}.backup`) backupReads++;
      return originalRead(file, ...args);
    };
    try {
      await assert.rejects(openDesktopStorage(directory), error => error.operation === 'read' && /Cannot read legacy storage/.test(error.message));
      assert.equal(backupReads, 0);
      process.send({ event: 'io-refused', code: command.slice(3), backupReads });
    } finally { fs.readFileSync = originalRead; }
    process.disconnect();
  } else if (command === 'interrupt') {
    const provider = new SQLiteStorageProvider(path.join(directory, 'prompt-optimizer-data.sqlite'));
    const entries = new Map([['first', 'uncommitted'], ['second', 'uncommitted']]);
    entries[Symbol.iterator] = function* () {
      yield ['first', 'uncommitted'];
      process.send({ event: 'partial' });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);
      yield ['second', 'uncommitted'];
    };
    await provider.initializeFromLegacy(() => ({ source: 'json', entries }));
    await provider.close();
  } else {
    const { provider, migration } = await openDesktopStorage(directory);
    await provider.close();
    process.send({ event: 'complete', migration, pid: process.pid, node: process.versions.node, electron: process.versions.electron });
    process.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; process.disconnect(); });
