import { describe, expect, it, vi } from 'vitest';
import { FavoriteManager } from '../../../src/services/favorite/manager';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';

const restore = { matchBy: 'id', mergeStrategy: 'overwrite' } as const;
const payload = (favorites: unknown[], categories: unknown[] = [], tags: string[] = []) =>
  JSON.stringify({ version: '1.0', favorites, categories, tags });
const favorite = (id: string, content = id, extra: Record<string, unknown> = {}) => ({
  id, title: id, content, functionMode: 'basic', optimizationMode: 'system',
  tags: [], createdAt: 1000, updatedAt: 2000, useCount: 3, ...extra,
});
const setup = () => {
  const storage = new MemoryStorageProvider();
  return { storage, manager: new FavoriteManager(storage) };
};
const snapshot = (storage: MemoryStorageProvider) =>
  Promise.all(storage.getAllKeys().sort().map(async key => [key, await storage.getItem(key)]));

describe('Favorite backup identity and preflight', () => {
  it('restores nested category identities even when children precede parents', async () => {
    const { manager } = setup();
    await manager.importFavorites(payload([
      favorite('f', 'nested', { category: 'child' }),
    ], [
      { id: 'child', name: 'Child', parentId: 'parent', color: '#abc', createdAt: 1, sortOrder: 2 },
      { id: 'parent', name: 'Parent', createdAt: 1, sortOrder: 1 },
    ]), restore);
    expect(await manager.getCategories()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'child', parentId: 'parent', color: '#abc', createdAt: 1 }),
      expect.objectContaining({ id: 'parent', name: 'Parent' }),
    ]));
    expect((await manager.getFavorite('f')).category).toBe('child');
    expect((await manager.getStats()).categoryStats.find(category => category.categoryId === 'child')?.count).toBe(1);
  });

  it('maps same-name manual categories within the mapped parent', async () => {
    const { manager } = setup();
    await manager.importFavorites(payload([], [
      { id: 'target-root', name: 'Root' },
      { id: 'target-child', name: 'Child', parentId: 'target-root' },
    ]), restore);
    await manager.importFavorites(payload([favorite('f', 'text', { category: 'source-child' })], [
      { id: 'source-root', name: 'Root' },
      { id: 'source-child', name: 'Child', parentId: 'source-root' },
    ]));
    expect(await manager.getCategories()).toHaveLength(2);
    expect((await manager.getFavorite('f')).category).toBe('target-child');
  });

  it('keeps different favorite and category identities with identical names or content during backup restore', async () => {
    const { manager } = setup();
    await manager.importFavorites(payload([favorite('target', 'same')], [{ id: 'target-category', name: 'Shared' }]), restore);
    const backup = payload([
      favorite('one', 'same', { title: 'One', category: 'source-category' }),
      favorite('two', 'same', { title: 'Two', category: 'source-category' }),
    ], [{ id: 'source-category', name: 'Shared' }]);
    expect(await manager.importFavorites(backup, restore)).toEqual({ imported: 2, skipped: 0, errors: [] });
    expect((await manager.getFavorites()).map(item => item.id).sort()).toEqual(['one', 'target', 'two']);
    expect(await manager.getCategories()).toHaveLength(2);
    await manager.importFavorites(backup, restore);
    expect((await manager.getFavorites()).map(item => item.id).sort()).toEqual(['one', 'target', 'two']);
  });

  it('restores changed content by identity and preserves complete asset versions', async () => {
    const source = setup();
    await source.manager.importFavorites(payload([favorite('shared', 'first')]), restore);
    await source.manager.updateFavorite('shared', { content: 'second' });
    const before = await source.manager.getFavorite('shared');
    expect(before.metadata?.promptAsset.versions).toHaveLength(2);
    const target = setup();
    await target.manager.importFavorites(payload([favorite('shared', 'old target')]), restore);
    await target.manager.importFavorites(await source.manager.exportFavorites(), restore);
    const after = await target.manager.getFavorite('shared');
    expect(after.content).toBe('second');
    expect(after.metadata?.promptAsset).toEqual(before.metadata?.promptAsset);
    await target.manager.importFavorites(await source.manager.exportFavorites(), restore);
    expect((await target.manager.getFavorite('shared')).metadata?.promptAsset).toEqual(before.metadata?.promptAsset);
  });

  it('allows idempotent merge of an identical identity but rejects ambiguous changed identities before writes', async () => {
    const { manager, storage } = setup();
    await manager.importFavorites(payload([favorite('shared')]), restore);
    const exported = await manager.exportFavorites();
    expect(await manager.importFavorites(exported, { matchBy: 'id', mergeStrategy: 'merge' })).toEqual({ imported: 0, skipped: 1, errors: [] });
    const before = await snapshot(storage);
    await expect(manager.importFavorites(payload([favorite('shared', 'changed')], [{ id: 'new', name: 'New' }], ['new-tag']), { matchBy: 'id', mergeStrategy: 'merge' })).rejects.toThrow('Favorite ID conflict');
    expect(await snapshot(storage)).toEqual(before);
  });

  it('rebases derived asset and version references when a manual merge must allocate a favorite ID', async () => {
    const source = setup();
    await source.manager.importFavorites(payload([favorite('shared', 'incoming favorite:shared', {
      metadata: { origin: { kind: 'favorite', id: 'shared' }, favoriteId: 'shared' },
    })]), restore);
    const { manager } = setup();
    await manager.importFavorites(payload([favorite('shared', 'existing')]), restore);
    await manager.importFavorites(await source.manager.exportFavorites(), { mergeStrategy: 'merge' });
    const all = await manager.getFavorites();
    const incoming = all.find(item => item.content === 'incoming favorite:shared')!;
    expect(incoming.id).not.toBe('shared');
    const asset = incoming.metadata?.promptAsset;
    expect(asset.id).toBe(`favorite:${incoming.id}`);
    expect(asset.currentVersionId).toBe(`favorite:${incoming.id}:current`);
    expect(asset.versions[0].source).toEqual({ kind: 'favorite', id: incoming.id });
    expect(incoming.metadata?.origin).toEqual({ kind: 'favorite', id: incoming.id });
    expect(incoming.metadata?.favoriteId).toBe(incoming.id);
    expect(new Set(all.map(item => item.metadata?.promptAsset.id)).size).toBe(2);
  });

  it('rebases imported asset identities when manual overwrite retains the content-matched target ID', async () => {
    const source = setup();
    await source.manager.importFavorites(payload([favorite('source', 'same')]), restore);
    const { manager } = setup();
    await manager.importFavorites(payload([favorite('target', 'same')]), restore);
    await manager.importFavorites(await source.manager.exportFavorites(), { mergeStrategy: 'overwrite' });
    const target = await manager.getFavorite('target');
    expect(target.metadata?.promptAsset.id).toBe('favorite:target');
    expect(target.metadata?.promptAsset.versions[0].source.id).toBe('target');
    expect(await manager.getFavorites()).toHaveLength(1);
  });

  it('validates the full payload and performs no category/tag writes if one favorite is invalid', async () => {
    const { manager, storage } = setup();
    await manager.importFavorites(payload([favorite('existing')]), restore);
    const before = await snapshot(storage);
    await expect(manager.importFavorites(payload([
      favorite('good'), favorite('bad', ''),
    ], [{ id: 'new-category', name: 'New' }], ['new-tag']), restore)).rejects.toThrow('Invalid favorite content');
    expect(await snapshot(storage)).toEqual(before);
  });

  it('provides read-only preflight including category references and size budgets', async () => {
    const { manager, storage } = setup();
    await manager.getCategories();
    const update = vi.spyOn(storage, 'updateData');
    const data = payload([favorite('f', 'saved', { category: 'cat' })], [{ id: 'cat', name: 'Category' }], ['tag']);
    await manager.validateImportData(data, restore);
    expect(update).not.toHaveBeenCalled();
    expect(await manager.getFavorites()).toEqual([]);
    await manager.importFavorites(data, restore);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it.each([
    payload([favorite('f')], [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }]),
    payload([favorite('f', 'text', { category: 'missing' })]),
    payload([favorite('f')], [{ id: 'a', name: 'A', parentId: 'missing' }]),
    payload([favorite('f'), favorite('f', 'duplicate')]),
    JSON.stringify({ version: '999', favorites: [] }),
  ])('rejects invalid reference graphs or unsupported versions before writing (%#)', async data => {
    const { manager, storage } = setup();
    await manager.getCategories();
    const update = vi.spyOn(storage, 'updateData');
    await expect(manager.importFavorites(data, restore)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it('propagates category persistence failures instead of silently accepting missing categories', async () => {
    const { manager, storage } = setup();
    await manager.getCategories();
    vi.spyOn(storage, 'updateData').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(manager.importFavorites(payload([favorite('f', 'text', { category: 'cat' })], [{ id: 'cat', name: 'Category' }]), restore)).rejects.toThrow('storage unavailable');
    expect(await manager.getCategories()).toEqual([]);
    expect(await manager.getFavorites()).toEqual([]);
  });

  it('preserves a concurrent favorite edit made after the import plan was read', async () => {
    const { manager, storage } = setup();
    await manager.importFavorites(payload([favorite('existing', 'old')]), restore);
    const update = storage.updateData.bind(storage);
    let intervened = false;
    vi.spyOn(storage, 'updateData').mockImplementation(async (key, modifier) => {
      if (key === 'favorites' && !intervened) {
        intervened = true;
        await update('favorites', current => (current as unknown as Array<Record<string, unknown>>).map(item => ({ ...item, title: 'Concurrent title' })));
      }
      return update(key, modifier);
    });
    await expect(manager.importFavorites(payload([favorite('new', 'imported')], [{ id: 'new-category', name: 'New category' }], ['new-tag']), restore)).rejects.toThrow('changed during import');
    expect((await manager.getFavorite('existing')).title).toBe('Concurrent title');
    expect(await manager.getFavorites()).toHaveLength(1);
    expect(await manager.getCategories()).toEqual([]);
    expect(await manager.getAllTags()).toEqual([]);
  });

  it('does not roll back another window\'s later category edit', async () => {
    const { manager, storage } = setup();
    await manager.importFavorites(payload([favorite('existing')]), restore);
    const update = storage.updateData.bind(storage);
    let intervened = false;
    vi.spyOn(storage, 'updateData').mockImplementation(async (key, modifier) => {
      if (key === 'favorites' && !intervened) {
        intervened = true;
        await update('favorite_categories', current => (current as unknown as Array<Record<string, unknown>>).map(item => ({ ...item, name: 'Concurrent category' })));
        await update('favorites', current => (current as unknown as Array<Record<string, unknown>>).map(item => ({ ...item, title: 'Concurrent favorite' })));
      }
      return update(key, modifier);
    });
    await expect(manager.importFavorites(payload([favorite('new')], [{ id: 'cat', name: 'Imported category' }]), restore)).rejects.toThrow('rollback incomplete');
    expect((await manager.getCategories())[0].name).toBe('Concurrent category');
    expect((await manager.getFavorite('existing')).title).toBe('Concurrent favorite');
  });
});
