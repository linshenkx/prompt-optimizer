import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const repoDir = resolve(packageDir, '../..');
const entries = ['index', 'start', 'desktop', 'desktop-business', 'browser', 'product', 'legacy'];
const { values } = parseArgs({ options: { 'out-dir': { type: 'string' } } });
const destination = values['out-dir']
  ? resolve(process.env.INIT_CWD || process.cwd(), values['out-dir'])
  : join(repoDir, 'dist', 'npm');

async function collectNotices(builds) {
  const packageRoots = new Set();
  const nodeModules = sep + 'node_modules' + sep;
  for (const { metafile } of builds) {
    for (const entry of Object.keys(metafile.inputs)) {
      const input = resolve(packageDir, entry);
      const index = input.lastIndexOf(nodeModules);
      if (index < 0) continue;
      const moduleRoot = input.slice(0, index + nodeModules.length);
      const [name, scopedName] = input.slice(moduleRoot.length).split(sep);
      packageRoots.add(name.startsWith('@') ? join(moduleRoot, name, scopedName) : join(moduleRoot, name));
    }
  }

  const notices = [];
  for (const root of packageRoots) {
    const { name, version, license } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const files = (await readdir(root, { withFileTypes: true }))
      .filter(file => file.isFile() && /^(?:licen[cs]e|copying|notice|patents)(?:$|[._-])/i.test(file.name))
      .map(file => file.name)
      .sort();
    const texts = await Promise.all(files.map(async file => file + '\n' + (await readFile(join(root, file), 'utf8')).trim()));
    notices.push([name + '@' + version + (license ? ' (' + license + ')' : ''), ...texts].join('\n\n'));
  }
  return [...new Set(notices)].sort().join('\n\n' + '-'.repeat(72) + '\n\n') + '\n';
}

const repoBlobBase = 'https://github.com/linshenkx/prompt-optimizer/blob/master/';

function rewriteReadmeLinks(markdown) {
  return markdown.replace(/\]\(\.\.\/\.\.\/([^)\s]+)\)/g, (_, target) => `](${repoBlobBase}${target})`);
}

const tempRoot = await realpath(tmpdir());
const staging = await mkdtemp(join(tempRoot, 'prompt-optimizer-mcp-npm-'));
try {
  const dist = join(staging, 'dist');
  const skill = join('skills', 'prompt-optimizer-compare', 'SKILL.md');
  await mkdir(join(staging, 'skills', 'prompt-optimizer-compare'), { recursive: true });

  const bundleOptions = {
    absWorkingDir: packageDir,
    bundle: true,
    minify: true,
    platform: 'node',
    target: 'node24',
    metafile: true,
  };
  const builds = await Promise.all([
    build({
      ...bundleOptions,
      entryPoints: entries.map(entry => 'src/' + entry + '.ts'),
      outdir: dist,
      format: 'esm',
      splitting: true,
      // Some bundled CommonJS libraries still require Node built-ins at runtime.
      banner: { js: 'import { createRequire as __mcpCreateRequire } from "node:module";\nconst require = __mcpCreateRequire(import.meta.url);' },
    }),
    build({
      ...bundleOptions,
      entryPoints: ['preload-env.cjs'],
      outfile: join(staging, 'preload-env.cjs'),
      format: 'cjs',
    }),
  ]);
  // These optional accelerators and color support already have a JS fallback.
  const optionalImports = new Set(['bufferutil', 'utf-8-validate', 'supports-color']);
  for (const { metafile } of builds) {
    for (const { imports } of Object.values(metafile.outputs)) {
      const missing = imports.find(item => item.external && !isBuiltin(item.path) && !optionalImports.has(item.path));
      if (missing) throw new Error('Unbundled npm runtime dependency: ' + missing.path);
    }
  }

  const { dependencies, devDependencies, scripts, files, types, ...manifest } =
    JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
  manifest.files = ['bin', 'dist', 'preload-env.cjs', 'skills', 'THIRD_PARTY_NOTICES.txt'];

  await Promise.all([
    cp(join(packageDir, 'bin'), join(staging, 'bin'), { recursive: true }),
    readFile(join(packageDir, 'README.md'), 'utf8')
      .then(content => writeFile(join(staging, 'README.md'), rewriteReadmeLinks(content))),
    copyFile(join(repoDir, 'LICENSE'), join(staging, 'LICENSE')),
    copyFile(join(repoDir, '.agents', skill), join(staging, skill)),
    writeFile(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n'),
    writeFile(join(staging, 'THIRD_PARTY_NOTICES.txt'), await collectNotices(builds)),
    ...entries.map(entry => writeFile(join(dist, entry + '.cjs'), 'module.exports = require("./' + entry + '.js");\n')),
  ]);

  await mkdir(destination, { recursive: true });
  execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--pack-destination', destination], {
    cwd: staging,
    stdio: 'inherit',
    windowsHide: true,
  });
} finally {
  // This is the unique directory allocated by mkdtemp, not a configurable output path.
  if (resolve(staging).startsWith(join(tempRoot, 'prompt-optimizer-mcp-npm-'))) {
    await rm(staging, { recursive: true, force: true });
  }
}
