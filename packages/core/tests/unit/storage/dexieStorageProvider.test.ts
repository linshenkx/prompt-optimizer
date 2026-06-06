import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DexieStorageProvider } from '../../../src/services/storage/dexieStorageProvider';
import { StorageError } from '../../../src/services/storage/errors';

describe('DexieStorageProvider', () => {
  let provider: DexieStorageProvider;
  let dbName: string;

  const createProvider = async () => {
    dbName = `PromptOptimizerTestDB_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    vi.stubGlobal('window', { __TEST_DB_NAME__: dbName });
    provider = new DexieStorageProvider();
    await provider.clearAll();
  };

  beforeEach(async () => {
    await createProvider();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await provider?.close();
    if (dbName) {
      await Dexie.delete(dbName);
    }
  });

  it('persists and removes string values', async () => {
    await provider.setItem('key', 'value');
    await provider.setItem('json', JSON.stringify({ nested: true }));

    expect(await provider.getItem('key')).toBe('value');
    expect(JSON.parse((await provider.getItem('json'))!)).toEqual({ nested: true });

    await provider.removeItem('key');
    expect(await provider.getItem('key')).toBeNull();
    expect(await provider.getItem('missing')).toBeNull();
  });

  it('clears all records in the active database', async () => {
    await provider.setItem('first', 'one');
    await provider.setItem('second', 'two');

    await provider.clearAll();

    expect(await provider.getItem('first')).toBeNull();
    expect(await provider.getItem('second')).toBeNull();
  });

  it('updates existing and missing JSON records atomically', async () => {
    await provider.setItem('counter', JSON.stringify({ count: 1 }));

    await provider.updateData<{ count: number }>('counter', (current) => ({
      count: (current?.count ?? 0) + 1
    }));
    await provider.atomicUpdate<{ count: number }>('created', (current) => ({
      count: (current?.count ?? 0) + 5
    }));

    expect(JSON.parse((await provider.getItem('counter'))!)).toEqual({ count: 2 });
    expect(JSON.parse((await provider.getItem('created'))!)).toEqual({ count: 5 });
  });

  it('serializes same-key concurrent atomic updates through the provider lock', async () => {
    await provider.setItem('counter', JSON.stringify({ count: 0 }));

    await Promise.all(
      Array.from({ length: 5 }, () =>
        provider.atomicUpdate<{ count: number }>('counter', (current) => ({
          count: (current?.count ?? 0) + 1
        }))
      )
    );

    expect(JSON.parse((await provider.getItem('counter'))!)).toEqual({ count: 5 });
  });

  it('applies mixed batch updates in one transaction', async () => {
    await provider.setItem('remove-me', 'old');

    await provider.batchUpdate([
      { key: 'a', operation: 'set', value: 'one' },
      { key: 'b', operation: 'set', value: 'two' },
      { key: 'remove-me', operation: 'remove' },
      { key: 'ignored-set-without-value', operation: 'set' }
    ]);

    expect(await provider.getItem('a')).toBe('one');
    expect(await provider.getItem('b')).toBe('two');
    expect(await provider.getItem('remove-me')).toBeNull();
    expect(await provider.getItem('ignored-set-without-value')).toBeNull();
  });

  it('exports, imports, and reports storage information', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(2000);

    await provider.setItem('first', 'one');
    await provider.setItem('second', 'four');

    expect(await provider.exportAll()).toEqual({
      first: 'one',
      second: 'four'
    });
    expect(await provider.getStorageInfo()).toEqual({
      itemCount: 2,
      estimatedSize: 7,
      lastUpdated: 2000
    });

    nowSpy.mockRestore();

    await provider.clearAll();
    await provider.importAll({ restored: 'value', another: 'item' });

    expect(await provider.exportAll()).toEqual({
      restored: 'value',
      another: 'item'
    });
  });

  it('falls back to a simple update when atomic retries are exhausted', async () => {
    const atomicSpy = vi
      .spyOn(provider as any, '_performAtomicUpdate')
      .mockRejectedValue(new StorageError('forced transaction failure', 'write'));

    await provider.setItem('fallback', JSON.stringify({ count: 1 }));
    await provider.atomicUpdate<{ count: number }>('fallback', (current) => ({
      count: (current?.count ?? 0) + 1
    }));

    expect(atomicSpy).toHaveBeenCalledTimes(3);
    expect(JSON.parse((await provider.getItem('fallback'))!)).toEqual({ count: 2 });
  });

  it('wraps table failures in StorageError and returns safe stats fallback', async () => {
    const table = (provider as any).db.storage;

    vi.spyOn(table, 'get').mockRejectedValueOnce(new Error('read failed'));
    await expect(provider.getItem('broken')).rejects.toThrow(StorageError);

    vi.spyOn(table, 'put').mockRejectedValueOnce(new Error('write failed'));
    await expect(provider.setItem('broken', 'value')).rejects.toThrow(StorageError);

    vi.spyOn(table, 'delete').mockRejectedValueOnce(new Error('delete failed'));
    await expect(provider.removeItem('broken')).rejects.toThrow(StorageError);

    vi.spyOn(table, 'clear').mockRejectedValueOnce(new Error('clear failed'));
    await expect(provider.clearAll()).rejects.toThrow(StorageError);

    vi.spyOn(table, 'count').mockRejectedValueOnce(new Error('count failed'));
    await expect(provider.getStorageInfo()).resolves.toEqual({
      itemCount: 0,
      estimatedSize: 0,
      lastUpdated: null
    });
  });
});
