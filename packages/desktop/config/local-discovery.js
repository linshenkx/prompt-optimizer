const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { fetch, Agent } = require('undici');

// Only read the documented port field; never return or change Magpie's settings.
async function readMagpiePort(readFile = fs.readFile, env = process.env, home = os.homedir()) {
  try {
    const file = path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'magpie', 'settings.json');
    const { port } = JSON.parse(await readFile(file, 'utf8'));
    return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined;
  } catch {
    return undefined;
  }
}

async function discoverDesktopLocalServices(ports = {}) {
  const { discoverLocalServices, validateLocalDiscoveryPorts } = require('@prompt-optimizer/core');
  const validated = validateLocalDiscoveryPorts(ports);
  if (validated.magpie === undefined) validated.magpie = await readMagpiePort();
  // Discovery must connect directly even when the app has a system/manual proxy.
  const dispatcher = new Agent();
  try {
    return await discoverLocalServices(validated, {
      fetch: (url, options) => fetch(url, { ...options, dispatcher }),
    });
  } finally {
    await dispatcher.destroy();
  }
}

async function fetchDesktopLocalServiceModels(input) {
  const { fetchLocalServiceModels } = require('@prompt-optimizer/core');
  const dispatcher = new Agent();
  try {
    return await fetchLocalServiceModels(input, {
      fetch: (url, options) => fetch(url, { ...options, dispatcher }),
    });
  } finally {
    await dispatcher.destroy();
  }
}

module.exports = { readMagpiePort, discoverDesktopLocalServices, fetchDesktopLocalServiceModels };
