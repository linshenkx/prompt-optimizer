import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import releaseNotes from './release-notes.js';

const {
  buildCommitDraft,
  buildReleaseNotesTemplate,
  createReleaseNotesFiles,
  renderGitHubReleaseBody,
  validateReleaseArtifacts,
} = releaseNotes;

function createTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-optimizer-release-notes-'));
}

function writeFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runGit(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commitFile(root, relativePath, content, message) {
  writeFile(root, relativePath, content);
  runGit(root, ['add', relativePath]);
  runGit(root, ['commit', '-m', message]);
}

function createTaggedRepo() {
  const root = createTempRepo();
  runGit(root, ['init']);
  runGit(root, ['config', 'user.name', 'Test User']);
  runGit(root, ['config', 'user.email', 'test@example.com']);

  commitFile(root, 'notes.txt', 'first\n', 'chore: initial release');
  runGit(root, ['tag', 'v1.0.0']);

  commitFile(root, 'notes.txt', 'second\n', 'feat: add second change');
  runGit(root, ['tag', 'v1.1.0']);

  commitFile(root, 'notes.txt', 'third\n', 'fix: add third change');
  runGit(root, ['tag', 'v1.2.0']);

  return root;
}

function buildValidEnglishReleaseNotes(version, options = {}) {
  const summary =
    options.includeSummary === false
      ? ''
      : `## Summary
- Text-to-image evaluation is now easier to review and compare.
- Reference-image workflows are smoother and safer across the app.

`;

  return `# GlobalCloud XiaoC v${version}

${summary}## Highlights
- Faster image prompt evaluation with clearer outputs.

## Product Updates
### Desktop
- Improved packaging metadata for GitHub Releases.
### Web
- Refined release surfaces for bilingual documentation.
### Extension
- Synced release messaging with the desktop workflow.
### Core/Infra
- Added release note validation for tagged builds.

## Fixes
- Prevented empty release bodies from being published.

## Breaking Changes / Upgrade Notes
- None.

## Developer Notes
- Release notes now live in the repository and sync to GitHub Releases.
`;
}

function buildValidChineseReleaseNotes(version, options = {}) {
  const summary =
    options.includeSummary === false
      ? ''
      : `## 概括
- 文生图评估现在更容易查看和比较。
- 参考图工作流在整个应用里都更顺手、更安全。

`;

  return `# GlobalCloud XiaoC v${version}

${summary}## 亮点
- 图像提示词评估更快，结果表达也更清晰。

## 产品更新
### Desktop
- 改进了 GitHub Release 使用的桌面端打包元数据。
### Web
- 优化了双语发布文档的展示入口。
### Extension
- 让扩展端发布说明与桌面端流程保持一致。
### Core/Infra
- 为打标签发布增加了版本说明校验。

## 修复
- 避免发布出空的 Release 正文。

## 破坏性变更 / 升级说明
- 无。

## 开发者说明
- 版本说明现在以仓库文件为准，并同步到 GitHub Releases。
`;
}

test('buildReleaseNotesTemplate creates the English release note skeleton with summary', () => {
  const template = buildReleaseNotesTemplate({
    version: '2.8.0',
    locale: 'en',
    commitDraft: ['- feat(ui): polish release notes', '- fix(ci): validate note files'],
  });

  assert.match(template, /^# GlobalCloud XiaoC v2\.8\.0/m);
  assert.match(template, /^## Summary$/m);
  assert.match(template, /^## Highlights$/m);
  assert.match(template, /^### Desktop$/m);
  assert.match(template, /^## Developer Notes$/m);
  assert.match(template, /feat\(ui\): polish release notes/);
});

test('buildReleaseNotesTemplate creates the Chinese release note skeleton with 概括', () => {
  const template = buildReleaseNotesTemplate({
    version: '2.8.0',
    locale: 'zh-CN',
    commitDraft: ['- feat(core): ship bilingual release notes'],
  });

  assert.match(template, /^# GlobalCloud XiaoC v2\.8\.0/m);
  assert.match(template, /^## 概括$/m);
  assert.match(template, /^## 亮点$/m);
  assert.match(template, /^### Desktop$/m);
  assert.match(template, /^## 开发者说明$/m);
  assert.match(template, /feat\(core\): ship bilingual release notes/);
});

test('createReleaseNotesFiles writes split English and Chinese release note files', () => {
  const root = createTempRepo();

  const result = createReleaseNotesFiles({
    cwd: root,
    version: '2.8.0',
    commitDraft: ['- feat(core): ship bilingual release notes'],
  });

  assert.equal(result.created, true);
  assert.equal(result.filePaths.en, path.join(root, 'releases', 'v2.8.0.en.md'));
  assert.equal(result.filePaths.zhCN, path.join(root, 'releases', 'v2.8.0.zh-CN.md'));
  assert.equal(fs.existsSync(result.filePaths.en), true);
  assert.equal(fs.existsSync(result.filePaths.zhCN), true);
});

test('validateReleaseArtifacts accepts split release notes with summaries and changelog links', () => {
  const root = createTempRepo();
  writeFile(
    root,
    'CHANGELOG.md',
    [
      '# Changelog',
      '',
      '## [2.8.0] - 2026-04-04',
      '- EN: Bilingual release notes become the source of truth. See [Release Notes (EN)](releases/v2.8.0.en.md).',
      '- 中文：双语版本说明成为唯一发布来源。参见 [版本说明（中文）](releases/v2.8.0.zh-CN.md)。',
      '',
      '## [2.1.0] - 2025-01-19',
      '- Legacy entry kept for compatibility.',
      '',
    ].join('\n')
  );
  writeFile(root, 'releases/v2.8.0.en.md', buildValidEnglishReleaseNotes('2.8.0'));
  writeFile(root, 'releases/v2.8.0.zh-CN.md', buildValidChineseReleaseNotes('2.8.0'));

  const result = validateReleaseArtifacts({
    cwd: root,
    version: '2.8.0',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateReleaseArtifacts ignores no-change desktop and extension subsections for product order', () => {
  const root = createTempRepo();
  writeFile(
    root,
    'CHANGELOG.md',
    [
      '# Changelog',
      '',
      '## [2.8.0] - 2026-04-04',
      '- EN: Bilingual release notes become the source of truth. See [Release Notes (EN)](releases/v2.8.0.en.md).',
      '- 中文：双语版本说明成为唯一发布来源。参见 [版本说明（中文）](releases/v2.8.0.zh-CN.md)。',
      '',
    ].join('\n')
  );
  writeFile(
    root,
    'releases/v2.8.0.en.md',
    buildValidEnglishReleaseNotes('2.8.0')
      .replace(
        [
          '### Desktop',
          '- Improved packaging metadata for GitHub Releases.',
          '### Web',
          '- Refined release surfaces for bilingual documentation.',
          '### Extension',
          '- Synced release messaging with the desktop workflow.',
          '### Core/Infra',
        ].join('\n'),
        [
          '### Web',
          '- Refined release surfaces for bilingual documentation.',
          '### Extension',
          '- No extension-specific user-facing changes landed in this patch release.',
          '### Desktop',
          '- No desktop-specific user-facing changes landed in this patch release.',
          '### Core/Infra',
        ].join('\n')
      )
  );
  writeFile(
    root,
    'releases/v2.8.0.zh-CN.md',
    buildValidChineseReleaseNotes('2.8.0')
      .replace(
        [
          '### Desktop',
          '- 改进了 GitHub Release 使用的桌面端打包元数据。',
          '### Web',
          '- 优化了双语发布文档的展示入口。',
          '### Extension',
          '- 让扩展端发布说明与桌面端流程保持一致。',
          '### Core/Infra',
        ].join('\n'),
        [
          '### Web',
          '- 优化了双语发布文档的展示入口。',
          '### Extension',
          '- 本次补丁没有扩展端专属的用户可见变化。',
          '### Desktop',
          '- 本次补丁没有桌面端专属的用户可见变化。',
          '### Core/Infra',
        ].join('\n')
      )
  );

  const result = validateReleaseArtifacts({
    cwd: root,
    version: '2.8.0',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateReleaseArtifacts blocks release when a language file or summary is missing', () => {
  const root = createTempRepo();
  writeFile(
    root,
    'CHANGELOG.md',
    [
      '# Changelog',
      '',
      '## [2.8.0] - 2026-04-04',
      '- EN: Missing the Chinese file link.',
      '- 中文：这里只有概括，没有双语文件链接。',
      '',
    ].join('\n')
  );
  writeFile(root, 'releases/v2.8.0.en.md', buildValidEnglishReleaseNotes('2.8.0'));
  writeFile(
    root,
    'releases/v2.8.0.zh-CN.md',
    buildValidChineseReleaseNotes('2.8.0', { includeSummary: false }).replace('无。', 'TODO')
  );

  const result = validateReleaseArtifacts({
    cwd: root,
    version: '2.8.0',
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /releases\/v2\.8\.0\.en\.md/);
  assert.match(result.errors.join('\n'), /releases\/v2\.8\.0\.zh-CN\.md/);
  assert.match(result.errors.join('\n'), /"## 概括"/);
  assert.match(result.errors.join('\n'), /placeholder content/i);
});

test('validateReleaseArtifacts can validate a matching non-top changelog entry for historical backfills', () => {
  const root = createTempRepo();
  writeFile(
    root,
    'CHANGELOG.md',
    [
      '# Changelog',
      '',
      '## [2.8.0] - 2026-04-04',
      '- EN: Current release stays on top. See [Release Notes (EN)](releases/v2.8.0.en.md).',
      '- 中文：当前版本仍然位于顶部。参见 [版本说明（中文）](releases/v2.8.0.zh-CN.md)。',
      '',
      '## [2.6.0] - 2026-03-09',
      '- EN: Historical backfill for MiniMax support. See [Release Notes (EN)](releases/v2.6.0.en.md).',
      '- 中文：为 MiniMax 支持补齐历史版本说明。参见 [版本说明（中文）](releases/v2.6.0.zh-CN.md)。',
      '',
    ].join('\n')
  );
  writeFile(root, 'releases/v2.6.0.en.md', buildValidEnglishReleaseNotes('2.6.0'));
  writeFile(root, 'releases/v2.6.0.zh-CN.md', buildValidChineseReleaseNotes('2.6.0'));

  const blockingResult = validateReleaseArtifacts({
    cwd: root,
    version: '2.6.0',
  });
  assert.equal(blockingResult.ok, false);
  assert.match(blockingResult.errors.join('\n'), /top entry must be version 2\.6\.0/);

  const historicalResult = validateReleaseArtifacts({
    cwd: root,
    version: '2.6.0',
    requireTopEntry: false,
  });
  assert.equal(historicalResult.ok, true);
  assert.deepEqual(historicalResult.errors, []);
});

test('renderGitHubReleaseBody renders English first, then Chinese, with final macOS note and guide links', () => {
  const root = createTempRepo();
  writeFile(root, 'releases/v2.8.0.en.md', buildValidEnglishReleaseNotes('2.8.0'));
  writeFile(root, 'releases/v2.8.0.zh-CN.md', buildValidChineseReleaseNotes('2.8.0'));

  const body = renderGitHubReleaseBody({
    cwd: root,
    version: '2.8.0',
    repository: 'linshenkx/prompt-optimizer',
  });

  assert.match(body, /^## English$/m);
  assert.match(body, /^### Summary$/m);
  assert.match(body, /^### Highlights$/m);
  assert.match(body, /^### Product Updates$/m);
  assert.match(body, /^#### Web$/m);
  assert.match(body, /^### Fixes$/m);
  assert.doesNotMatch(body, /^# GlobalCloud XiaoC v2\.8\.0$/m);
  assert.match(body, /^Installation guide: \[English\]\(https:\/\/github\.com\/linshenkx\/prompt-optimizer\/blob\/v2\.8\.0\/mkdocs\/docs\/en\/deployment\/desktop\.md\) \| \[中文\]\(https:\/\/github\.com\/linshenkx\/prompt-optimizer\/blob\/v2\.8\.0\/mkdocs\/docs\/zh\/deployment\/desktop\.md\)$/m);
  assert.match(body, /\[Source release notes \(EN\)\]\(https:\/\/github\.com\/linshenkx\/prompt-optimizer\/blob\/v2\.8\.0\/releases\/v2\.8\.0\.en\.md\)/);
  assert.match(body, /^---$/m);
  assert.match(body, /^## 中文$/m);
  assert.match(body, /^### 概括$/m);
  assert.match(body, /^### 亮点$/m);
  assert.match(body, /^### 产品更新$/m);
  assert.match(body, /^#### Web$/m);
  assert.match(body, /^### 修复$/m);
  assert.match(body, /^安装文档：\[English\]\(https:\/\/github\.com\/linshenkx\/prompt-optimizer\/blob\/v2\.8\.0\/mkdocs\/docs\/en\/deployment\/desktop\.md\) \| \[中文\]\(https:\/\/github\.com\/linshenkx\/prompt-optimizer\/blob\/v2\.8\.0\/mkdocs\/docs\/zh\/deployment\/desktop\.md\)$/m);
  assert.match(body, /\[仓库版本说明（中文）\]\(https:\/\/github\.com\/linshenkx\/prompt-optimizer\/blob\/v2\.8\.0\/releases\/v2\.8\.0\.zh-CN\.md\)/);
  assert.doesNotMatch(body, /^### macOS/m);
  assert.match(body, /^macOS note: if macOS reports the app as damaged or cannot verify the developer, this is usually caused by the quarantine attribute on downloaded apps\./m);
  assert.match(body, /^macOS 备注：如果 macOS 提示“已损坏”或“无法验证开发者”，通常是下载文件的隔离属性导致。/m);
  assert.match(body, /xattr -rd com\.apple\.quarantine \/Applications\/PromptOptimizer\.app/);
  assert.match(body, /~\/Downloads\/PromptOptimizer-\*\.dmg/);
  assert.ok(body.lastIndexOf('macOS note:') > body.indexOf('[仓库版本说明（中文）]'));
});

test('renderGitHubReleaseBody renders full text even when summaries are absent', () => {
  const root = createTempRepo();
  writeFile(root, 'releases/v2.8.0.en.md', buildValidEnglishReleaseNotes('2.8.0', { includeSummary: false }));
  writeFile(root, 'releases/v2.8.0.zh-CN.md', buildValidChineseReleaseNotes('2.8.0', { includeSummary: false }));

  const body = renderGitHubReleaseBody({
    cwd: root,
    version: '2.8.0',
    repository: 'linshenkx/prompt-optimizer',
  });

  assert.match(body, /^## English$/m);
  assert.match(body, /^### Highlights$/m);
  assert.match(body, /^## 中文$/m);
  assert.match(body, /^### 亮点$/m);
  assert.doesNotMatch(body, /^# GlobalCloud XiaoC v2\.8\.0/m);
  assert.doesNotMatch(body, /^\[Full release notes \(EN\)\]/m);
});

test('buildCommitDraft uses the adjacent older tag for historical tagged versions', () => {
  const root = createTaggedRepo();

  const draft = buildCommitDraft(root, '1.1.0');

  assert.equal(draft[0], '- Range: v1.0.0..v1.1.0');
  assert.equal(draft.length, 2);
  assert.match(draft[1], /^- feat: add second change \([0-9a-f]+\)$/);
});
