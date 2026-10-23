import { describe, expect, it, vi } from 'vitest'
import { createAppUpdatePreparation } from '../../../src/composables/ui/useAppUpdatePreparation'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

describe('application update checkpoint', () => {
  it('protects new edits entered while the previous snapshot is being saved', async () => {
    const write = deferred<boolean>()
    let changed: () => void = () => {}
    const stop = vi.fn()
    const prepare = createAppUpdatePreparation({
      isBusy: () => false,
      subscribeToChanges: callback => { changed = callback; return stop },
      flush: () => write.promise,
    })
    const result = prepare()
    changed()
    write.resolve(true)
    expect(await result).toBe('busy')
    expect(stop).toHaveBeenCalledOnce()
  })

  it('defers a running optimization without writing or reloading', async () => {
    const flush = vi.fn(async () => true)
    const prepare = createAppUpdatePreparation({ isBusy: () => true, flush })
    expect(await prepare()).toBe('busy')
    expect(flush).not.toHaveBeenCalled()
  })

  it('does not approve an update until storage acknowledges completion', async () => {
    const write = deferred<boolean>()
    const prepare = createAppUpdatePreparation({ isBusy: () => false, flush: () => write.promise })
    const finished = vi.fn()
    const result = prepare().then(finished)
    await Promise.resolve()
    expect(finished).not.toHaveBeenCalled()
    write.resolve(true)
    await result
    expect(finished).toHaveBeenCalledWith('ready')
  })

  it('rechecks activity that starts while saving, including a protected editor', async () => {
    let busy = false
    const write = deferred<boolean>()
    const prepare = createAppUpdatePreparation({ isBusy: () => busy, flush: () => write.promise })
    const result = prepare()
    busy = true
    write.resolve(true)
    expect(await result).toBe('busy')
  })

  it.each(['reported', 'rejected'])('blocks a %s storage failure and allows a later retry', async kind => {
    const flush = vi.fn(async () => true)
    if (kind === 'reported') flush.mockResolvedValueOnce(false)
    else flush.mockRejectedValueOnce(new Error('quota exceeded'))
    const prepare = createAppUpdatePreparation({ isBusy: () => false, flush })
    expect(await prepare()).toBe('save-failed')
    expect(await prepare()).toBe('ready')
  })

  it('shares a pending checkpoint when the update button is pressed twice', async () => {
    const write = deferred<boolean>()
    const flush = vi.fn(() => write.promise)
    const prepare = createAppUpdatePreparation({ isBusy: () => false, flush })
    const first = prepare()
    const second = prepare()
    expect(flush).toHaveBeenCalledOnce()
    write.resolve(true)
    expect(await first).toBe('ready')
    expect(await second).toBe('ready')
  })
})
