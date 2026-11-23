const test = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { buildCodexMcpConfig, isDesktopMcpInvocation } = require('./desktop-mcp');

const {
  buildAppMenuTemplate,
  buildPageZoomMenuItems,
  getPageZoomShortcutAction,
  shouldBlockPageZoomShortcut,
} = require('./app-menu');

test('desktop app menu includes explicit page zoom items in the View menu', () => {
  const template = buildAppMenuTemplate({ isMac: false });
  const viewMenu = template.find((item) => item.label === '&View');

  assert.ok(viewMenu);
  assert.deepEqual(
    viewMenu.submenu.map((item) => item.role || item.type || item.label),
    [
      'reload',
      'forceReload',
      'toggleDevTools',
      'separator',
      'Actual Size',
      'Zoom In',
      'Zoom Out',
      'separator',
      'togglefullscreen',
    ],
  );
});

test('desktop app menu keeps the macOS app menu while using explicit zoom items', () => {
  const template = buildAppMenuTemplate({ isMac: true });

  assert.equal(template[0]?.role, 'appMenu');
  assert.equal(
    template.some((item) => item.role === 'viewMenu'),
    false,
  );
});

test('desktop Help menu exposes the Codex configuration action when provided', () => {
  assert.equal(buildAppMenuTemplate().some(item => item.role === 'help'), false);
  let copies = 0;
  const template = buildAppMenuTemplate({ onCopyCodexMcpConfig: () => copies++ });
  const action = template.find(item => item.role === 'help').submenu[0];
  assert.equal(action.id, 'copy-codex-mcp-config');
  action.click();
  assert.equal(copies, 1);
});

test('installed Codex configuration preserves absolute paths with spaces', () => {
  const executable = join(__dirname, 'Installed App', 'PromptOptimizer.exe');
  const resourcesPath = join(__dirname, 'Installed App', 'resources');
  const userDataPath = join(__dirname, 'Desktop data');
  const [section, command, args, env] = buildCodexMcpConfig({ executable, resourcesPath, userDataPath }).split('\n');
  assert.equal(section, '[mcp_servers.prompt_optimizer_product]');
  assert.equal(JSON.parse(command.slice('command = '.length)), executable);
  const [entry, profile] = JSON.parse(args.slice('args = '.length));
  assert.equal(profile, '--desktop-profile=' + userDataPath);
  assert.equal(env, 'env = { ELECTRON_RUN_AS_NODE = "1" }');
  assert.equal(isDesktopMcpInvocation(entry, resourcesPath), true);
  assert.equal(isDesktopMcpInvocation('prompt-optimizer-desktop-mcp.cjs', resourcesPath), false);
  assert.equal(isDesktopMcpInvocation(executable, resourcesPath), false);
});

test('desktop page zoom menu items expose the expected accelerators and actions', () => {
  const actions = [];
  const mockWebContents = { id: 'focused-web-contents' };
  const items = buildPageZoomMenuItems({
    onPageZoomAction: (action, targetWebContents) => {
      actions.push([action, targetWebContents]);
    },
  });

  assert.deepEqual(
    items.map((item) => [item.label, item.accelerator]),
    [
      ['Actual Size', 'CommandOrControl+0'],
      ['Zoom In', 'CommandOrControl+Plus'],
      ['Zoom Out', 'CommandOrControl+-'],
    ],
  );

  for (const item of items) {
    item.click({}, { webContents: mockWebContents });
  }

  assert.deepEqual(actions, [
    ['reset', mockWebContents],
    ['zoomIn', mockWebContents],
    ['zoomOut', mockWebContents],
  ]);
});

test('page zoom shortcut detection covers top-row, shifted, and numpad inputs', () => {
  assert.equal(
    getPageZoomShortcutAction({ type: 'keyDown', control: true, meta: false, alt: false, key: '=', code: 'Equal' }),
    'zoomIn',
  );
  assert.equal(
    getPageZoomShortcutAction({ type: 'keyDown', control: true, meta: false, alt: false, key: '+', code: 'Equal' }),
    'zoomIn',
  );
  assert.equal(
    getPageZoomShortcutAction({ type: 'keyDown', control: true, meta: false, alt: false, key: '+', code: 'NumpadAdd' }),
    'zoomIn',
  );
  assert.equal(
    getPageZoomShortcutAction({ type: 'keyDown', control: true, meta: false, alt: false, key: '-', code: 'Minus' }),
    'zoomOut',
  );
  assert.equal(
    getPageZoomShortcutAction({ type: 'keyDown', control: true, meta: false, alt: false, key: '_', code: 'Minus' }),
    'zoomOut',
  );
  assert.equal(
    getPageZoomShortcutAction({ type: 'keyDown', control: true, meta: false, alt: false, key: '0', code: 'Digit0' }),
    'reset',
  );
});

test('page zoom shortcut detection ignores unrelated shortcuts', () => {
  assert.equal(
    shouldBlockPageZoomShortcut({ type: 'keyDown', control: true, meta: false, alt: false, key: 'i', code: 'KeyI' }),
    false,
  );
  assert.equal(
    shouldBlockPageZoomShortcut({ type: 'keyDown', control: true, meta: false, alt: true, key: '=', code: 'Equal' }),
    false,
  );
  assert.equal(
    shouldBlockPageZoomShortcut({ type: 'keyUp', control: true, meta: false, alt: false, key: '=', code: 'Equal' }),
    false,
  );
});
