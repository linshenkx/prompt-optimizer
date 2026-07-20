const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  createOwnedStreamHandlers,
  createStreamRegistry,
} = require('./stream-registry');

/** 创建具备 Electron WebContents 最小事件接口的 renderer sender 替身。 */
function createSender(id) {
  const sent = [];
  const sender = new EventEmitter();
  sender.id = id;
  sender.sent = sent;
  sender.isDestroyed = () => false;
  sender.send = (...args) => sent.push(args);
  return sender;
}

test('stream cancellation aborts the owner controller and stops further renderer events', () => {
  const registry = createStreamRegistry();
  const sender = createSender(1);
  const stream = registry.register(sender, 'stream_owner');
  const handlers = createOwnedStreamHandlers({
    registry,
    sender,
    streamId: 'stream_owner',
    channels: { token: 'stream-token', finish: 'stream-finish', error: 'stream-error' },
  });

  handlers.onToken('before-cancel');
  assert.deepEqual(sender.sent, [['stream-token-stream_owner', 'before-cancel']]);

  assert.equal(registry.cancel(sender, 'stream_owner'), true);
  assert.equal(stream.signal.aborted, true);

  handlers.onToken('after-cancel');
  handlers.onComplete();
  assert.deepEqual(sender.sent, [['stream-token-stream_owner', 'before-cancel']]);
  assert.equal(registry.has('stream_owner'), false);
});

test('a non-owner cannot cancel an active stream', () => {
  const registry = createStreamRegistry();
  const owner = createSender(1);
  const otherSender = createSender(2);
  registry.register(owner, 'stream_owner');

  assert.throws(
    () => registry.cancel(otherSender, 'stream_owner'),
    (error) => error && error.code === 'IPC_STREAM_NOT_OWNER',
  );
  assert.equal(registry.has('stream_owner'), true);
});

test('stream completion sends only to the registered sender and clears ownership', () => {
  const registry = createStreamRegistry();
  const owner = createSender(1);
  const unrelatedWindow = createSender(2);
  registry.register(owner, 'stream_complete');
  const handlers = createOwnedStreamHandlers({
    registry,
    sender: owner,
    streamId: 'stream_complete',
    channels: { finish: 'stream-finish', error: 'stream-error' },
  });

  handlers.onComplete();

  assert.deepEqual(owner.sent, [['stream-finish-stream_complete']]);
  assert.deepEqual(unrelatedWindow.sent, []);
  assert.equal(registry.has('stream_complete'), false);
});

test('stream registry binds one destroyed listener per sender and cancels active work on teardown', () => {
  const registry = createStreamRegistry();
  const sender = createSender(1);

  for (let index = 0; index < 12; index += 1) {
    const streamId = `stream_completed_${index}`;
    registry.register(sender, streamId);
    registry.complete(sender, streamId);
  }

  const activeStream = registry.register(sender, 'stream_active');
  assert.equal(sender.listenerCount('destroyed'), 1);

  sender.emit('destroyed');

  assert.equal(activeStream.signal.aborted, true);
  assert.equal(registry.has('stream_active'), false);
  assert.equal(sender.listenerCount('destroyed'), 0);
});
