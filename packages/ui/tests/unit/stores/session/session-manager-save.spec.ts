import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { IImageStorageService } from '@prompt-optimizer/core'
import { createTestPinia, createPreferenceServiceStub } from '../../../utils/pinia-test-helpers'
import { queueImageStorageMaintenance, scheduleImageStorageGc } from '../../../../src/stores/session/imageStorageMaintenance'
import { useSessionManager } from '../../../../src/stores/session/useSessionManager'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../../src/stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../../src/stores/session/useProVariableSession'
import { useImageText2ImageSession } from '../../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../../../src/stores/session/useImageMultiImageSession'
import { createAppUpdatePreparation } from '../../../../src/composables/ui/useAppUpdatePreparation'

const sessionStores = [
  ['basic-system', useBasicSystemSession],
  ['basic-user', useBasicUserSession],
  ['pro-multi', useProMultiMessageSession],
  ['pro-variable', useProVariableSession],
  ['image-text2image', useImageText2ImageSession],
  ['image-image2image', useImageImage2ImageSession],
  ['image-multiimage', useImageMultiImageSession],
] as const

const imageStorage = () => ({
  getImage: vi.fn(async () => null),
  listAllMetadata: vi.fn(async () => []),
  deleteImages: vi.fn(async () => {}),
}) as unknown as IImageStorageService
const createContext = (set: (key: string, value: unknown) => Promise<void> = vi.fn(async () => {})) =>
  createTestPinia({ preferenceService: createPreferenceServiceStub({ set }), imageStorageService: imageStorage() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('session checkpoint persistence', () => {
  it('allows repeated idle updates after all seven workspaces are hydrated', async () => {
    const { pinia } = createContext()
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const user = useBasicUserSession(pinia)
    user.prompt = 'original prompt'
    user.optimizedPrompt = 'completed optimization'
    await nextTick()
    const prepare = createAppUpdatePreparation({
      isBusy: () => false,
      subscribeToChanges: manager.subscribeToSessionChanges,
      flush: manager.saveAllSessions,
    })
    expect(await prepare()).toBe('ready')
    expect(await prepare()).toBe('ready')
    expect(user.optimizedPrompt).toBe('completed optimization')
  })

  it('still rejects an update when a real user edit arrives during the checkpoint', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const writing = vi.fn()
    const { pinia } = createContext(async (key) => {
      if (key === 'session/v1/basic-user') { writing(); await pending }
    })
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const user = useBasicUserSession(pinia)
    user.prompt = 'before checkpoint'
    await nextTick()
    const prepare = createAppUpdatePreparation({
      isBusy: () => false,
      subscribeToChanges: manager.subscribeToSessionChanges,
      flush: manager.saveAllSessions,
    })
    const result = prepare()
    await vi.waitFor(() => expect(writing).toHaveBeenCalled())
    user.prompt = 'a new edit while storage is pending'
    await nextTick()
    release()
    expect(await result).toBe('busy')
    expect(await prepare()).toBe('ready')
  })

  it('drains direct image-result persistence before allowing imported assets to replace it', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const previous = queueImageStorageMaintenance(async () => { await pending })
    const { pinia } = createContext()
    const manager = useSessionManager(pinia)
    const ready = vi.fn()
    const begin = manager.beginSessionRestore()
    void begin.then(ready)
    await Promise.resolve()
    expect(ready).not.toHaveBeenCalled()
    release()
    await previous
    const resume = await begin
    expect(manager.isRestoring).toBe(true)
    resume()
  })

  it('holds automatic saves across imported data until reload or explicit failure recovery', async () => {
    const set = vi.fn(async (_key: string, _value: unknown) => {})
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    useBasicUserSession(pinia).prompt = 'old in-memory workspace'
    const resume = await manager.beginSessionRestore()
    expect(set).toHaveBeenCalledTimes(7)
    set.mockClear()
    expect(manager.isRestoring).toBe(true)
    expect(await manager.saveAllSessions()).toBe(false)
    expect(await manager.saveSubModeSession('basic-user')).toBe(false)
    await manager.switchMode('basic-user', 'pro-variable')
    await manager.switchSubMode('basic-user', 'basic-system')
    expect(set).not.toHaveBeenCalled()
    resume()
    resume()
    expect(manager.isRestoring).toBe(false)
    expect(await manager.saveSubModeSession('basic-user')).toBe(true)
  })

  it('pauses queued saves before waiting for an existing writer to finish', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const set = vi.fn(async (key: string, _value: unknown) => {
      if (key === 'session/v1/basic-user') await pending
    })
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const first = manager.saveSubModeSession('basic-user')
    const queued = manager.saveAllSessions()
    const begin = manager.beginSessionRestore()
    expect(manager.isRestoring).toBe(true)
    const ready = vi.fn()
    void begin.then(ready)
    await Promise.resolve()
    expect(ready).not.toHaveBeenCalled()
    release()
    expect(await first).toBe(true)
    expect(await queued).toBe(false)
    const resume = await begin
    expect(set).toHaveBeenCalledTimes(8) // drained writer + full pre-import checkpoint
    expect(await manager.saveAllSessions()).toBe(false)
    resume()
  })

  it('releases the restore pause when the pending writer cannot drain in time', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const set = vi.fn(async (key: string, _value: unknown) => {
      if (key === 'session/v1/basic-user') await pending
    })
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    vi.useFakeTimers()
    const first = manager.saveSubModeSession('basic-user')
    const begin = manager.beginSessionRestore()
    const rejection = expect(begin).rejects.toThrow('Timed out')
    await vi.advanceTimersByTimeAsync(5100)
    await rejection
    expect(manager.isRestoring).toBe(false)
    release()
    expect(await first).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
  })

  it.each(sessionStores)('blocks direct %s saves and selection callbacks after import replaces its snapshot', async (key, useStore) => {
    const stored = new Map<string, unknown>()
    const set = vi.fn(async (storageKey: string, value: unknown) => {
      stored.set(storageKey, JSON.parse(JSON.stringify(value)))
    })
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const store = useStore(pinia)
    store.optimizedPrompt = 'old memory'
    const resume = await manager.beginSessionRestore()
    const storageKey = `session/v1/${key}`
    // Simulate the actual import followed by its delayed reload window.
    stored.set(storageKey, { optimizedPrompt: 'imported snapshot' })
    set.mockClear()
    store.optimizedPrompt = 'late old result'
    store.updateTemplate('late-template')
    if ('updateTextModel' in store) store.updateTextModel('late-model')
    else store.updateOptimizeModel('late-model')
    expect(await store.saveSession()).toBe(false)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(set).not.toHaveBeenCalled()
    expect(stored.get(storageKey)).toEqual({ optimizedPrompt: 'imported snapshot' })
    resume()
    expect(await store.saveSession()).toBe(true)
  })

  it('checkpoints every recent draft before a favorites-only import reloads the app', async () => {
    const stored = new Map<string, unknown>()
    const preferenceService = createPreferenceServiceStub({
      set: async (key, value) => { stored.set(key, JSON.parse(JSON.stringify(value))) },
      get: async <T,>(key: string, fallback: T): Promise<T> => (stored.get(key) ?? fallback) as T,
    })
    const { pinia } = createTestPinia({ preferenceService, imageStorageService: imageStorage() })
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    for (const [key, useStore] of sessionStores) useStore(pinia).optimizedPrompt = `unsaved draft: ${key}`
    const resume = await manager.beginSessionRestore()
    // A legacy/favorites-only import does not write any session key.
    stored.set('favorites', [{ title: 'imported favorite' }])
    const nextPage = createTestPinia({ preferenceService, imageStorageService: imageStorage() })
    await useSessionManager(nextPage.pinia).restoreAllSessions()
    for (const [key, useStore] of sessionStores) {
      expect(useStore(nextPage.pinia).optimizedPrompt).toBe(`unsaved draft: ${key}`)
    }
    resume()
  })

  it('keeps GC frozen through the manager restore lease until imported references are committed', async () => {
    const stored = new Map<string, unknown>()
    const preferenceService = createPreferenceServiceStub({
      set: async (key, value) => { stored.set(key, JSON.parse(JSON.stringify(value))) },
      get: async <T,>(key: string, fallback: T): Promise<T> => (stored.get(key) ?? fallback) as T,
    })
    const images = imageStorage()
    const { pinia } = createTestPinia({ preferenceService, imageStorageService: images })
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const resume = await manager.beginSessionRestore()
    vi.useFakeTimers()
    vi.mocked(images.listAllMetadata).mockResolvedValue([{ id: 'new-imported-asset' }] as never)
    scheduleImageStorageGc(preferenceService, images, { getFavoritesPayload: null })
    await vi.advanceTimersByTimeAsync(2000)
    expect(images.deleteImages).not.toHaveBeenCalled()
    expect(images.listAllMetadata).not.toHaveBeenCalled()
    stored.set('session/v1/image-text2image', { images: [{ _type: 'image-ref', id: 'new-imported-asset' }] })
    resume()
    await vi.runOnlyPendingTimersAsync()
    await queueImageStorageMaintenance(async () => {})
    expect(images.listAllMetadata).toHaveBeenCalledOnce()
    expect(images.deleteImages).not.toHaveBeenCalled()
  })

  it('rejects import on checkpoint failure and restores direct saving for retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    const set = vi.fn(async (key: string, _value: unknown) => {
      if (key === 'session/v1/basic-user' && fail) throw new Error('quota exceeded')
    })
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const store = useBasicUserSession(pinia)
    store.prompt = 'latest draft'
    await expect(manager.beginSessionRestore()).rejects.toThrow('Failed to save current workspaces')
    expect(manager.isRestoring).toBe(false)
    expect(store.prompt).toBe('latest draft')
    fail = false
    expect(await store.saveSession()).toBe(true)
    const resume = await manager.beginSessionRestore()
    resume()
  })

  it('drains a direct store writer then checkpoints edits that arrived during that write', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let hold = true
    const snapshots: string[] = []
    const { pinia } = createContext(async (key, value) => {
      if (key !== 'session/v1/basic-user') return
      snapshots.push((value as { prompt: string }).prompt)
      if (hold) { hold = false; await pending }
    })
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const store = useBasicUserSession(pinia)
    store.prompt = 'old snapshot'
    const first = store.saveSession() // bypass the manager deliberately
    store.prompt = 'latest draft'
    const begin = manager.beginSessionRestore()
    const ready = vi.fn()
    void begin.then(ready)
    await Promise.resolve()
    expect(ready).not.toHaveBeenCalled()
    expect(await store.saveSession()).toBe(false)
    release()
    expect(await first).toBe(true)
    const resume = await begin
    expect(snapshots).toEqual(['old snapshot', 'latest draft'])
    resume()
  })

  it.each([
    ['basic-system', useBasicSystemSession],
    ['basic-user', useBasicUserSession],
    ['pro-multi', useProMultiMessageSession],
    ['pro-variable', useProVariableSession],
  ] as const)('reports %s storage failures without discarding its draft', async (_key, useStore) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const set = vi.fn(async (): Promise<void> => { throw new Error('storage full') })
    const { pinia } = createContext(set)
    const store = useStore(pinia)
    store.optimizedPrompt = 'Draft that must survive a failed update checkpoint'
    expect(await store.saveSession()).toBe(false)
    expect(store.optimizedPrompt).toBe('Draft that must survive a failed update checkpoint')
    set.mockImplementation(async () => {})
    expect(await store.saveSession()).toBe(true)
  })

  it('saves the active workspace first and acknowledges every workspace', async () => {
    const set = vi.fn(async (_key: string, _value: unknown) => {})
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    manager.injectSubModeReaders({ getFunctionMode: () => 'pro', getBasicSubMode: () => 'system', getProSubMode: () => 'variable', getImageSubMode: () => 'text2image' })
    expect(await manager.saveAllSessions()).toBe(true)
    const sessionKeys = set.mock.calls.map(([key]) => key).filter(key => key.startsWith('session/v1/'))
    expect(sessionKeys[0]).toBe('session/v1/pro-variable')
    expect(new Set(sessionKeys).size).toBe(7)
  })

  it('reports a handled text-store failure while still preserving the other workspaces', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const set = vi.fn(async (key: string, _value: unknown) => {
      if (key === 'session/v1/basic-user') throw new Error('quota exceeded')
    })
    const { pinia } = createContext(set)
    expect(await useSessionManager(pinia).saveAllSessions()).toBe(false)
    expect(set.mock.calls.some(([key]) => key === 'session/v1/image-multiimage')).toBe(true)
  })

  it('does not claim that missing storage services completed a checkpoint', async () => {
    const { pinia } = createTestPinia({ preferenceService: undefined })
    expect(await useSessionManager(pinia).saveAllSessions()).toBe(false)
  })

  it('waits for an in-flight save and flushes edits made during that save', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let hold = true
    const snapshots: string[] = []
    const set = vi.fn(async (key: string, value: unknown) => {
      if (key !== 'session/v1/basic-user') return
      snapshots.push((value as { prompt: string }).prompt)
      if (hold) { hold = false; await pending }
    })
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    const user = useBasicUserSession(pinia)
    user.prompt = 'old snapshot'
    const first = manager.saveSubModeSession('basic-user')
    await vi.waitFor(() => expect(snapshots).toEqual(['old snapshot']))
    user.prompt = 'latest edit'
    const checkpoint = manager.saveAllSessions()
    release()
    expect(await first).toBe(true)
    expect(await checkpoint).toBe(true)
    expect(snapshots).toEqual(['old snapshot', 'latest edit'])
  })

  it("reports lock timeout and does not release another writer's lock", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const set = vi.fn(async (key: string, _value: unknown) => {
      if (key === 'session/v1/basic-user') await pending
    })
    const { pinia } = createContext(set)
    const manager = useSessionManager(pinia)
    await manager.restoreAllSessions()
    vi.useFakeTimers()
    const first = manager.saveSubModeSession('basic-user')
    const checkpoint = manager.saveAllSessions()
    await vi.advanceTimersByTimeAsync(5100)
    expect(await checkpoint).toBe(false)
    expect(await manager.saveSubModeSession('basic-system')).toBe(false)
    release()
    expect(await first).toBe(true)
  })

  it('unsubscribes mobile change tracking without creating a second snapshot', async () => {
    const { pinia } = createContext()
    const manager = useSessionManager(pinia)
    const changed = vi.fn()
    const stop = manager.subscribeToSessionChanges(changed)
    useBasicUserSession(pinia).prompt = 'mobile edit'
    await nextTick()
    expect(changed).toHaveBeenCalledOnce()
    stop()
    useBasicUserSession(pinia).prompt = 'later edit'
    await nextTick()
    expect(changed).toHaveBeenCalledOnce()
  })
})
