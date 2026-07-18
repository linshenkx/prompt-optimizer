/**
 * 发布溯源记录：把本地 commit / fork / 安装形态写成可复查清单。
 * 不依赖网络签名服务；hash 仅覆盖关键入口文件。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.pipeline');
const outFile = path.join(outDir, 'release-traceability.md');

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function safeGit(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
  } catch (error) {
    return `(unavailable: ${error.message.split('\n')[0]})`;
  }
}

const commit = safeGit('git rev-parse HEAD');
const branch = safeGit('git rev-parse --abbrev-ref HEAD');
const status = safeGit('git status -sb');
const remotes = safeGit('git remote -v');

const filesToHash = [
  'packages/desktop/main.js',
  'packages/desktop/preload.js',
  'packages/desktop/remote-storage.js',
  'packages/desktop/config/ipc/channel-manifest.js',
  'packages/desktop/config/ipc/update-handlers.js',
  'packages/core/dist/index.cjs',
  'packages/core/dist/electron.cjs',
  'packages/desktop/web-dist/index.html',
];

const installFiles = [
  'D:/PromtOptimizer/PromptOptimizer/PromptOptimizer.exe',
  'D:/PromtOptimizer/PromptOptimizer/resources/app/main.js',
  'D:/PromtOptimizer/PromptOptimizer/resources/app/preload.js',
  'D:/PromtOptimizer/PromptOptimizer/resources/app/config/ipc/channel-manifest.js',
  'D:/PromtOptimizer/PromptOptimizer/resources/app/node_modules/@prompt-optimizer/core/dist/electron.cjs',
];

const lines = [];
lines.push('# Release Traceability');
lines.push('');
lines.push(`- generatedAt: ${new Date().toISOString()}`);
lines.push(`- branch: \`${branch}\``);
lines.push(`- commit: \`${commit}\``);
lines.push(`- fork: https://github.com/xvyimu/prompt-optimizer`);
lines.push(`- upstream: https://github.com/linshenkx/prompt-optimizer`);
lines.push('');
lines.push('## git status');
lines.push('```');
lines.push(status);
lines.push('```');
lines.push('');
lines.push('## remotes');
lines.push('```');
lines.push(remotes);
lines.push('```');
lines.push('');
lines.push('## source file hashes (sha256)');
lines.push('');
for (const rel of filesToHash) {
  const abs = path.join(root, rel);
  if (fs.existsSync(abs)) {
    lines.push(`- \`${rel}\`: \`${sha256File(abs)}\``);
  } else {
    lines.push(`- \`${rel}\`: MISSING`);
  }
}
lines.push('');
lines.push('## installed app hashes (if present)');
lines.push('');
for (const abs of installFiles) {
  if (fs.existsSync(abs)) {
    lines.push(`- \`${abs}\`: \`${sha256File(abs)}\``);
  } else {
    lines.push(`- \`${abs}\`: MISSING`);
  }
}
lines.push('');
lines.push('## notes');
lines.push('');
lines.push('- 当前安装为 resources/app 热替换，不是 electron-builder 签名安装包。');
lines.push('- 完整签名链需正式 package + Authenticode；本文件仅提供本地可复查 hash。');
lines.push('');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`[release-traceability] wrote ${outFile}`);
