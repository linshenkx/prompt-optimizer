const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// One policy for tags, source versions, GitHub metadata and image tags.
// Build metadata is unsupported: '+' is not a Docker tag character.
function releaseChannel(value) {
  const version = String(value ?? '').replace(/^v/, '');
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match || version.length > 128) throw new Error(`Unsupported release version: ${value}`);
  if (match[4]?.split('.').some(id => /^\d+$/.test(id) && id.length > 1 && id.startsWith('0'))) {
    throw new Error('Numeric prerelease identifiers must not have leading zeroes');
  }
  if (match.slice(1, 4).some(n => Number(n) > 65535) || match.slice(1, 4).every(n => Number(n) === 0)) {
    throw new Error('Release version is outside Chrome manifest version bounds');
  }
  return {
    version, tag: `v${version}`, isPrerelease: Boolean(match[4]),
    extensionVersion: match.slice(1, 4).join('.'),
    imageTags: match[4] ? [version] : [version, 'latest'],
  };
}

function validateVersions(root, desktop, extension, requested) {
  const policy = releaseChannel(requested);
  if (root.version !== policy.version || desktop.version !== policy.version) {
    throw new Error('Release tag, root package and desktop package versions must match');
  }
  if (extension.version !== policy.extensionVersion ||
      (policy.isPrerelease ? extension.version_name !== policy.version :
        extension.version_name != null && extension.version_name !== policy.version)) {
    throw new Error('Extension version/version_name does not match the release');
  }
  return policy;
}

function assertForwardStable(policy, publishedTags) {
  if (policy.isPrerelease) return;
  const target = policy.extensionVersion.split('.').map(Number);
  for (const tag of publishedTags) {
    let previous;
    try { previous = releaseChannel(tag); } catch { continue; }
    if (previous.isPrerelease) continue;
    const parts = previous.extensionVersion.split('.').map(Number);
    const different = parts.findIndex((n, i) => n !== target[i]);
    if (different === -1 || parts[different] > target[different]) {
      throw new Error(`Stable release must be newer than published ${previous.tag}`);
    }
  }
}

function assertReleaseState(policy, releases, requireDraft = false) {
  if (!Array.isArray(releases) || releases.some(r => typeof r.tag_name !== 'string' ||
      typeof r.draft !== 'boolean' || typeof r.prerelease !== 'boolean')) {
    throw new Error('Invalid GitHub release state');
  }
  const current = releases.find(r => r.tag_name === policy.tag);
  if (current && !current.draft) throw new Error('Refusing to overwrite a published release');
  if (requireDraft && !current?.draft) throw new Error('Expected an existing draft release');
  if (current && current.prerelease !== policy.isPrerelease) throw new Error('Draft release channel mismatch');
  assertForwardStable(policy, releases.filter(r => !r.draft && !r.prerelease).map(r => r.tag_name));
}

function validateSource(cwd, requested, expectedSha) {
  const read = file => JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf8'));
  const policy = validateVersions(read('package.json'), read('packages/desktop/package.json'),
    read('packages/extension/public/manifest.json'), requested);
  const git = args => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const sha = git(['rev-parse', 'HEAD']);
  const tagSha = git(['rev-parse', '--verify', `refs/tags/${policy.tag}^{commit}`]);
  if (tagSha !== sha || (expectedSha && expectedSha !== sha)) {
    throw new Error('Release tag and checked-out source commit must match');
  }
  return { ...policy, sha };
}

function main(env = process.env, cwd = process.cwd()) {
  const result = validateSource(cwd, env.RELEASE_VERSION || env.GITHUB_REF_NAME, env.RELEASE_SHA);
  const output = {
    version: result.tag, version_no_prefix: result.version,
    is_prerelease: String(result.isPrerelease),
    version_type: result.isPrerelease ? 'prerelease' : 'release',
    source_sha: result.sha, extension_version: result.extensionVersion,
  };
  const text = Object.entries(output).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, text);
  process.stdout.write(text);
}

function readRemoteReleases(env = process.env, cwd = process.cwd(), run = execFileSync) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '')) throw new Error('Missing repository identity');
  // Release bodies and asset metadata grow past execFileSync's default buffer.
  // Project each page in gh before capturing output; JSON lines retain records
  // across pages without combining the incompatible --slurp and --jq options.
  const lines = run('gh', ['api', '--paginate',
    `repos/${env.GITHUB_REPOSITORY}/releases`, '--jq',
    '.[] | {tag_name, draft, prerelease} | @json'], {
    cwd, env, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  });
  return lines.trim() ? lines.trim().split(/\r?\n/).map(line => JSON.parse(line)) : [];
}

function checkRemoteReleaseState(env = process.env, cwd = process.cwd()) {
  const policy = validateSource(cwd, env.RELEASE_VERSION, env.RELEASE_SHA);
  assertReleaseState(policy, readRemoteReleases(env, cwd), env.REQUIRE_DRAFT === 'true');
  console.log(`Release state verified: ${policy.tag}`);
}

if (require.main === module) {
  try {
    if (process.argv[2] === '--check-state') checkRemoteReleaseState();
    else main();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { releaseChannel, validateVersions, validateSource, assertForwardStable, assertReleaseState, readRemoteReleases, main };
