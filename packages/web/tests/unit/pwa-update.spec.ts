import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareUpdate, requestWorkerUpdate } from '../../src/pwa/update'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('explicit PWA update preparation', () => {
  it('waits for the shared UI to finish saving before it allows an update', async () => {
    let finish: (value: 'ready') => void = () => {}
    const prepare = vi.fn(() => new Promise<'ready'>(resolve => { finish = resolve }))
    let completed = false
    const result = prepareUpdate(prepare).then(value => { completed = true; return value })
    await Promise.resolve()
    expect(completed).toBe(false)
    finish('ready')
    expect(await result).toBe('ready')
  })
  it('preserves busy and failed states, and fails closed without the UI adapter', async () => {
    expect(await prepareUpdate(async () => 'busy')).toBe('busy')
    expect(await prepareUpdate(async () => 'save-failed')).toBe('save-failed')
    expect(await prepareUpdate(async () => { throw new Error('fixture storage failure') })).toBe('save-failed')
    expect(await prepareUpdate(undefined)).toBe('save-failed')
  })
  it('releases the update attempt when local persistence stalls', async () => {
    vi.useFakeTimers()
    const result = prepareUpdate(() => new Promise(() => {}), 100)
    await vi.advanceTimersByTimeAsync(100)
    expect(await result).toBe('save-failed')
  })
})

describe('PWA worker update handshake', () => {
  function messageWorker(reply?: unknown) {
    let receiver: ((event: { data: unknown }) => void) | undefined
    const close = vi.fn()
    vi.stubGlobal('MessageChannel', class {
      port1 = { close, set onmessage(listener: typeof receiver) { receiver = listener } }
      port2 = {}
    })
    const postMessage = vi.fn(() => { if (reply !== undefined) receiver?.({ data: reply }) })
    return { worker: { postMessage } as unknown as ServiceWorker, postMessage, close }
  }
  it('requests explicit activation and accepts a confirmed response', async () => {
    const { worker, postMessage, close } = messageWorker({ accepted: true })
    expect(await requestWorkerUpdate(worker)).toBe('ready')
    expect(postMessage).toHaveBeenCalledWith({ type: 'PROMPT_OPTIMIZER_APPLY_UPDATE' }, [expect.anything()])
    expect(close).toHaveBeenCalledOnce()
  })
  it('reports another open app window instead of forcing activation', async () => {
    const { worker } = messageWorker({ accepted: false, reason: 'other-tabs' })
    expect(await requestWorkerUpdate(worker)).toBe('other-tabs')
  })
  it('times out without reloading or losing the current workspace', async () => {
    vi.useFakeTimers()
    const { worker, close } = messageWorker()
    const result = requestWorkerUpdate(worker, 100)
    await vi.advanceTimersByTimeAsync(100)
    expect(await result).toBe('failed')
    expect(close).toHaveBeenCalledOnce()
  })
})
