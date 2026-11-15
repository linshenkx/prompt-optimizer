import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { AssetVersionSelection, AssetReadPagination } from '@prompt-optimizer/core/asset-reader';
import type { PromptModeKey } from '@prompt-optimizer/core';
import { createDesktopReadonlyRouter, DesktopSourceError, publicDesktopError } from './desktop-router.js';
import type { DesktopProfile, DesktopReadonlyOpener } from './desktop-router.js';

const string = { type: 'string', minLength: 1 };
const pagination = { limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: string };
const specs: Array<{ name: string; description: string; properties: Record<string, unknown>; required: string[] }> = [
  { name: 'po_sources_list', description: 'List configured desktop source labels without opening storage.', properties: {}, required: [] },
  { name: 'po_sources_open', description: 'Open one configured migrated desktop source for reading only.', properties: { sourceId: string, access: { type: 'string', enum: ['read'] } }, required: ['sourceId', 'access'] },
  { name: 'po_sources_close', description: 'Close this connection and invalidate its reader revisions.', properties: { connectionId: string }, required: ['connectionId'] },
  { name: 'po_models_list', description: 'List saved model descriptions; execution is unavailable.', properties: { connectionId: string, ...pagination }, required: ['connectionId'] },
  { name: 'po_assets_list', description: 'List saved prompt assets without contents or private metadata.', properties: { connectionId: string, ...pagination, modeKey: string, query: { type: 'string' } }, required: ['connectionId'] },
  { name: 'po_assets_get_version', description: 'Read one exact saved or legacy current text version.', properties: { connectionId: string, favoriteId: string, assetId: string, versionId: string, expectedRevision: string }, required: ['connectionId', 'favoriteId', 'assetId', 'versionId'] },
];
function validate(name: string, input: unknown): Record<string, unknown> {
  const spec = specs.find(spec => spec.name === name);
  if (!spec) throw new DesktopSourceError('UNKNOWN_TOOL');
  const args = input ?? {};
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new DesktopSourceError('INVALID_INPUT');
  const result = args as Record<string, unknown>;
  if (Object.keys(result).some(key => !Object.hasOwn(spec.properties, key)) || spec.required.some(key => !Object.hasOwn(result, key))) throw new DesktopSourceError('INVALID_INPUT');
  for (const [key, value] of Object.entries(result)) {
    if (key === 'limit') {
      if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 100) throw new DesktopSourceError('INVALID_INPUT');
    } else if (typeof value !== 'string' || (key !== 'query' && !value.trim())) throw new DesktopSourceError('INVALID_INPUT');
  }
  return result;
}

export function createDesktopReadonlyServer(profiles: DesktopProfile[], opener?: DesktopReadonlyOpener) {
  const router = createDesktopReadonlyRouter(profiles, opener);
  const server = new Server({ name: 'prompt-optimizer-desktop-readonly', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: specs.map(spec => ({
    name: spec.name, description: spec.description,
    inputSchema: { type: 'object', properties: spec.properties, required: spec.required, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false },
  } as Tool)) }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const a = validate(request.params.name, request.params.arguments);
      const connectionId = a.connectionId as string;
      let result: unknown;
      switch (request.params.name) {
        case 'po_sources_list': result = router.listSources(); break;
        case 'po_sources_open': result = await router.open(a.sourceId as string, a.access as string); break;
        case 'po_sources_close': result = await router.close(connectionId); break;
        case 'po_models_list': result = await router.listModels(connectionId, { limit: a.limit, cursor: a.cursor } as AssetReadPagination); break;
        case 'po_assets_list': result = await router.listAssets(connectionId, { limit: a.limit as number | undefined, cursor: a.cursor as string | undefined, modeKey: a.modeKey as PromptModeKey | undefined, query: a.query as string | undefined }); break;
        case 'po_assets_get_version': result = await router.getAssetVersion(connectionId, { favoriteId: a.favoriteId, assetId: a.assetId, versionId: a.versionId, expectedRevision: a.expectedRevision } as AssetVersionSelection); break;
      }
      const payload = result as Record<string, unknown>;
      return { structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
    } catch (error) {
      const payload = { error: publicDesktopError(error) };
      return { isError: true, structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
    }
  });
  server.onclose = () => { void router.dispose().catch(() => {}); };
  return { server, router };
}

export async function startDesktopReadonlyStdio(profiles: DesktopProfile[], opener?: DesktopReadonlyOpener) {
  const { server, router } = createDesktopReadonlyServer(profiles, opener);
  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= (async () => {
      process.stdin.off('end', onEnd); process.stdin.off('close', onEnd);
      process.off('SIGINT', onEnd); process.off('SIGTERM', onEnd);
      try { await router.dispose(); } finally { await server.close(); }
    })();
    return closing;
  };
  const onEnd = () => { void close().catch(() => { process.stderr.write('Desktop readonly shutdown failed (SOURCE_CLOSE_FAILED).\n'); process.exitCode = 1; }); };
  process.stdin.once('end', onEnd); process.stdin.once('close', onEnd);
  process.once('SIGINT', onEnd); process.once('SIGTERM', onEnd);
  try { await server.connect(new StdioServerTransport()); }
  catch { await close(); throw new DesktopSourceError('SOURCE_OPEN_FAILED'); }
  return { server, router, close };
}
