import * as core from '../../index';
import { signText } from '../../utils/portable-crypto';
import type { ComparisonStorage } from '../text-comparison/repository';
import { DesktopBusinessError, assertJson, businessOperations } from './catalog';

type Callable = (...parameters: unknown[]) => unknown;
export type Service = Record<string, Callable>;
export type Snapshot = Map<string, string>;
export type BusinessStorage = core.IStorageProvider & ComparisonStorage & {
  getAllEntries(): Promise<Array<[string, string]>>;
};
const internalKey = (key: string) => key.startsWith('mcp:');
const revisionSecret = globalThis.crypto.getRandomValues(new Uint8Array(32));

export function snapshotRevision(snapshot: Snapshot, sourceId: string): string {
  const entries = [...snapshot].filter(([key]) => !internalKey(key)).sort(([left], [right]) => left.localeCompare(right));
  return signText(revisionSecret, JSON.stringify([sourceId, entries]));
}

export function redactConfiguration(value: unknown): unknown {
  if (typeof value === 'string' && /^\s*[[{]/.test(value)) {
    try { return JSON.stringify(redactConfiguration(JSON.parse(value))); } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(redactConfiguration);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, field]) => {
    if (/api.?key|access.?key|authorization|password|secret|token|headers|credential|connectionConfig/i.test(key)) return [key, '[REDACTED]'];
    if (/url|endpoint|proxy/i.test(key) && typeof field === 'string') {
      try { const url = new URL(field); return [key, `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/[REDACTED]`]; }
      catch { return [key, '[REDACTED]']; }
    }
    return [key, redactConfiguration(field)];
  }));
  return value;
}

export class BusinessStage implements core.IStorageProvider {
  readonly values: Snapshot;
  readonly observed = new Set<string>();
  readonly changed = new Set<string>();
  private readonly services = new Map<string, Promise<unknown>>();

  constructor(readonly original: Snapshot) {
    this.values = new Map(original);
    const known = ['models', 'image-models', 'user-templates', 'prompt_history', 'favorites', 'favorite_categories', 'favorite_tags', 'favorite_stats'];
    for (const key of known) {
      const value = original.get(key);
      if (value !== undefined) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (!parsed || typeof parsed !== 'object') throw new Error();
        } catch { throw new DesktopBusinessError('SOURCE_DATA_INVALID'); }
      }
    }
  }
  async getItem(key: string): Promise<string | null> { this.observed.add(key); return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.changed.add(key); this.values.set(key, value); }
  async removeItem(key: string): Promise<void> { this.changed.add(key); this.values.delete(key); }
  async clearAll(): Promise<void> { for (const key of this.values.keys()) await this.removeItem(key); }
  async compareAndSetItem(key: string, expected: string | null, value: string | null): Promise<boolean> {
    if (await this.getItem(key) !== expected) return false;
    if (value === null) await this.removeItem(key); else await this.setItem(key, value);
    return true;
  }
  async updateData<Value>(key: string, modifier: (current: Value | null) => Value): Promise<void> {
    const stored = await this.getItem(key);
    await this.setItem(key, JSON.stringify(modifier(stored === null ? null : JSON.parse(stored))));
  }
  async batchUpdate(operations: Parameters<core.IStorageProvider['batchUpdate']>[0]): Promise<void> {
    for (const operation of operations) {
      if (operation.operation === 'remove') await this.removeItem(operation.key);
      else if (operation.value !== undefined) await this.setItem(operation.key, operation.value);
    }
  }
  async getEntriesByPrefix(prefix: string): Promise<Array<[string, string]>> {
    return [...this.values].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => {
      this.observed.add(key); return [key, value];
    });
  }
  async withWriteTransaction<Value>(modifier: (transaction: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  }) => Value): Promise<Value> {
    const previous = new Map(this.values);
    try {
      const result = modifier({
        getItem: key => { this.observed.add(key); return this.values.get(key) ?? null; },
        setItem: (key, value) => { this.changed.add(key); this.values.set(key, value); },
        removeItem: key => { this.changed.add(key); this.values.delete(key); },
      });
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new DesktopBusinessError('ASYNC_TRANSACTION_REFUSED');
      return result;
    } catch (error) {
      this.values.clear(); for (const [key, value] of previous) this.values.set(key, value);
      throw error;
    }
  }
  getCapabilities() { return { supportsAtomic: true, supportsBatch: true }; }

  service(domain: string): Promise<Service> {
    if (!this.services.has(domain)) this.services.set(domain, this.createService(domain));
    return this.services.get(domain) as Promise<Service>;
  }

  private async createService(domain: string): Promise<unknown> {
    const typed = async <Value>(name: string) => await this.service(name) as unknown as Value;
    switch (domain) {
      case 'favorites': return new core.FavoriteManager(this);
      case 'settings': return core.createPreferenceService(this);
      case 'variables': {
        const preferences = await typed<core.IPreferenceService>('settings');
        const load = async () => {
          const value = await preferences.get('variableManager.storage', { customVariables: {} as Record<string, string>, advancedModeEnabled: false, lastConversationMessages: [] });
          if (!value || !value.customVariables || typeof value.customVariables !== 'object' || Array.isArray(value.customVariables)) throw new DesktopBusinessError('SOURCE_DATA_INVALID');
          return value;
        };
        const valid = (name: unknown) => {
          if (typeof name !== 'string' || !core.isValidVariableName(name) || (core.PREDEFINED_VARIABLES as readonly string[]).includes(name)) {
            throw new DesktopBusinessError('INVALID_VARIABLE_NAME');
          }
          return name;
        };
        return {
          list: async () => (await load()).customVariables,
          get: async (name: string) => (await load()).customVariables[valid(name)] ?? null,
          set: async (name: string, value: string) => {
            valid(name);
            if (typeof value !== 'string' || value.length > core.VARIABLE_VALIDATION.MAX_VALUE_LENGTH) throw new DesktopBusinessError('INVALID_VARIABLE_VALUE');
            const stored = await load(); stored.customVariables[name] = value;
            await preferences.set('variableManager.storage', stored);
          },
          delete: async (name: string) => {
            valid(name); const stored = await load(); delete stored.customVariables[name];
            await preferences.set('variableManager.storage', stored);
          },
        };
      }
      case 'contexts': return core.createContextRepo(this);
      case 'models': {
        const manager = core.createModelManager(this);
        await manager.ensureInitialized(); return manager;
      }
      case 'providers': return this.providerService(core.createTextAdapterRegistry());
      case 'imageProviders': return this.providerService(core.createImageAdapterRegistry());
      case 'imageModels': {
        const manager = core.createImageModelManager(this, core.createImageAdapterRegistry());
        await manager.ensureInitialized(); return manager;
      }
      case 'templates': {
        const language = core.createTemplateLanguageService(await typed<core.IPreferenceService>('settings'));
        await language.initialize(); return core.createTemplateManager(this, language);
      }
      case 'history': return core.createHistoryManager(this, await typed<core.IModelManager>('models'));
      case 'llm': return core.createLLMService(await typed<core.ModelManager>('models'));
      case 'prompt': return core.createPromptService(await typed<core.IModelManager>('models'),
        await typed<core.ILLMService>('llm'), await typed<core.ITemplateManager>('templates'),
        await typed<core.IHistoryManager>('history'), core.createImageUnderstandingService());
      case 'evaluation': return core.createEvaluationService(await typed<core.ILLMService>('llm'),
        await typed<core.IModelManager>('models'), await typed<core.ITemplateManager>('templates'));
      case 'image': return core.createImageService(await typed<core.IImageModelManager>('imageModels'), core.createImageAdapterRegistry());
      case 'imageUnderstanding': return core.createImageUnderstandingService();
      case 'variableExtraction': return core.createVariableExtractionService(await typed<core.ILLMService>('llm'),
        await typed<core.IModelManager>('models'), await typed<core.ITemplateManager>('templates'));
      case 'variableValues': return core.createVariableValueGenerationService(await typed<core.ILLMService>('llm'),
        await typed<core.IModelManager>('models'), await typed<core.ITemplateManager>('templates'));
      case 'workspaces': return new core.WorkspaceSessionTransfer(await typed<core.IPreferenceService>('settings'));
      case 'data': return core.createDataManager(await typed<core.IModelManager>('models'),
        await typed<core.ITemplateManager>('templates'), await typed<core.IHistoryManager>('history'),
        await typed<core.IPreferenceService>('settings'), await typed<core.ContextRepo>('contexts'),
        await typed<core.IImageModelManager>('imageModels'));
      default: throw new DesktopBusinessError('UNKNOWN_DOMAIN');
    }
  }

  private providerService(registry: { getAllProviders(): Array<{ id: string }>; getStaticModels(providerId: string): unknown[] }) {
    return {
      getAllProviders: () => registry.getAllProviders(),
      getStaticModels: (providerId: string) => registry.getStaticModels(providerId),
      getProvider: (id: string) => registry.getAllProviders().find(provider => provider.id === id) ?? null,
    };
  }

  async invoke(domain: string, operation: string, parameters: unknown[], access: 'read' | 'write'): Promise<unknown> {
    const spec = businessOperations.find(item => item.domain === domain && item.operation === operation && item.access === access);
    if (!spec) throw new DesktopBusinessError('UNKNOWN_OPERATION');
    assertJson(parameters);
    if (!Array.isArray(parameters) || parameters.length < spec.minimum || parameters.length > spec.arguments.length) {
      throw new DesktopBusinessError('INVALID_ARGUMENTS');
    }
    if (domain === 'settings' && typeof parameters[0] === 'string' &&
      (parameters[0].startsWith('mcp:') || parameters[0].startsWith('session/'))) {
      throw new DesktopBusinessError('USE_WORKSPACE_OPERATIONS');
    }
    const service = await this.service(domain);
    const result = await service[operation](...parameters);
    return result ?? null;
  }

  async commit(provider: BusinessStorage, extra?: { key: string; value: string }, check?: () => void): Promise<void> {
    await provider.withWriteTransaction(transaction => {
      check?.();
      for (const key of new Set([...this.observed, ...this.changed])) {
        if (transaction.getItem(key) !== (this.original.get(key) ?? null)) throw new DesktopBusinessError('REVISION_CONFLICT');
      }
      if (extra && transaction.getItem(extra.key) !== null) throw new DesktopBusinessError('REQUEST_ALREADY_COMMITTED');
      for (const key of this.changed) {
        const value = this.values.get(key);
        if (value === undefined) transaction.removeItem(key); else transaction.setItem(key, value);
      }
      if (extra) transaction.setItem(extra.key, extra.value);
    });
  }
}
