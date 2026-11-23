const { isAbsolute, join, relative } = require('node:path');

function desktopMcpEntry(resourcesPath, bin = 'prompt-optimizer-product-mcp.cjs') {
  return join(resourcesPath, 'app.asar', 'node_modules', '@prompt-optimizer', 'mcp-server', 'bin',
    bin);
}

function isDesktopMcpInvocation(argument, resourcesPath) {
  return typeof resourcesPath === 'string' && typeof argument === 'string' &&
    isAbsolute(argument) && (relative(desktopMcpEntry(resourcesPath), argument) === '' ||
      relative(desktopMcpEntry(resourcesPath, 'prompt-optimizer-desktop-mcp.cjs'), argument) === '');
}

function buildCodexMcpConfig({ executable, resourcesPath, userDataPath }) {
  return [
    '[mcp_servers.prompt_optimizer_product]',
    'command = ' + JSON.stringify(executable),
    'args = ' + JSON.stringify([desktopMcpEntry(resourcesPath), '--desktop-profile=' + userDataPath]),
    'env = { ELECTRON_RUN_AS_NODE = "1" }',
    '',
  ].join('\n');
}

module.exports = { buildCodexMcpConfig, isDesktopMcpInvocation };
