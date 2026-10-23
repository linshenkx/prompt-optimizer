import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_SESSION_SNAPSHOT_BYTES, PreferenceService } from '../../../src/services/preference/service'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'

const key = 'session/v1/basic-user'
const storedKey = `pref:${key}`

afterEach(() => vi.restoreAllMocks())

describe('preference snapshot cleanup', () => {
  it('reads an absent preference with the fallback without granting removal', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const commit = vi.spyOn(storage, 'compareAndSetItem')
    const fallback = { prompt: 'default' }
    const snapshot = await preferences.readSnapshot!(key, fallback)

    expect(snapshot.result).toEqual({ ok: true, value: fallback })
    await preferences.set(key, { prompt: 'created after the read' })
    expect(await snapshot.removeIfUnchanged()).toBe(false)
    expect(commit).not.toHaveBeenCalled()
    expect(await preferences.get(key, null)).toEqual({ prompt: 'created after the read' })
  })

  it('rejects an oversized value before parsing and removes only that same value', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    // Deliberately invalid JSON so a parsing attempt would produce a different error.
    const raw = 'private-data' + 'x'.repeat(MAX_SESSION_SNAPSHOT_BYTES)
    await storage.setItem(storedKey, raw)
    const snapshot = await preferences.readSnapshot!(key, null)

    expect(snapshot.result).toMatchObject({
      ok: false,
      error: { code: 'error.storage.read', params: { reason: 'session_snapshot_too_large' } },
    })
    expect(JSON.stringify(snapshot)).not.toContain('private-data')
    expect(await snapshot.removeIfUnchanged()).toBe(true)
    expect(await storage.getItem(storedKey)).toBeNull()
    expect(await snapshot.removeIfUnchanged()).toBe(false)
  })

  it('keeps a replacement written after an oversized snapshot was read', async () => {
    const storage = new MemoryStorageProvider()
    const first = new PreferenceService(storage)
    const second = new PreferenceService(storage)
    await storage.setItem(storedKey, 'x'.repeat(MAX_SESSION_SNAPSHOT_BYTES + 1))
    const snapshot = await first.readSnapshot!(key, null)
    await second.set(key, { prompt: 'repaired in another window' })

    expect(await snapshot.removeIfUnchanged()).toBe(false)
    expect(await first.get(key, null)).toEqual({ prompt: 'repaired in another window' })
  })

  it('binds cleanup to the original bytes even when decoded JSON is formatted or mutated', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const raw = '{\n  "prompt": "original",\n  "version": 1\n}\n'
    await storage.setItem(storedKey, raw)
    const snapshot = await preferences.readSnapshot!(key, { prompt: '', version: 0 })
    expect(snapshot.result).toEqual({ ok: true, value: { prompt: 'original', version: 1 } })
    expect(await preferences.keys()).toContain(key)
    if (snapshot.result.ok) snapshot.result.value.prompt = 'changed in memory'

    expect(await snapshot.removeIfUnchanged()).toBe(true)
    expect(await storage.getItem(storedKey)).toBeNull()
    expect(await preferences.keys()).not.toContain(key)
  })

  it('returns a payload-free decoding error and a cleanup handle without logging private JSON', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const secret = 'private-secret-prompt'
    await storage.setItem(storedKey, `${secret}{`)
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warningLog = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const snapshot = await preferences.readSnapshot!(key, null)

    expect(Object.keys(snapshot).sort()).toEqual(['removeIfUnchanged', 'result'])
    expect(snapshot.result).toMatchObject({
      ok: false,
      error: { code: 'error.storage.read', params: { reason: 'invalid_preference_json' } },
    })
    expect(JSON.stringify(snapshot)).not.toContain(secret)
    if (!snapshot.result.ok) {
      const error = snapshot.result.error as Error
      expect(error.message).not.toContain(secret)
      expect(error.stack).not.toContain(secret)
    }
    expect(errorLog).not.toHaveBeenCalled()
    expect(warningLog).not.toHaveBeenCalled()
    expect(await snapshot.removeIfUnchanged()).toBe(true)
  })

  it('keeps the original key bound to the cleanup and consumes a stale handle only once', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const otherKey = 'session/v1/basic-system'
    const original = { prompt: 'original' }
    await preferences.set(key, original)
    await preferences.set(otherKey, original)
    const snapshot = await preferences.readSnapshot!(key, null)
    await preferences.set(key, { prompt: 'newer' })
    const commit = vi.spyOn(storage, 'compareAndSetItem')

    expect(await snapshot.removeIfUnchanged()).toBe(false)
    expect(await preferences.keys()).toContain(key)
    // Even if the bytes later match again, this already consumed cleanup cannot delete them.
    await preferences.set(key, original)
    expect(await snapshot.removeIfUnchanged()).toBe(false)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(await preferences.get(otherKey, null)).toEqual(original)
    expect(await preferences.get(key, null)).toEqual(original)
  })

  it('allows only one cleanup call when the same handle is used concurrently', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    await preferences.set(key, { prompt: 'original' })
    const snapshot = await preferences.readSnapshot!(key, null)
    const commit = vi.spyOn(storage, 'compareAndSetItem')

    expect(await Promise.all([snapshot.removeIfUnchanged(), snapshot.removeIfUnchanged()]))
      .toEqual([true, false])
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('does not retry or fall back to unconditional deletion after a failed atomic removal', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    await preferences.set(key, { prompt: 'original' })
    const snapshot = await preferences.readSnapshot!(key, null)
    const failure = new Error('transaction failed')
    const commit = vi.spyOn(storage, 'compareAndSetItem').mockRejectedValue(failure)
    const remove = vi.spyOn(storage, 'removeItem')

    await expect(snapshot.removeIfUnchanged()).rejects.toBe(failure)
    expect(await snapshot.removeIfUnchanged()).toBe(false)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
    expect(await preferences.keys()).toContain(key)
    expect(await preferences.get(key, null)).toEqual({ prompt: 'original' })
  })

  it('throws a storage read error without creating any deletion authority', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const failure = new Error('storage unavailable')
    vi.spyOn(storage, 'getItem').mockRejectedValue(failure)
    const commit = vi.spyOn(storage, 'compareAndSetItem')
    const remove = vi.spyOn(storage, 'removeItem')

    await expect(preferences.readSnapshot!(key, null)).rejects.toBe(failure)
    expect(commit).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('rejects invalid keys before accessing storage', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const read = vi.spyOn(storage, 'getItem')
    await expect(preferences.readSnapshot!('', null)).rejects.toThrow('Invalid preference key')
    expect(read).not.toHaveBeenCalled()
  })
})
