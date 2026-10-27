import type { StreamHandlers } from '../services/llm/types'

/** AbortSignal stays in the renderer; only IDs and callback proxies cross IPC. */
export function runIpcStream(
  callbacks: StreamHandlers,
  start: (handlers: StreamHandlers) => Promise<void>,
  cancel?: (id: string) => Promise<unknown>,
): Promise<void> {
  const { signal, ...handlers } = callbacks
  if (!signal) return start(callbacks)
  if (signal.aborted) return Promise.reject(signal.reason)
  let id: string | undefined
  let settled = false
  let terminal = false
  let abort: () => void
  const result = new Promise<void>((resolve, reject) => {
    const cancelRequest = () => { if (id) void cancel?.(id).catch(() => {}) }
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error) } }
    abort = () => { cancelRequest(); fail(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    const guard = <T extends unknown[]>(callback?: (...args: T) => void) => (...args: T) => {
      if (settled) return
      try { callback?.(...args) } catch (error) { cancelRequest(); fail(error) }
    }
    const complete: StreamHandlers['onComplete'] = async response => {
      if (settled || terminal) return
      terminal = true
      try {
        await handlers.onComplete(response)
        if (!settled) { settled = true; resolve() }
      } catch (error) { fail(error) }
    }
    Promise.resolve().then(() => start({
      ...handlers,
      onStart: streamId => { id = streamId; if (signal.aborted) cancelRequest() },
      onToken: guard(handlers.onToken),
      onReasoningToken: guard(handlers.onReasoningToken),
      onToolCall: guard(handlers.onToolCall),
      onComplete: complete,
      onError: error => { guard(handlers.onError)(error); fail(error) },
    })).then(() => { if (!terminal && !settled) void complete() }, fail)
  })
  return result.finally(() => signal.removeEventListener('abort', abort))
}
