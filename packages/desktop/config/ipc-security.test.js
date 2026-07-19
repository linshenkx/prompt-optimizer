const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createIpcError,
  isTrustedRendererSender,
  isValidStreamId,
  registerSecureIpcHandler,
} = require('./ipc-security');

const options = {
  isDevelopment: false,
  packagedRoot: 'C:/app/web-dist',
  devServerUrl: 'http://localhost:18181',
};

function createEvent({
  id = 1,
  url = 'file:///C:/app/web-dist/index.html',
  isMainFrame = true,
} = {}) {
  return {
    sender: {
      id,
      getURL: () => url,
      isDestroyed: () => false,
    },
    senderFrame: {
      url,
      isMainFrame,
    },
  };
}

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  };
}

test('IPC sender trust accepts only the app main frame', () => {
  assert.equal(isTrustedRendererSender(createEvent(), options), true);
  assert.equal(isTrustedRendererSender(createEvent({ isMainFrame: false }), options), false);
  assert.equal(
    isTrustedRendererSender(createEvent({ url: 'file:///C:/Windows/System32/notepad.exe' }), options),
    false,
  );
  assert.equal(
    isTrustedRendererSender(createEvent({ url: 'https://attacker.example' }), options),
    false,
  );
});

test('IPC sender trust tolerates missing senderFrame metadata on packaged file URLs', () => {
  const eventWithoutFrame = {
    sender: {
      id: 7,
      getURL: () => 'file:///C:/app/web-dist/index.html',
      isDestroyed: () => false,
    },
  };
  assert.equal(isTrustedRendererSender(eventWithoutFrame, options), true);

  const eventWithUnknownMainFrame = createEvent();
  delete eventWithUnknownMainFrame.senderFrame.isMainFrame;
  assert.equal(isTrustedRendererSender(eventWithUnknownMainFrame, options), true);
});

test('IPC sender trust accepts only the configured development origin', () => {
  const developmentOptions = { ...options, isDevelopment: true };

  assert.equal(
    isTrustedRendererSender(createEvent({ url: 'http://localhost:18181/workspace' }), developmentOptions),
    true,
  );
  assert.equal(
    isTrustedRendererSender(createEvent({ url: 'http://localhost:5173/workspace' }), developmentOptions),
    false,
  );
});

test('stream identifiers are bounded and use a restricted alphabet', () => {
  assert.equal(isValidStreamId('stream_abc-123'), true);
  assert.equal(isValidStreamId('stream with spaces'), false);
  assert.equal(isValidStreamId('../stream'), false);
  assert.equal(isValidStreamId('a'.repeat(97)), false);
});

test('secure IPC handler rejects untrusted senders with the shared error envelope', async () => {
  const ipcMain = createIpcMain();
  let called = false;

  registerSecureIpcHandler(ipcMain, 'sensitive-action', async () => {
    called = true;
    return 'unreachable';
  }, { senderOptions: options });

  const result = await ipcMain.handlers.get('sensitive-action')(
    createEvent({ url: 'https://attacker.example' }),
  );

  assert.equal(called, false);
  assert.deepEqual(result, {
    success: false,
    error: {
      code: 'IPC_UNTRUSTED_SENDER',
      message: 'IPC request sender is not trusted',
    },
  });
});

test('secure IPC handler validates arguments and normalizes successful results', async () => {
  const ipcMain = createIpcMain();

  registerSecureIpcHandler(ipcMain, 'validated-action', async (_event, value) => value.toUpperCase(), {
    senderOptions: options,
    validateArgs: ([value]) => {
      if (typeof value !== 'string') {
        throw createIpcError('IPC_INVALID_ARGUMENT', 'Invalid IPC request arguments');
      }
    },
  });

  const handler = ipcMain.handlers.get('validated-action');
  assert.deepEqual(await handler(createEvent(), 'ok'), { success: true, data: 'OK' });
  assert.deepEqual(await handler(createEvent(), 42), {
    success: false,
    error: {
      code: 'IPC_INVALID_ARGUMENT',
      message: 'Invalid IPC request arguments',
    },
  });
});
