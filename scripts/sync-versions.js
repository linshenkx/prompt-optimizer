const fs = require('node:fs');
const path = require('node:path');
const { releaseChannel } = require('./release-channel.js');

function syncVersions(cwd = path.resolve(__dirname, '..')) {
  const read = file => JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf8'));
  const policy = releaseChannel(read('package.json').version);
  const desktopPath = 'packages/desktop/package.json';
  const extensionPath = 'packages/extension/public/manifest.json';
  // Read and validate both before changing either file.
  const desktop = read(desktopPath);
  const extension = read(extensionPath);
  desktop.version = policy.version;
  extension.version = policy.extensionVersion;
  if (policy.isPrerelease) extension.version_name = policy.version;
  else delete extension.version_name;
  for (const [file, data] of [[desktopPath, desktop], [extensionPath, extension]]) {
    const content = JSON.stringify(data, null, 2) + '\n';
    if (fs.readFileSync(path.join(cwd, file), 'utf8') !== content) {
      fs.writeFileSync(path.join(cwd, file), content);
    }
  }
  return policy;
}

if (require.main === module) {
  try { console.log(`Versions synchronized: ${syncVersions().version}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { syncVersions };
