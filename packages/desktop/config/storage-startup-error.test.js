const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStorageStartupErrorDialog, showStorageStartupErrorDialog } = require('./storage-startup-error');

test('builds divergence dialog without promising optional WAL/SHM sidecars', () => {
  const error = Object.assign(new Error('Legacy JSON and SQLite contain different data.'), {
    params: { reason: 'DESKTOP_STORAGE_DIVERGED' },
  });
  const dialog = buildStorageStartupErrorDialog({
    error,
    locale: 'zh-CN',
    userDataPath: 'C:\\Users\\test\\AppData\\Roaming\\PromptOptimizer',
    stage: 'storage',
  });
  assert.equal(dialog.type, 'error');
  assert.equal(dialog.title, '请核对桌面数据');
  assert.match(dialog.detail, /prompt-optimizer-data\.json/);
  assert.match(dialog.detail, /prompt-optimizer-data\.sqlite/);
  assert.doesNotMatch(dialog.detail, /WAL 和 SHM 文件均已保留/);
  assert.match(dialog.detail, /数据目录：|数据目录:/);
  assert.deepEqual(dialog.buttons, ['打开数据目录', '退出']);
  assert.equal(dialog.openDirectoryButtonIndex, 0);
  assert.equal(dialog.cancelId, 1);
});

test('uses structured reason for WAL unsupported errors and ignores message text', () => {
  const walStructured = Object.assign(new Error('SQLite WAL mode is required'), {
    params: { reason: 'DESKTOP_STORAGE_WAL_UNSUPPORTED' },
  });
  const en = buildStorageStartupErrorDialog({ error: walStructured, locale: 'en-US', userDataPath: '/tmp/po', stage: 'storage' });
  const tw = buildStorageStartupErrorDialog({ error: walStructured, locale: 'zh-TW', userDataPath: '/tmp/po', stage: 'storage' });
  assert.equal(en.title, 'Desktop storage unsupported in this directory');
  assert.match(en.detail, /Data directory: \/tmp\/po/);
  assert.equal(tw.title, '目前目錄不支援桌面儲存');
  assert.deepEqual(tw.buttons, ['開啟資料目錄', '結束']);

  const mentionsWalInPayload = new Error('Malformed JSON near WAL secret-token-123');
  const generic = buildStorageStartupErrorDialog({ error: mentionsWalInPayload, locale: 'en-US', userDataPath: '/tmp/po', stage: 'storage' });
  assert.equal(generic.title, 'Desktop storage initialization failed');
  assert.doesNotMatch(generic.detail, /secret-token-123/);
});

test('distinguishes post-storage service initialization failures with payload-free copy', () => {
  const dialog = buildStorageStartupErrorDialog({
    error: new Error('Unexpected service failure with sensitive-payload-xyz'),
    locale: 'zh-CN',
    userDataPath: 'C:\\po-data',
    stage: 'services',
  });
  assert.equal(dialog.title, '桌面服务启动失败');
  assert.match(dialog.message, /桌面数据存储已就绪/);
  assert.doesNotMatch(dialog.detail, /sensitive-payload-xyz/);
});

test('showStorageStartupErrorDialog surfaces shell.openPath failure string before exiting', async () => {
  const errorBoxes = [];
  let opened = null;
  const dialog = {
    showMessageBox: async () => ({ response: 0 }),
    showErrorBox: (title, content) => { errorBoxes.push({ title, content }); },
  };
  const shell = {
    openPath: async (target) => {
      opened = target;
      return 'Failed to launch file manager';
    },
  };

  await showStorageStartupErrorDialog({
    dialog,
    shell,
    error: new Error('fail'),
    locale: 'en-US',
    userDataPath: 'C:\\data\\dir',
    stage: 'storage',
  });

  assert.equal(opened, 'C:\\data\\dir');
  assert.equal(errorBoxes.length, 1);
  assert.equal(errorBoxes[0].title, 'Could not open data directory');
  assert.match(errorBoxes[0].content, /C:\\data\\dir/);
  assert.match(errorBoxes[0].content, /Failed to launch file manager/);
});

test('showStorageStartupErrorDialog skips shell.openPath when user selects Quit', async () => {
  let openCalled = false;
  await showStorageStartupErrorDialog({
    dialog: {
      showMessageBox: async () => ({ response: 1 }),
      showErrorBox: () => { throw new Error('unexpected error box'); },
    },
    shell: {
      openPath: async () => { openCalled = true; return ''; },
    },
    error: new Error('fail'),
    locale: 'en-US',
    userDataPath: 'C:\\data\\dir',
  });
  assert.equal(openCalled, false);
});
