import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import Dexie from 'dexie'
import { DexieStorageProvider } from '../../../src/services/storage/dexieStorageProvider'
import { StorageAdapter } from '../../../src/services/storage/adapter'
import { PreferenceService } from '../../../src/services/preference/service'

const providers: DexieStorageProvider[] = []
const originalDependencies = { ...Dexie.dependencies }
beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
})
afterEach(async () => {
  await Promise.all(providers.splice(0).map(provider => provider.close()))
  Object.assign(Dexie.dependencies, originalDependencies)
})

describe('IndexedDB conditional commits across connections', () => {
  it('serializes two independent window connections without an unlocked fallback', async () => {
    const connections = [new DexieStorageProvider(), new DexieStorageProvider()]
    providers.push(...connections)
    const [first, second] = connections.map(provider => new PreferenceService(new StorageAdapter(provider)))
    const key = 'session/v1/basic-user'
    await first.set(key, { prompt: 'shared baseline' })
    const original = await first.get(key, null)
    const results = await Promise.all([
      first.compareAndSet!(key, original, { prompt: 'first winner' }),
      second.compareAndSet!(key, original, { prompt: 'second winner' }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await second.get(key, null)).toEqual({ prompt: results[0] ? 'first winner' : 'second winner' })
    expect(await first.compareAndSet!(key, original, { prompt: 'late overwrite' })).toBe(false)
  })
})
