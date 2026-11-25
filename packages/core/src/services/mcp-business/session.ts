import { hashText } from '../../utils/portable-crypto';
import { createReadonlyAssetReader } from '../asset-reader/reader';
import { DesktopBusinessError, businessOperations } from './catalog';
import { ProductRuns, runKinds, type RunInput } from './runs';
import { BusinessStage, snapshotRevision, redactConfiguration, type BusinessStorage } from './services';

export function productBusinessCatalog(domain?: unknown) {
  return {
    operations: businessOperations.filter(item => !domain || item.domain === domain),
    assets: { domain: 'assets', operations: ['listAssets(options?)', 'listAssetVersions(selection, options?)', 'getAssetVersion(selection)'] },
    runKinds,
    runInput: 'request uses the existing product service request. source optionally selects favoriteId/assetId/versionId/expectedRevision. test: systemPrompt,userPrompt,modelKey,inputImages?; optimize: targetPrompt,optimizationMode,modelKey,templateId?; iterate: originalPrompt,lastOptimizedPrompt,iterateInput,modelKey,templateId; evaluate: EvaluationRequest; test-batch: request.candidates contains 2-4 test requests. Each has modelKey, systemPrompt/userPrompt, optional variables, source and promptField. For a saved version pass its asset revision in candidate.source.expectedRevision, independently of the query revision for po_runs_start.',
  };
}

export function createProductBusiness(storage: BusinessStorage, sourceId: string, options: {
  owner: { id: string; isGone(id: string): boolean | Promise<boolean> };
  revisionKey?: Promise<CryptoKey>;
  beforeMutation?: (domain: string) => Promise<void>;
  assertActive?: () => void;
  guardedStorageKeys?: readonly string[];
}) {
  const revisionKeys = {
    revisionKey: options.revisionKey ?? globalThis.crypto.subtle?.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    portableRevisionKey: globalThis.crypto.getRandomValues(new Uint8Array(32)),
  };
  const runs = new ProductRuns(storage, sourceId, options.owner, revisionKeys);
  async function call(name: string, args: Record<string, unknown>, readOnly = false): Promise<unknown> {
    options.assertActive?.();
    if (name === 'po_runs_get') return runs.get(args.runId as string, !readOnly);
    if (name === 'po_runs_cancel') return runs.cancel(args.runId as string);
    if (name === 'po_runs_save') {
      if (args.target !== undefined && !['archive', 'history'].includes(args.target as string)) throw new DesktopBusinessError('INVALID_INPUT');
      return runs.save(args.runId as string, args.target as 'archive' | 'history' | undefined);
    }
    if (name === 'po_runs_delete') {
      if (!Number.isSafeInteger(args.expectedUpdatedAt) || (args.expectedUpdatedAt as number) < 0) throw new DesktopBusinessError('INVALID_INPUT');
      await runs.delete(args.runId as string, args.expectedUpdatedAt as number); return { deleted: true };
    }
    if (name === 'po_runs_list') return { runs: (await runs.list(!readOnly)).filter(run => !run.deleted && (!args.savedOnly || run.saved))
      .map(({ id, kind, status, createdAt, updatedAt, saved }) => ({ id, kind, status, createdAt, updatedAt, saved })) };
    const snapshot = new Map(await storage.getAllEntries());
    const revision = snapshotRevision(snapshot, sourceId);
    const stage = new BusinessStage(snapshot);
    const parameters = args.arguments ?? [];
    if (!Array.isArray(parameters)) throw new DesktopBusinessError('INVALID_ARGUMENTS');
    if (name === 'po_desktop_query') {
      let result;
      if (args.domain === 'assets') {
        const reader = createReadonlyAssetReader(stage, { sourceId, sourceEpoch: 'business-v1' }, revisionKeys);
        if (!['listAssets', 'listAssetVersions', 'getAssetVersion'].includes(args.operation as string)) throw new DesktopBusinessError('UNKNOWN_OPERATION');
        result = await (reader[args.operation as keyof typeof reader] as (...values: unknown[]) => unknown)(...parameters);
      } else result = await stage.invoke(args.domain as string, args.operation as string, parameters, 'read');
      if (args.domain === 'models') {
        // Imported configurations can carry arbitrary private fields outside TextModelConfig.
        const fields = ['id', 'name', 'enabled', 'activationState', 'providerId', 'modelId', 'providerMeta', 'modelMeta',
          'connectionConfig', 'paramOverrides', 'customParamOverrides'];
        const publicModel = (value: unknown) => value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).filter(([key]) => fields.includes(key))) : value;
        result = Array.isArray(result) ? result.map(publicModel) : publicModel(result);
      }
      if (args.domain === 'settings' && args.operation === 'get' && typeof parameters[0] === 'string') {
        result = (redactConfiguration({ [parameters[0]]: result }) as Record<string, unknown>)[parameters[0]];
      }
      if (['models', 'imageModels', 'settings', 'data'].includes(args.domain as string)) {
        result = typeof result === 'string' && args.domain === 'data'
          ? JSON.stringify(redactConfiguration(JSON.parse(result))) : redactConfiguration(result);
      }
      return { revision, result };
    }
    if (name === 'po_data_export_file') {
      if (args.includeCredentials !== true) throw new DesktopBusinessError('INVALID_INPUT');
      const data = await stage.invoke('data', 'exportAllData', [], 'read');
      return { data };
    }
    const signature = hashText(JSON.stringify({ domain: args.domain, operation: args.operation, parameters }));
    const receiptKey = 'mcp:receipt:' + hashText(args.requestKey as string);
    if (name === 'po_desktop_mutate') {
      const previous = snapshot.get(receiptKey);
      if (previous) {
        const receipt = JSON.parse(previous) as { signature: string; result: unknown };
        if (receipt.signature !== signature) throw new DesktopBusinessError('REQUEST_KEY_REUSED');
        return receipt.result;
      }
    }
    if (name === 'po_runs_start') {
      const previous = (await runs.repository.list()).find(run => run.requestKey === args.requestKey);
      if (!previous && revision !== args.expectedRevision) throw new DesktopBusinessError('REVISION_CONFLICT');
      return runs.start(args.input as unknown as RunInput, args.requestKey as string, snapshot);
    }
    if (revision !== args.expectedRevision) throw new DesktopBusinessError('REVISION_CONFLICT');
    await options.beforeMutation?.(args.domain as string);
    for (const key of options.guardedStorageKeys ?? []) await stage.getItem(key);
    options.assertActive?.();
    if (name !== 'po_desktop_mutate') throw new DesktopBusinessError('UNKNOWN_TOOL');
    const result = redactConfiguration(await stage.invoke(args.domain as string, args.operation as string, parameters, 'write'));
    const response = { revision: snapshotRevision(stage.values, sourceId), result };
    options.assertActive?.();
    await stage.commit(storage, { key: receiptKey, value: JSON.stringify({ signature, result: response }) }, options.assertActive);
    return response;
  }
  return { call, close: () => runs.close() };
}
