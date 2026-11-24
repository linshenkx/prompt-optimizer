let nextRequestId = 0;

function requestWorkspaceSave(ipcMain, win, timeoutMs) {
  if (!win || win.isDestroyed()) return Promise.resolve();
  const contents = win.webContents;
  const requestId = ++nextRequestId;

  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timeout);
      contents.removeListener('destroyed', onDestroyed);
      ipcMain.removeListener('workspace-save-reply', onReply);
      if (error) reject(error);
      else resolve();
    };
    const onDestroyed = () => finish(new Error('Workspace window was closed before it could save'));
    const onReply = (event, id, saved) => {
      if (id !== requestId || event.sender !== contents || event.senderFrame !== contents.mainFrame) return;
      finish(saved === true ? undefined : new Error('Workspace changes could not be saved'));
    };
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for the workspace to save')), timeoutMs);
    contents.once('destroyed', onDestroyed);
    ipcMain.on('workspace-save-reply', onReply);
    try {
      contents.send('workspace-save-request', requestId);
    } catch (error) {
      finish(error);
    }
  });
}

function createShutdownController({ app, getWindow, save, confirmDiscard, isInstallingUpdate }) {
  let pending;
  let quitRequested = false;
  let approved = false;

  const intercept = (event, quitApp) => {
    if (approved || isInstallingUpdate()) return;
    event.preventDefault();
    quitRequested ||= quitApp;
    if (pending) return pending;

    const win = getWindow();
    pending = Promise.resolve().then(async () => {
      let discard = false;
      try {
        await save(win);
      } catch (error) {
        console.error('[DESKTOP] Failed to save before exiting:', error);
        discard = await confirmDiscard(win);
        if (!discard) return;
      }

      approved = true;
      if (discard && win && !win.isDestroyed()) win.destroy();
      if (quitRequested) app.quit();
      else if (win && !win.isDestroyed()) win.close();
    }).catch(error => {
      approved = false;
      console.error('[DESKTOP] Could not finish closing:', error);
    }).finally(() => {
      pending = undefined;
      quitRequested = false;
    });
    return pending;
  };

  return {
    onClose: (event) => intercept(event, false),
    onQuit: (event) => intercept(event, true),
    resetApproval: () => { approved = false; },
  };
}

function createWillQuitStorageCloser({ app, getStorage, onError } = {}) {
  let closePromise;
  let closed = false;

  return {
    onWillQuit(event) {
      if (closed) return;
      const storage = typeof getStorage === 'function' ? getStorage() : undefined;
      if (!storage || typeof storage.close !== 'function') return;

      event.preventDefault();
      if (!closePromise) {
        let closing;
        try {
          closing = Promise.resolve(storage.close());
        } catch (error) {
          closing = Promise.reject(error);
        }
        closePromise = closing
          .catch((error) => {
            if (typeof onError === 'function') onError(error);
          })
          .finally(() => {
            closed = true;
            setImmediate(() => app.quit());
          });
      }
      return closePromise;
    },
    markClosed() {
      closed = true;
    },
  };
}

module.exports = { createShutdownController, createWillQuitStorageCloser, requestWorkspaceSave };
