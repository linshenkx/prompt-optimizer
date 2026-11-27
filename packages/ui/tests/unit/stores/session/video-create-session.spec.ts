import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorageProvider, PreferenceService, defaultVideoConfig, summarizeVideoModel, SEEDANCE_MODEL, VIDEO_MODEL_PREFERENCE } from '@prompt-optimizer/core'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { setPiniaServices } from '../../../../src/plugins/pinia'
import {
  VIDEO_CREATE_SESSION_KEY,
  useVideoCreateSession,
} from '../../../../src/stores/session/useVideoCreateSession'
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
    await expect(store.submit(store.prepareRun(ark))).rejects.toThrow()
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
      .mockResolvedValueOnce(Response.json({ id: 'cgt-b', status: 'running', usage: { completion_tokens: 0, total_tokens: 12 } }))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-b', status: 'succeeded', content: { video_url: 'https://example.org/b.mp4' } }))
    const a = session.prepareRun(ark, 'a', session.state.originalPrompt)
    const b = session.prepareRun(ark)
    await session.submit(a)
    await session.submit(b)
    await session.submit(a)
    const accepted = session.activeFor('b')!
    await session.refresh(accepted)
    await session.refresh(accepted)
    expect(send.mock.calls.map(([, opts]) => opts?.method)).toEqual(['POST', 'POST', 'GET', 'GET'])
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
