const { AsyncLocalStorage } = require('node:async_hooks');
const { EventEmitter } = require('node:events');
const { matchesBypassRule } = require('./network-settings');
const { isPrivateIPv6, shouldBypassProxyForHostname, mapProxyDecisionToUrl } = require('./proxy-dispatcher');

class ModelNetworkDispatcher extends EventEmitter {
  constructor({ settings, fallbackDispatcher, Agent, ProxyAgent, Socks5ProxyAgent, resolveProxy }) {
    super();
    this.settings = settings;
    this.fallbackDispatcher = fallbackDispatcher;
    this.directDispatcher = new Agent();
    this.ProxyAgent = ProxyAgent;
    this.Socks5ProxyAgent = Socks5ProxyAgent;
    this.resolveProxy = resolveProxy;
    this.proxies = new Map();
    this.context = new AsyncLocalStorage();
    this.activeRequests = 0;
    this.lastConnection = null;
  }

  async run(callback, { connectionTest = false, onConnectionTest } = {}) {
    const context = { routes: new Map() };
    this.activeRequests += 1;
    try {
      return await this.context.run(context, callback);
    } finally {
      this.activeRequests -= 1;
      if (connectionTest) {
        this.lastConnection = { routes: [...context.routes.values()], testedAt: new Date().toISOString() };
        onConnectionTest?.(this.lastConnection);
      }
    }
  }

  async selectRoute(url) {
    const localHost = url.hostname.includes(':')
      ? isPrivateIPv6(url.hostname.replace(/^\[|\]$/g, ''))
      : shouldBypassProxyForHostname(url.hostname);
    if (this.settings.mode === 'direct' || matchesBypassRule(url.hostname, this.settings.bypassRules)
      || localHost) {
      return { dispatcher: this.directDispatcher, mode: 'direct' };
    }
    let proxyUrl = this.settings.proxyUrl;
    if (this.settings.mode === 'system') {
      // PAC and system exclusions are evaluated for the actual request, not a sample external URL.
      const decisions = (await this.resolveProxy(url.href)).split(';').map(value => value.trim());
      const decision = decisions.find(value => value === 'DIRECT' || /^(PROXY|HTTPS) /.test(value)
        || (this.Socks5ProxyAgent && /^SOCKS5 /.test(value)));
      if (!decision) throw new Error('networkSettings.errors.unsupportedSystemProxy');
      if (decision === 'DIRECT') return { dispatcher: this.directDispatcher, mode: 'direct' };
      proxyUrl = decision.startsWith('HTTPS ') ? `https://${decision.split(' ')[1]}` : mapProxyDecisionToUrl(decision);
    }
    if (!this.proxies.has(proxyUrl)) {
      const Agent = proxyUrl.startsWith('socks5:') ? this.Socks5ProxyAgent : this.ProxyAgent;
      this.proxies.set(proxyUrl, new Agent(proxyUrl));
    }
    return { dispatcher: this.proxies.get(proxyUrl), mode: `${this.settings.mode}-proxy` };
  }

  dispatch(options, handler) {
    const context = this.context.getStore();
    if (!context) return this.fallbackDispatcher.dispatch(options, handler);
    const url = new URL(`${new URL(String(options.origin)).origin}${options.path || '/'}`);
    this.selectRoute(url).then(({ dispatcher, mode }) => {
      context.routes.set(`${url.host}:${mode}`, { host: url.host, mode });
      dispatcher.dispatch(options, handler);
    }).catch(error => handler.onError(error));
    return true;
  }

  async close(callback) {
    try {
      await Promise.all([...new Set([this.fallbackDispatcher, this.directDispatcher, ...this.proxies.values()])]
        .map(dispatcher => dispatcher.close()));
      callback?.();
    } catch (error) {
      if (callback) callback(error); else throw error;
    }
  }

  async destroy(error, callback) {
    if (typeof error === 'function') { callback = error; error = undefined; }
    try {
      await Promise.all([...new Set([this.fallbackDispatcher, this.directDispatcher, ...this.proxies.values()])]
        .map(dispatcher => dispatcher.destroy(error)));
      callback?.();
    } catch (failure) {
      if (callback) callback(failure); else throw failure;
    }
  }
}

module.exports = { ModelNetworkDispatcher };
