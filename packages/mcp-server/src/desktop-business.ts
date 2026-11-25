import { randomUUID } from 'node:crypto';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { openExistingDesktopStorageForWriting, type ExistingSQLiteStorage } from '@prompt-optimizer/core/node';
import { createDesktopProductRouter, DesktopSourceError, type DesktopProfile } from './desktop-router.js';
import { openReadonlyDesktop } from './desktop-storage.js';
import {
  DesktopBusinessError, assertJson, createProductBusiness, productBusinessCatalog, runKinds,
} from '@prompt-optimizer/core/bridge-protocol';
import { requestDesktopResource, resourceOperations, writeCredentialExport } from './desktop-business-resources.js';

const text = { type: 'string', minLength: 1 } as const;
const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
const sourceFields = { sourceId: text };
function spec(name: string, description: string, properties: Record<string, object>, required: string[], annotations = read): Tool {
  return { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, annotations };
}
export const desktopBusinessTools = [
  spec('po_resources', 'Use the open desktop renderer for real image stores or full ZIP import/export (app data, favorites and image resources). Windows desktop must be running this version. File writes create a NEW absolute file. Package transfers contain credentials and require includeCredentials=true. Input limit 20MiB. image deletion requires expectedDigest returned by images.get and refuses referenced images. A RESOURCE_RESULT_UNKNOWN may mean an edit applied; do not automatically retry with a new key.',
    { ...sourceFields, operation: { type: 'string', enum: resourceOperations }, requestKey: text, file: text,
      store: { type: 'string', enum: ['imageCache', 'favoriteImages'] }, id: text, mimeType: text,
      expectedDigest: text, includeCredentials: { type: 'boolean' } }, ['sourceId', 'operation', 'requestKey'], write),
  spec('po_sources_list', 'List explicitly configured local desktop sources. Does not open or create a profile.', {}, []),
  spec('po_desktop_catalog', 'Discover available desktop business operations, ordered positional arguments, and asynchronous run kinds. Optional arguments have ?. Queries return a source revision; writes require that revision and a unique requestKey. No arbitrary service methods are callable.', { domain: text }, []),
  spec('po_desktop_query', 'Read current desktop data through the product business services. Call the catalog first. Model credentials and private endpoint details are redacted. Assets expose exact saved versions.',
    { ...sourceFields, domain: text, operation: text, arguments: { type: 'array', items: {} } }, ['sourceId', 'domain', 'operation']),
  spec('po_desktop_mutate', 'Perform an explicitly selected desktop edit using existing service validation. Requires a recent query revision. Reuse requestKey only for an exact retry; conflicting desktop edits are not overwritten. Deletion and import can be destructive.',
    { ...sourceFields, domain: text, operation: text, arguments: { type: 'array', items: {} }, expectedRevision: text, requestKey: text },
    ['sourceId', 'domain', 'operation', 'expectedRevision', 'requestKey'], write),
  spec('po_runs_start', 'Start optimization, message optimization, iteration, one test, a conversation test, evaluation, image generation, or 2-4 tests. This uses saved model credentials and can incur charges. Input and configurations are frozen from a single desktop snapshot. Query status with po_runs_get; network requests use the local Node runtime, not Electron proxy settings.',
    { ...sourceFields, requestKey: text, expectedRevision: text, input: { type: 'object', properties: {
      kind: { type: 'string', enum: [...runKinds] }, request: { type: 'object' }, source: { type: 'object' },
      promptField: { type: 'string', enum: ['systemPrompt', 'userPrompt'] }, inputRunId: text,
      timeoutMs: { type: 'integer', minimum: 100, maximum: 600000 },
    }, required: ['kind', 'request'], additionalProperties: false } }, ['sourceId', 'requestKey', 'expectedRevision', 'input'],
    { ...write, destructiveHint: false, openWorldHint: true }),
  spec('po_runs_get', 'Get the current state, partial output, reasoning, final output, and sanitized failure for one run.',
    { ...sourceFields, runId: text }, ['sourceId', 'runId']),
  spec('po_runs_list', 'List run summaries, optionally only explicitly saved results. No model calls are made.',
    { ...sourceFields, savedOnly: { type: 'boolean' } }, ['sourceId']),
  spec('po_runs_cancel', 'Request cancellation of a running operation, including another client connected to the same source. Partial text is retained. Providers may continue processing a request already submitted.',
    { ...sourceFields, runId: text }, ['sourceId', 'runId'], { ...write, destructiveHint: false }),
  spec('po_runs_save', 'Save a terminal optimization, test, evaluation, or image run for retrieval through MCP without overwriting the current workspace.',
    { ...sourceFields, runId: text, target: { type: 'string', enum: ['archive', 'history'] } }, ['sourceId', 'runId'], { ...write, destructiveHint: false }),
  spec('po_runs_delete', 'Delete one terminal run with an optimistic timestamp guard.',
    { ...sourceFields, runId: text, expectedUpdatedAt: { type: 'integer', minimum: 0 } }, ['sourceId', 'runId', 'expectedUpdatedAt'], write),
  spec('po_data_export_file', 'Explicitly export the current product data to a NEW absolute local file, including model credentials. Never overwrites a file. Do not upload or share the result without user authorization.',
    { ...sourceFields, destination: text, includeCredentials: { type: 'boolean', const: true } },
    ['sourceId', 'destination', 'includeCredentials'], { ...write, destructiveHint: false }),
];

function runOwnerGone(ownerId: string) {
  const pid = Number(ownerId.split(':')[0]);
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; }
}

type BusinessSource = { lease: ExistingSQLiteStorage; business: ReturnType<typeof createProductBusiness> };
export function createDesktopBusinessServer(profiles: DesktopProfile[]) {
  const revisionKey = globalThis.crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const owner = () => ({ id: process.pid + ':' + randomUUID(), isGone: runOwnerGone });
  const openRead: NonNullable<Parameters<typeof createDesktopProductRouter>[2]> = async (path, source) => {
    const lease = await openReadonlyDesktop(path);
    try {
      const business = createProductBusiness(lease.provider, source.sourceId, { owner: owner(), revisionKey });
      return {
        ...lease,
        product: {
          call: (name, args) => business.call(name, args, true),
        },
      };
    } catch (error) {
      await lease.provider.close();
      throw error;
    }
  };
  const router = createDesktopProductRouter(profiles, async (_path, source) => {
    // The business session owns this store until shutdown so running jobs survive a reconnect.
    const { lease } = await open(source.sourceId);
    return { migration: lease.migration, provider: { getItem: key => lease.provider.getItem(key), close: async () => {} } };
  }, openRead);
  const sourceLeases = new Map<string, Promise<BusinessSource>>();
  let closing: Promise<void> | undefined;
  const open = async (sourceId: string) => {
    if (closing) throw new DesktopBusinessError('SOURCE_CLOSING');
    let opening = sourceLeases.get(sourceId);
    if (!opening) {
      const profile = router.getSourceProfile(sourceId);
      if (!profile) throw new DesktopBusinessError('SOURCE_NOT_FOUND');
      opening = (async () => {
        const lease = await openExistingDesktopStorageForWriting(profile.userDataPath);
        const business = createProductBusiness(lease.provider, sourceId, {
          owner: owner(),
          revisionKey,
          beforeMutation: async domain => {
            if (!['workspaces', 'settings', 'variables', 'data'].includes(domain)) return;
            const descriptor = await lease.provider.getItem('mcp:renderer:resources');
            if (descriptor) {
              const { pid } = JSON.parse(descriptor) as { pid?: number };
              if (Number.isSafeInteger(pid) && pid! > 0 && !runOwnerGone(String(pid))) {
                throw new DesktopBusinessError('DESKTOP_STATE_IN_USE');
              }
            }
          },
        });
        return { lease, business };
      })();
      sourceLeases.set(sourceId, opening);
    }
    try { return await opening; }
    catch {
      if (sourceLeases.get(sourceId) === opening) sourceLeases.delete(sourceId);
      throw new DesktopSourceError('SOURCE_NOT_READY');
    }
  };
  const callBusiness = async (name: string, args: Record<string, unknown>, readonlyConnectionId?: string): Promise<unknown> => {
    const definition = desktopBusinessTools.find(item => item.name === name);
    if (!definition) throw new DesktopBusinessError('UNKNOWN_TOOL');
    assertJson(args);
    if (args.savedOnly !== undefined && typeof args.savedOnly !== 'boolean') throw new DesktopBusinessError('INVALID_INPUT');
    if (JSON.stringify(args).length > 8 * 1024 * 1024) throw new DesktopBusinessError('INPUT_LIMIT_REACHED');
    if ((definition.inputSchema.required ?? []).some(key => args[key] === undefined) ||
      Object.keys(args).some(key => !Object.hasOwn(definition.inputSchema.properties ?? {}, key))) throw new DesktopBusinessError('INVALID_INPUT');
    for (const key of ['sourceId', 'domain', 'operation', 'expectedRevision', 'requestKey', 'runId']) {
      if (args[key] !== undefined && (typeof args[key] !== 'string' || !(args[key] as string).trim() || (args[key] as string).length > 512)) {
        throw new DesktopBusinessError('INVALID_INPUT');
      }
    }
    if (name === 'po_sources_list') {
      return { sources: router.listSources().sources.map(({ sourceId, label }) => ({ sourceId, label, access: 'business' })) };
    }
    if (name === 'po_desktop_catalog') return productBusinessCatalog(args.domain);
    if (readonlyConnectionId !== undefined) {
      if (!definition.annotations?.readOnlyHint) throw new DesktopBusinessError('BUSINESS_ACCESS_REQUIRED');
      return router.callReadonlyBusiness(readonlyConnectionId, name, args);
    }
    const { lease, business } = await open(args.sourceId as string);
    if (name === 'po_resources') return requestDesktopResource(lease.provider, args);
    if (name === 'po_data_export_file') return writeCredentialExport(args, () => business.call(name, args));
    return business.call(name, args);
  };
  return {
    call: callBusiness,
    openSource: (sourceId: string, access: 'read' | 'write') => router.open(sourceId, access),
    closeSource: (connectionId: string) => router.close(connectionId),
    close() {
      closing ??= (async () => {
        const results = await Promise.allSettled([
          router.dispose(),
          ...Array.from(sourceLeases.values(), async opening => {
            const opened = await opening.catch(() => undefined);
            if (!opened) return;
            try { await opened.business.close(); }
            finally { await opened.lease.provider.close(); }
          }),
        ]);
        sourceLeases.clear();
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
      })();
      return closing;
    },
  };
}
