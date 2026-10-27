const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createStreamRegistry } = require('../stream-runtime');

test('cancellation belongs to the originating renderer and supports early aborts', () => {
  const registry = createStreamRegistry(), a = new EventEmitter(), b = new EventEmitter();
  const request = registry.begin(a, 'same-id');
  registry.cancel(b, 'same-id');
  assert.equal(request.signal.aborted, false);
  registry.cancel(a, 'same-id');
  assert.equal(request.signal.aborted, true);
  request.release();
  const early = registry.begin(b, 'same-id');
  assert.equal(early.signal.aborted, true);
  early.release();
  assert.equal(a.listenerCount('destroyed'), 0);
  assert.equal(b.listenerCount('destroyed'), 0);
});

test('closing a renderer aborts all its concurrent requests and releases listeners', () => {
  const registry = createStreamRegistry(), sender = new EventEmitter();
  const streams = Array.from({ length: 4 }, (_, index) => registry.begin(sender, String(index)));
  sender.emit('destroyed');
  streams.forEach(stream => { assert.equal(stream.signal.aborted, true); stream.release(); });
  assert.equal(sender.listenerCount('destroyed'), 0);
});

test('repeated cleanup cannot remove a subsequent stream owner', () => {
  const registry = createStreamRegistry(), sender = new EventEmitter();
  const old = registry.begin(sender, 'old');
  old.release();
  const current = registry.begin(sender, 'new');
  old.release();
  registry.cancel(sender, 'new');
  assert.equal(current.signal.aborted, true);
  current.release();
});
