import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useCompactSessionAutosave } from '../../../src/composables/session/useCompactSessionAutosave'

let scope: ReturnType<typeof effectScope>
beforeEach(() => { vi.useFakeTimers(); scope = effectScope() })
afterEach(() => { scope.stop(); vi.useRealTimers() })
const setup = (initiallyEnabled = true) => {
  const enabled = ref(initiallyEnabled)
  let change: () => void = () => {}
  const unsubscribe = vi.fn()
  const subscribe = vi.fn((callback: () => void) => { change = callback; return unsubscribe })
  const save = vi.fn(async () => true)
  const controls = scope.run(() => useCompactSessionAutosave({ enabled, subscribe, save }))!
  return { enabled, subscribe, unsubscribe, save, change: () => change(), ...controls }
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
