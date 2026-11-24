import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { version } from '../package.json';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import type { AssetVersionSelection } from '@prompt-optimizer/core/asset-reader';
import type { PromptModeKey } from '@prompt-optimizer/core';
import {
  createDesktopReadonlyRouter, DesktopSourceError, publicDesktopError,
  type DesktopProfile, type DesktopReadonlyOpener,
} from './desktop-router.js';

type ObjectSchema = {
  type: 'object';
  properties: Record<string, FieldSchema>;
  required: string[];
  additionalProperties: false;
};
type FieldSchema =
  | { type: 'string'; minLength?: number; enum?: string[] }
  | { type: 'integer'; minimum: number; maximum: number }
  | { type: 'array'; minItems: number; maxItems: number; items: FieldSchema }
  | { type: 'object'; additionalProperties: FieldSchema; propertyNames: { not: { enum: string[] } } }
  | ObjectSchema;

type ToolSpec = Tool & { inputSchema: ObjectSchema };
const string = { type: 'string', minLength: 1 } as const;
const pagination = { limit: { type: 'integer', minimum: 1, maximum: 100 } as const, cursor: string };
const assetSelectionFields = { favoriteId: string, assetId: string, expectedRevision: string };
const readOnly = { readOnlyHint: true, destructiveHint: false };

function object(properties: Record<string, FieldSchema>, required: string[]): ObjectSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}
function connectionInput(properties: Record<string, FieldSchema>, required: string[]): ObjectSchema {
  return object({ connectionId: string, ...properties }, ['connectionId', ...required]);
}
function tool(name: string, description: string, inputSchema: ObjectSchema, annotations: Tool['annotations'] = readOnly): ToolSpec {
  return { name, description, inputSchema, annotations };
}

function toolSpecs() {
  return [
    tool('po_sources_list', 'List configured desktop source labels without opening storage.', object({}, [])),
    tool('po_sources_open', 'Open one configured migrated desktop source for reading only.',
      object({ sourceId: string, access: { type: 'string', enum: ['read'] } }, ['sourceId', 'access'])),
    tool('po_sources_close', 'Close this connection and invalidate its reader revisions.', connectionInput({}, [])),
    tool('po_models_list', 'List saved model descriptions in this read-only source.', connectionInput(pagination, [])),
    tool('po_assets_list', 'List saved prompt assets without contents or private metadata.',
      connectionInput({ ...pagination, modeKey: string, query: { type: 'string' } }, [])),
    tool('po_assets_list_versions', 'List the versions of a saved prompt in descending version order. Use the returned version ID and asset revision to read the requested version.',
      connectionInput({ ...assetSelectionFields, ...pagination }, ['favoriteId', 'assetId'])),
    tool('po_assets_get_version', 'Read one exact saved or legacy current text version.',
      connectionInput({ ...assetSelectionFields, versionId: string }, ['favoriteId', 'assetId', 'versionId'])),
  ];
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
export function matches(schema: FieldSchema, value: unknown): boolean {
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' && (!schema.minLength || value.trim().length >= schema.minLength) &&
        (!schema.enum || schema.enum.includes(value));
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= schema.minimum && value <= schema.maximum;
    case 'array':
      return Array.isArray(value) && value.length >= schema.minItems && value.length <= schema.maxItems &&
        value.every(item => matches(schema.items, item));
    case 'object':
      if (!isObject(value)) return false;
      if ('properties' in schema) {
        return schema.required.every(key => Object.hasOwn(value, key)) &&
          Object.entries(value).every(([key, field]) => Object.hasOwn(schema.properties, key) && matches(schema.properties[key], field));
      }
      return Object.entries(value).every(([key, field]) => !schema.propertyNames.not.enum.includes(key) &&
        matches(schema.additionalProperties, field));
  }
}

type DesktopRouter = ReturnType<typeof createDesktopReadonlyRouter>;
export function createDesktopToolDispatcher(router: DesktopRouter) {
  const specs = toolSpecs();
  const toolsByName = new Map(specs.map(spec => [spec.name, spec]));
  return {
    specs,
    has: (name: string) => toolsByName.has(name),
    async call(name: string, args: Record<string, unknown>) {
      const spec = toolsByName.get(name);
      if (!spec) throw new DesktopSourceError('UNKNOWN_TOOL');
      if (!matches(spec.inputSchema, args)) throw new DesktopSourceError('INVALID_INPUT');
      const { connectionId, ...fields } = args as { connectionId: string } & Record<string, unknown>;
      const pagination = { limit: fields.limit as number | undefined, cursor: fields.cursor as string | undefined };
      switch (name) {
        case 'po_sources_list': return router.listSources();
        case 'po_sources_open': return router.open(fields.sourceId as string, fields.access as string);
        case 'po_sources_close': return router.close(connectionId);
        case 'po_models_list': return router.listModels(connectionId, pagination);
        case 'po_assets_list':
          return router.listAssets(connectionId, {
            ...pagination, modeKey: fields.modeKey as PromptModeKey | undefined, query: fields.query as string | undefined,
          });
        case 'po_assets_list_versions':
          return router.listAssetVersions(connectionId, {
            favoriteId: fields.favoriteId as string,
            assetId: fields.assetId as string,
            expectedRevision: fields.expectedRevision as string | undefined,
          }, pagination);
        case 'po_assets_get_version':
          return router.getAssetVersion(connectionId, fields as unknown as AssetVersionSelection);
        default: throw new DesktopSourceError('UNKNOWN_TOOL');
      }
    },
  };
}

function createDesktopServer(router: DesktopRouter) {
  const dispatcher = createDesktopToolDispatcher(router);
  const server = new Server({
    name: 'prompt-optimizer-desktop-readonly',
    version,
  }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: dispatcher.specs }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const { name, arguments: input } = request.params;
      const payload = await dispatcher.call(name, input ?? {});
      return { structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
    } catch (error) {
      const payload = { error: publicDesktopError(error) };
      return { isError: true, structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
    }
  });
  server.onclose = () => { void router.dispose().catch(() => {}); };
  return { server, router };
}

export function createDesktopReadonlyServer(profiles: DesktopProfile[], opener?: DesktopReadonlyOpener) {
  return createDesktopServer(createDesktopReadonlyRouter(profiles, opener));
}

async function startDesktopStdio({ server, router }: ReturnType<typeof createDesktopServer>) {
  let closing: Promise<void> | undefined;
  let reportedShutdownFailure = false;
  const close = () => {
    closing ??= (async () => {
      process.stdin.off('end', onEnd); process.stdin.off('close', onEnd);
      process.off('SIGINT', onEnd); process.off('SIGTERM', onEnd);
      try { await router.dispose(); } finally {
        try { await server.close(); } finally {
          // Release the pipe even on signal shutdown after closing all leases.
          process.stdin.pause(); process.stdin.destroy();
        }
      }
    })();
    return closing;
  };
  const onEnd = () => { void close().catch(() => {
    if (!reportedShutdownFailure) process.stderr.write(`Desktop readonly shutdown failed (SOURCE_CLOSE_FAILED).\n`);
    reportedShutdownFailure = true; process.exitCode = 1;
  }); };
  server.onclose = onEnd;
  process.stdin.once('end', onEnd); process.stdin.once('close', onEnd);
  process.once('SIGINT', onEnd); process.once('SIGTERM', onEnd);
  try { await server.connect(new StdioServerTransport()); }
  catch { await close(); throw new DesktopSourceError('SOURCE_OPEN_FAILED'); }
  return { server, router, close };
}

export function startDesktopReadonlyStdio(profiles: DesktopProfile[], opener?: DesktopReadonlyOpener) {
  return startDesktopStdio(createDesktopReadonlyServer(profiles, opener));
}
