import { describe, expect, it } from 'vitest'
import { PreferenceService } from '../../../src/services/preference/service'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { StorageAdapter } from '../../../src/services/storage/adapter'
import type { IStorageProvider } from '../../../src/services/storage/types'

describe('preference conditional writes', () => {
  it('allows exactly one writer based on the same snapshot', async () => {
    const storage = new MemoryStorageProvider()
    const first = new PreferenceService(storage)
    const second = new PreferenceService(storage)
    const key = 'session/v1/basic-user'
    await first.set(key, { prompt: 'original' })
    const initial = await first.get(key, null)
    const results = await Promise.all([
      first.compareAndSet!(key, initial, { prompt: 'first' }),
      second.compareAndSet!(key, initial, { prompt: 'second' }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await first.get(key, null)).toEqual({ prompt: results[0] ? 'first' : 'second' })
  })

  it('never overwrites an imported snapshot with an older window', async () => {
    const storage = new MemoryStorageProvider()
    const oldWindow = new PreferenceService(storage)
    const importer = new PreferenceService(storage)
    const key = 'session/v1/basic-user'
    await oldWindow.set(key, { prompt: 'before import' })
    const baseline = await oldWindow.get(key, null)
    await importer.set(key, { prompt: 'imported draft' })
    expect(await oldWindow.compareAndSet!(key, baseline, { prompt: 'stale draft' })).toBe(false)
    expect(await importer.get(key, null)).toEqual({ prompt: 'imported draft' })
  })

  it('handles absent and legacy null snapshots, including conditional removal', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const key = 'session/v1/basic-user'
    expect(await preferences.compareAndSet!(key, null, { prompt: 'created' })).toBe(true)
    expect(await preferences.compareAndSet!(key, { prompt: 'created' }, null)).toBe(true)
    expect(await storage.getItem(`pref:${key}`)).toBeNull()
    await storage.setItem(`pref:${key}`, 'null')
    expect(await preferences.compareAndSet!(key, null, { prompt: 'legacy migrated' })).toBe(true)
    expect(await preferences.get(key, null)).toEqual({ prompt: 'legacy migrated' })
  })

  it('leaves existing providers without atomic commits on their original preference API', async () => {
    const storage = new MemoryStorageProvider()
    const legacy = {
      getItem: storage.getItem.bind(storage), setItem: storage.setItem.bind(storage),
      removeItem: storage.removeItem.bind(storage), clearAll: storage.clearAll.bind(storage),
      updateData: storage.updateData.bind(storage), batchUpdate: storage.batchUpdate.bind(storage),
    } satisfies IStorageProvider
    const adapter = new StorageAdapter(legacy)
    const preferences = new PreferenceService(adapter)
    expect(adapter.compareAndSetItem).toBeUndefined()
    expect(preferences.compareAndSet).toBeUndefined()
    expect(preferences.readSnapshot).toBeUndefined()
    await preferences.set('session/v1/basic-user', { prompt: 'normal save' })
    expect(await preferences.get('session/v1/basic-user', null)).toEqual({ prompt: 'normal save' })
  })
})
