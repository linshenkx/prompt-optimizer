import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorageProvider, PreferenceService, type IImageStorageService } from '@prompt-optimizer/core'
import { createTestPinia, createPreferenceServiceStub } from '../../../utils/pinia-test-helpers'
import { allowConsole } from '../../../utils/error-detection'
import { useImageMultiImageSession } from '../../../../src/stores/session/useImageMultiImageSession'
import { useSessionManager } from '../../../../src/stores/session/useSessionManager'
import {
  pauseSessionWrites, readSessionSnapshot, withSessionRestoreCheckpoint, writeSessionSnapshot,
} from '../../../../src/stores/session/sessionPersistence'

const key = 'session/v1/image-multiimage'
const broken = { originalPrompt: 'old draft', inputImages: [{ id: 'input-1', assetId: 'missing-image' }] }
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const setup = (preferences: PreferenceService, getImage = vi.fn(async () => null)) => {
  const { pinia } = createTestPinia({
    preferenceService: preferences,
    imageStorageService: {
      getImage, listAllMetadata: vi.fn(async () => []), deleteImages: vi.fn(async () => {}),
    } as unknown as IImageStorageService,
  })
  return { manager: useSessionManager(pinia), store: useImageMultiImageSession(pinia) }
}
afterEach(() => vi.restoreAllMocks())

describe('corrupted session conditional cleanup', () => {
  it('removes an unchanged missing-image snapshot and establishes an empty write baseline', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set(key, broken)
    const { manager, store } = setup(preferences)
    await manager.restoreSubModeSession('image-multiimage')
    expect(await preferences.get(key, null)).toBeNull()
    store.originalPrompt = 'recovered draft'
    expect(await store.saveSession()).toBe(true)
    expect(await preferences.get(key, null)).toMatchObject({ originalPrompt: 'recovered draft' })
  })

  it('preserves a newer window snapshot when the old image lookup later fails', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const otherWindow = new PreferenceService(storage)
    await preferences.set(key, broken)
    const image = deferred<null>()
    const getImage = vi.fn(() => image.promise)
    const { manager, store } = setup(preferences, getImage)
    const restoring = manager.restoreSubModeSession('image-multiimage')
    await vi.waitFor(() => expect(getImage).toHaveBeenCalledOnce())
    const latest = { originalPrompt: 'new remote draft', inputImages: [] }
    await otherWindow.set(key, latest)
    image.resolve(null)
    await restoring
    expect(await preferences.get(key, null)).toEqual(latest)
    // The failed restore must not adopt the remote baseline then overwrite it with defaults.
    expect(await store.saveSession().catch(() => false)).toBe(false)
    expect(await otherWindow.get(key, null)).toEqual(latest)
  })

  it('does not replace a successful same-window save baseline with an old cleanup receipt', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set(key, broken)
    const image = deferred<null>()
    const getImage = vi.fn(() => image.promise)
    const { manager, store } = setup(preferences, getImage)
    const restoring = manager.restoreSubModeSession('image-multiimage')
    await vi.waitFor(() => expect(getImage).toHaveBeenCalledOnce())
    store.originalPrompt = 'new local draft'
    expect(await store.saveSession()).toBe(true)
    image.resolve(null)
    await restoring
    expect(await preferences.get(key, null)).toMatchObject({ originalPrompt: 'new local draft' })
    store.originalPrompt = 'next local draft'
    expect(await store.saveSession()).toBe(true)
  })

  it.each([false, true])('conditionally cleans oversized snapshots (replaced: %s)', async replaced => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    await storage.setItem(`pref:${key}`, JSON.stringify({ originalPrompt: 'x'.repeat(1024 * 1024) }))
    const snapshotReady = deferred<void>()
    const resume = deferred<void>()
    const readSnapshot = preferences.readSnapshot!.bind(preferences)
    vi.spyOn(preferences, 'readSnapshot').mockImplementation(async (snapshotKey, fallback) => {
      const snapshot = await readSnapshot(snapshotKey, fallback)
      snapshotReady.resolve()
      await resume.promise
      return snapshot
    })
    const { manager, store } = setup(preferences)
    const restoring = manager.restoreSubModeSession('image-multiimage')
    await snapshotReady.promise
    const latest = { originalPrompt: 'fixed elsewhere', inputImages: [] }
    if (replaced) await new PreferenceService(storage).set(key, latest)
    resume.resolve()
    await restoring
    expect(await preferences.get(key, null)).toEqual(replaced ? latest : null)
    store.originalPrompt = 'fresh local edit'
    expect(await store.saveSession().catch(() => false)).toBe(!replaced)
    if (replaced) expect(await preferences.get(key, null)).toEqual(latest)
  })

  it('shares one restore receipt when the same workspace is restored concurrently', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set(key, broken)
    const image = deferred<null>()
    const getImage = vi.fn(() => image.promise)
    const read = vi.spyOn(preferences, 'readSnapshot')
    const { manager } = setup(preferences, getImage)
    const first = manager.restoreSubModeSession('image-multiimage')
    const second = manager.restoreSubModeSession('image-multiimage')
    await vi.waitFor(() => expect(getImage).toHaveBeenCalledOnce())
    image.resolve(null)
    await Promise.all([first, second])
    expect(read).toHaveBeenCalledOnce()
    expect(await preferences.get(key, null)).toBeNull()
  })

  it('does not clean a snapshot while import has frozen writes', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set(key, broken)
    const image = deferred<null>()
    const getImage = vi.fn(() => image.promise)
    const { manager } = setup(preferences, getImage)
    const restoring = manager.restoreSubModeSession('image-multiimage')
    await vi.waitFor(() => expect(getImage).toHaveBeenCalledOnce())
    const lease = pauseSessionWrites(preferences)
    try {
      image.resolve(null)
      await restoring
      expect(await preferences.get(key, null)).toEqual(broken)
    } finally { lease.release() }
  })

  it('rechecks import protection after cleanup waited behind a same-key write', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set(key, { originalPrompt: 'old' })
    const entered = deferred<void>()
    const release = deferred<void>()
    const compareAndSet = preferences.compareAndSet!.bind(preferences)
    vi.spyOn(preferences, 'compareAndSet').mockImplementation(async (writeKey, expected, value) => {
      entered.resolve()
      await release.promise
      return compareAndSet(writeKey, expected, value)
    })
    await withSessionRestoreCheckpoint(preferences, key, async cleanup => {
      await readSessionSnapshot(preferences, key, null)
      const write = writeSessionSnapshot(preferences, key, { originalPrompt: 'saved before freeze' })
      await entered.promise
      const cleaning = cleanup()
      // Let cleanup enqueue after the existing write before freezing.
      await Promise.resolve()
      const lease = pauseSessionWrites(preferences)
      try {
        release.resolve()
        await write
        expect(await cleaning).toBe(false)
        expect(await preferences.get(key, null)).toEqual({ originalPrompt: 'saved before freeze' })
      } finally { lease.release() }
    })
  })

  it('does not let a recovery error select another workspace for deletion', async () => {
    allowConsole(/\[SessionManager\] Failed to restore image-multiimage session:/)
    const remove = vi.fn(async () => {})
    const { pinia } = createTestPinia({
      preferenceService: createPreferenceServiceStub({
        get: vi.fn(async () => { throw { code: 'error.storage.read', params: {
          reason: 'session_snapshot_too_large', key: 'session/v1/basic-user',
        } } }),
        delete: remove,
      }),
      imageStorageService: { getImage: vi.fn(async () => null) } as unknown as IImageStorageService,
    })
    await useSessionManager(pinia).restoreSubModeSession('image-multiimage')
    expect(remove).not.toHaveBeenCalled()
  })

  it('releases a failed cleanup so a later restore obtains a fresh receipt', async () => {
    allowConsole(/\[SessionManager\] Failed to remove corrupted session snapshot/)
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    await preferences.set(key, broken)
    const remove = vi.spyOn(storage, 'compareAndSetItem').mockRejectedValueOnce(new Error('storage unavailable'))
    const read = vi.spyOn(preferences, 'readSnapshot')
    const { manager } = setup(preferences)
    await manager.restoreSubModeSession('image-multiimage')
    expect(await preferences.get(key, null)).toEqual(broken)
    await manager.restoreSubModeSession('image-multiimage')
    expect(read).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledTimes(2)
    expect(await preferences.get(key, null)).toBeNull()
  })

  it('drains an already started cleanup before the import freeze becomes ready', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    await preferences.set(key, { originalPrompt: 'broken' })
    const entered = deferred<void>()
    const release = deferred<void>()
    const compareAndSet = storage.compareAndSetItem.bind(storage)
    vi.spyOn(storage, 'compareAndSetItem').mockImplementation(async (...args) => {
      entered.resolve()
      await release.promise
      return compareAndSet(...args)
    })
    await withSessionRestoreCheckpoint(preferences, key, async cleanup => {
      await readSessionSnapshot(preferences, key, null)
      const cleaning = cleanup()
      await entered.promise
      const lease = pauseSessionWrites(preferences)
      let drained = false
      void lease.ready.then(() => { drained = true })
      try {
        await Promise.resolve()
        expect(drained).toBe(false)
        release.resolve()
        expect(await cleaning).toBe(true)
        await lease.ready
        expect(drained).toBe(true)
        expect(await preferences.get(key, null)).toBeNull()
      } finally { lease.release() }
    })
  })
})
