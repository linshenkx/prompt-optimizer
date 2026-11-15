// Run only with the workspace's development Electron, inside the generated launcher app.
// Nothing from the desktop application is loaded until all guards below are installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Module = require('node:module');
const electron = require('electron');
const { createBoundary, installFilesystemGuards } = require('./desktop-main-isolation.cjs');
const exerciseDesktopBusiness = require('./desktop-main-business.cjs');

const [root, phase] = process.argv.slice(2);
assert.ok(['first', 'restart'].includes(phase));
assert.equal(path.dirname(__dirname), root);
assert.equal(fs.realpathSync(root), root);
assert.ok(path.basename(root).startsWith('po-desktop-main-r2-'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const mainPath = path.join(root, 'app/packages/desktop/main.js');
assert.equal(createHash('sha256').update(fs.readFileSync(mainPath)).digest('hex'), manifest.mainSha256);
assert.equal(fs.realpathSync(path.join(root, 'app/packages/desktop/node_modules')), manifest.dependencyRoot);

const audit = {
  phase, mainSha256: manifest.mainSha256, mainLoaded: false,
  readable: 0, writable: 0, violations: [], events: [], dotenv: [], windows: 0,
  ipcVerified: false, closeCompleted: false, flushCompleted: false, requests: 0,
};
function record(event) {
  audit.events.push(event);
  fs.writeFileSync(path.join(root, `${phase}-progress.json`), JSON.stringify(audit, null, 2));
}
const boundary = createBoundary(root, [manifest.sourceRoot]);
const { app } = electron;
assert.equal(app.isPackaged, false, 'Only development Electron may run this bootstrap');
const exit = app.exit.bind(app);
const stderr = process.stderr.write.bind(process.stderr);
function fail(error) {
  stderr(`Desktop main fixture failed: ${error.message}\n`);
  try { fs.writeFileSync(path.join(root, `${phase}-failure.json`), JSON.stringify({ ...audit, failure: error.message }, null, 2)); } catch {}
  exit(1);
}
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

// Configure native Electron/Chromium paths before ConsoleLogger, dotenv or storage imports.
const paths = {};
for (const name of ['home', 'appData', 'userData', 'sessionData', 'temp', 'desktop', 'documents', 'downloads', 'music', 'pictures', 'videos', 'recent', 'logs', 'crashDumps']) {
  const directory = path.join(root, 'profile', name);
  fs.mkdirSync(directory, { recursive: true });
  app.setPath(name, directory);
  paths[name] = directory;
}
app.setAppLogsPath(paths.logs);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('disk-cache-dir', path.join(root, 'profile/cache'));
app.commandLine.appendSwitch('crash-dumps-dir', paths.crashDumps);
const getPath = app.getPath.bind(app);
app.getPath = name => {
  const value = getPath(name);
  if (!['assets', 'exe', 'module'].includes(name)) boundary.writable(value);
  return value;
};
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => { assert.ok(typeof value === 'string' && path.isAbsolute(value)); boundary.writable(value); return setPath(name, value); };
const setLogsPath = app.setAppLogsPath.bind(app);
app.setAppLogsPath = value => { assert.ok(typeof value === 'string' && path.isAbsolute(value)); boundary.writable(value); return setLogsPath(value); };
for (const name of Object.keys(paths)) assert.equal(app.getPath(name), paths[name]);
for (const name of ['APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOME', 'TEMP', 'TMP']) boundary.writable(process.env[name]);
assert.equal(Object.keys(process.env).some(key => /^(VITE_|OPENAI_|ANTHROPIC_|GOOGLE_|GEMINI_|PORTABLE_|DOTENV_|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)/i.test(key)), false);

// Preflight rejections have no I/O: a boundary escape must fail before the native call.
const outside = path.join(root, '..', 'refused-fixture-path');
assert.throws(() => app.setPath('userData', outside), /outside fixture/);
assert.throws(() => app.setAppLogsPath(outside), /outside fixture/);
assert.throws(() => app.setPath('userData', path.join(root, 'app/packages/desktop/node_modules/refused-write')), /outside fixture/);
assert.throws(() => boundary.readable(path.join(manifest.sourceRoot, '.env.local')), /read outside/);
installFilesystemGuards(boundary, audit);
assert.throws(() => fs.writeFileSync(outside, 'must-not-write'), /outside fixture/);
audit.violations = [];
audit.preflightRejections = 5;
audit.paths = Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, path.relative(root, value)]));
record('isolation-ready');

function forbidden(operation) {
  return () => {
    audit.requests++;
    audit.violations.push({ operation });
    throw new Error(`Isolation: ${operation} refused`);
  };
}
// Deny Node requests, model networking, subprocesses, updates and external navigation.
global.fetch = forbidden('fetch');
require('node:net').Socket.prototype.connect = forbidden('socket.connect');
for (const moduleName of ['node:http', 'node:https']) {
  const api = require(moduleName);
  api.request = forbidden(`${moduleName}.request`);
  api.get = forbidden(`${moduleName}.get`);
}
const childProcess = require('node:child_process');
for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) childProcess[method] = forbidden(`child_process.${method}`);
for (const method of ['openExternal', 'openPath', 'showItemInFolder', 'trashItem']) electron.shell[method] = forbidden(`shell.${method}`);
electron.net.request = forbidden('electron.net.request');
electron.net.fetch = forbidden('electron.net.fetch');
app.relaunch = forbidden('app.relaunch');
app.exit = forbidden('app.exit');
const realProcessExit = process.exit.bind(process);
process.exit = code => { audit.violations.push({ operation: 'process.exit', code }); realProcessExit(code || 1); };

const sqlite = require('node:sqlite');
sqlite.DatabaseSync = new Proxy(sqlite.DatabaseSync, {
  construct(Target, args) {
    if (args[0] !== ':memory:') boundary.writable(args[0]);
    return Reflect.construct(Target, args);
  },
});

const load = Module._load;
const electronForApp = new Proxy(electron, {
  get(target, name) { return name === 'BrowserWindow' ? HiddenWindow : target[name]; },
});
const HiddenWindow = new Proxy(electron.BrowserWindow, {
  construct(Target, [options]) {
    boundary.readable(options.webPreferences.preload);
    const window = new Target({ ...options, show: false });
    audit.windows++;
    assert.equal(window.isVisible(), false);
    window.show = forbidden('window.show');
    window.showInactive = forbidden('window.showInactive');
    window.on('show', () => fail(new Error('Test window became visible')));
    window.webContents.setWindowOpenHandler(() => { audit.violations.push({ operation: 'window.open' }); return { action: 'deny' }; });
    const loadFile = window.loadFile.bind(window);
    window.loadFile = (file, ...args) => {
      assert.equal(boundary.readable(file), path.join(root, 'app/packages/desktop/web-dist/index.html'));
      return loadFile(file, ...args);
    };
    window.loadURL = forbidden('window.loadURL');
    window.webContents.once('did-finish-load', async () => {
      try {
        assert.equal(window.isVisible(), false);
        const result = await window.webContents.executeJavaScript(`(async () => {
          const api = window.electronAPI;
          const legacy = await api.preference.get('storage-main-r2', null);
          const persisted = await api.preference.get('storage-main-r2-written', null);
          await api.preference.set('storage-main-r2-written', 'persisted-through-real-ipc');
          return { legacy, persisted, info: await api.data.getStorageInfo() };
        })()`);
        assert.deepEqual(result.legacy, { origin: 'synthetic-legacy-json' });
        assert.equal(result.persisted, phase === 'first' ? null : 'persisted-through-real-ipc');
        assert.equal(result.info.userDataPath, paths.userData);
        assert.equal(result.info.mainFilePath, path.join(paths.userData, 'prompt-optimizer-data.sqlite'));
        audit.business = await window.webContents.executeJavaScript(`(${exerciseDesktopBusiness.toString()})(${JSON.stringify(phase)})`);
        assert.equal(audit.business.ok, true);
        audit.ipcVerified = true;
        record('real-preload-ipc-verified');
        app.quit(); // Actual main before-quit/window-close/will-quit handlers run normally.
      } catch (error) { fail(error); }
    });
    return window;
  },
});

Module._load = function (request, parent, ...args) {
  if (request === 'electron') return electronForApp;
  if (request === 'dotenv/config') throw new Error('Isolation: implicit dotenv loading refused');
  const exported = load.call(this, request, parent, ...args);
  if (request === 'dotenv') {
    return { ...exported, config(options = {}) {
      for (const file of Array.isArray(options.path) ? options.path : [options.path]) {
        boundary.writable(file);
        assert.equal(fs.readFileSync(file, 'utf8'), '');
        audit.dotenv.push(path.relative(root, file));
      }
      return exported.config(options);
    } };
  }
  if (request === 'electron-updater') {
    const updater = exported.autoUpdater;
    for (const method of ['checkForUpdates', 'checkForUpdatesAndNotify', 'downloadUpdate', 'quitAndInstall']) updater[method] = forbidden(`updater.${method}`);
  }
  if (request === '@prompt-optimizer/core/node') {
    return { ...exported, async openDesktopStorage(directory, options) {
      assert.equal(boundary.writable(directory), paths.userData);
      const result = await exported.openDesktopStorage(directory, options);
      audit.migration = result.migration;
      audit.database = path.relative(root, result.provider.databasePath);
      record('actual-storage-opened');
      const close = result.provider.close.bind(result.provider);
      result.provider.close = async () => { await close(); audit.closeCompleted = true; record('actual-storage-close-completed'); };
      const flush = result.provider.flush.bind(result.provider);
      result.provider.flush = async () => { await flush(); audit.flushCompleted = true; record('actual-storage-flush-completed'); };
      return result;
    } };
  }
  return exported;
};

app.whenReady().then(() => {
  const session = electron.session.defaultSession;
  boundary.writable(session.storagePath);
  session.resolveProxy = async () => 'DIRECT'; // Never consult a real system PAC/proxy.
  session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => {
    audit.requests++;
    audit.violations.push({ operation: 'chromium-network' });
    callback({ cancel: true });
  });
});
app.on('before-quit', () => record('before-quit'));
app.on('will-quit', () => record('will-quit'));
app.on('quit', (_event, code) => {
  try {
    assert.equal(code, 0);
    assert.equal(audit.mainLoaded, true);
    assert.equal(audit.windows, 1);
    assert.equal(audit.ipcVerified, true);
    assert.equal(audit.closeCompleted, true);
    assert.equal(audit.flushCompleted, true);
    assert.equal(audit.requests, 0);
    assert.deepEqual(audit.violations, []);
    assert.equal(audit.dotenv.length, 2);
    record('normal-quit');
    audit.runtime = { node: process.versions.node, electron: process.versions.electron, sqlite: process.versions.sqlite };
    audit.ok = true;
    fs.writeFileSync(path.join(root, `${phase}-report.json`), JSON.stringify(audit, null, 2));
  } catch (error) { fail(error); }
});

audit.mainLoaded = true;
record('loading-actual-main');
require(mainPath);
