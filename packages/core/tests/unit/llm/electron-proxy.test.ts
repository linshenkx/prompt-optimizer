import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElectronLLMProxy } from '../../../src/services/llm/electron-proxy'
import type { LLMResponse, Message, ToolDefinition } from '../../../src/services/llm/types'

describe('ElectronLLMProxy stream completion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each(['text', 'tools', 'legacy tools fallback'] as const)(
    'forwards the response and usage from the %s IPC channel',
    async mode => {
      const response: LLMResponse = {
        content: 'Answer',
        metadata: {
          model: 'test-model',
          usage: { inputTokens: 12, outputTokens: 4, cachedInputTokens: null, totalTokens: 16 }
        }
      }
      const finish = (callbacks: {
        onStart?: (id: string) => void
        onFinish?: (result?: LLMResponse) => void
      }) => {
        callbacks.onStart?.('stream-id')
        callbacks.onFinish?.(response)
      }
      const sendMessageStream = vi.fn(async (_messages, _provider, callbacks) => finish(callbacks))
      const sendMessageStreamWithTools = vi.fn(async (_messages, _provider, _tools, callbacks) => finish(callbacks))
      vi.stubGlobal('window', {
        electronAPI: {
          llm: {
            sendMessageStream,
            ...(mode === 'legacy tools fallback' ? {} : { sendMessageStreamWithTools })
          }
        }
      })

      const proxy = new ElectronLLMProxy()
      const messages: Message[] = [{ role: 'user', content: 'Question' }]
      const tools: ToolDefinition[] = [{ type: 'function', function: { name: 'lookup' } }]
      const callbacks = {
        signal: new AbortController().signal,
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      if (mode === 'text') {
        await proxy.sendMessageStream(messages, 'test-provider', callbacks)
      } else {
        await proxy.sendMessageStreamWithTools(messages, 'test-provider', tools, callbacks)
      }

      const ipcMethod = mode === 'tools' ? sendMessageStreamWithTools : sendMessageStream
      expect(ipcMethod).toHaveBeenCalledOnce()
      expect(callbacks.onComplete).toHaveBeenCalledExactlyOnceWith(response)
      expect(callbacks.onError).not.toHaveBeenCalled()
    }
  )
})
