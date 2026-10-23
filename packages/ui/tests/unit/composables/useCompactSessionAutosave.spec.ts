import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useCompactSessionAutosave } from '../../../src/composables/session/useCompactSessionAutosave'
import type { SessionSaveResult } from '../../../src/stores/session/sessionSaveResult'

let scope: ReturnType<typeof effectScope>
beforeEach(() => { vi.useFakeTimers(); scope = effectScope() })
afterEach(() => { scope.stop(); vi.useRealTimers() })
const setup = (initiallyEnabled = true) => {
  const enabled = ref(initiallyEnabled)
  const busy = ref(false)
  let change: (key: string) => void = () => {}
  const unsubscribe = vi.fn()
  const subscribe = vi.fn((callback: (key: string) => void) => { change = callback; return unsubscribe })
  const save = vi.fn(async (_key: string): Promise<SessionSaveResult> => 'saved')
  const controls = scope.run(() => useCompactSessionAutosave({ enabled, busy, subscribe, save }))!
  return { enabled, busy, subscribe, unsubscribe, save, change: (key = 'basic-user') => change(key), ...controls }
}

describe('compact session autosave', () => {
  it('leaves desktop and initialization without extra subscriptions or writes', async () => {
    const state = setup(false)
    await vi.advanceTimersByTimeAsync(6000)
    expect(state.subscribe).not.toHaveBeenCalled()
    expect(state.save).not.toHaveBeenCalled()
    state.enabled.value = true
    await nextTick()
    expect(state.subscribe).toHaveBeenCalledOnce()
  })

  it('coalesces a burst of edits and saves shortly after typing stops', async () => {
    const state = setup()
    state.change()
    await vi.advanceTimersByTimeAsync(500)
    state.change()
    await vi.advanceTimersByTimeAsync(749)
    expect(state.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(state.save).toHaveBeenCalledOnce()
  })

  it('flushes continuous edits within five seconds instead of postponing indefinitely', async () => {
    const state = setup()
    for (let step = 0; step < 10; step++) {
      state.change()
      await vi.advanceTimersByTimeAsync(500)
    }
    expect(state.save).toHaveBeenCalledOnce()
  })

  it('lets the existing pagehide flush cancel a duplicate pending write', async () => {
    const state = setup()
    state.change()
    state.cancelPending()
    await vi.advanceTimersByTimeAsync(6000)
    expect(state.save).not.toHaveBeenCalled()
  })

  it('coalesces edits while busy without polling and saves the original workspaces when idle', async () => {
    const state = setup()
    state.busy.value = true
    state.change('basic-user')
    state.change('basic-user')
    state.change('image-text2image')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    state.busy.value = false
    await nextTick()
    expect(state.save.mock.calls).toEqual([['basic-user'], ['image-text2image']])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).toHaveBeenCalledTimes(2)
  })

  it('flushes one trailing save when the final edit outlasts an in-flight write', async () => {
    const state = setup()
    let finish!: (value: SessionSaveResult) => void
    state.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    state.change()
    await vi.advanceTimersByTimeAsync(750)
    state.change()
    state.change()
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.save).toHaveBeenCalledOnce()
    finish('saved')
    await nextTick()
    expect(state.save).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).toHaveBeenCalledTimes(2)
  })

  it('does not poll a deferred result and resumes when availability changes', async () => {
    const state = setup()
    state.save.mockResolvedValueOnce('deferred')
    state.change()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    state.busy.value = true
    state.busy.value = false
    await nextTick()
    expect(state.save).toHaveBeenCalledTimes(2)
  })

  it('handles an idle event delivered before the awaited deferred status without losing the retry', async () => {
    const state = setup()
    let finish!: (value: SessionSaveResult) => void
    state.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    state.change('basic-user')
    await vi.advanceTimersByTimeAsync(750)
    state.busy.value = true
    state.busy.value = false
    await nextTick()
    expect(state.save).toHaveBeenCalledOnce()
    finish('deferred')
    await nextTick()
    expect(state.save.mock.calls).toEqual([['basic-user'], ['basic-user']])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['blocked', 'failed'] as const)('does not retry a %s write after a busy cycle', async result => {
    const state = setup()
    let finish!: (value: SessionSaveResult) => void
    state.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    state.change()
    await vi.advanceTimersByTimeAsync(750)
    state.change()
    await vi.advanceTimersByTimeAsync(1000)
    finish(result)
    await nextTick()
    state.busy.value = true
    state.busy.value = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['cancel', 'disable', 'dispose'] as const)('invalidates an in-flight trailing request on %s', async action => {
    const state = setup()
    let finish!: (value: SessionSaveResult) => void
    state.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    state.change()
    await vi.advanceTimersByTimeAsync(750)
    state.change()
    await vi.advanceTimersByTimeAsync(1000)
    if (action === 'cancel') state.cancelPending()
    if (action === 'disable') state.enabled.value = false
    if (action === 'dispose') scope.stop()
    finish('deferred')
    await nextTick()
    state.busy.value = true
    state.busy.value = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).toHaveBeenCalledOnce()
  })

  it('keeps new edits after re-enabling while an older save is unresolved without reviving its cancelled request', async () => {
    const state = setup()
    let finish!: (value: SessionSaveResult) => void
    state.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    state.change('basic-user')
    await vi.advanceTimersByTimeAsync(750)
    state.enabled.value = false
    state.enabled.value = true
    state.change('image-text2image')
    await vi.advanceTimersByTimeAsync(750)
    expect(state.unsubscribe).toHaveBeenCalledOnce()
    expect(state.subscribe).toHaveBeenCalledTimes(2)
    expect(state.save).toHaveBeenCalledOnce()
    finish('deferred')
    await nextTick()
    expect(state.save.mock.calls).toEqual([['basic-user'], ['image-text2image']])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.save).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels timers and subscriptions when leaving compact layout or unmounting', async () => {
    const state = setup()
    state.change()
    state.enabled.value = false
    await nextTick()
    expect(state.unsubscribe).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(6000)
    expect(state.save).not.toHaveBeenCalled()
    state.enabled.value = true
    await nextTick()
    state.change()
    scope.stop()
    await vi.advanceTimersByTimeAsync(6000)
    expect(state.unsubscribe).toHaveBeenCalledTimes(2)
    expect(state.save).not.toHaveBeenCalled()
  })
})
