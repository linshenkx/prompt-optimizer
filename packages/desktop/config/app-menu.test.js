const test = require('node:test');
const assert = require('node:assert/strict');

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

test('desktop app menu does not include a Help menu', () => {
  const template = buildAppMenuTemplate({ isMac: false });
  assert.equal(template.some((item) => item.role === 'help'), false);
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
