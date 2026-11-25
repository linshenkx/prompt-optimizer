const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const net = require('node:net');

for (const platform of ['linux', 'darwin']) {
  test(platform + ' registers a PID without a pipe and clears only its own marker', async t => {
    const server = t.mock.method(net, 'createServer', () => { throw new Error('Unexpected pipe'); });
    const { installDesktopResources } = require('./desktop-resources');
    const handlers = new Map();
    const entries = new Map();
    const storage = {
      async setItem(key, value) { entries.set(key, value); },
      async compareAndSetItem(key, expected, value) {
        if (entries.get(key) !== expected) return false;
        entries.set(key, value);
        return true;
      },
    };
    installDesktopResources({ handle: (name, handler) => handlers.set(name, handler) }, storage, platform);
    const key = 'mcp:renderer:resources';
    let previous;
    for (const replaced of [false, true]) {
      const sender = Object.assign(new EventEmitter(), { isDestroyed: () => false });
      assert.equal(await handlers.get('desktop-resources-register')({ sender }), true);
      const descriptor = JSON.parse(entries.get(key));
      assert.deepEqual(Object.keys(descriptor).sort(), ['instanceId', 'pid']);
      assert.equal(descriptor.pid, process.pid);
      assert.ok(descriptor.instanceId && descriptor.instanceId !== previous);
      previous = descriptor.instanceId;
      const newer = JSON.stringify({ pid: process.pid, instanceId: 'newer-instance' });
      if (replaced) entries.set(key, newer);
      sender.emit('destroyed');
      assert.equal(entries.get(key), replaced ? newer : null);
    }
    assert.equal(server.mock.callCount(), 0);
  });
}
