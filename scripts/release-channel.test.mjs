import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import policyModule from './release-channel.js';
import syncModule from './sync-versions.js';

const { releaseChannel, validateVersions, validateSource, assertForwardStable, assertReleaseState, readRemoteReleases } = policyModule;
const { syncVersions } = syncModule;
const read = file => fs.readFileSync(file, 'utf8');
const release = yaml.load(read('.github/workflows/release.yml'));
const docker = yaml.load(read('.github/workflows/docker.yml'));

test('remote history projects metadata before capture and keeps later-page publication guards', () => {
  const releases = readRemoteReleases({ GITHUB_REPOSITORY: 'owner/repo' }, process.cwd(), (bin, args, options) => {
    assert.equal(bin, 'gh');
    assert.ok(args.includes('--paginate'));
    assert.ok(!args.includes('--slurp'), 'gh does not support --slurp with --jq');
    assert.equal(args[args.indexOf('--jq') + 1], '.[] | {tag_name, draft, prerelease} | @json');
    assert.equal(options.encoding, 'utf8');
    return [
      { tag_name: 'v2.11.13', draft: false, prerelease: false },
      { tag_name: 'v2.12.0-beta.1', draft: false, prerelease: true },
      { tag_name: 'v2.12.0', draft: false, prerelease: false },
    ].map(r => JSON.stringify(r)).join('\r\n') + '\r\n';
  });
  assert.throws(() => assertReleaseState(releaseChannel('2.12.0-beta.1'), releases), /published release/);
  assert.throws(() => assertReleaseState(releaseChannel('2.11.14'), releases), /newer/);
});

test('remote history handles empty repositories and refuses malformed state or command failure', () => {
  const env = { GITHUB_REPOSITORY: 'owner/repo' };
  assert.deepEqual(readRemoteReleases(env, '.', () => ''), []);
  assert.throws(() => readRemoteReleases(env, '.', () => '{broken'), SyntaxError);
  assert.throws(() => readRemoteReleases(env, '.', () => { throw new Error('API unavailable'); }), /API unavailable/);
  const invalid = readRemoteReleases(env, '.', () => '{"tag_name":"v2.12.0-beta.1"}\n');
  assert.throws(() => assertReleaseState(releaseChannel('2.12.0-beta.1'), invalid), /Invalid GitHub release state/);
});

for (const version of ['2.12.0-beta.1', '2.12.0-alpha.2', '2.12.0-rc.1', '2.12.0-preview.3', '2.12.0-hotfix.1']) {
  test(`${version} cannot promote a stable image or GitHub release`, () => {
    const result = releaseChannel(`v${version}`);
    assert.equal(result.isPrerelease, true);
    assert.deepEqual(result.imageTags, [version]);
    assert.equal(result.extensionVersion, '2.12.0');
  });
}

test('stable version selects version and latest tags', () => {
  assert.deepEqual(releaseChannel('v2.12.0').imageTags, ['2.12.0', 'latest']);
  assert.equal(releaseChannel('2.12.0').isPrerelease, false);
});

test('invalid versions cannot reach output files or image tags', () => {
  for (const input of ['', 'v', 'vv2.12.0', '2.12', '02.12.0', '2.12.0-beta.01',
    '2.12.0+build.1', '2.12.0\nlatest=true', '2.12.0;echo hi', '2.12.0-foo/',
    '65536.0.0', '0.0.0', `2.12.0-${'a'.repeat(130)}`]) {
    assert.throws(() => releaseChannel(input), undefined, input);
  }
});

test('tag/root/desktop/extension mismatch fails closed', () => {
  const root = { version: '2.12.0-beta.1' };
  const ext = { version: '2.12.0', version_name: root.version };
  assert.equal(validateVersions(root, root, ext, 'v2.12.0-beta.1').isPrerelease, true);
  assert.throws(() => validateVersions(root, { version: '2.11.13' }, ext, root.version));
  assert.throws(() => validateVersions(root, root, ext, '2.12.0'));
  assert.throws(() => validateVersions(root, root, { version: root.version }, root.version));
  assert.throws(() => validateVersions(root, root, { version: '2.12.0' }, root.version));
});

test('stable aliases cannot move backward, but previews do not change aliases', () => {
  for (const version of ['2.11.13', '2.12.0']) {
    assert.throws(() => assertForwardStable(releaseChannel(version), ['v2.12.0']));
  }
  assert.doesNotThrow(() => assertForwardStable(releaseChannel('2.13.0'), ['v2.12.0', 'v2.13.0-beta.1']));
  assert.doesNotThrow(() => assertForwardStable(releaseChannel('2.12.0-beta.2'), ['v2.13.0']));
});

test('resumed jobs reject published versions, missing drafts and stale stable releases', () => {
  const stable = releaseChannel('2.12.0');
  const beta = releaseChannel('2.12.0-beta.1');
  const row = (tag_name, draft, prerelease) => ({ tag_name, draft, prerelease });
  assert.throws(() => assertReleaseState(beta, [row(beta.tag, false, true)], true));
  assert.throws(() => assertReleaseState(stable, [], true));
  assert.throws(() => assertReleaseState(stable, [row(stable.tag, true, false), row('v2.13.0', false, false)], true));
  assert.throws(() => assertReleaseState(beta, [row(beta.tag, true, false)], true));
  assert.throws(() => assertReleaseState(stable, [{ tag_name: stable.tag }]));
  assert.doesNotThrow(() => assertReleaseState(stable, [row('v2.11.13', false, false)]));
  assert.doesNotThrow(() => assertReleaseState(beta, [row(beta.tag, true, true)], true));
});

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-release-policy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), JSON.stringify(content, null, 2) + '\n');
  };
  const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  write('package.json', { version: '2.12.0-beta.1' });
  write('packages/desktop/package.json', { version: '2.11.13', name: 'desktop' });
  write('packages/extension/public/manifest.json', { version: '2.11.13', manifest_version: 3 });
  return { dir, write, git };
}

test('version sync produces a valid beta extension and clears its name on stable transition', t => {
  const { dir, write } = fixture(t);
  syncVersions(dir);
  const extension = () => JSON.parse(read(path.join(dir, 'packages/extension/public/manifest.json')));
  assert.deepEqual(extension(), { version: '2.12.0', manifest_version: 3, version_name: '2.12.0-beta.1' });
  write('package.json', { version: '2.12.0' });
  syncVersions(dir);
  assert.deepEqual(extension(), { version: '2.12.0', manifest_version: 3 });
  assert.equal(JSON.parse(read(path.join(dir, 'packages/desktop/package.json'))).name, 'desktop');
});

test('real Git tags must resolve to the exact tested source; missing tags and moved HEAD fail', t => {
  const { dir, write, git } = fixture(t);
  syncVersions(dir);
  git(['init', '-q']);
  git(['add', '.']);
  git(['-c','user.name=Release Test','-c','user.email=release@example.invalid','commit','-qm','fixture']);
  const sha = git(['rev-parse', 'HEAD']);
  assert.throws(() => validateSource(dir, '2.12.0-beta.1', sha));
  git(['-c','user.name=Release Test','-c','user.email=release@example.invalid','tag','-a','v2.12.0-beta.1','-m','fixture']);
  assert.equal(validateSource(dir, '2.12.0-beta.1', sha).sha, sha);
  const output = path.join(dir, 'github-output');
  execFileSync(process.execPath, [path.resolve('scripts/release-channel.js')], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, RELEASE_VERSION: 'v2.12.0-beta.1', RELEASE_SHA: sha, GITHUB_OUTPUT: output },
  });
  assert.match(read(output), /^is_prerelease=true$/m);
  assert.match(read(output), /^extension_version=2\.12\.0$/m);
  assert.ok(read(output).includes(`source_sha=${sha}\n`));
  assert.throws(() => validateSource(dir, '2.12.0-beta.1', '0'.repeat(40)));
  write('other.json', { changed: true });
  git(['add', '.']);
  git(['-c','user.name=Release Test','-c','user.email=release@example.invalid','commit','-qm','moved']);
  assert.throws(() => validateSource(dir, '2.12.0-beta.1'));
});

test('Docker publication is reusable only, after every platform artifact succeeds', () => {
  assert.deepEqual(Object.keys(docker.on), ['workflow_call']);
  assert.equal(release.jobs['publish-docker'].uses, './.github/workflows/docker.yml');
  assert.deepEqual(release.jobs['publish-docker'].needs, ['prepare-release','build-windows','build-macos','build-linux','build-extension']);
  assert.deepEqual(release.jobs['publish-release'].needs, ['prepare-release', 'publish-docker']);
  assert.deepEqual(release.jobs.test.needs, ['validate-release-notes']);
  assert.equal(release.concurrency['cancel-in-progress'], false);
});

test('all platform builds and Docker consume the validated source SHA', () => {
  for (const name of ['build-windows','build-macos','build-linux','build-extension']) {
    const checkout = release.jobs[name].steps.find(s => s.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout.with.ref, '${{ needs.prepare-release.outputs.source_sha }}');
  }
  assert.equal(release.jobs['publish-docker'].with.source_sha, '${{ needs.prepare-release.outputs.source_sha }}');
  assert.equal(docker.jobs.build.steps[0].with.ref, '${{ inputs.source_sha }}');
  const validator = docker.jobs.build.steps.find(s => s.id === 'version');
  assert.equal(validator.env.RELEASE_SHA, '${{ inputs.source_sha }}');
  assert.equal(validator.run, 'node scripts/release-channel.js');
});

test('both registries receive version tags and the same verified digest before stable promotion', () => {
  const steps = docker.jobs.build.steps;
  const build = steps.find(s => s.id === 'image');
  assert.equal(build.with.platforms, 'linux/amd64,linux/arm64');
  assert.equal(build.with.tags.trim().split('\n').length, 2);
  assert.doesNotMatch(build.with.tags, /latest|beta$/m);
  assert.match(build.with.labels, /org.opencontainers.image.revision/);
  const verify = steps.find(s => s.name?.startsWith('Verify both'));
  const promote = steps.find(s => s.name === 'Promote stable images only');
  assert.ok(steps.indexOf(verify) < steps.indexOf(promote));
  assert.match(verify.run, /test "\$actual" = "\$DIGEST"/);
  assert.equal(promote.if, "steps.version.outputs.is_prerelease == 'false'");
  assert.match(promote.run, /"\$image@\$DIGEST"/);
});

test('actual workflow verification shell stops on a mismatched registry digest', t => {
  const { dir } = fixture(t);
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
  const verify = docker.jobs.build.steps.find(s => s.name?.startsWith('Verify both')).run;
  const promote = docker.jobs.build.steps.find(s => s.name === 'Promote stable images only').run;
  const harness = `set -euo pipefail
docker() {
  printf '%s\\n' "$*" >> "$COMMAND_LOG"
  if [ "$1 $2 $3" = 'buildx imagetools inspect' ] && [ "\u0024{5:-}" = '--format' ]; then
    if [ "$MISMATCH" = true ] && [[ "$4" == *registry-two* ]]; then echo sha256:wrong; else echo "$DIGEST"; fi
  fi
}
${verify}
${promote}
`;
  for (const mismatch of ['false', 'true']) {
    const log = path.join(dir, `docker-${mismatch}.log`).replaceAll('\\', '/');
    const result = spawnSync(bash, ['--noprofile', '--norc', '-c', harness], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, DOCKERHUB_IMAGE: 'registry-one/app', ALIYUN_IMAGE: 'registry-two/app',
        VERSION: '2.12.0', DIGEST: 'sha256:matching', MISMATCH: mismatch, COMMAND_LOG: log,
        GITHUB_STEP_SUMMARY: path.join(dir, 'summary').replaceAll('\\', '/') },
    });
    assert.equal(result.status, mismatch === 'true' ? 1 : 0, result.stderr);
    const calls = read(log);
    if (mismatch === 'true') assert.doesNotMatch(calls, /imagetools create/);
    else assert.equal(calls.match(/imagetools create/g).length, 2);
  }
});

test('published releases are immutable and preview metadata is never latest', () => {
  const prepare = release.jobs['prepare-release'].steps;
  const draft = prepare.find(s => s.name === '创建或更新 Draft Release');
  assert.match(draft.run, /if \[ "\$is_draft" != "true" \]; then[\s\S]*exit 1/);
  assert.match(draft.run, /--verify-tag/);
  const publish = release.jobs['publish-release'].steps.find(s => s.name === '发布 Draft Release').run;
  assert.match(publish, /--prerelease="\$IS_PRERELEASE"/);
  assert.match(publish, /--latest=.*IS_PRERELEASE.*false.*true/);
  assert.ok(prepare.some(s => s.run === 'node scripts/release-channel.js --check-state'));
  for (const steps of [docker.jobs.build.steps, release.jobs['publish-release'].steps]) {
    const guard = steps.find(s => s.run === 'node scripts/release-channel.js --check-state');
    assert.equal(guard.env.REQUIRE_DRAFT, 'true');
    const mutation = steps.findIndex(s => s.uses?.startsWith('docker/login-action@') || s.name === '发布 Draft Release');
    assert.ok(steps.indexOf(guard) < mutation);
  }
  const defaults = read('packages/desktop/config/constants.js');
  assert.match(defaults, /allowPrerelease: false/);
});

test('both sides of the reusable Docker workflow can see the unpublished draft', () => {
  // A read-only GITHUB_TOKEN omits draft releases from the API. The callee
  // cannot elevate permissions beyond the caller, so both must grant write.
  assert.equal(release.jobs['publish-docker'].permissions.contents, 'write');
  assert.equal(docker.jobs.build.permissions.contents, 'write');
});

test('daily repository gate runs release policy and release notes tests', () => {
  const gate = JSON.parse(read('package.json')).scripts['test:repo'];
  for (const file of ['scripts/release-channel.test.mjs','scripts/release-notes.test.mjs']) {
    assert.ok(gate.split(/\s+/).includes(file));
  }
});
