const PAGE_ZOOM_MENU_ITEMS = Object.freeze([
  { label: 'Actual Size', accelerator: 'CommandOrControl+0', action: 'reset' },
  { label: 'Zoom In', accelerator: 'CommandOrControl+Plus', action: 'zoomIn' },
  { label: 'Zoom Out', accelerator: 'CommandOrControl+-', action: 'zoomOut' },
]);

function buildPageZoomMenuItems({ onPageZoomAction = () => {} } = {}) {
  return PAGE_ZOOM_MENU_ITEMS.map(({ label, accelerator, action }) => ({
    label,
    accelerator,
    click: (_menuItem, browserWindow) => onPageZoomAction(action, browserWindow?.webContents),
  }));
}

function buildAppMenuTemplate({
  isMac = process.platform === 'darwin',
  onPageZoomAction,
} = {}) {
  return [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: isMac ? 'View' : '&View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        ...buildPageZoomMenuItems({ onPageZoomAction }),
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
}

function getPageZoomShortcutAction(input) {
  if (!input || input.type !== 'keyDown') return null;
  if (!(input.control || input.meta) || input.alt) return null;

  const key = typeof input.key === 'string' ? input.key : '';
  const code = typeof input.code === 'string' ? input.code : '';

  if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
    return 'reset';
  }

  if (key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract') {
    return 'zoomOut';
  }

  if (
    key === '+' ||
    key === '=' ||
    key === 'Plus' ||
    code === 'Equal' ||
    code === 'NumpadAdd'
  ) {
    return 'zoomIn';
  }

  return null;
}

function shouldBlockPageZoomShortcut(input) {
  return getPageZoomShortcutAction(input) !== null;
}

module.exports = {
  buildAppMenuTemplate,
  buildPageZoomMenuItems,
  getPageZoomShortcutAction,
  shouldBlockPageZoomShortcut,
};
