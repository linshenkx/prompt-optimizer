#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LOCALE_CONFIG = {
  en: {
    fileSuffix: 'en',
    summaryHeading: '## Summary',
    headings: [
      '## Summary',
      '## Highlights',
      '## Product Updates',
      '## Fixes',
      '## Breaking Changes / Upgrade Notes',
      '## Developer Notes',
    ],
    productSectionHeading: '## Product Updates',
    productSubsections: ['### Desktop', '### Web', '### Extension', '### Core/Infra'],
  },
  'zh-CN': {
    fileSuffix: 'zh-CN',
    summaryHeading: '## 概括',
    headings: [
      '## 概括',
      '## 亮点',
      '## 产品更新',
      '## 修复',
      '## 破坏性变更 / 升级说明',
      '## 开发者说明',
    ],
    productSectionHeading: '## 产品更新',
    productSubsections: ['### Desktop', '### Web', '### Extension', '### Core/Infra'],
  },
};

const PLACEHOLDER_PATTERNS = [/\bTODO\b/i, /\bTBD\b/i, /待补充/, /(^|[^A-Z])XX([^A-Z]|$)/];

function readRootPackage(cwd = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
}

function normalizeVersion(value, cwd = process.cwd()) {
  const candidate = String(value || readRootPackage(cwd).version).trim();

  if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(candidate)) {
    throw new Error(`Invalid version "${candidate}". Expected x.y.z or vx.y.z.`);
  }

  return candidate.startsWith('v') ? candidate.slice(1) : candidate;
}

function getTagVersion(version, cwd = process.cwd()) {
  return `v${normalizeVersion(version, cwd)}`;
}

function getLocaleConfig(locale) {
  const config = LOCALE_CONFIG[locale];
  if (!config) {
    throw new Error(`Unsupported locale "${locale}". Expected one of: ${Object.keys(LOCALE_CONFIG).join(', ')}.`);
  }
  return config;
}

function getReleaseNotesRelativePath(version, locale, cwd = process.cwd()) {
  const normalizedVersion = normalizeVersion(version, cwd);
  const config = getLocaleConfig(locale);
  return `releases/v${normalizedVersion}.${config.fileSuffix}.md`;
}

function getReleaseNotesPath({ cwd = process.cwd(), version, locale }) {
  return path.join(cwd, getReleaseNotesRelativePath(version, locale, cwd));
}

function getReleaseNotesPaths({ cwd = process.cwd(), version }) {
  return {
    en: getReleaseNotesPath({ cwd, version, locale: 'en' }),
    zhCN: getReleaseNotesPath({ cwd, version, locale: 'zh-CN' }),
  };
}

function stripHtmlComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHeadingIndex(block, heading) {
  const match = new RegExp(`^${escapeRegExp(heading)}\\s*$`, 'm').exec(block);
  return match ? match.index : -1;
}

function findSection(content, heading, nextHeading = null) {
  const startIndex = getHeadingIndex(content, heading);
  if (startIndex === -1) {
    return null;
  }

  const bodyStart = content.indexOf('\n', startIndex);
  if (bodyStart === -1) {
    return content.slice(startIndex).trim();
  }

  if (!nextHeading) {
    return content.slice(startIndex).trim();
  }

  const remaining = content.slice(bodyStart + 1);
  const nextIndex = getHeadingIndex(remaining, nextHeading);
  if (nextIndex === -1) {
    return content.slice(startIndex).trim();
  }

  return content.slice(startIndex, bodyStart + 1 + nextIndex).trim();
}

function extractSectionBody(content, heading, nextHeading = null) {
  const section = findSection(content, heading, nextHeading);
  if (!section) {
    return null;
  }

  const firstLineBreak = section.indexOf('\n');
  if (firstLineBreak === -1) {
    return '';
  }

  return section.slice(firstLineBreak + 1).trim();
}

function extractSubsectionBody(section, heading) {
  const startIndex = getHeadingIndex(section, heading);
  if (startIndex === -1) {
    return null;
  }

  const bodyStart = section.indexOf('\n', startIndex);
  if (bodyStart === -1) {
    return '';
  }

  const remaining = section.slice(bodyStart + 1);
  const nextSubsectionMatch = /^###\s+.+$/m.exec(remaining);
  const body = nextSubsectionMatch
    ? remaining.slice(0, nextSubsectionMatch.index)
    : remaining;

  return stripHtmlComments(body).trim();
}

function isNoChangeProductSubsection(body) {
  const normalized = String(body || '')
    .replace(/^[\s*>-]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    /\bno\b.*\b(extension|desktop)[-\s]specific\b.*\b(user[-\s]facing\s+)?changes?\b/.test(normalized) ||
    /本次.*没有.*(扩展端|桌面端).*变化/.test(normalized)
  );
}

function validateHeadingOrder(block, headings, label) {
  const errors = [];
  let lastIndex = -1;

  for (const heading of headings) {
    const headingIndex = getHeadingIndex(block, heading);
    if (headingIndex === -1) {
      errors.push(`${label} section is missing required heading "${heading}".`);
      continue;
    }
    if (headingIndex < lastIndex) {
      errors.push(`${label} section has heading "${heading}" out of order.`);
    }
    lastIndex = headingIndex;
  }

  return errors;
}

function validateProductSubsectionOrder(content, locale) {
  const config = getLocaleConfig(locale);
  const label = locale === 'en' ? 'English' : '中文';
  const nextHeading = config.headings[config.headings.indexOf(config.productSectionHeading) + 1] ?? null;
  const productSection = findSection(content, config.productSectionHeading, nextHeading);

  if (!productSection) {
    return [];
  }

  const errors = [];
  let lastIndex = -1;
  let previousHeading = null;

  for (const heading of config.productSubsections) {
    const headingIndex = getHeadingIndex(productSection, heading);
    if (headingIndex === -1) {
      continue;
    }
    const subsectionBody = extractSubsectionBody(productSection, heading);
    if (isNoChangeProductSubsection(subsectionBody)) {
      continue;
    }
    if (headingIndex < lastIndex) {
      errors.push(`${label} Product Updates subsection "${heading}" must appear after "${previousHeading}".`);
    }
    lastIndex = headingIndex;
    previousHeading = heading;
  }

  return errors;
}

function findPlaceholderMatches(content) {
  const matches = [];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matched = content.match(pattern);
    if (matched) {
      matches.push(matched[0]);
    }
  }

  return [...new Set(matches)];
}

function validateReleaseNotesContent(content, version, locale, options = {}) {
  const config = getLocaleConfig(locale);
  const requireSummary = options.requireSummary !== false;
  const errors = [];
  const normalizedContent = stripHtmlComments(content).replace(/\r\n/g, '\n');
  const expectedTitle = `# GlobalCloud XiaoC ${getTagVersion(version)}`;

  if (!new RegExp(`^${escapeRegExp(expectedTitle)}\\s*$`, 'm').test(normalizedContent)) {
    errors.push(`Release notes title must be "${expectedTitle}" in ${locale}.`);
  }

  errors.push(...validateHeadingOrder(normalizedContent, config.headings, locale === 'en' ? 'English' : '中文'));
  errors.push(...validateProductSubsectionOrder(normalizedContent, locale));

  if (requireSummary) {
    const summaryBody = extractSectionBody(
      normalizedContent,
      config.summaryHeading,
      config.headings[1] ?? null
    );
    if (!summaryBody) {
      errors.push(`Release notes must include a non-empty "${config.summaryHeading}" section in ${locale}.`);
    }
  }

  const placeholders = findPlaceholderMatches(normalizedContent);
  if (placeholders.length > 0) {
    errors.push(
      `Release notes contain placeholder content in ${locale}: ${placeholders.join(', ')}. Replace placeholders before publishing.`
    );
  }

  return errors;
}

function validateChangelogEntry(changelogContent, version, options = {}) {
  const requireTopEntry = options.requireTopEntry !== false;
  const errors = [];
  const normalizedContent = changelogContent.replace(/\r\n/g, '\n');
  const headingMatches = [...normalizedContent.matchAll(/^## \[([^\]]+)\] - .+$/gm)];

  if (headingMatches.length === 0) {
    return ['CHANGELOG.md must include at least one version entry.'];
  }

  const topEntry = headingMatches[0];
  const topVersion = topEntry[1];
  const normalizedVersion = normalizeVersion(version);
  if (requireTopEntry && topVersion !== normalizedVersion) {
    errors.push(`CHANGELOG.md top entry must be version ${normalizedVersion}.`);
  }

  const matchedEntry = requireTopEntry ? topEntry : headingMatches.find((match) => match[1] === normalizedVersion);
  if (!matchedEntry) {
    errors.push(`CHANGELOG.md must include version ${normalizedVersion}.`);
    return errors;
  }

  const matchedEntryIndex = headingMatches.findIndex((match) => match.index === matchedEntry.index);
  const entryStart = matchedEntry.index ?? 0;
  const nextEntryStart = headingMatches[matchedEntryIndex + 1]?.index ?? normalizedContent.length;
  const matchedEntryBlock = normalizedContent.slice(entryStart, nextEntryStart);
  const englishPath = getReleaseNotesRelativePath(version, 'en');
  const chinesePath = getReleaseNotesRelativePath(version, 'zh-CN');

  if (!matchedEntryBlock.includes(englishPath)) {
    errors.push(
      requireTopEntry
        ? `CHANGELOG.md top entry must link to ${englishPath}.`
        : `CHANGELOG.md entry for version ${normalizedVersion} must link to ${englishPath}.`
    );
  }

  if (!matchedEntryBlock.includes(chinesePath)) {
    errors.push(
      requireTopEntry
        ? `CHANGELOG.md top entry must link to ${chinesePath}.`
        : `CHANGELOG.md entry for version ${normalizedVersion} must link to ${chinesePath}.`
    );
  }

  if (!/^- EN:/m.test(matchedEntryBlock)) {
    errors.push(
      requireTopEntry
        ? 'CHANGELOG.md top entry must include an English summary line prefixed with "- EN:".'
        : `CHANGELOG.md entry for version ${normalizedVersion} must include an English summary line prefixed with "- EN:".`
    );
  }

  if (!/^- 中文[:：]/m.test(matchedEntryBlock)) {
    errors.push(
      requireTopEntry
        ? 'CHANGELOG.md top entry must include a Chinese summary line prefixed with "- 中文：".'
        : `CHANGELOG.md entry for version ${normalizedVersion} must include a Chinese summary line prefixed with "- 中文：".`
    );
  }

  return errors;
}

function validateReleaseArtifacts({ cwd = process.cwd(), version, requireSummary = true, requireTopEntry = true }) {
  const normalizedVersion = normalizeVersion(version, cwd);
  const filePaths = getReleaseNotesPaths({ cwd, version: normalizedVersion });
  const errors = [];

  for (const [locale, filePath] of [
    ['en', filePaths.en],
    ['zh-CN', filePaths.zhCN],
  ]) {
    if (!fs.existsSync(filePath)) {
      errors.push(`Release notes file is missing: ${path.relative(cwd, filePath).replace(/\\/g, '/')}.`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    errors.push(...validateReleaseNotesContent(content, normalizedVersion, locale, { requireSummary }));
  }

  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    errors.push('CHANGELOG.md is missing.');
  } else {
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    errors.push(...validateChangelogEntry(changelogContent, normalizedVersion, { requireTopEntry }));
  }

  return {
    ok: errors.length === 0,
    errors,
    filePaths,
    version: normalizedVersion,
  };
}

function safeExecFileSync(command, args, options) {
  try {
    return execFileSync(command, args, options);
  } catch {
    return null;
  }
}

function buildCommitDraft(cwd, version) {
  const currentTag = getTagVersion(version, cwd);
  const tagsOutput = safeExecFileSync('git', ['tag', '--sort=-version:refname'], {
    cwd,
    encoding: 'utf8',
  });

  if (!tagsOutput) {
    return [];
  }

  const tags = tagsOutput
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const currentTagIndex = tags.indexOf(currentTag);
  const previousTag = currentTagIndex === -1 ? tags[0] : tags[currentTagIndex + 1];
  const currentTagExists = Boolean(
    safeExecFileSync('git', ['rev-parse', '--verify', `refs/tags/${currentTag}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  );

  const rangeEnd = currentTagExists ? currentTag : 'HEAD';
  const logArgs = previousTag
    ? ['log', '--pretty=format:- %s (%h)', `${previousTag}..${rangeEnd}`]
    : ['log', '--pretty=format:- %s (%h)', '--max-count=20'];
  const logOutput = safeExecFileSync('git', logArgs, { cwd, encoding: 'utf8' });

  if (!logOutput) {
    return [];
  }

  const commits = logOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (commits.length === 0) {
    return previousTag
      ? [`- No commits found between ${previousTag} and ${rangeEnd}.`]
      : ['- No commits found.'];
  }

  return previousTag ? [`- Range: ${previousTag}..${rangeEnd}`, ...commits] : commits;
}

function buildReleaseNotesTemplate({ version, locale, commitDraft = [] }) {
  const normalizedVersion = normalizeVersion(version);
  const config = getLocaleConfig(locale);
  const draftingLines =
    commitDraft.length > 0
      ? commitDraft.join('\n')
      : '- No commit draft available. You can still write the notes manually.';

  if (locale === 'en') {
    return `# GlobalCloud XiaoC ${getTagVersion(normalizedVersion)}

## Summary
- TODO: Add 2-4 concise bullets for the GitHub Release summary.

## Highlights
- TODO: Summarize the most important user-facing change in English.

## Product Updates
### Desktop
- TODO: Add desktop-specific changes or remove this subsection if none.
### Web
- TODO: Add web-specific changes or remove this subsection if none.
### Extension
- TODO: Add extension-specific changes or remove this subsection if none.
### Core/Infra
- TODO: Add shared platform or infrastructure changes or remove this subsection if none.

## Fixes
- TODO: Capture the most relevant fixes in English.

## Breaking Changes / Upgrade Notes
- TODO: Describe required upgrade actions, or write "None." when nothing changed.

## Developer Notes
- TODO: Capture implementation-facing details that are worth surfacing publicly.

<!-- Release drafting reference:
Remove every TODO placeholder before running "pnpm release:notes:check ${getTagVersion(normalizedVersion)}".

${draftingLines}
-->
`;
  }

  return `# GlobalCloud XiaoC ${getTagVersion(normalizedVersion)}

## 概括
- TODO: 用 2-4 条简短要点概括本次发布，供 GitHub Release 直接引用。

## 亮点
- TODO: 用中文总结本次发布最重要的用户价值。

## 产品更新
### Desktop
- TODO: 填写桌面端相关变化；如果没有，可以删除这个小节。
### Web
- TODO: 填写 Web 端相关变化；如果没有，可以删除这个小节。
### Extension
- TODO: 填写扩展端相关变化；如果没有，可以删除这个小节。
### Core/Infra
- TODO: 填写共享基础设施或核心能力变化；如果没有，可以删除这个小节。

## 修复
- TODO: 用中文补充最重要的修复。

## 破坏性变更 / 升级说明
- TODO: 说明升级动作；如果没有，请写“无”。

## 开发者说明
- TODO: 补充对开发者或自托管用户有价值的实现说明。

<!-- Release drafting reference:
Remove every TODO placeholder before running "pnpm release:notes:check ${getTagVersion(normalizedVersion)}".

${draftingLines}
-->
`;
}

function createReleaseNotesFiles({ cwd = process.cwd(), version, commitDraft = [], force = false }) {
  const normalizedVersion = normalizeVersion(version, cwd);
  const filePaths = getReleaseNotesPaths({ cwd, version: normalizedVersion });

  for (const filePath of [filePaths.en, filePaths.zhCN]) {
    if (fs.existsSync(filePath) && !force) {
      throw new Error(`Release notes already exist at ${path.relative(cwd, filePath).replace(/\\/g, '/')}.`);
    }
  }

  fs.mkdirSync(path.dirname(filePaths.en), { recursive: true });
  fs.writeFileSync(
    filePaths.en,
    buildReleaseNotesTemplate({ version: normalizedVersion, locale: 'en', commitDraft }),
    'utf8'
  );
  fs.writeFileSync(
    filePaths.zhCN,
    buildReleaseNotesTemplate({ version: normalizedVersion, locale: 'zh-CN', commitDraft }),
    'utf8'
  );

  return {
    created: true,
    filePaths,
    version: normalizedVersion,
  };
}

function buildTagScopedFileUrl(repository, tag, relativePath) {
  return `https://github.com/${repository}/blob/${tag}/${relativePath}`;
}

function renderMacSecurityNote(locale) {
  if (locale === 'en') {
    return [
      'macOS note: if macOS reports the app as damaged or cannot verify the developer, this is usually caused by the quarantine attribute on downloaded apps. See the installation guide, or remove it after installing with `xattr -rd com.apple.quarantine /Applications/PromptOptimizer.app`; for a downloaded DMG, you can run the same command on `~/Downloads/PromptOptimizer-*.dmg` before installing.',
    ].join('\n');
  }

  if (locale === 'zh-CN') {
    return [
      'macOS 备注：如果 macOS 提示“已损坏”或“无法验证开发者”，通常是下载文件的隔离属性导致。请参考安装文档；也可以在安装后执行 `xattr -rd com.apple.quarantine /Applications/PromptOptimizer.app`，或在安装前对 `~/Downloads/PromptOptimizer-*.dmg` 执行同类命令。',
    ].join('\n');
  }

  return [renderMacSecurityNote('en'), renderMacSecurityNote('zh-CN')].join('\n');
}

function prepareReleaseNotesForGitHubBody(content, version, cwd = process.cwd()) {
  const expectedTitle = `# GlobalCloud XiaoC ${getTagVersion(version, cwd)}`;
  return stripHtmlComments(content)
    .replace(new RegExp(`^${escapeRegExp(expectedTitle)}\\s*\\n+`, 'm'), '')
    .replace(/^###\s+/gm, '#### ')
    .replace(/^##\s+/gm, '### ')
    .trim();
}

function renderGitHubReleaseBody({ cwd = process.cwd(), version, repository }) {
  const normalizedVersion = normalizeVersion(version, cwd);
  const tag = getTagVersion(normalizedVersion);
  const englishPath = getReleaseNotesPath({ cwd, version: normalizedVersion, locale: 'en' });
  const chinesePath = getReleaseNotesPath({ cwd, version: normalizedVersion, locale: 'zh-CN' });
  const englishContent = fs.readFileSync(englishPath, 'utf8').replace(/\r\n/g, '\n').trim();
  const chineseContent = fs.readFileSync(chinesePath, 'utf8').replace(/\r\n/g, '\n').trim();
  const englishGuideUrl = buildTagScopedFileUrl(repository, tag, 'mkdocs/docs/en/deployment/desktop.md');
  const chineseGuideUrl = buildTagScopedFileUrl(repository, tag, 'mkdocs/docs/zh/deployment/desktop.md');
  const englishBody = prepareReleaseNotesForGitHubBody(englishContent, normalizedVersion, cwd);
  const chineseBody = prepareReleaseNotesForGitHubBody(chineseContent, normalizedVersion, cwd);

  return [
    '## English',
    '',
    englishBody,
    '',
    `Installation guide: [English](${englishGuideUrl}) | [中文](${chineseGuideUrl})`,
    `[Source release notes (EN)](${buildTagScopedFileUrl(repository, tag, getReleaseNotesRelativePath(normalizedVersion, 'en', cwd))})`,
    '',
    '---',
    '',
    '## 中文',
    '',
    chineseBody,
    '',
    `安装文档：[English](${englishGuideUrl}) | [中文](${chineseGuideUrl})`,
    `[仓库版本说明（中文）](${buildTagScopedFileUrl(repository, tag, getReleaseNotesRelativePath(normalizedVersion, 'zh-CN', cwd))})`,
    '',
    '---',
    '',
    renderMacSecurityNote(),
    '',
  ].join('\n');
}

function printUsage() {
  console.log('Usage: node scripts/release-notes.js <new|check|check-entry|render-body> [version] [repository]');
  console.log('Examples:');
  console.log('  pnpm release:notes:new 2.9.0');
  console.log('  pnpm release:notes:check v2.9.0');
  console.log('  pnpm release:notes:check:entry v2.6.0');
  console.log('  node scripts/release-notes.js render-body v2.9.0 linshenkx/prompt-optimizer');
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const [command, versionArg, repositoryArg] = argv;

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  const version = normalizeVersion(versionArg, cwd);

  if (command === 'new') {
    const result = createReleaseNotesFiles({
      cwd,
      version,
      commitDraft: buildCommitDraft(cwd, version),
    });
    console.log(
      `Created ${path.relative(cwd, result.filePaths.en).replace(/\\/g, '/')} and ${path
        .relative(cwd, result.filePaths.zhCN)
        .replace(/\\/g, '/')} for ${getTagVersion(version)}.`
    );
    console.log('Next steps: update both files and add the matching top entry in CHANGELOG.md.');
    return;
  }

  if (command === 'check') {
    const result = validateReleaseArtifacts({ cwd, version, requireSummary: true });
    if (!result.ok) {
      console.error(`Release notes validation failed for ${getTagVersion(version)}:`);
      for (const error of result.errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log(`Release notes validation passed for ${getTagVersion(version)}.`);
    return;
  }

  if (command === 'check-entry') {
    const result = validateReleaseArtifacts({
      cwd,
      version,
      requireSummary: true,
      requireTopEntry: false,
    });
    if (!result.ok) {
      console.error(`Release notes entry validation failed for ${getTagVersion(version)}:`);
      for (const error of result.errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log(`Release notes entry validation passed for ${getTagVersion(version)}.`);
    return;
  }

  if (command === 'render-body') {
    if (!repositoryArg) {
      throw new Error('render-body requires a repository argument like "linshenkx/prompt-optimizer".');
    }
    process.stdout.write(renderGitHubReleaseBody({ cwd, version, repository: repositoryArg }));
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {
  buildCommitDraft,
  buildReleaseNotesTemplate,
  createReleaseNotesFiles,
  extractSectionBody,
  getReleaseNotesPath,
  getReleaseNotesPaths,
  getReleaseNotesRelativePath,
  getTagVersion,
  main,
  normalizeVersion,
  renderGitHubReleaseBody,
  renderMacSecurityNote,
  validateChangelogEntry,
  validateReleaseArtifacts,
  validateReleaseNotesContent,
};
