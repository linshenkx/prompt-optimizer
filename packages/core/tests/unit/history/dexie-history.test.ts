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
    expect(await manager.getIterationChain(chain.currentRecord.id)).toEqual(chain.versions);

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
    expect(await manager.getIterationChain(next.currentRecord.id)).toEqual(next.versions);
  });

  it('queues concurrent Dexie mutations so a rejected delete does not reject the next valid mutation', async () => {
    const provider = new DexieStorageProvider();
    providers.push(provider);
    const manager = new HistoryManager(provider, stubModelManager);

    const chainA = await manager.createNewChain({
      id: 'root-dexie-queue-a',
      originalPrompt: 'Original A',
      optimizedPrompt: 'v1 A',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
    const chainB = await manager.createNewChain({
      id: 'root-dexie-queue-b',
      originalPrompt: 'Original B',
      optimizedPrompt: 'v1 B',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });

    const results = await Promise.allSettled([
      manager.deleteChain('missing-chain'),
      manager.deleteChain(chainA.chainId),
      manager.addIteration({
        chainId: chainB.chainId,
        originalPrompt: 'Original B',
        optimizedPrompt: 'v2 B',
        modelKey: 'openai',
        templateId: 'tpl-1',
      }),
    ]);

    expect(results[0].status).toBe('rejected');
    expect((results[0] as PromiseRejectedResult).reason).toBeInstanceOf(RecordNotFoundError);
    expect(results[1].status).toBe('fulfilled');
    expect(results[2].status).toBe('fulfilled');
    expect((results[2] as PromiseFulfilledResult<Awaited<ReturnType<typeof manager.addIteration>>>).value.currentRecord.version).toBe(2);

    await expect(manager.getChain(chainA.chainId)).rejects.toBeInstanceOf(RecordNotFoundError);
    const updatedB = await manager.getChain(chainB.chainId);
    expect(updatedB.versions.map(v => v.version)).toEqual([1, 2]);
  });

  it('preserves roots of all active chains when alternating iterations exceed 50 records', async () => {
    const provider = new DexieStorageProvider();
    providers.push(provider);
    const manager = new HistoryManager(provider, stubModelManager);

    const chainA = await manager.createNewChain({
      id: 'root-dexie-alt-a',
      originalPrompt: 'Original A',
      optimizedPrompt: 'A v1',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
    const chainB = await manager.createNewChain({
      id: 'root-dexie-alt-b',
      originalPrompt: 'Original B',
      optimizedPrompt: 'B v1',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });

    for (let i = 0; i < 24; i++) {
      await manager.addIteration({
        chainId: chainA.chainId,
        originalPrompt: 'Original A',
        optimizedPrompt: `A v${i + 2}`,
        modelKey: 'openai',
        templateId: 'tpl-1',
      });
      await manager.addIteration({
        chainId: chainB.chainId,
        originalPrompt: 'Original B',
        optimizedPrompt: `B v${i + 2}`,
        modelKey: 'openai',
        templateId: 'tpl-1',
      });
    }

    await manager.addIteration({
      chainId: chainA.chainId,
      originalPrompt: 'Original A',
      optimizedPrompt: 'A v26',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
    await manager.addIteration({
      chainId: chainB.chainId,
      originalPrompt: 'Original B',
      optimizedPrompt: 'B v26',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });
    const chainC = await manager.createNewChain({
      id: 'root-dexie-alt-c',
      originalPrompt: 'Original C',
      optimizedPrompt: 'C v1',
      type: 'optimize',
      modelKey: 'openai',
      templateId: 'tpl-1',
    });

    expect((await manager.getRecords()).length).toBeLessThanOrEqual(50);
    expect((await manager.getChain(chainA.chainId)).rootRecord.version).toBe(1);
    expect((await manager.getChain(chainB.chainId)).rootRecord.version).toBe(1);
    expect((await manager.getChain(chainC.chainId)).rootRecord.version).toBe(1);
    expect((await manager.getAllChains()).map(c => c.chainId).sort()).toEqual(
      [chainA.chainId, chainB.chainId, chainC.chainId].sort(),
    );
  });

  it('preserves chain root and ancestor links when importing a 51-version newest-first chain', async () => {
    const provider = new DexieStorageProvider();
    providers.push(provider);
    const manager = new HistoryManager(provider, stubModelManager);

    const chainId = 'chain-import-51';
    const baseTime = 1_700_000_000_000;
    const newestFirst51 = Array.from({ length: 51 }, (_, index) => {
      const version = 51 - index;
      return {
        id: `imp-${version}`,
        chainId,
        originalPrompt: 'Original prompt',
        optimizedPrompt: `Optimized v${version}`,
        type: version === 1 ? ('optimize' as const) : ('iterate' as const),
        version,
        ...(version > 1 ? { previousId: `imp-${version - 1}` } : {}),
        timestamp: baseTime + version,
        modelKey: 'openai',
        templateId: 'tpl-1',
      };
    });

    await manager.importData(newestFirst51);

    expect(await manager.getRecords()).toHaveLength(50);
    const allChains = await manager.getAllChains();
    expect(allChains).toHaveLength(1);
    const loaded = await manager.getChain(chainId);
    expect(loaded.rootRecord.version).toBe(1);
    expect(loaded.currentRecord.version).toBe(51);
    expect(loaded.versions).toHaveLength(50);
    expect(await manager.getIterationChain(newestFirst51[0].id)).toEqual(loaded.versions);
  });
});
