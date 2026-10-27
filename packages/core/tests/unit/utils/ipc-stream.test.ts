import { describe, expect, it, vi } from 'vitest'
import { runIpcStream } from '../../../src/utils/ipc-stream'
import type { StreamHandlers } from '../../../src/services/llm/types'

describe('IPC stream lifecycle', () => {
  it('keeps AbortSignal local, cancels an idle request and ignores late IPC events', async () => {
    const controller = new AbortController(), cancel = vi.fn(async () => {}), onToken = vi.fn()
    let remote!: StreamHandlers
    const request = runIpcStream({ signal: controller.signal, onToken, onComplete() {}, onError() {} }, async handlers => {
      remote = handlers
      expect('signal' in handlers).toBe(false)
      handlers.onStart?.('request-a')
      await new Promise(() => {})
    }, cancel)
    await Promise.resolve()
    controller.abort(new Error('stopped'))
    await expect(request).rejects.toThrow('stopped')
    remote.onToken('late')
    expect(onToken).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledWith('request-a')
  })

  it('cancels callback failures without throwing across the context bridge', async () => {
    const cancel = vi.fn(async () => {})
    const request = runIpcStream({ signal: new AbortController().signal, onToken() { throw new Error('capacity') }, onComplete() {}, onError() {} }, async handlers => {
      handlers.onStart?.('limited')
      expect(() => handlers.onToken('overflow')).not.toThrow()
    }, cancel)
    await expect(request).rejects.toThrow('capacity')
    expect(cancel).toHaveBeenCalledWith('limited')
  })

  it('waits for the completion transaction rather than only the IPC reply', async () => {
    let release!: () => void
    const transaction = new Promise<void>(resolve => { release = resolve })
    let complete = false
    const request = runIpcStream({ signal: new AbortController().signal, onToken() {}, onComplete: () => transaction, onError() {} }, async handlers => { void handlers.onComplete() })
      .then(() => { complete = true })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(complete).toBe(false)
    release()
    await request
    expect(complete).toBe(true)
  })

  it('does not start an already cancelled request', async () => {
    const controller = new AbortController(), start = vi.fn()
    controller.abort(new Error('cancelled'))
    await expect(runIpcStream({ signal: controller.signal, onToken() {}, onComplete() {}, onError() {} }, start)).rejects.toThrow('cancelled')
    expect(start).not.toHaveBeenCalled()
  })
})
