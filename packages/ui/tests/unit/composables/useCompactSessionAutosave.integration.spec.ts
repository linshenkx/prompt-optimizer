import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import type { IImageStorageService, IPreferenceService } from '@prompt-optimizer/core'
import { useCompactSessionAutosave } from '../../../src/composables/session/useCompactSessionAutosave'
import { useSessionManager } from '../../../src/stores/session/useSessionManager'
import { useBasicUserSession } from '../../../src/stores/session/useBasicUserSession'
import { useBasicSystemSession } from '../../../src/stores/session/useBasicSystemSession'
import { useProMultiMessageSession } from '../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../src/stores/session/useProVariableSession'
import { useImageText2ImageSession } from '../../../src/stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../../src/stores/session/useImageImage2ImageSession'
import { useImageMultiImageSession } from '../../../src/stores/session/useImageMultiImageSession'
import { createPreferenceServiceStub, createTestPinia } from '../../utils/pinia-test-helpers'

let scope: ReturnType<typeof effectScope> | undefined
afterEach(() => { scope?.stop(); vi.useRealTimers(); vi.restoreAllMocks() })

const setup = async (overrides: Partial<IPreferenceService> = {}) => {
  const snapshots = new Map<string, unknown>()
  const set = vi.fn(async (key: string, value: unknown) => {
    snapshots.set(key, JSON.parse(JSON.stringify(value)))
  })
  const preferenceService = createPreferenceServiceStub({
    set,
    get: async <T,>(key: string, fallback: T): Promise<T> => (snapshots.get(key) ?? fallback) as T,
    ...overrides,
  })
  const { pinia } = createTestPinia({
    preferenceService,
    imageStorageService: {
      getImage: vi.fn(async () => null),
      listAllMetadata: vi.fn(async () => []),
      deleteImages: vi.fn(async () => {}),
    } as unknown as IImageStorageService,
  })
  const manager = useSessionManager(pinia)
  await manager.restoreAllSessions()
  const enabled = ref(true)
  const attach = () => {
    scope = effectScope()
    return scope.run(() => useCompactSessionAutosave({
      enabled,
      busy: computed(() => manager.isSwitching || manager.isSaving),
      subscribe: manager.subscribeToSessionChanges,
      save: manager.saveSubModeSessionWithStatus,
    }))!
  }
  return { pinia, manager, snapshots, set, enabled, attach }
}

describe('compact autosave with the session manager', () => {
  it('distinguishes temporary manager contention without changing the boolean save API', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const { manager } = await setup({ set: async () => pending })
    const first = manager.saveSubModeSession('basic-user')
    expect(manager.isSaving).toBe(true)
    expect(await manager.saveSubModeSessionWithStatus('basic-system')).toBe('deferred')
    expect(await manager.saveSubModeSession('basic-system')).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already in progress'))
    release()
    expect(await first).toBe(true)
    expect(manager.isSaving).toBe(false)
    manager.isSwitching = true
    expect(await manager.saveSubModeSessionWithStatus('basic-user')).toBe('deferred')
    expect(await manager.saveSubModeSession('basic-user')).toBe(true)
    manager.isSwitching = false
    expect(await manager.saveSubModeSessionWithStatus('basic-user')).toBe('saved')
  })

  it('persists the final edit after an independent in-flight save with no additional edit or periodic tick', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const writes: string[] = []
    let hold = true
    const state = await setup({ set: async (key, value) => {
      if (key !== 'session/v1/basic-user') return
      writes.push((value as { prompt: string }).prompt)
      if (hold) { hold = false; await pending }
    } })
    state.attach()
    vi.useFakeTimers()
    const user = useBasicUserSession(state.pinia)
    user.prompt = 'first snapshot'
    const first = state.manager.saveSubModeSession('basic-user')
    await nextTick()
    user.prompt = 'penultimate edit'
    await nextTick()
    user.prompt = 'the final edit'
    await nextTick()
    await vi.advanceTimersByTimeAsync(6000)
    expect(writes).toEqual(['first snapshot'])
    release()
    await first
    await vi.advanceTimersByTimeAsync(0)
    expect(writes).toEqual(['first snapshot', 'the final edit'])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(writes).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('saves the dirty workspace IDs across a route switch instead of redirecting them to the active mode', async () => {
    const state = await setup()
    let active: 'user' | 'system' = 'user'
    state.manager.injectSubModeReaders({
      getFunctionMode: () => 'basic', getBasicSubMode: () => active,
      getProSubMode: () => 'multi', getImageSubMode: () => 'text2image',
    })
    state.attach()
    vi.useFakeTimers()
    state.manager.isSwitching = true
    useBasicUserSession(state.pinia).prompt = 'old route final draft'
    await nextTick()
    active = 'system'
    useBasicSystemSession(state.pinia).prompt = 'new route draft'
    await nextTick()
    await vi.advanceTimersByTimeAsync(750)
    expect(state.set).not.toHaveBeenCalled()
    state.manager.isSwitching = false
    await vi.advanceTimersByTimeAsync(0)
    expect(state.snapshots.get('session/v1/basic-user')).toMatchObject({ prompt: 'old route final draft' })
    expect(state.snapshots.get('session/v1/basic-system')).toMatchObject({ prompt: 'new route draft' })
    expect(state.set).toHaveBeenCalledTimes(2)
  })

  it('saves all seven changed stores once without an idle save creating a new dirty cycle', async () => {
    const state = await setup()
    state.attach()
    vi.useFakeTimers()
    const stores = [useBasicUserSession, useBasicSystemSession, useProMultiMessageSession,
      useProVariableSession, useImageText2ImageSession, useImageImage2ImageSession, useImageMultiImageSession]
    for (const useStore of stores) useStore(state.pinia).optimizedPrompt = 'latest workspace draft'
    await nextTick()
    await vi.advanceTimersByTimeAsync(750)
    expect(state.set).toHaveBeenCalledTimes(7)
    expect(new Set(state.set.mock.calls.map(([key]) => key)).size).toBe(7)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.set).toHaveBeenCalledTimes(7)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports pre-hydration and import freezes as blocked and never retries imported old memory', async () => {
    const { pinia } = createTestPinia()
    expect(await useSessionManager(pinia).saveSubModeSessionWithStatus('basic-user')).toBe('blocked')
    const state = await setup()
    const resume = await state.manager.beginSessionRestore()
    state.set.mockClear()
    state.attach()
    vi.useFakeTimers()
    useBasicUserSession(state.pinia).prompt = 'late old memory'
    await nextTick()
    await vi.advanceTimersByTimeAsync(750)
    expect(await state.manager.saveSubModeSessionWithStatus('basic-user')).toBe('blocked')
    resume()
    state.manager.isSwitching = true
    state.manager.isSwitching = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.set).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains a conflicting local draft without retrying the winning remote snapshot', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const remote = { prompt: 'remote winner' }
    let exists = false
    const compareAndSet = vi.fn(async () => false)
    const state = await setup({
      get: async <T,>(key: string, fallback: T): Promise<T> =>
        (exists && key === 'session/v1/basic-user' ? remote : fallback) as T,
      compareAndSet,
    })
    exists = true
    state.attach()
    vi.useFakeTimers()
    const user = useBasicUserSession(state.pinia)
    user.prompt = 'my unsaved local draft'
    await nextTick()
    await vi.advanceTimersByTimeAsync(750)
    expect(compareAndSet).toHaveBeenCalledOnce()
    expect(await state.manager.saveSubModeSessionWithStatus('basic-user')).toBe('blocked')
    state.manager.isSwitching = true
    state.manager.isSwitching = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(compareAndSet).toHaveBeenCalledOnce()
    expect(user.prompt).toBe('my unsaved local draft')
    expect(remote.prompt).toBe('remote winner')
  })

  it('stops on a storage failure while preserving the draft and permits a later user edit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const write = vi.fn(async (): Promise<void> => { throw new Error('quota exceeded') })
    const state = await setup({ set: write })
    expect(await state.manager.saveSubModeSessionWithStatus('basic-user')).toBe('failed')
    write.mockClear()
    state.attach()
    vi.useFakeTimers()
    const user = useBasicUserSession(state.pinia)
    user.prompt = 'retained draft'
    await nextTick()
    await vi.advanceTimersByTimeAsync(750)
    state.manager.isSwitching = true
    state.manager.isSwitching = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(write).toHaveBeenCalledOnce()
    expect(user.prompt).toBe('retained draft')
    write.mockResolvedValue(undefined)
    user.prompt = 'later deliberate edit'
    await nextTick()
    await vi.advanceTimersByTimeAsync(750)
    expect(write).toHaveBeenCalledTimes(2)
  })
})
