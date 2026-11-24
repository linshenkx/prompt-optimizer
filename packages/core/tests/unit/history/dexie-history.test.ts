import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { DexieStorageProvider } from '../../../src/services/storage/dexieStorageProvider';
import { HistoryManager } from '../../../src/services/history/manager';
import { RecordNotFoundError } from '../../../src/services/history/errors';
import { IModelManager } from '../../../src/services/model/types';

const providers: DexieStorageProvider[] = [];
const originalDependencies = { ...Dexie.dependencies };
const stubModelManager = { getModel: async () => undefined } as unknown as IModelManager;

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(async () => {
  await Promise.all(providers.splice(0).map(provider => provider.close()));
  Object.assign(Dexie.dependencies, originalDependencies);
});

describe('HistoryManager with DexieStorageProvider', () => {
  it('preserves RecordNotFoundError on deleteRecord, deleteChain, and addIteration without retrying or wrapping', async () => {
    const provider = new DexieStorageProvider();
    providers.push(provider);
    const updateSpy = vi.spyOn(provider, 'updateData');
    const manager = new HistoryManager(provider, stubModelManager);

    await expect(manager.deleteRecord('missing-record')).rejects.toBeInstanceOf(RecordNotFoundError);
    await expect(manager.deleteChain('missing-chain')).rejects.toBeInstanceOf(RecordNotFoundError);
    await expect(
      manager.addIteration({
        chainId: 'missing-chain',
        originalPrompt: 'Original',
        optimizedPrompt: 'Iteration',
        modelKey: 'openai',
        templateId: 'tpl-1',
      }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    expect(updateSpy).toHaveBeenCalledTimes(3);

    const created = await manager.createNewChain({
      id: 'root-dexie-1',
      originalPrompt: 'Original',
      optimizedPrompt: 'v1',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
    const iterated = await manager.addIteration({
      chainId: created.chainId,
      originalPrompt: 'Original',
      optimizedPrompt: 'v2',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });

    await manager.deleteRecord(iterated.currentRecord.id);
    await expect(manager.deleteRecord(iterated.currentRecord.id)).rejects.toBeInstanceOf(RecordNotFoundError);

    await manager.deleteChain(created.chainId);
    await expect(manager.deleteChain(created.chainId)).rejects.toBeInstanceOf(RecordNotFoundError);
  });

  it('preserves the chain root when addIteration exceeds the 50-record retention limit', async () => {
    const provider = new DexieStorageProvider();
    providers.push(provider);
    const manager = new HistoryManager(provider, stubModelManager);

    const created = await manager.createNewChain({
      id: 'root-dexie-50',
      originalPrompt: 'Original',
      optimizedPrompt: 'v1',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });

    let chain = created;
    for (let version = 2; version <= 51; version++) {
      chain = await manager.addIteration({
        chainId: created.chainId,
        originalPrompt: 'Original',
        optimizedPrompt: `v${version}`,
        modelKey: 'openai',
        templateId: 'tpl-1',
      });
    }

    expect(chain.rootRecord.version).toBe(1);
    expect(chain.currentRecord.version).toBe(51);
    expect(chain.versions).toHaveLength(50);
    expect(chain.versions[0].version).toBe(1);
    expect(await manager.getChain(created.chainId)).toEqual(chain);

    const next = await manager.addIteration({
      chainId: created.chainId,
      originalPrompt: 'Original',
      optimizedPrompt: 'v52',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
    expect(next.currentRecord.version).toBe(52);
    expect(next.versions).toHaveLength(50);
    expect(await manager.getChain(created.chainId)).toEqual(next);
  });
});
