const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createShutdownController, createWillQuitStorageCloser, requestWorkspaceSave } = require('./shutdown');

function harness({ save = async () => {}, discard = false, updating = false } = {}) {
  let saves = 0;
  let closed = 0;
  let quit = 0;
  let destroyed = false;
  const event = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
  const win = {
    close() {
      const close = event();
      controller.onClose(close);
      if (!close.prevented) closed++;
    },
    isDestroyed: () => destroyed,
    destroy() { destroyed = true; },
  };
  const app = {
    quit() {
      const request = event();
      controller.onQuit(request);
      if (!request.prevented) {
        quit++;
        if (!destroyed) win.close();
      }
    },
  };
  const controller = createShutdownController({
    app, getWindow: () => win,
    save: (window) => { assert.equal(window, win); saves++; return save(); },
    confirmDiscard: async () => discard,
    isInstallingUpdate: () => updating,
  });
  return { controller, event, get saves() { return saves; }, get closed() { return closed; }, get quit() { return quit; }, get destroyed() { return destroyed; } };
}

test('close waits for the renderer and storage checkpoint before closing once', async () => {
  let finish;
  const desktop = harness({ save: () => new Promise(resolve => { finish = resolve; }) });
  const close = desktop.event();
  const saving = desktop.controller.onClose(close);
  await Promise.resolve();
  assert.equal(close.prevented, true);
  assert.equal(desktop.closed, 0);
  finish();
  await saving;
  assert.equal(desktop.saves, 1);
  assert.equal(desktop.closed, 1);
});

test('an app quit requested during a pending window close uses the same checkpoint', async () => {
  let finish;
  const desktop = harness({ save: () => new Promise(resolve => { finish = resolve; }) });
  const pending = desktop.controller.onClose(desktop.event());
  await Promise.resolve();
  const quitting = desktop.event();
  assert.equal(desktop.controller.onQuit(quitting), pending);
  assert.equal(quitting.prevented, true);
  finish();
  await pending;
  assert.equal(desktop.saves, 1);
  assert.equal(desktop.quit, 1);
  assert.equal(desktop.closed, 1);
});

test('a failed checkpoint keeps the window open and allows retry', async () => {
  let fail = true;
  const desktop = harness({ save: async () => { if (fail) throw new Error('Disk unavailable'); } });
  await desktop.controller.onClose(desktop.event());
  assert.equal(desktop.closed, 0);
  assert.equal(desktop.destroyed, false);
  fail = false;
  await desktop.controller.onClose(desktop.event());
  assert.equal(desktop.closed, 1);
});

test('an explicit discard permits exit after a checkpoint failure', async () => {
  const desktop = harness({ save: async () => { throw new Error('Disk unavailable'); }, discard: true });
  await desktop.controller.onQuit(desktop.event());
  assert.equal(desktop.destroyed, true);
  assert.equal(desktop.quit, 1);
});

test('installer does not repeat its already completed checkpoint', () => {
  const desktop = harness({ updating: true });
  const event = desktop.event();
  assert.equal(desktop.controller.onClose(event), undefined);
  assert.equal(desktop.controller.onQuit(event), undefined);
  assert.equal(event.prevented, false);
  assert.equal(desktop.saves, 0);
});

function renderer() {
  const ipcMain = new EventEmitter();
  const contents = new EventEmitter();
  contents.mainFrame = {};
  let id;
  contents.send = (channel, requestId) => {
    assert.equal(channel, 'workspace-save-request');
    id = requestId;
  };
  const request = (timeout = 1000) => requestWorkspaceSave(ipcMain, { webContents: contents, isDestroyed: () => false }, timeout);
  return { ipcMain, contents, request, get id() { return id; } };
}

test('only a reply from the requesting window and main frame completes the checkpoint', async () => {
  const desktop = renderer();
  const { ipcMain, contents } = desktop;
  const pending = desktop.request();
  const id = desktop.id;
  ipcMain.emit('workspace-save-reply', { sender: contents, senderFrame: {} }, id, false);
  ipcMain.emit('workspace-save-reply', { sender: contents, senderFrame: contents.mainFrame }, id, true);
  await pending;
  assert.equal(ipcMain.listenerCount('workspace-save-reply'), 0);
});

test('a renderer refusal or an unresponsive renderer rejects the checkpoint', async () => {
  const desktop = renderer();
  const pending = desktop.request();
  desktop.ipcMain.emit('workspace-save-reply', { sender: desktop.contents, senderFrame: desktop.contents.mainFrame }, desktop.id, false);
  await assert.rejects(pending, /could not be saved/);
  await assert.rejects(desktop.request(5), /Timed out/);
  assert.equal(desktop.ipcMain.listenerCount('workspace-save-reply'), 0);
});

test('will-quit prevents secondary quits while storage close is still pending', async () => {
  let finishClose;
  let closeCalls = 0;
  let quitCalls = 0;
  const event = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
  const app = { quit() { quitCalls++; } };
  const closer = createWillQuitStorageCloser({
    app,
    getStorage: () => ({
      close() {
        closeCalls++;
        return new Promise(resolve => { finishClose = resolve; });
      },
    }),
  });

  const first = event();
  const second = event();
  const pendingFirst = closer.onWillQuit(first);
  const pendingSecond = closer.onWillQuit(second);
  assert.equal(first.prevented, true);
  assert.equal(second.prevented, true);
  assert.equal(closeCalls, 1);
  assert.equal(pendingFirst, pendingSecond);

  finishClose();
  await pendingFirst;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(quitCalls, 1);

  const finalQuit = event();
  closer.onWillQuit(finalQuit);
  assert.equal(finalQuit.prevented, false);
});

test('clearing an updater quit flag after failure restores ordinary workspace saving', async () => {
  let updating = true;
  let saves = 0;
  let quitCalls = 0;
  const event = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
  const win = { isDestroyed: () => true };
  const controller = createShutdownController({
    app: { quit() { quitCalls++; } },
    getWindow: () => win,
    save: async () => { saves++; },
    confirmDiscard: async () => false,
    isInstallingUpdate: () => updating,
  });

  const skipped = event();
  controller.onQuit(skipped);
  assert.equal(skipped.prevented, false);
  assert.equal(saves, 0);

  // Mirrors autoUpdater error clearing isUpdaterQuitting after failed install start.
  updating = false;
  await controller.onQuit(event());
  assert.equal(saves, 1);
  assert.equal(quitCalls, 1);
});
