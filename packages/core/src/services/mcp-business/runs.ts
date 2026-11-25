import { v4 as randomUUID } from 'uuid';
import { hashText } from '../../utils/portable-crypto';
import { createDesktopRunRepository, type DesktopRun } from '../desktop-runs/repository';
import { createRunArchive } from '../desktop-runs/archive';
import { createComparisonRepository } from '../text-comparison/repository';
import { decodeTextModelSelection } from '../model/selection';
import { buildPromptExecutionContext, scanVariableNames, type StreamHandlers } from '../../index';
import { createReadonlyAssetReader, type AssetReaderRevisionKeys } from '../asset-reader/reader';
import type { AssetVersionSelection } from '../asset-reader/types';
import { BusinessStage, redactConfiguration, type BusinessStorage, type Snapshot } from './services';
import { DesktopBusinessError, assertJson, publicBusinessError } from './catalog';

export const runKinds = ['optimize', 'optimize-message', 'iterate', 'test', 'test-conversation', 'evaluate', 'image', 'test-batch',
  'extract-variables', 'generate-variable-values', 'model-list', 'model-test', 'image-model-list', 'image-model-test', 'image-understand'] as const;
export interface RunInput {
  kind: typeof runKinds[number];
  request: Record<string, unknown>;
  source?: AssetVersionSelection;
  promptField?: 'systemPrompt' | 'userPrompt';
  inputRunId?: string;
  timeoutMs?: number;
}
type ActiveRun = { controller: AbortController; task: Promise<void>; state: DesktopRun };

export class ProductRuns {
  readonly repository;
  private readonly archive;
  private readonly active = new Map<string, ActiveRun>();
  private closing = false;

  constructor(private readonly provider: BusinessStorage, private readonly sourceId: string,
    private readonly owner: { id: string; isGone(id: string): boolean | Promise<boolean> }, private readonly revisionKeys: AssetReaderRevisionKeys) {
    this.repository = createDesktopRunRepository(provider);
    this.archive = createRunArchive(this.repository, createComparisonRepository(provider));
  }

  async start(input: RunInput, requestKey: string, snapshot: Snapshot): Promise<DesktopRun> {
    assertJson(input);
    if (this.closing) throw new DesktopBusinessError('SOURCE_CLOSING');
    if (!input || typeof input !== 'object' || !runKinds.includes(input.kind) || !input.request ||
      typeof input.request !== 'object' || Array.isArray(input.request) ||
      Object.keys(input).some(key => !['kind', 'request', 'source', 'promptField', 'inputRunId', 'timeoutMs'].includes(key))) {
      throw new DesktopBusinessError('INVALID_INPUT');
    }
    if (input.promptField !== undefined && !['systemPrompt', 'userPrompt'].includes(input.promptField)) throw new DesktopBusinessError('INVALID_INPUT');
    if (input.source && (!input.source.expectedRevision || typeof input.source.expectedRevision !== 'string')) {
      throw new DesktopBusinessError('ASSET_REVISION_REQUIRED');
    }
    if ('configSnapshot' in input.request || 'modelConfig' in input.request) throw new DesktopBusinessError('USE_SAVED_MODEL_CONFIGURATION');
    if (input.timeoutMs !== undefined && (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 100 || input.timeoutMs > 600_000)) {
      throw new DesktopBusinessError('INVALID_TIMEOUT');
    }
    const requestHash = hashText(JSON.stringify(input));
    const runs = await this.repository.list();
    const previous = runs.find(run => run.requestKey === requestKey);
    if (previous) {
      if (previous.deleted) throw new DesktopBusinessError('RUN_DELETED');
      if (previous.requestHash !== requestHash) throw new DesktopBusinessError('REQUEST_KEY_REUSED');
      return this.get(previous.id);
    }
    if (this.active.size >= 4) throw new DesktopBusinessError('RUN_CAPACITY_REACHED');
    const stage = new BusinessStage(snapshot);
    const request = structuredClone(input.request);
    if (input.inputRunId) {
      const dependency = await this.get(input.inputRunId);
      if (dependency.status !== 'succeeded') throw new DesktopBusinessError('INPUT_RUN_NOT_SUCCEEDED');
      const output = dependency.output ?? dependency.partial;
      if (typeof output !== 'string' || !output.trim()) throw new DesktopBusinessError('INPUT_RUN_NOT_TEXT');
      if (input.kind === 'test') request[input.promptField ?? 'systemPrompt'] = output;
      else if (input.kind === 'evaluate') {
        const original = (dependency.input as { request: Record<string, unknown> }).request;
        request.target ??= { workspacePrompt: dependency.kind === 'optimize' ? output : original.systemPrompt || original.userPrompt };
        if (request.type === 'result') {
          request.testCase = { id: dependency.id, input: { kind: 'text', label: 'MCP test input', content: original.userPrompt ?? '' } };
          request.snapshot = { id: dependency.id, label: 'MCP test result', testCaseId: dependency.id,
            promptRef: { kind: 'custom' }, promptText: original.systemPrompt ?? '', output, modelKey: original.modelKey };
        }
      } else throw new DesktopBusinessError('INPUT_RUN_NOT_SUPPORTED');
    }
    if (input.source) {
      const reader = createReadonlyAssetReader(stage, { sourceId: this.sourceId, sourceEpoch: 'business-v1' }, this.revisionKeys);
      const version = await reader.getAssetVersion(input.source);
      const text = version.content.text;
      if (input.kind === 'optimize') request.targetPrompt = text;
      else if (input.kind === 'iterate') request.originalPrompt = text;
      else if (input.kind === 'test') request[input.promptField ?? 'systemPrompt'] = text;
      else if (input.kind === 'evaluate') request.target = { ...(request.target as object ?? {}), workspacePrompt: text };
      else throw new DesktopBusinessError('SOURCE_NOT_SUPPORTED_FOR_RUN');
    }
    const prepareTest = async (candidate: Record<string, unknown>) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || 'configSnapshot' in candidate || 'modelConfig' in candidate) {
        throw new DesktopBusinessError('INVALID_CANDIDATE');
      }
      if (candidate.source) {
        const selection = candidate.source as AssetVersionSelection;
        if (!selection.expectedRevision) throw new DesktopBusinessError('ASSET_REVISION_REQUIRED');
        const reader = createReadonlyAssetReader(stage, { sourceId: this.sourceId, sourceEpoch: 'business-v1' }, this.revisionKeys);
        const version = await reader.getAssetVersion(selection);
        if (candidate.promptField !== undefined && !['systemPrompt', 'userPrompt'].includes(candidate.promptField as string)) throw new DesktopBusinessError('INVALID_INPUT');
        candidate[(candidate.promptField as string) ?? 'systemPrompt'] = version.content.text;
      }
      if (candidate.variables !== undefined || candidate.source || (input.kind === 'test' && input.source)) {
        const supplied = candidate.variables === undefined ? {} : candidate.variables;
        if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.values(supplied).some(value => typeof value !== 'string')) {
          throw new DesktopBusinessError('INVALID_VARIABLES');
        }
        const saved = snapshot.get('pref:variableManager.storage');
        const defaults = saved ? JSON.parse(saved).customVariables : {};
        const used: Record<string, string> = Object.create(null);
        for (const [field, rawField] of [['systemPrompt', 'rawSystemPrompt'], ['userPrompt', 'rawUserPrompt']]) {
          const prompt = candidate[field];
          if (typeof prompt !== 'string') continue;
          const available = { ...defaults, ...supplied, currentPrompt: prompt, userQuestion: prompt };
          const variables = Object.fromEntries(scanVariableNames(prompt).filter(key =>
            Object.prototype.hasOwnProperty.call(available, key) && typeof available[key] === 'string').map(key => [key, available[key]]));
          const rendered = buildPromptExecutionContext(prompt, variables, 1024 * 1024);
          if (rendered.missingVariables.length) throw new DesktopBusinessError('MISSING_VARIABLES');
          if (rendered.forbiddenTemplateSyntax.length) throw new DesktopBusinessError('FORBIDDEN_TEMPLATE_SYNTAX');
          candidate[rawField] = prompt;
          candidate[field] = rendered.renderedContent;
          Object.assign(used, variables);
        }
        candidate.variables = used;
      }
      return candidate;
    };
    if (input.kind === 'test') await prepareTest(request);
    if (input.kind === 'test-batch') {
      if (!Array.isArray(request.candidates) || request.candidates.length < 2 || request.candidates.length > 4) throw new DesktopBusinessError('INVALID_CANDIDATES');
      request.candidates = await Promise.all(request.candidates.map(candidate => prepareTest(candidate)));
    }
    const candidates = input.kind === 'test-batch' ? request.candidates as Record<string, unknown>[] : [request];
    const executionModels = [];
    const imageKind = ['image', 'image-model-list', 'image-model-test'].includes(input.kind);
    for (const candidate of candidates) {
      const key = candidate.modelKey ?? candidate.evaluationModelKey ?? candidate.extractionModelKey ?? candidate.generationModelKey ?? candidate.configId;
      if (typeof key !== 'string') throw new DesktopBusinessError('INVALID_MODEL_KEY');
      const stored = JSON.parse(snapshot.get(imageKind ? 'image-models' : 'models') ?? '{}') as Record<string, unknown>;
      const configKey = imageKind ? key : decodeTextModelSelection(key)?.configId ?? key;
      if (!Object.prototype.hasOwnProperty.call(stored, configKey)) throw new DesktopBusinessError('MODEL_NOT_CONFIGURED');
      const config = await (await stage.service(imageKind ? 'imageModels' : 'models'))[imageKind ? 'getConfig' : 'getModel'](key) as Record<string, unknown> | null;
      if (!config) throw new DesktopBusinessError('MODEL_NOT_FOUND');
      executionModels.push(redactConfiguration({ configKey, name: config.name, providerId: config.providerId,
        modelId: config.modelId, paramOverrides: config.paramOverrides, coverage: 'frozen-saved-config' }));
    }
    const state: DesktopRun = {
      id: randomUUID(), requestKey, requestHash, ownerId: this.owner.id, kind: input.kind,
      status: 'running', createdAt: Date.now(), updatedAt: Date.now(), saved: false,
      input: redactConfiguration({ ...input, request, executionModels, sourceRevision: input.source?.expectedRevision }), partial: '', reasoning: '',
    };
    if (this.closing) throw new DesktopBusinessError('SOURCE_CLOSING');
    for (const run of runs) await this.reconcile(run, true);
    if (this.closing) throw new DesktopBusinessError('SOURCE_CLOSING');
    const persisted = await this.repository.create(state);
    if (persisted.id !== state.id) return this.get(persisted.id);
    if (this.closing) return this.repository.update(state.id, {
      status: 'cancelled', error: publicBusinessError(new DesktopBusinessError('SOURCE_CLOSING')),
    });
    const controller = new AbortController();
    const active: ActiveRun = { controller, state, task: Promise.resolve() };
    this.active.set(state.id, active);
    active.task = this.execute(stage, input.kind, request, controller, state, input.timeoutMs ?? 180_000)
      .finally(() => { if (state.error?.code !== 'RUN_PERSISTENCE_FAILED') this.active.delete(state.id); });
    return structuredClone(state);
  }

  private async execute(stage: BusinessStage, kind: RunInput['kind'], request: Record<string, unknown>,
    controller: AbortController, state: DesktopRun, timeoutMs: number): Promise<void> {
    const timer = setTimeout(() => controller.abort(new DesktopBusinessError('RUN_TIMEOUT')), timeoutMs);
    let pollPending = false;
    const cancellationTimer = setInterval(() => {
      if (pollPending) return;
      pollPending = true;
      void this.repository.get(state.id).then(run => {
        if (run.cancelRequested) controller.abort(new DesktopBusinessError('RUN_CANCELLED'));
      }).catch(() => {}).finally(() => { pollPending = false; });
    }, 500);
    const handlers: StreamHandlers = {
      signal: controller.signal,
      onToken: token => {
        controller.signal.throwIfAborted();
        if ((state.partial?.length ?? 0) + token.length > 4 * 1024 * 1024) {
          controller.abort(new DesktopBusinessError('OUTPUT_LIMIT_REACHED'));
          controller.signal.throwIfAborted();
        }
        state.partial += token;
      },
      onReasoningToken: token => {
        controller.signal.throwIfAborted();
        if ((state.reasoning?.length ?? 0) + token.length > 4 * 1024 * 1024) {
          controller.abort(new DesktopBusinessError('OUTPUT_LIMIT_REACHED'));
          controller.signal.throwIfAborted();
        }
        state.reasoning += token;
      },
      onComplete: () => {},
      onError: error => { throw error; },
    };
    try {
      let onAbort: (() => void) | undefined;
      const interrupted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', onAbort, { once: true });
        if (controller.signal.aborted) onAbort();
      });
      let output: unknown;
      try { output = await Promise.race([this.perform(stage, kind, request, handlers, state), interrupted]); }
      finally { if (onAbort) controller.signal.removeEventListener('abort', onAbort); }
      controller.signal.throwIfAborted();
      state.status = 'succeeded'; state.output = output ?? state.partial;
    } catch (error) {
      state.status = controller.signal.aborted ? 'cancelled' : 'failed';
      state.error = publicBusinessError(controller.signal.aborted ? controller.signal.reason : error);
    } finally {
      clearTimeout(timer);
      clearInterval(cancellationTimer);
      state.updatedAt = Date.now();
      try { Object.assign(state, await this.repository.update(state.id, state)); }
      catch { state.error = publicBusinessError(new DesktopBusinessError('RUN_PERSISTENCE_FAILED')); state.status = 'failed'; }
    }
  }

  private async perform(stage: BusinessStage, kind: RunInput['kind'], request: Record<string, unknown>, handlers: StreamHandlers, state?: DesktopRun): Promise<unknown> {
    if (kind === 'extract-variables') return (await stage.service('variableExtraction')).extract(request);
    if (kind === 'generate-variable-values') return (await stage.service('variableValues')).generate(request);
    if (kind === 'model-list' || kind === 'model-test') {
      if (typeof request.modelKey !== 'string') throw new DesktopBusinessError('INVALID_MODEL_KEY');
      const service = await stage.service('llm');
      if (kind === 'model-list') return service.fetchModelList(request.modelKey);
      await service.testConnection(request.modelKey); return { connected: true };
    }
    if (kind === 'image-model-list' || kind === 'image-model-test') {
      if (typeof request.modelKey !== 'string') throw new DesktopBusinessError('INVALID_MODEL_KEY');
      const config = await (await stage.service('imageModels')).getConfig(request.modelKey) as { providerId: string; connectionConfig: unknown } | null;
      if (!config) throw new DesktopBusinessError('MODEL_NOT_FOUND');
      const service = await stage.service('image');
      return kind === 'image-model-list' ? service.getDynamicModels(config.providerId, config.connectionConfig) : service.testConnection(config);
    }
    if (kind === 'image-understand') {
      if (typeof request.modelKey !== 'string') throw new DesktopBusinessError('INVALID_MODEL_KEY');
      const modelConfig = await (await stage.service('models')).getModel(request.modelKey);
      await (await stage.service('imageUnderstanding')).understandStream({ ...request, modelConfig }, handlers);
      return undefined;
    }
    if (kind === 'evaluate') {
      const service = await stage.service('evaluation');
      let output: unknown;
      await service.evaluateStream(request, {
        ...handlers, onComplete: (result: unknown) => { output = result; },
      });
      if (!output) throw new DesktopBusinessError('EVALUATION_RESULT_MISSING');
      return output;
    }
    if (kind === 'image') {
      const service = await stage.service('image');
      return service.generate(request);
    }
    if (kind === 'test-batch') {
      const candidates = request.candidates;
      if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 4) throw new DesktopBusinessError('INVALID_CANDIDATES');
      const results = candidates.map((_, index) => ({
        id: String(index + 1), status: 'running', output: '', reasoning: '', error: undefined as DesktopRun['error'],
      }));
      if (state) state.output = results;
      const cancel = () => {
        for (const result of results) if (result.status === 'running') result.status = 'cancelled';
      };
      handlers.signal?.addEventListener('abort', cancel, { once: true });
      try {
        await Promise.all(candidates.map(async (candidate, index) => {
          const result = results[index];
          function append(field: 'output' | 'reasoning', token: string) {
            handlers.signal?.throwIfAborted();
            if (result[field].length + token.length > 1024 * 1024) throw new DesktopBusinessError('OUTPUT_LIMIT_REACHED');
            result[field] += token;
          }
          try {
            await this.perform(stage, 'test', candidate, { ...handlers, onToken: token => append('output', token),
              onReasoningToken: token => append('reasoning', token) });
            handlers.signal?.throwIfAborted();
            result.status = 'succeeded';
          } catch (error) {
            result.status = handlers.signal?.aborted ? 'cancelled' : 'failed';
            result.error = publicBusinessError(error);
          }
        }));
        return results;
      } finally { handlers.signal?.removeEventListener('abort', cancel); }
    }
    const service = await stage.service('prompt');
    if (kind === 'optimize') await service.optimizePromptStream(request, handlers);
    else if (kind === 'optimize-message') await service.optimizeMessageStream(request, handlers);
    else if (kind === 'test-conversation') await service.testCustomConversationStream(request, handlers);
    else if (kind === 'test') await service.testPromptStream(request.systemPrompt ?? '', request.userPrompt ?? '', request.modelKey, handlers, request.inputImages);
    else if (kind === 'iterate') await service.iteratePromptStream(request.originalPrompt, request.lastOptimizedPrompt,
      request.iterateInput, request.modelKey, handlers, request.templateId, request.contextData);
    else throw new DesktopBusinessError('INVALID_RUN_KIND');
    return undefined;
  }

  private async reconcile(state: DesktopRun, persist: boolean): Promise<DesktopRun> {
    if (state.status !== 'running' || state.ownerId === this.owner.id || !await this.owner.isGone(state.ownerId)) return state;
    const error = publicBusinessError(new DesktopBusinessError('RUN_INTERRUPTED'));
    if (!persist) return { ...state, status: 'interrupted', error, updatedAt: state.updatedAt + 1 };
    return this.repository.interrupt(state.id, state.ownerId, error);
  }

  async list(persist: boolean): Promise<DesktopRun[]> {
    const runs = await this.archive.list();
    return Promise.all(runs.map(run => this.reconcile(run, persist)));
  }

  async delete(id: string, expectedUpdatedAt: number): Promise<void> {
    const state = (await this.repository.list()).find(run => run.id === id);
    if (state?.status === 'running') {
      const current = await this.reconcile(state, true);
      if (current.status === 'interrupted' && expectedUpdatedAt === state.updatedAt && current.updatedAt === state.updatedAt + 1) {
        expectedUpdatedAt = current.updatedAt;
      }
    }
    await this.archive.delete(id, expectedUpdatedAt);
  }

  async get(id: string, recover = true): Promise<DesktopRun> {
    const state = await this.reconcile(this.active.get(id)?.state ?? await this.archive.get(id), recover);
    const output = structuredClone(state);
    if (output.status === 'succeeded' && output.output === undefined) output.output = output.partial;
    return output;
  }

  async cancel(id: string): Promise<DesktopRun> {
    const run = await this.get(id);
    if (run.status !== 'running') return run;
    const active = this.active.get(id);
    await this.repository.update(id, { cancelRequested: true });
    active?.controller.abort(new DesktopBusinessError('RUN_CANCELLED'));
    return this.get(id);
  }

  async save(id: string, target: 'archive' | 'history' = 'archive'): Promise<DesktopRun> {
    const run = await this.get(id);
    if (run.status === 'running') throw new DesktopBusinessError('RUN_ACTIVE');
    if (target === 'history') {
      if (run.historyChainId) return run;
      if (run.status !== 'succeeded' || typeof run.output !== 'string' ||
        !['optimize', 'optimize-message', 'iterate'].includes(run.kind)) throw new DesktopBusinessError('RUN_NOT_HISTORY_COMPATIBLE');
      const stage = new BusinessStage(new Map(await this.provider.getAllEntries()));
      const input = (run.input as { request: Record<string, unknown> }).request;
      const chain = await (await stage.service('history')).createNewChain({
        id: randomUUID(), originalPrompt: input.targetPrompt ?? input.originalPrompt ?? '', optimizedPrompt: run.output,
        type: input.optimizationMode === 'user' ? 'userOptimize' : 'optimize', timestamp: Date.now(),
        modelKey: input.modelKey, templateId: input.templateId ?? '', metadata: { desktopRunId: run.id },
      }) as { chainId: string };
      const saved = await createDesktopRunRepository(stage).update(id, { saved: true, historyChainId: chain.chainId });
      await stage.commit(this.provider);
      return saved;
    }
    if (run.saved) return run;
    return this.repository.update(id, { ...run, saved: true, input: redactConfiguration(run.input) });
  }

  async close(): Promise<void> {
    this.closing = true;
    const runs = [...this.active.values()];
    for (const run of runs) run.controller.abort(new DesktopBusinessError('SOURCE_CLOSING'));
    await Promise.all(runs.map(run => run.task));
  }
}
