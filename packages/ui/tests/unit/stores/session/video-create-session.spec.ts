import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorageProvider, PreferenceService, WorkspaceSessionTransfer, defaultVideoConfig, summarizeVideoModel, MAX_VIDEO_SUBMIT_SNAPSHOT_BYTES, SEEDANCE_FLAGSHIP, SEEDANCE_MODEL, VIDEO_MODEL_PREFERENCE, videoRunKey, type IImageStorageService, type VideoCreateSessionState } from '@prompt-optimizer/core'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { setPiniaServices } from '../../../../src/plugins/pinia'
import {
  VIDEO_CREATE_SESSION_KEY,
  useVideoCreateSession,
} from '../../../../src/stores/session/useVideoCreateSession'
import * as imageMaintenance from '../../../../src/stores/session/imageStorageMaintenance'
import { useSessionManager } from '../../../../src/stores/session/useSessionManager'
import { hasSessionConflicts } from '../../../../src/stores/session/sessionPersistence'

const createWindow = (storage: MemoryStorageProvider) => {
  const preferences = new PreferenceService(storage)
  const context = createTestPinia({ preferenceService: preferences })
  const activate = () => { setPiniaServices(context.services) }
  return { ...context, preferences, activate }
}

const ark = summarizeVideoModel({ ...defaultVideoConfig(), apiKey: 'test' })

describe('video-create session', () => {
  afterEach(() => vi.restoreAllMocks())

  it('records the concrete model label for preset, sibling, and custom endpoint runs', () => {
    const ctx = createWindow(new MemoryStorageProvider())
    const store = useVideoCreateSession(ctx.pinia)
    const config = { ...ark, name: 'Studio Ark' }
    const prompt = 'A crane shot of a small boat.'

    expect(store.prepareRun(config, 'b', prompt)).toMatchObject({ model: SEEDANCE_MODEL, modelName: 'Seedance 2.0 Fast' })
    expect(store.prepareRun({ ...config, modelId: SEEDANCE_FLAGSHIP }, 'b', prompt, SEEDANCE_MODEL))
      .toMatchObject({ model: SEEDANCE_FLAGSHIP, modelName: 'Seedance 2.5', configModelId: SEEDANCE_MODEL })
    expect(store.prepareRun({ ...config, customModel: 'ep-studio-fast' }, 'b', prompt))
      .toMatchObject({ model: 'ep-studio-fast', modelName: 'ep-studio-fast' })
  })

  it('sends one paid request on overlapping clicks, then cancels the queued task by ID', async () => {
    const ctx = createWindow(new MemoryStorageProvider())
    await ctx.preferences.set(VIDEO_MODEL_PREFERENCE, {model: SEEDANCE_MODEL, apiKey:'test'})
    const store = useVideoCreateSession(ctx.pinia)
    await store.restoreSession()
    store.state.optimizedPrompt = 'A crane shot of a small boat.'
    const send = vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({id:'cgt-queued'}))
      .mockResolvedValueOnce(new Response(null,{status:204}))
    const confirmationOpenedAt = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(confirmationOpenedAt)
    const draft = store.prepareRun(ark)
    const submittedAt = confirmationOpenedAt + 30_000
    clock.mockReturnValue(submittedAt)
    await Promise.all([store.submit(draft),store.submit(draft)])
    expect(send).toHaveBeenCalledTimes(1)
    expect(store.activeRun).toMatchObject({ id: 'cgt-queued', submittedAt })
    await store.cancel(store.activeRun!)
    expect(send.mock.calls[1][1]?.method).toBe('DELETE')
    expect(store.activeRun).toBeUndefined()
    expect(store.state.runs[0].status).toBe('cancelled')
  })

  it('keeps a paid task ID if another window edits the draft before Ark responds', async () => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const other = new PreferenceService(storage)
    await first.preferences.set(VIDEO_MODEL_PREFERENCE, {model: SEEDANCE_MODEL, apiKey:'test'})
    const store = useVideoCreateSession(first.pinia)
    await store.restoreSession()
    store.state.optimizedPrompt = 'A tracked shot.'
    const send = vi.spyOn(globalThis,'fetch').mockImplementation(async () => {
      const pending = await other.get(VIDEO_CREATE_SESSION_KEY, {})
      await other.set(VIDEO_CREATE_SESSION_KEY, { ...pending, optimizedPrompt: 'A newer draft in the other window.' })
      return Response.json({id:'cgt-accepted'})
    })
    await store.submit(store.prepareRun(ark))
    expect(hasSessionConflicts(first.preferences)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(await other.get(VIDEO_CREATE_SESSION_KEY, null)).toMatchObject({
      optimizedPrompt: 'A newer draft in the other window.', runs: [{id:'cgt-accepted', status:'queued', prompt:'A tracked shot.'}],
    })
  })

  it('keeps an ambiguous submission blocked after reload and never resubmits it', async () => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    await first.preferences.set(VIDEO_MODEL_PREFERENCE, {model: SEEDANCE_MODEL,apiKey:'test'})
    const store = useVideoCreateSession(first.pinia)
    await store.restoreSession()
    store.state.optimizedPrompt = 'A four second shot.'
    const send = vi.spyOn(globalThis,'fetch').mockRejectedValue(new TypeError('connection lost'))
    const draft = store.prepareRun(ark)
    await store.submit(draft)
    expect(store.activeRun?.status).toBe('unknown')
    const second = createWindow(storage)
    const reopened = useVideoCreateSession(second.pinia)
    await reopened.restoreSession()
    await reopened.submit(draft)
    expect(send).toHaveBeenCalledTimes(1)
    expect(reopened.activeRun?.prompt).toBe(draft.prompt)
  })

  it('lets the other group finish when one submission is unknown and retains usage across incomplete polls', async () => {
    const storage = new MemoryStorageProvider()
    const ctx = createWindow(storage)
    await ctx.preferences.set(VIDEO_MODEL_PREFERENCE, { model: SEEDANCE_MODEL, apiKey: 'test' })
    const session = useVideoCreateSession(ctx.pinia)
    await session.restoreSession()
    session.state.originalPrompt = 'Original request'
    session.state.optimizedPrompt = 'Workspace draft'
    const send = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-b' }))
      .mockRejectedValueOnce(new Error('temporary query failure'))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-b', status: 'running', usage: { completion_tokens: 0, total_tokens: 12 } }))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-b', status: 'succeeded', content: { video_url: 'https://example.org/b.mp4' } }))
    const a = session.prepareRun(ark, 'a', session.state.originalPrompt)
    const b = session.prepareRun(ark)
    await session.submit(a)
    await session.submit(b)
    await session.submit(a)
    const accepted = session.activeFor('b')!
    await expect(session.refresh(accepted)).rejects.toThrow('temporary query failure')
    expect(session.pollErrors.get(videoRunKey(accepted))).toBe('temporary query failure')
    await session.refresh(accepted)
    expect(session.pollErrors.has(videoRunKey(accepted))).toBe(false)
    await session.refresh(accepted)
    expect(send.mock.calls.map(([, opts]) => opts?.method)).toEqual(['POST', 'POST', 'GET', 'GET', 'GET'])
    const restored = useVideoCreateSession(createWindow(storage).pinia)
    await restored.restoreSession()
    expect(restored.activeFor('a')).toMatchObject({ status: 'unknown', prompt: 'Original request' })
    expect(restored.activeFor('b')).toBeUndefined()
    expect(restored.state.runs[0]).toMatchObject({ source: 'workspace', status: 'succeeded', usage: { outputTokens: 0, totalTokens: 12 } })
  })

  it('saves the first draft without reporting a cross-window conflict', async () => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const store = useVideoCreateSession(first.pinia)
    await store.restoreSession()
    expect(await first.preferences.get(VIDEO_CREATE_SESSION_KEY, null)).toBeNull()

    store.state.originalPrompt = '一只黑猫在雨夜的街头走路'
    expect(await store.saveSession()).toBe(true)
    expect(hasSessionConflicts(first.preferences)).toBe(false)
    expect(await first.preferences.get(VIDEO_CREATE_SESSION_KEY, null)).toMatchObject({
      originalPrompt: '一只黑猫在雨夜的街头走路',
      optimizedPrompt: '',
      selectedTemplateId: null,
    })
  })

  it('keeps generation settings independent of an older draft and prompt restore', async () => {
    const storage = new MemoryStorageProvider()
    const ctx = createWindow(storage)
    const params = { duration: 4, ratio: '16:9', resolution: '480p' }
    await ctx.preferences.set(VIDEO_CREATE_SESSION_KEY, {
      originalPrompt: 'A harbor', optimizedPrompt: 'A four-second pan', params, draftParams: params,
    })
    const session = useVideoCreateSession(ctx.pinia)
    await session.restoreSession()
    session.setColumnParam('b', ark, 'duration', 8)
    session.setColumnParam('b', ark, 'resolution', '720p')
    const generation = { ...params, duration: 8, resolution: '720p', audio: false }
    expect(await session.saveSession()).toBe(true)

    const restored = useVideoCreateSession(createWindow(storage).pinia)
    await restored.restoreSession()
    expect(restored.state.columns.b.params).toEqual(generation)
    expect(restored.state.columns.a.params).toEqual(params)
    expect(restored.state.optimizedPrompt).toBe('A four-second pan')
    expect(restored.state).not.toHaveProperty('draftParams')
    restored.applyPrompt('Another harbor', 'Hold on the sailboat.', 'record', 'chain')
    expect(restored.state).toMatchObject({ columns: { b: { params: generation } }, currentVersionId: 'record', currentChainId: 'chain' })
    expect(restored.prepareRun(ark)).toMatchObject({ params: generation, prompt: 'Hold on the sailboat.' })
  })

  it('keeps repeated generations bounded while retaining other active task IDs', async () => {
    const ctx = createWindow(new MemoryStorageProvider())
    await ctx.preferences.set(VIDEO_MODEL_PREFERENCE, { model: SEEDANCE_MODEL, apiKey: 'test' })
    const store = useVideoCreateSession(ctx.pinia)
    await store.restoreSession()
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'cgt-active-a' }))
    await store.submit(store.prepareRun(ark, 'a', 'Hold this task active'))
    const prompt = 'A boat sails past a lighthouse. '.repeat(1700)
    for (let i = 0; i < 24; i++) {
      const id = 'cgt-b-' + i
      send.mockResolvedValueOnce(Response.json({ id }))
        .mockResolvedValueOnce(Response.json({ id, status: 'failed' }))
      await store.submit(store.prepareRun(ark, 'b', prompt))
      await store.refresh(store.activeFor('b')!)
    }
    const saved = await ctx.preferences.get<VideoCreateSessionState | null>(VIDEO_CREATE_SESSION_KEY, null)
    expect(new TextEncoder().encode(JSON.stringify(saved)).length).toBeLessThan(128 * 1024)
    expect(saved?.runs.map(run => run.id)).toEqual(['cgt-b-23', 'cgt-active-a'])
    expect(store.state.runs.map(run => run.id)).toEqual(['cgt-b-23', 'cgt-active-a'])
  })

  it('schedules image collection after the video snapshot has been written', async () => {
    const ctx = createWindow(new MemoryStorageProvider())
    const storage = {} as IImageStorageService
    setPiniaServices({ ...ctx.services, imageStorageService: storage })
    const snapshotWritten = vi.spyOn(ctx.preferences, 'compareAndSet')
    const schedule = vi.spyOn(imageMaintenance, 'scheduleImageStorageGc').mockImplementation(() => {
      expect(snapshotWritten).toHaveBeenCalledWith(VIDEO_CREATE_SESSION_KEY, null, expect.objectContaining({ originalPrompt: 'A new draft' }))
    })
    const store = useVideoCreateSession(ctx.pinia)
    await store.restoreSession()
    store.state.originalPrompt = 'A new draft'
    expect(await store.saveSession()).toBe(true)
    expect(schedule).toHaveBeenCalledOnce()
    expect(schedule).toHaveBeenCalledWith(ctx.preferences, storage)
  })

  it.each([
    ['invalid JSON', () => '{invalid-json: cgt-paid'],
    ['invalid schema', () => ({ runs: [{ id: 'cgt-paid' }] })],
  ])('protects a stored snapshot with %s from subsequent writes', async (_label, invalid) => {
    const ctx = createWindow(new MemoryStorageProvider())
    const raw = invalid()
    await ctx.preferences.set(VIDEO_CREATE_SESSION_KEY, raw)
    const store = useVideoCreateSession(ctx.pinia)
    await expect(store.restoreSession()).rejects.toThrow()
    store.reset()
    store.state.originalPrompt = 'An unsaved edit'
    expect(await store.saveSession()).toBe(false)
    expect(await ctx.preferences.get(VIDEO_CREATE_SESSION_KEY, null)).toEqual(raw)
  })

  it('preserves an oversized paid snapshot during workspace restore', async () => {
    const storage = new MemoryStorageProvider()
    const ctx = createWindow(storage)
    const key = 'pref:' + VIDEO_CREATE_SESSION_KEY
    const raw = JSON.stringify({ originalPrompt: 'x'.repeat(1024 * 1024), runs: [{ id: 'cgt-paid' }] })
    await storage.setItem(key, raw)
    const store = useVideoCreateSession(ctx.pinia)
    const manager = useSessionManager(ctx.pinia)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await manager.restoreSubModeSession('video-create')
    expect(consoleError).toHaveBeenCalled()
    expect(await store.saveSession()).toBe(false)
    expect(await storage.getItem(key)).toBe(raw)
  })

  it.each(['refresh', 'cancel', 'acknowledge'] as const)('merges a %s into the newer draft using CAS', async operation => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const other = new PreferenceService(storage)
    await first.preferences.set(VIDEO_MODEL_PREFERENCE, { model: SEEDANCE_MODEL, apiKey: 'test' })
    const store = useVideoCreateSession(first.pinia)
    await store.restoreSession()
    store.state.optimizedPrompt = 'A tracked shot.'
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'cgt-merge' }))
    await store.submit(store.prepareRun(ark))
    const run = store.activeRun!
    const key = videoRunKey(run)
    if (operation === 'acknowledge') {
      send.mockRejectedValueOnce(new Error('provider query failed'))
      await expect(store.refresh(run)).rejects.toThrow('provider query failed')
      await store.restoreSession()
      expect(store.pollErrors.get(key)).toBe('provider query failed')
    }
    const latest = (await other.get<VideoCreateSessionState | null>(VIDEO_CREATE_SESSION_KEY, null))!
    await other.set(VIDEO_CREATE_SESSION_KEY, { ...latest, optimizedPrompt: 'A newer draft' })
    if (operation === 'refresh') {
      send.mockResolvedValueOnce(Response.json({
        id: run.id, status: 'succeeded', content: { video_url: 'https://fixture.invalid/video.mp4' },
        usage: { completion_tokens: 100, total_tokens: 110 },
      }))
    } else if (operation === 'cancel') {
      send.mockResolvedValueOnce(new Response(null, { status: 204 }))
    }
    await store[operation](store.activeRun!)
    expect(hasSessionConflicts(first.preferences)).toBe(true)
    expect(store.activeRun).toBeUndefined()
    expect(store.pollErrors.has(key)).toBe(false)
    const status = { refresh: 'succeeded', cancel: 'cancelled', acknowledge: 'untracked' }[operation]
    expect(await other.get(VIDEO_CREATE_SESSION_KEY, null)).toMatchObject({
      optimizedPrompt: 'A newer draft',
      runs: [{
        id: 'cgt-merge', prompt: 'A tracked shot.', status,
        ...(operation === 'refresh' && {
          videoUrl: 'https://fixture.invalid/video.mp4', expiresAt: expect.any(Number),
          usage: { outputTokens: 100, totalTokens: 110 }, cost: { basis: 'outputTokens', amount: expect.any(Number) },
        }),
      }],
    })
  })

  it('preserves a terminal result when a stale poll finishes in another window', async () => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const other = new PreferenceService(storage)
    await first.preferences.set(VIDEO_MODEL_PREFERENCE, { model: SEEDANCE_MODEL, apiKey: 'test' })
    const store = useVideoCreateSession(first.pinia)
    await store.restoreSession()
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'cgt-stale' }))
    await store.submit(store.prepareRun(ark, 'b', 'A tracked shot.'))
    const latest = (await other.get<VideoCreateSessionState | null>(VIDEO_CREATE_SESSION_KEY, null))!
    await other.set(VIDEO_CREATE_SESSION_KEY, { ...latest, runs: [{ ...latest.runs[0], status: 'untracked' }] })
    send.mockResolvedValueOnce(Response.json({ id: 'cgt-stale', status: 'running' }))
    await store.refresh(store.activeRun!)
    expect(store.activeRun).toBeUndefined()
    expect(await other.get(VIDEO_CREATE_SESSION_KEY, null)).toMatchObject({ runs: [{ id: 'cgt-stale', status: 'untracked' }] })
  })

  it('promotes terminal usage and cost over an intermediate running poll in another window', async () => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const other = new PreferenceService(storage)
    await first.preferences.set(VIDEO_MODEL_PREFERENCE, { model: SEEDANCE_MODEL, apiKey: 'test' })
    const store = useVideoCreateSession(first.pinia)
    await store.restoreSession()
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'cgt-promote' }))
    await store.submit(store.prepareRun(ark, 'b', 'A tracked shot.'))
    const latest = (await other.get<VideoCreateSessionState | null>(VIDEO_CREATE_SESSION_KEY, null))!
    await other.set(VIDEO_CREATE_SESSION_KEY, {
      ...latest,
      runs: [{ ...latest.runs[0], status: 'running', usage: { outputTokens: 0, totalTokens: 12 }, cost: { amount: 0, currency: 'CNY', basis: 'outputTokens' } }],
    })
    send.mockResolvedValueOnce(Response.json({
      id: 'cgt-promote', status: 'succeeded', content: { video_url: 'https://fixture.invalid/final.mp4' },
      usage: { completion_tokens: 200, total_tokens: 220 },
    }))
    await store.refresh(store.activeRun!)
    expect(await other.get(VIDEO_CREATE_SESSION_KEY, null)).toMatchObject({
      runs: [{
        id: 'cgt-promote', status: 'succeeded', videoUrl: 'https://fixture.invalid/final.mp4',
        usage: { outputTokens: 200, totalTokens: 220 },
        cost: { basis: 'outputTokens', amount: expect.any(Number) },
      }],
    })
    expect((await other.get<VideoCreateSessionState | null>(VIDEO_CREATE_SESSION_KEY, null))!.runs[0].cost!.amount).toBeGreaterThan(0)
  })

  it('clears session dirty state when pruning runs on save and reports failure on invalid snapshots', async () => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const ctx = createTestPinia({
      preferenceService: preferences,
      imageStorageService: {
        getImage: vi.fn(async () => null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as unknown as IImageStorageService,
    })
    await preferences.set(VIDEO_MODEL_PREFERENCE, { model: SEEDANCE_MODEL, apiKey: 'test' })
    const manager = useSessionManager(ctx.pinia)
    await manager.restoreAllSessions()
    const store = useVideoCreateSession(ctx.pinia)
    const send = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ id: 'cgt-1' }))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-1', status: 'failed' }))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-2' }))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-2', status: 'failed' }))
    await store.submit(store.prepareRun(ark, 'b', 'First'))
    await store.refresh(store.activeFor('b')!)
    await store.submit(store.prepareRun(ark, 'b', 'Second'))
    await store.refresh(store.activeFor('b')!)
    expect(store.state.runs.map(run => run.id)).toEqual(['cgt-2'])
    expect(manager.hasUnsavedSessions).toBe(false)

    await preferences.set(VIDEO_CREATE_SESSION_KEY, { runs: [{ id: 'cgt-corrupt' }] })
    await expect(store.restoreSession()).rejects.toThrow()
    expect(await store.saveSession()).toBe(false)
    expect(manager.saveFailures.get('video-create')).toBe('failed')
    expect(manager.hasUnsavedSessions).toBe(true)
  })

  it('blocks paid submission before calling the provider when the snapshot lacks headroom for the task ID', async () => {
    const ctx = createWindow(new MemoryStorageProvider())
    await ctx.preferences.set(VIDEO_MODEL_PREFERENCE, { model: SEEDANCE_MODEL, apiKey: 'test' })
    const store = useVideoCreateSession(ctx.pinia)
    await store.restoreSession()
    store.state.originalPrompt = 'a'.repeat(MAX_VIDEO_SUBMIT_SNAPSHOT_BYTES)
    store.state.optimizedPrompt = 'A short video prompt.'
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'cgt-never' }))
    await expect(store.submit(store.prepareRun(ark))).rejects.toThrow('video.error.save')
    expect(send).not.toHaveBeenCalled()
    expect(store.state.runs).toEqual([])
  })

  it.each([
    ['corrupted schema', (storage: MemoryStorageProvider, preferences: PreferenceService) =>
      preferences.set(VIDEO_CREATE_SESSION_KEY, { runs: [{ id: 'cgt-paid' }] })],
    ['oversized snapshot', (storage: MemoryStorageProvider) =>
      storage.setItem('pref:' + VIDEO_CREATE_SESSION_KEY, JSON.stringify({ originalPrompt: 'x'.repeat(1024 * 1024), runs: [{ id: 'cgt-paid' }] }))],
  ])('allows backup import recovery when the video session has a %s', async (_label, seed) => {
    const storage = new MemoryStorageProvider()
    const preferences = new PreferenceService(storage)
    const ctx = createTestPinia({
      preferenceService: preferences,
      imageStorageService: {
        getImage: vi.fn(async () => null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as unknown as IImageStorageService,
    })
    await seed(storage, preferences)
    const rawBefore = await storage.getItem('pref:' + VIDEO_CREATE_SESSION_KEY)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const manager = useSessionManager(ctx.pinia)
    await manager.restoreAllSessions()
    expect(consoleError).toHaveBeenCalled()
    expect(useVideoCreateSession(ctx.pinia).hasInvalidSnapshot).toBe(true)

    const release = await manager.beginSessionRestore()
    try {
      expect(await storage.getItem('pref:' + VIDEO_CREATE_SESSION_KEY)).toBe(rawBefore)
      await new WorkspaceSessionTransfer(preferences).importData({
        version: 1,
        sessions: {
          'video-create': { originalPrompt: 'Restored brief', optimizedPrompt: 'Restored prompt' },
        },
      })
    } finally {
      release()
    }
    expect(await preferences.get(VIDEO_CREATE_SESSION_KEY, null)).toEqual({
      originalPrompt: 'Restored brief', optimizedPrompt: 'Restored prompt',
    })
  })

  it('allows local untracking of imported active tasks in the browser extension', async () => {
    const storage = new MemoryStorageProvider()
    const ctx = createWindow(storage)
    await ctx.preferences.set(VIDEO_CREATE_SESSION_KEY, {
      originalPrompt: 'Imported brief',
      optimizedPrompt: 'Imported prompt',
      runs: [{
        id: 'cgt-ext-imported', status: 'running', variantId: 'b',
        prompt: 'Imported prompt', model: SEEDANCE_MODEL, params: {}, images: [], submittedAt: 1,
      }],
    })
    const store = useVideoCreateSession(ctx.pinia)
    await store.restoreSession()
    const run = store.activeRun!
    expect(store.canAcknowledge(run)).toBe(false)

    vi.stubGlobal('location', { protocol: 'chrome-extension:' })
    try {
      expect(store.canAcknowledge(run)).toBe(true)
      await store.acknowledge(run)
      expect(store.activeRun).toBeUndefined()
      expect(store.state.runs[0]).toMatchObject({ id: 'cgt-ext-imported', status: 'untracked' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('restores the persisted draft in another window', async () => {
    const storage = new MemoryStorageProvider()
    const first = createWindow(storage)
    const store = useVideoCreateSession(first.pinia)
    await store.restoreSession()
    store.state.originalPrompt = '城市夜景，手持跟拍'
    store.state.selectedTextModelKey = 'text-config'
    expect(await store.saveSession()).toBe(true)

    const second = createWindow(storage)
    second.activate()
    const restored = useVideoCreateSession(second.pinia)
    await restored.restoreSession()
    expect(restored.state.originalPrompt).toBe('城市夜景，手持跟拍')
    expect(restored.state.selectedTextModelKey).toBe('text-config')
  })
})
