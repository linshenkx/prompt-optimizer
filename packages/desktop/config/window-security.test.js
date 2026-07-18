const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  installMainFrameNavigationGuard,
  isAllowedMainFrameNavigation,
} = require('./window-security');

function createWebContents() {
  const webContents = new EventEmitter();
  webContents.setWindowOpenHandler = (handler) => {
    webContents.windowOpenHandler = handler;
  };
  return webContents;
}

test('production navigation allows only packaged files under the application root', () => {
  const options = {
    isDevelopment: false,
    packagedRoot: 'C:/app/web-dist',
    devServerUrl: 'http://localhost:18181',
  };

  assert.equal(isAllowedMainFrameNavigation('file:///C:/app/web-dist/index.html', options), true);
  assert.equal(isAllowedMainFrameNavigation('file:///C:/app/web-dist/assets/app.js', options), true);
  assert.equal(isAllowedMainFrameNavigation('file:///C:/Windows/System32/notepad.exe', options), false);
  assert.equal(isAllowedMainFrameNavigation('https://attacker.example', options), false);
});

test('development navigation allows only the configured development server origin', () => {
  const options = {
    isDevelopment: true,
    packagedRoot: 'C:/app/web-dist',
    devServerUrl: 'http://localhost:18181',
  };

  assert.equal(isAllowedMainFrameNavigation('http://localhost:18181/workspace', options), true);
  assert.equal(isAllowedMainFrameNavigation('http://localhost:5173/workspace', options), false);
  assert.equal(isAllowedMainFrameNavigation('https://attacker.example', options), false);
});

test('navigation guard prevents untrusted top-level navigation and opens only safe external links', async () => {
  const webContents = createWebContents();
  const openedUrls = [];
  installMainFrameNavigationGuard(webContents, {
    isDevelopment: false,
    packagedRoot: 'C:/app/web-dist',
    devServerUrl: 'http://localhost:18181',
    openExternal: async (url) => openedUrls.push(url),
  });

  let prevented = false;
  webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } }, 'https://docs.example');
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(prevented, true);
  assert.deepEqual(openedUrls, ['https://docs.example']);
  assert.deepEqual(webContents.windowOpenHandler({ url: 'javascript:alert(1)' }), { action: 'deny' });
  assert.deepEqual(webContents.windowOpenHandler({ url: 'https://docs.example/new' }), { action: 'deny' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(openedUrls, ['https://docs.example', 'https://docs.example/new']);
});
