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
  await wait(`Boolean(document.querySelector('[data-testid="header-desktop-runs"]'))`);
  await window.webContents.executeJavaScript(`document.querySelector('[data-testid="header-desktop-runs"]').click()`);
  await wait(`document.querySelectorAll('[data-testid="desktop-run-item"]').length >= 3`);
  const visible = [];
  for (const run of fixture.runs) {
    await window.webContents.executeJavaScript(`(() => {
      const wrapper = document.querySelector('[data-testid="desktop-run-id"]');
      const input = wrapper.matches('input') ? wrapper : wrapper.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(run.id)}); input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await window.webContents.executeJavaScript(`document.querySelector('[data-testid="desktop-run-search"]').click()`);
    const detail = await wait(`(() => {
      const card = document.querySelector('[data-testid="desktop-run-detail"]');
      return card?.textContent.includes(${JSON.stringify(run.id)}) && card.textContent;
    })()`);
    assert.ok(detail.includes(run.contains), 'Actual product UI must show the persisted model result');
    visible.push({ id: run.id, kind: run.kind, outputVisible: true });
  }
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
  return { ok: true, completeProductUi: true, visible, checked: ['header entry', 'optimization result', 'test result', 'evaluation score', 'restart persistence'] };
}

module.exports = { exerciseProductUi };
