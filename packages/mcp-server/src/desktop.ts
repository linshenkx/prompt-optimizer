import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import type { AssetVersionSelection } from '@prompt-optimizer/core/asset-reader';
import type { PrepareTextComparison } from '@prompt-optimizer/core/desktop-comparison';
import type { PromptModeKey } from '@prompt-optimizer/core';
import {
  createDesktopComparisonRouter, createDesktopReadonlyRouter, DesktopSourceError, publicDesktopError,
  type DesktopAccess, type DesktopComparisonOpener, type DesktopProfile, type DesktopReadonlyOpener,
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
const readOnly = { readOnlyHint: true, destructiveHint: false };
const localAction = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

function object(properties: Record<string, FieldSchema>, required: string[]): ObjectSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}
function connectionInput(properties: Record<string, FieldSchema>, required: string[]): ObjectSchema {
  return object({ connectionId: string, ...properties }, ['connectionId', ...required]);
}
function tool(name: string, description: string, inputSchema: ObjectSchema, annotations: Tool['annotations'] = readOnly): ToolSpec {
  return { name, description, inputSchema, annotations };
}

const prepareInput = connectionInput({
  source: object({ favoriteId: string, assetId: string, versionId: string, expectedRevision: string },
    ['favoriteId', 'assetId', 'versionId', 'expectedRevision']),
  variables: {
    type: 'object', additionalProperties: { type: 'string' },
    propertyNames: { not: { enum: ['__proto__', 'constructor', 'prototype'] } },
  },
  candidates: {
    type: 'array', minItems: 2, maxItems: 2,
    items: object({ id: { type: 'string', enum: ['a', 'b'] }, configKey: string, expectedRevision: string },
      ['id', 'configKey', 'expectedRevision']),
  },
}, ['source', 'variables', 'candidates']);

const comparisonTools: ToolSpec[] = [
  tool('po_tests_prepare', 'Validate a pro-variable favorite version and two enabled, saved model configurations. Freeze and preview their shared input and parameters without calling either model.',
    prepareInput, localAction),
  tool('po_tests_execute', 'Start both prepared model requests. This sends the previewed prompt to the saved model endpoints using the MCP Node runtime network settings and can incur charges.',
    connectionInput({ preparedId: string, previewRevision: string }, ['preparedId', 'previewRevision']),
    { ...localAction, openWorldHint: true }),
  tool('po_tests_get', 'Read the current state and outputs of both candidates for a prepared comparison.',
    connectionInput({ preparedId: string }, ['preparedId'])),
  tool('po_tests_cancel', 'Cancel an active comparison or a single candidate by runId. Any partial output already received is retained.',
    connectionInput({ preparedId: string, runId: string }, ['preparedId']), localAction),
  tool('po_comparisons_save', 'Save both completed results. Reuse the same saveKey after an uncertain response. The returned comparisonId opens the result in the desktop variable workspace.',
    connectionInput({ preparedId: string, saveKey: string }, ['preparedId', 'saveKey']),
    { ...localAction, idempotentHint: true }),
  tool('po_comparisons_list', 'List saved comparison summaries for this desktop source.',
    connectionInput({ ...pagination, favoriteId: string }, [])),
  tool('po_comparisons_get', 'Read a saved comparison, including its frozen input and both outcomes.',
    connectionInput({ comparisonId: string }, ['comparisonId'])),
  tool('po_comparisons_delete', 'Permanently delete the selected saved comparison using its current revision.',
    connectionInput({ comparisonId: string, expectedRevision: string }, ['comparisonId', 'expectedRevision']),
    { ...localAction, destructiveHint: true, idempotentHint: true }),
];

function toolSpecs(access: DesktopAccess) {
  const comparison = access === 'compare';
  const shared = [
    tool('po_sources_list', 'List configured desktop source labels without opening storage.', object({}, [])),
    tool('po_sources_open', comparison ? 'Open one configured migrated desktop source with comparison execution and storage permissions.'
      : 'Open one configured migrated desktop source for reading only.',
    object({ sourceId: string, access: { type: 'string', enum: [access] } }, ['sourceId', 'access']),
    comparison ? localAction : readOnly),
    tool('po_sources_close', comparison ? 'Cancel active requests, release this source, and invalidate its prepared comparisons and revisions.'
      : 'Close this connection and invalidate its reader revisions.',
    connectionInput({}, []), comparison ? localAction : readOnly),
    tool('po_models_list', comparison ? 'List saved model descriptions and whether each can run a text comparison.'
      : 'List saved model descriptions; execution is unavailable.', connectionInput(pagination, [])),
    tool('po_assets_list', 'List saved prompt assets without contents or private metadata.',
      connectionInput({ ...pagination, modeKey: string, query: { type: 'string' } }, [])),
    tool('po_assets_get_version', 'Read one exact saved or legacy current text version.',
      connectionInput({ favoriteId: string, assetId: string, versionId: string, expectedRevision: string },
        ['favoriteId', 'assetId', 'versionId'])),
  ];
  return comparison ? [...shared, ...comparisonTools] : shared;
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function matches(schema: FieldSchema, value: unknown): boolean {
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
function createDesktopServer(access: DesktopAccess, router: DesktopRouter) {
  const specs = toolSpecs(access);
  const toolsByName = new Map(specs.map(spec => [spec.name, spec]));
  const server = new Server({
    name: access === 'compare' ? 'prompt-optimizer-desktop-comparison' : 'prompt-optimizer-desktop-readonly',
    version: '0.1.0',
  }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: specs }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const { name, arguments: input } = request.params;
      const spec = toolsByName.get(name);
      if (!spec) throw new DesktopSourceError('UNKNOWN_TOOL');
      const args = input ?? {};
      if (!matches(spec.inputSchema, args)) throw new DesktopSourceError('INVALID_INPUT');
      const { connectionId, ...fields } = args as { connectionId: string } & Record<string, unknown>;
      const pagination = { limit: fields.limit as number | undefined, cursor: fields.cursor as string | undefined };
      let result: unknown;
      switch (name) {
        case 'po_sources_list': result = router.listSources(); break;
        case 'po_sources_open': result = await router.open(fields.sourceId as string, fields.access as string); break;
        case 'po_sources_close': result = await router.close(connectionId); break;
        case 'po_models_list': result = await router.listModels(connectionId, pagination); break;
        case 'po_assets_list':
          result = await router.listAssets(connectionId, {
            ...pagination, modeKey: fields.modeKey as PromptModeKey | undefined, query: fields.query as string | undefined,
          });
          break;
        case 'po_assets_get_version':
          result = await router.getAssetVersion(connectionId, fields as unknown as AssetVersionSelection);
          break;
        case 'po_tests_prepare': result = await router.prepare(connectionId, fields as unknown as PrepareTextComparison); break;
        case 'po_tests_execute':
          result = await router.execute(connectionId, fields.preparedId as string, fields.previewRevision as string);
          break;
        case 'po_tests_get': result = await router.getTest(connectionId, fields.preparedId as string); break;
        case 'po_tests_cancel':
          result = await router.cancel(connectionId, fields.preparedId as string, fields.runId as string | undefined);
          break;
        case 'po_comparisons_save':
          result = await router.saveComparison(connectionId, fields.preparedId as string, fields.saveKey as string);
          break;
        case 'po_comparisons_list':
          result = await router.listComparisons(connectionId, { ...pagination, favoriteId: fields.favoriteId as string | undefined });
          break;
        case 'po_comparisons_get': result = await router.getComparison(connectionId, fields.comparisonId as string); break;
        case 'po_comparisons_delete':
          result = await router.deleteComparison(connectionId, fields.comparisonId as string, fields.expectedRevision as string);
          break;
        default: throw new DesktopSourceError('UNKNOWN_TOOL');
      }
      const payload = result as Record<string, unknown>;
      return { structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
    } catch (error) {
      const payload = { error: publicDesktopError(error, access) };
      return { isError: true, structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
    }
  });
  server.onclose = () => { void router.dispose().catch(() => {}); };
  return { server, router };
}

export function createDesktopReadonlyServer(profiles: DesktopProfile[], opener?: DesktopReadonlyOpener) {
  return createDesktopServer('read', createDesktopReadonlyRouter(profiles, opener));
}

export function createDesktopComparisonServer(profiles: DesktopProfile[], opener: DesktopComparisonOpener) {
  return createDesktopServer('compare', createDesktopComparisonRouter(profiles, opener));
}

async function startDesktopStdio(access: DesktopAccess, { server, router }: ReturnType<typeof createDesktopServer>) {
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
    const scope = access === 'compare' ? 'comparison' : 'readonly';
    if (!reportedShutdownFailure) process.stderr.write(`Desktop ${scope} shutdown failed (SOURCE_CLOSE_FAILED).\n`);
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
  return startDesktopStdio('read', createDesktopReadonlyServer(profiles, opener));
}

export function startDesktopComparisonStdio(profiles: DesktopProfile[], opener: DesktopComparisonOpener) {
  return startDesktopStdio('compare', createDesktopComparisonServer(profiles, opener));
}
