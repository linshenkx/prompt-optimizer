import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  assertBridgeJson, BrowserBridgeError, browserFavoriteOperations, browserTextRunKinds, publicBrowserError, type BrowserAccess,
} from '@prompt-optimizer/core/bridge-protocol';
import { toolSpecs, matches } from './desktop.js';
import { createBrowserTransport } from './browser-transport.js';

const text = { type: 'string', minLength: 1 } as const;
const local = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const read = { ...local, readOnlyHint: true };
function spec(name: string, description: string, properties: Record<string, object>, required: string[], annotations = read): Tool {
  return { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, annotations };
}
const productFields = { sourceId: text, domain: { type: 'string', enum: ['favorites'] }, operation: text, arguments: { type: 'array', maxItems: 2, items: {} } };
const extraSpecs = [
  spec('po_sources_authorize', 'Create a short-lived one-use authorization link for the exact deployed product URL. Open it in the desired browser/profile and approve on the real page. No profile scanning, CDP, file access or extra daemon. The loopback bridge starts only on demand. Do not publish or log the link.',
    { productUrl: text, access: { type: 'string', enum: ['read', 'compare'] } }, ['productUrl', 'access'], local),
  spec('po_desktop_catalog', 'Discover supported product business operations. Discover favorite operations and supported text run kinds in the browser source.', { domain: text }, []),
  spec('po_desktop_query', 'Query favorites using the already initialized product services in an explicitly opened browser source. Returns result and a revision for a subsequent mutation.', productFields, ['sourceId', 'domain', 'operation']),
  spec('po_desktop_mutate', 'Mutate favorites using the same product business operations and ordered arguments as desktop. Query first for expectedRevision. Reuse requestKey for an exact retry; concurrent page edits are not overwritten. Refresh the original favorites view after saving.',
    { ...productFields, expectedRevision: text, requestKey: text }, ['sourceId', 'domain', 'operation', 'expectedRevision', 'requestKey'], { ...local, destructiveHint: true }),
  spec('po_runs_start', 'Start text prompt optimization or a single test in the authorized product page using a saved model. Uses the browser network and may incur charges. Query favorites for a current expectedRevision. Optimize with targetPrompt, optimizationMode, modelKey and optional templateId. Test with userPrompt, modelKey, optional systemPrompt or inputRunId. Read the result with po_runs_get.',
    { sourceId: text, requestKey: text, expectedRevision: text, input: { type: 'object', properties: {
      kind: { type: 'string', enum: [...browserTextRunKinds] }, request: { type: 'object' }, inputRunId: text,
      promptField: { type: 'string', enum: ['systemPrompt', 'userPrompt'] }, timeoutMs: { type: 'integer', minimum: 100, maximum: 600000 },
    }, required: ['kind', 'request'], additionalProperties: false } }, ['sourceId', 'requestKey', 'expectedRevision', 'input'],
    { ...local, openWorldHint: true }),
  spec('po_runs_get', 'Read the current state and text output of a run in this browser connection.',
    { sourceId: text, runId: text }, ['sourceId', 'runId']),
  spec('po_runs_cancel', 'Request cancellation of an active browser text run. The partial output can still be read.',
    { sourceId: text, runId: text }, ['sourceId', 'runId'], local),
];

export function createBrowserServer(transport = createBrowserTransport()) {
  const baseSpecs = toolSpecs('compare');
  const baseByName = new Map(baseSpecs.map(tool => [tool.name, tool]));
  const tools: Tool[] = [...baseSpecs.map(tool => ({
    ...tool,
    description: tool.name === 'po_sources_list' ? 'List authorized, currently connected product pages. Exact origin, browserContextId and pageId distinguish browser/profile storage; never choose by hostname alone.'
      : tool.name === 'po_sources_open' ? 'Open exactly one authorized browser source. A disconnected or revoked source never falls back to another page. Requested access cannot exceed the page authorization.'
      : (tool.description ?? '').replaceAll('desktop', 'browser').replace('MCP Node runtime network settings', 'product page browser network settings'),
    ...(tool.name === 'po_sources_open' ? { inputSchema: { ...tool.inputSchema,
      properties: { sourceId: text, access: { type: 'string', enum: ['read', 'compare'] } } } } : {}),
  })), ...extraSpecs];
  const server = new Server({ name: 'prompt-optimizer-browser', version: '0.1.1' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  async function callTool(name: string, input: Record<string, unknown> = {}) {
    assertBridgeJson(input);
    const base = baseByName.get(name);
    if (base && name !== 'po_sources_open' && !matches(base.inputSchema, input)) throw new BrowserBridgeError('INVALID_INPUT');
    if (!base) {
      const selected = extraSpecs.find(tool => tool.name === name);
      if (!selected) throw new BrowserBridgeError('UNKNOWN_TOOL');
      const allowed = Object.keys(selected.inputSchema.properties ?? {});
      if (Object.keys(input).some(key => !allowed.includes(key)) || (selected.inputSchema.required ?? []).some(key => !Object.hasOwn(input, key))) {
        throw new BrowserBridgeError('INVALID_INPUT');
      }
      for (const [key, value] of Object.entries(input)) {
        if (key === 'arguments') { if (!Array.isArray(value) || value.length > 2) throw new BrowserBridgeError('INVALID_INPUT'); }
        else if (key === 'input') { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BrowserBridgeError('INVALID_INPUT'); }
        else if (typeof value !== 'string' || !value.trim()) throw new BrowserBridgeError('INVALID_INPUT');
      }
    }
    switch (name) {
      case 'po_sources_authorize': return transport.authorize(input.productUrl as string, input.access as BrowserAccess);
      case 'po_sources_list': return transport.listSources();
      case 'po_sources_open':
        if (Object.keys(input).some(key => !['sourceId', 'access'].includes(key)) || typeof input.sourceId !== 'string' || !['read', 'compare'].includes(input.access as string)) throw new BrowserBridgeError('INVALID_INPUT');
        return transport.open(input.sourceId, input.access as BrowserAccess);
      case 'po_sources_close': return transport.close(input.connectionId as string);
      case 'po_desktop_catalog': return {
        operations: input.domain && input.domain !== 'favorites' ? [] : browserFavoriteOperations.map(operation => ({ domain: 'favorites', ...operation })),
        runKinds: browserTextRunKinds,
      };
      case 'po_desktop_query':
      case 'po_runs_start':
      case 'po_runs_get':
      case 'po_runs_cancel':
      case 'po_desktop_mutate': {
        const { sourceId, ...fields } = input;
        return transport.callSource(sourceId as string, name, fields);
      }
      default: {
        const { connectionId, ...fields } = input;
        return transport.call(connectionId as string, name, fields);
      }
    }
  }
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const result = await callTool(request.params.name, request.params.arguments ?? {});
      const payload = result as Record<string, unknown>;
      return { structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] };
    } catch (error) {
      const payload = { error: { code: publicBrowserError(error) } };
      return { isError: true, structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] };
    }
  });
  server.onclose = () => { void transport.dispose(); };
  return { server, transport, callTool };
}

export async function startBrowserStdio() {
  const instance = createBrowserServer();
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    process.stdin.off('end', onEnd); process.stdin.off('close', onEnd);
    process.off('SIGINT', onEnd); process.off('SIGTERM', onEnd);
    await instance.transport.dispose();
    await instance.server.close();
    process.stdin.pause(); process.stdin.destroy();
  })();
  const onEnd = () => { void close().catch(() => { process.exitCode = 1; }); };
  instance.server.onclose = onEnd;
  process.stdin.once('end', onEnd); process.stdin.once('close', onEnd);
  process.once('SIGINT', onEnd); process.once('SIGTERM', onEnd);
  try { await instance.server.connect(new StdioServerTransport()); }
  catch { await close(); throw new BrowserBridgeError('BRIDGE_START_FAILED'); }
  return { ...instance, close };
}
