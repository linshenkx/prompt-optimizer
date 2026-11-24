import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  assertJson, BrowserBridgeError, productBusinessCatalog, publicBrowserError, type BrowserAccess,
} from '@prompt-optimizer/core/bridge-protocol';
import { createBrowserTransport } from './browser-transport.js';
import { browserSourceId, createBrowserRegistry } from './browser-source-registry.js';
import { createDesktopBusinessServer } from './desktop-business.js';
import { matches, toolSpecs } from './desktop.js';
import type { DesktopProfile } from './desktop-router.js';
import { transferResourceFile, writeCredentialExport } from './desktop-business-resources.js';

type Access = 'read' | 'write';
type Connection = { sourceId: string; kind: 'desktop' | 'browser'; access: Access };
type BrowserSource = ReturnType<ReturnType<typeof createBrowserTransport>['listSources']>['sources'][number];
const text = { type: 'string', minLength: 1 };
const access = { type: 'string', enum: ['read', 'write'] };
const businessNames: Record<string, string> = {
  po_query: 'po_desktop_query', po_mutate: 'po_desktop_mutate',
};
const comparisonSpecs = new Map(toolSpecs('compare').map(tool => [tool.name, tool.inputSchema]));
const readTools = new Set([
  'po_query', 'po_models_list', 'po_assets_list', 'po_assets_list_versions', 'po_assets_get_version',
  'po_runs_get', 'po_runs_list', 'po_comparisons_list', 'po_comparisons_get',
]);

export function defaultDesktopProfile(): DesktopProfile {
  const home = homedir();
  const appData = process.platform === 'win32' ? process.env.APPDATA || join(home, 'AppData', 'Roaming')
    : process.platform === 'darwin' ? join(home, 'Library', 'Application Support')
    : process.env.XDG_CONFIG_HOME || join(home, '.config');
  return { label: 'Desktop', userDataPath: join(appData, '@prompt-optimizer', 'desktop') };
}

function tool(name: string, description: string, properties: Record<string, object>, required: string[] = []): Tool {
  return { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false } };
}

export function createProductServer(
  profiles: DesktopProfile[] = [defaultDesktopProfile()],
  productUrl?: string,
) {
  const registry = createBrowserRegistry(join(dirname(defaultDesktopProfile().userDataPath), 'mcp-browser-sources-v1'));
  const browser = createBrowserTransport({ rememberSource: registry.remember });
  const desktop = createDesktopBusinessServer(profiles);
  const connections = new Map<string, Connection>();
  const businessTools = desktop.tools.filter(spec => 'sourceId' in (spec.inputSchema.properties ?? {}) && spec.name !== 'po_sources_open');
  const business = new Set(businessTools.map(spec => spec.name));
  const tools = [
    tool('po_sources_list', 'List configured desktop sources and previously authorized browser sources, including offline ones. For a new browser source, ask for the product URL and use po_sources_authorize.', {}),
    tool('po_sources_authorize', 'Create a one-use link. Use sourceId to reconnect a remembered browser profile, or productUrl to add a profile. With neither, use the configured web default. If several profiles match, select one by sourceId. Open the link in that profile and approve.', { sourceId: text, productUrl: text, access }),
    tool('po_sources_open', 'Open the selected sourceId or the configured default. Returns the connectionId used by all product tools. A requested permission never exceeds page authorization.', { sourceId: text, access }),
    tool('po_sources_close', 'Close the connection. The source can be reopened while it remains available.', { connectionId: text }, ['connectionId']),
    tool('po_catalog', 'Discover the shared product operations and kinds of model runs for desktop and browser sources.', { domain: text }),
    ...businessTools.map(spec => {
      const fields = { ...spec.inputSchema.properties };
      delete fields.sourceId;
      const name = Object.keys(businessNames).find(alias => businessNames[alias] === spec.name) ?? spec.name;
      const description = spec.description?.replaceAll('desktop', 'product').replaceAll('Desktop', 'Product')
        .replace('Windows product must be running this version. ', '')
        .replace('network requests use the local Node runtime, not Electron proxy settings.', 'network requests use the connected source.');
      return { ...spec, name, description, inputSchema: { ...spec.inputSchema, properties: { ...fields, connectionId: text },
        required: [...(spec.inputSchema.required ?? []).filter(key => key !== 'sourceId'), 'connectionId'] } };
    }),
    ...desktop.tools.filter(spec => !business.has(spec.name) && !spec.name.startsWith('po_sources_') && spec.name !== 'po_desktop_catalog')
      .map(spec => ({ ...spec, description: spec.description?.replaceAll('desktop', 'product')
        .replace('MCP Node runtime network settings', 'connected source network settings') })),
  ];
  const byName = new Map(tools.map(spec => [spec.name, spec]));

  async function listSources() {
    const [configured, remembered] = await Promise.all([
      desktop.call('po_sources_list', {}) as Promise<{ sources: Array<{ sourceId: string; label: string }> }>,
      registry.list(),
    ]);
    const desktopSources = configured.sources.map(source => ({ ...source, kind: 'desktop' as const, authorizedAccess: 'write' as const }));
    const browserSources = new Map<string, BrowserSource>();
    for (const source of browser.listSources().sources) {
      const key = browserSourceId(source);
      const previous = browserSources.get(key);
      if (!previous || (previous.authorizedAccess !== 'business' && source.authorizedAccess === 'business')) browserSources.set(key, source);
    }
    const online = [...browserSources.entries()].map(([sourceId, source]) => ({
      ...source, sourceId, authorizedAccess: source.authorizedAccess === 'business' ? 'write' as const : 'read' as const,
    }));
    const offline = remembered.sources.map(source => ({
      ...source, sourceId: browserSourceId(source), kind: 'browser' as const, availability: 'offline' as const,
      readiness: 'authorization-required' as const,
    })).filter(source => !browserSources.has(source.sourceId));
    const webSources = [...online, ...offline];
    const matches = productUrl ? webSources.filter(source => source.origin === new URL(productUrl).origin) : [];
    const defaultSourceId = productUrl ? (matches.length === 1 ? matches[0].sourceId : undefined) : desktopSources[0]?.sourceId;
    return { browserSources, result: {
      sources: [...desktopSources, ...webSources], defaultSourceId, defaultProductUrl: productUrl,
      browserRegistryAvailable: remembered.browserRegistryAvailable,
      ...(productUrl && matches.length > 1 ? { defaultSourceReason: 'SOURCE_AMBIGUOUS' } : {}),
    } };
  }

  function connection(connectionId: unknown) {
    if (typeof connectionId !== 'string') throw new BrowserBridgeError('INVALID_INPUT');
    const selected = connections.get(connectionId);
    if (!selected || (selected.kind === 'browser' && !browser.hasConnection(connectionId))) {
      connections.delete(connectionId);
      throw new BrowserBridgeError('CONNECTION_CLOSED');
    }
    return selected;
  }

  async function call(name: string, input: Record<string, unknown> = {}): Promise<unknown> {
    assertJson(input);
    const spec = byName.get(name);
    if (!spec) throw new BrowserBridgeError('UNKNOWN_TOOL');
    const { properties = {}, required = [] } = spec.inputSchema;
    if (Object.keys(input).some(key => !Object.hasOwn(properties, key)) || required.some(key => !Object.hasOwn(input, key))) {
      throw new BrowserBridgeError('INVALID_INPUT');
    }
    const { connectionId, ...fields } = input;
    if ((input.access !== undefined && input.access !== 'read' && input.access !== 'write') ||
      ['sourceId', 'productUrl', 'connectionId', 'domain', 'operation', 'requestKey', 'expectedRevision', 'runId'].some(key =>
        input[key] !== undefined && (typeof input[key] !== 'string' || !(input[key] as string).trim())) ||
      (input.savedOnly !== undefined && typeof input.savedOnly !== 'boolean') ||
      (input.arguments !== undefined && !Array.isArray(input.arguments))) throw new BrowserBridgeError('INVALID_INPUT');
    switch (name) {
      case 'po_sources_list': return (await listSources()).result;
      case 'po_sources_authorize': {
        const permission = input.access === 'read' ? 'read' : 'business';
        if (input.sourceId && input.productUrl) throw new BrowserBridgeError('INVALID_INPUT');
        if (typeof input.productUrl === 'string') return browser.authorize(input.productUrl, permission);
        if (!input.sourceId && !productUrl) throw new BrowserBridgeError('PRODUCT_URL_REQUIRED');
        const { result } = await listSources();
        if (!input.sourceId && result.defaultSourceReason) throw new BrowserBridgeError('SOURCE_AMBIGUOUS');
        const selected = input.sourceId ?? result.defaultSourceId;
        if (!selected && productUrl) return browser.authorize(productUrl, permission);
        const source = result.sources.find(item => item.sourceId === selected);
        if (source?.kind !== 'browser') throw new BrowserBridgeError('SOURCE_NOT_FOUND');
        return { ...await browser.authorize(source.productUrl, permission, source),
          sourceId: source.sourceId, browser: source.browser, label: source.label };
      }
      case 'po_catalog': return productBusinessCatalog(input.domain);
      case 'po_sources_open': {
        const { browserSources, result: listed } = await listSources();
        const sourceId = input.sourceId ?? listed.defaultSourceId;
        if (!sourceId) throw new BrowserBridgeError(listed.defaultSourceReason ?? 'SOURCE_NOT_READY');
        const source = listed.sources.find(item => item.sourceId === sourceId);
        if (!source) throw new BrowserBridgeError('SOURCE_NOT_FOUND');
        if (source.kind === 'browser' && source.availability === 'offline') throw new BrowserBridgeError('SOURCE_OFFLINE');
        const permission = (input.access ?? source.authorizedAccess) as Access;
        if (permission === 'write' && source.authorizedAccess !== 'write') throw new BrowserBridgeError('BUSINESS_ACCESS_REQUIRED');
        let opened: { connectionId: string };
        if (source.kind === 'desktop') {
          opened = await desktop.openSource(source.sourceId, permission === 'read' ? 'read' : 'compare');
        } else {
          const access = (permission === 'write' ? 'business' : 'read') satisfies BrowserAccess;
          opened = await browser.open(browserSources.get(source.sourceId)!.sourceId, access) as { connectionId: string };
        }
        const current = connections.get(opened.connectionId);
        if (current && current.access !== permission) throw new BrowserBridgeError('ACCESS_MISMATCH');
        connections.set(opened.connectionId, { sourceId: source.sourceId, kind: source.kind, access: permission });
        return { source, connectionId: opened.connectionId, access: permission };
      }
      case 'po_sources_close': {
        const selected = connection(connectionId);
        connections.delete(connectionId as string);
        if (selected.kind === 'browser') await browser.close(connectionId as string);
        else await desktop.call(name, { connectionId });
        return { closed: true };
      }
    }
    const selected = connection(connectionId);
    if (selected.access === 'read' && !readTools.has(name)) throw new BrowserBridgeError('BUSINESS_ACCESS_REQUIRED');
    const method = businessNames[name] ?? name;
    if (business.has(method)) {
      if (selected.kind === 'desktop') {
        return desktop.call(method, { ...fields, sourceId: selected.sourceId }, selected.access === 'read' ? connectionId as string : undefined);
      }
      const request = (args: Record<string, unknown>) => browser.call(connectionId as string, 'product', { name: method, args });
      if (method === 'po_resources') return transferResourceFile(fields, (operation, args) =>
        request({ operation, ...args, includeCredentials: fields.includeCredentials, requestKey: fields.requestKey }) as Promise<Record<string, unknown>>);
      if (method === 'po_data_export_file') return writeCredentialExport(fields, () => request({ includeCredentials: true }));
      return request(fields);
    }
    const schema = comparisonSpecs.get(name);
    if (!schema || !matches(schema, input)) throw new BrowserBridgeError('INVALID_INPUT');
    if (selected.kind === 'browser') return browser.call(connectionId as string, name, fields);
    const result = await desktop.call(name, input);
    if (name !== 'po_models_list' || selected.access !== 'read') return result;
    const models = result as { items: Array<Record<string, unknown>> };
    return { ...models, items: models.items.map(model => ({ ...model, executable: false })) };
  }

  const server = new Server({ name: 'prompt-optimizer', version: '0.1.1' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const payload = await call(request.params.name, request.params.arguments ?? {}) as Record<string, unknown>;
      return { structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] };
    } catch (error) {
      const payload = { error: { code: publicBrowserError(error) } };
      return { isError: true, structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] };
    }
  });
  return { server, call, close: async () => {
    connections.clear();
    await Promise.all([desktop.close(), browser.dispose()]);
  } };
}

export async function startProductStdio(profiles: DesktopProfile[], productUrl?: string) {
  const instance = createProductServer(profiles.length ? profiles : undefined, productUrl);
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    process.stdin.off('end', onClose);
    process.stdin.off('close', onClose);
    process.off('SIGINT', onClose);
    process.off('SIGTERM', onClose);
    try { await instance.close(); }
    finally { await instance.server.close(); process.stdin.destroy(); }
  })();
  const onClose = () => { void close().catch(() => { process.exitCode = 1; }); };
  process.stdin.once('end', onClose);
  process.stdin.once('close', onClose);
  process.once('SIGINT', onClose);
  process.once('SIGTERM', onClose);
  instance.server.onclose = onClose;
  try { await instance.server.connect(new StdioServerTransport()); }
  catch (error) { await close(); throw error; }
  return { ...instance, close };
}
