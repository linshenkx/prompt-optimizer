const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const DEFAULT_NETWORK_SETTINGS = Object.freeze({ mode: 'system', proxyUrl: '', bypassRules: [] });

function settingsError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeNetworkSettings(input) {
  if (!input || !['system', 'direct', 'manual'].includes(input.mode)) {
    throw settingsError('networkSettings.errors.invalidMode');
  }
  let proxyUrl = typeof input.proxyUrl === 'string' ? input.proxyUrl.trim() : '';
  if (proxyUrl) {
    let url;
    try { url = new URL(proxyUrl); } catch { throw settingsError('networkSettings.errors.invalidProxy'); }
    if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw settingsError('networkSettings.errors.invalidProxy');
    }
    proxyUrl = url.origin;
  }
  if (input.mode === 'manual' && !proxyUrl) throw settingsError('networkSettings.errors.invalidProxy');
  if (!Array.isArray(input.bypassRules) || input.bypassRules.length > 100) {
    throw settingsError('networkSettings.errors.invalidRules');
  }
  const bypassRules = input.bypassRules.map(rule => {
    if (typeof rule !== 'string') throw settingsError('networkSettings.errors.invalidRules');
    const normalized = rule.trim().toLowerCase().replace(/\.$/, '');
    const hostname = normalized.startsWith('*.') ? normalized.slice(2) : normalized;
    if (!hostname || hostname.length > 253 || !hostname.split('.').every(label =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
      throw settingsError('networkSettings.errors.invalidRules');
    }
    return normalized;
  });
  return { mode: input.mode, proxyUrl, bypassRules: [...new Set(bypassRules)] };
}

function matchesBypassRule(hostname, rules) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return rules.some(rule => rule.startsWith('*.')
    ? host.endsWith(rule.slice(1))
    : host === rule);
}

function effectiveSettings(settings) {
  if (settings.mode === 'direct') return { mode: 'direct' };
  return { mode: settings.mode, proxyUrl: settings.mode === 'manual' ? settings.proxyUrl : '',
    bypassRules: [...settings.bypassRules].sort() };
}

class NetworkSettingsStore {
  constructor(userDataPath) {
    // Kept outside PreferenceService so model/data backups cannot move machine-specific routing.
    this.filePath = path.join(userDataPath, 'model-network-settings.json');
    this.saved = normalizeNetworkSettings(DEFAULT_NETWORK_SETTINGS);
    this.active = this.saved;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.saved = normalizeNetworkSettings(data);
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[Model Network] Invalid saved settings; using system routing.');
    }
    this.active = this.saved;
    return this.snapshot();
  }

  snapshot() {
    return structuredClone({ saved: this.saved, active: this.active,
      restartRequired: JSON.stringify(effectiveSettings(this.saved)) !== JSON.stringify(effectiveSettings(this.active)) });
  }

  async save(input) {
    const settings = normalizeNetworkSettings(input);
    const write = async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryPath, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 });
        await fs.rename(temporaryPath, this.filePath);
        this.saved = settings;
      } finally {
        await fs.rm(temporaryPath, { force: true });
      }
      return this.snapshot();
    };
    const pending = this.writeQueue.then(write);
    this.writeQueue = pending.catch(() => {});
    return pending;
  }
}

module.exports = { DEFAULT_NETWORK_SETTINGS, NetworkSettingsStore, normalizeNetworkSettings, matchesBypassRule };
