const { isAbsolute, join, relative } = require('node:path');

function desktopMcpEntry(resourcesPath) {
  return join(resourcesPath, 'app.asar', 'node_modules', '@prompt-optimizer', 'mcp-server', 'bin',
    'prompt-optimizer-desktop-mcp.cjs');
}

function isDesktopMcpInvocation(argument, resourcesPath) {
  return typeof resourcesPath === 'string' && typeof argument === 'string' &&
    isAbsolute(argument) && relative(desktopMcpEntry(resourcesPath), argument) === '';
}

function buildCodexMcpConfig({ executable, resourcesPath, userDataPath }) {
  return [
    '[mcp_servers.prompt_optimizer_desktop]',
    'command = ' + JSON.stringify(executable),
    'args = ' + JSON.stringify([desktopMcpEntry(resourcesPath), '--desktop-profile=' + userDataPath]),
    'env = { ELECTRON_RUN_AS_NODE = "1" }',
    '',
  ].join('\n');
}

module.exports = { buildCodexMcpConfig, isDesktopMcpInvocation };
