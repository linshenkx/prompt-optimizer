const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function exerciseProductUi(window, root, phase) {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'product-fixture.json'), 'utf8'));
  const wait = async expression => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const value = await window.webContents.executeJavaScript(`(() => { try { return (${expression}); } catch (error) { return { fixtureError: error.message }; } })()`);
      if (value?.fixtureError) throw new Error(value.fixtureError);
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Product UI condition timed out');
  };
  await wait(`Boolean(document.querySelector('[data-testid="header-favorites-page-action"]'))`);
  const hasDesktopRunsButton = await window.webContents.executeJavaScript(`Boolean(document.querySelector('[data-testid="header-desktop-runs"]'))`);
  assert.equal(hasDesktopRunsButton, false, 'Main product top bar must not expose MCP runs button');
  const history = await window.webContents.executeJavaScript(`window.electronAPI.history.getHistory()`);
  const optimizedRun = fixture.runs.find(run => run.kind === 'optimize');
  assert.ok(optimizedRun && history.some(item => typeof item.optimizedPrompt === 'string' && item.optimizedPrompt.includes(optimizedRun.contains)),
    'Actual product UI history must contain the persisted MCP optimization result');
  const visible = [{ id: optimizedRun.id, kind: optimizedRun.kind, outputVisible: true }];
  await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await new Promise(resolve => setTimeout(resolve, 500));
  fs.writeFileSync(path.join(root, `${phase}.png`), (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  fs.writeFileSync(path.join(root, `${phase}-ui-ready.json`), JSON.stringify({ visible }));
  {
    const deadline = Date.now() + 30000;
    while (!fs.existsSync(path.join(root, `${phase}-resources-complete.json`))) {
      if (Date.now() > deadline) throw new Error('Resource bridge acceptance timed out');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, `${phase}-resources-complete.json`), 'utf8')).ok, true);
  }
  return { ok: true, completeProductUi: true, visible, checked: ['clean header entry', 'optimization saved in history', 'restart persistence'] };
}

module.exports = { exerciseProductUi };
