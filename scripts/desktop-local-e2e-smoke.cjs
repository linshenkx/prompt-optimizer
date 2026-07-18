/**
 * 本地 E2E 烟测：启动已安装/源码 Desktop，确认主进程初始化与 web-dist 加载。
 * 不依赖真实模型 API，不安装新依赖。
 *
 * 用法：
 *   node scripts/desktop-local-e2e-smoke.mjs
 *   node scripts/desktop-local-e2e-smoke.mjs --source
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const useSource = process.argv.includes('--source');
const installExe = 'D:\\PromtOptimizer\\PromptOptimizer\\PromptOptimizer.exe';
const sourceElectronCli = path.join(root, 'packages', 'desktop', 'node_modules', 'electron', 'cli.js');
const sourceDesktopDir = path.join(root, 'packages', 'desktop');

const outLog = path.join(os.tmpdir(), `po-local-e2e-out-${Date.now()}.log`);
const errLog = path.join(os.tmpdir(), `po-local-e2e-err-${Date.now()}.log`);

function fail(message) {
  console.error(`[desktop-local-e2e] FAIL: ${message}`);
  process.exitCode = 1;
}

async function main() {
  let child;
  const outFd = fs.openSync(outLog, 'w');
  const errFd = fs.openSync(errLog, 'w');

  if (useSource || !fs.existsSync(installExe)) {
    if (!fs.existsSync(sourceElectronCli)) {
      fail(`electron cli missing: ${sourceElectronCli}`);
      return;
    }
    console.log('[desktop-local-e2e] mode=source');
    child = spawn(process.execPath, [sourceElectronCli, '.'], {
      cwd: sourceDesktopDir,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', outFd, errFd],
      windowsHide: true,
    });
  } else {
    console.log('[desktop-local-e2e] mode=installed');
    child = spawn(installExe, [], {
      stdio: ['ignore', outFd, errFd],
      windowsHide: false,
    });
  }

  const startedAt = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const out = fs.existsSync(outLog) ? fs.readFileSync(outLog, 'utf8') : '';
  const err = fs.existsSync(errLog) ? fs.readFileSync(errLog, 'utf8') : '';
  const combined = `${out}\n${err}`;

  const checks = [
    { name: 'core-services-init', re: /Core services initialized successfully/i },
    { name: 'ipc-handlers-ready', re: /High-level service IPC handlers ready/i },
    { name: 'web-dist-loaded', re: /Loading web app from:.*web-dist[\\/]+index\.html/i },
  ];

  let ok = true;
  for (const check of checks) {
    if (check.re.test(combined)) {
      console.log(`[desktop-local-e2e] PASS ${check.name}`);
    } else {
      ok = false;
      console.error(`[desktop-local-e2e] FAIL ${check.name}`);
    }
  }

  if (!child.killed && child.exitCode === null) {
    try { child.kill(); } catch {}
  }

  // cleanup children on windows（taskkill 可能不在 PATH，失败忽略）
  try {
    const killer = spawn('taskkill', ['/IM', 'PromptOptimizer.exe', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('error', () => {});
  } catch {}

  console.log(`[desktop-local-e2e] durationMs=${Date.now() - startedAt}`);
  console.log(`[desktop-local-e2e] outLog=${outLog}`);
  console.log(`[desktop-local-e2e] errLog=${errLog}`);

  if (!ok) {
    console.error('[desktop-local-e2e] --- out tail ---');
    console.error(out.split(/\r?\n/).slice(-30).join('\n'));
    console.error('[desktop-local-e2e] --- err tail ---');
    console.error(err.split(/\r?\n/).slice(-30).join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log('[desktop-local-e2e] ALL CHECKS PASSED');
}

main().catch((error) => {
  fail(error && error.stack ? error.stack : String(error));
});
