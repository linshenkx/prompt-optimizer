const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { EventEmitter } = require('node:events');

/**
 * 使用可控的 Electron IPC 替身加载 preload，并返回暴露给前端的桥接接口。
 */
function loadPreloadWithElectronMock(ipcRenderer) {
  const preloadPath = path.resolve(__dirname, '../preload.js');
  const originalLoad = Module._load;
  let api;

  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') {
      return {
        contextBridge: {
          exposeInMainWorld: (_name, exposedApi) => {
            api = exposedApi;
          },
        },
        ipcRenderer,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[preloadPath];
    require(preloadPath);
    return api;
  } finally {
    Module._load = originalLoad;
    delete require.cache[preloadPath];
  }
}

test('preload AbortSignal cancels an active stream and resolves the caller promptly', async () => {
  const calls = [];
  const listeners = new Map();
  const ipcRenderer = {
    on(channel, listener) {
      listeners.set(`${channel}:${listener.name || listeners.size}`, listener);
    },
    removeListener(channel, listener) {
      listeners.delete(`${channel}:${listener.name || 0}`);
    },
    invoke(channel, ...args) {
      calls.push([channel, ...args]);
      if (channel === 'stream-cancel') {
        return Promise.resolve({ success: true, data: { cancelled: true } });
      }
      return new Promise(() => {});
    },
  };
  const api = loadPreloadWithElectronMock(ipcRenderer);
  const controller = new AbortController();

  const pending = api.llm.sendMessageStream([], 'provider', {}, controller.signal);
  controller.abort();

  await assert.rejects(
    pending,
    (error) => error && error.code === 'IPC_STREAM_CANCELLED',
  );
  assert.equal(calls[0][0], 'llm-sendMessageStream');
  assert.equal(calls[1][0], 'stream-cancel');
  assert.match(calls[1][1], /^stream_[A-Za-z0-9_]+$/);
  assert.equal(listeners.size, 0);
});

test('preload forwards Prompt AbortSignal to the main-process cancellation channel', async () => {
  const calls = [];
  const ipcRenderer = new EventEmitter();
  ipcRenderer.invoke = (channel, ...args) => {
    calls.push([channel, ...args]);
    if (channel === 'stream-cancel') {
      return Promise.resolve({ success: true, data: { cancelled: true } });
    }
    return new Promise(() => {});
  };
  const api = loadPreloadWithElectronMock(ipcRenderer);
  const controller = new AbortController();

  const pending = api.prompt.optimizePromptStream({}, {}, controller.signal);
  controller.abort();

  await assert.rejects(
    Promise.race([
      pending,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Prompt cancellation timed out')), 100)),
    ]),
    (error) => error && error.code === 'IPC_STREAM_CANCELLED',
  );
  assert.equal(calls[0][0], 'prompt-optimizePromptStream');
  assert.equal(calls[1][0], 'stream-cancel');
  assert.equal(ipcRenderer.listenerCount('stream-token-' + calls[1][1]), 0);
});

test('preload on/off and disposer remove the exact wrapped listener', () => {
  const ipcRenderer = new EventEmitter();
  ipcRenderer.invoke = async () => ({ success: true, data: null });
  const api = loadPreloadWithElectronMock(ipcRenderer);
  let callCount = 0;

  /** 记录前端实际收到的更新事件次数。 */
  const callback = () => {
    callCount += 1;
  };

  const dispose = api.on('update-error', callback);
  assert.equal(typeof dispose, 'function');
  ipcRenderer.emit('update-error', {}, 'first');
  assert.equal(callCount, 1);

  api.off('update-error', callback);
  ipcRenderer.emit('update-error', {}, 'second');
  assert.equal(callCount, 1);
  assert.equal(ipcRenderer.listenerCount('update-error'), 0);

  const disposeAgain = api.on('update-error', callback);
  disposeAgain();
  assert.equal(ipcRenderer.listenerCount('update-error'), 0);
});
