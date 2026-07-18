import { describe, expect, it, vi } from 'vitest'
import { LLMService } from '../../../src/services/llm/service'
import { OpenAIAdapter } from '../../../src/services/llm/adapters/openai-adapter'
import { AnthropicAdapter } from '../../../src/services/llm/adapters/anthropic-adapter'
import { GeminiAdapter } from '../../../src/services/llm/adapters/gemini-adapter'
import { ChromeBuiltInAdapter } from '../../../src/services/llm/adapters/chrome-built-in-adapter'
import type {
  ITextProviderAdapter,
  Message,
  StreamHandlers,
  TextModelConfig,
} from '../../../src/services/llm/types'

const messages: Message[] = [{ role: 'user', content: 'cancel me' }]

/** 创建不产生业务副作用的流回调替身。 */
function createCallbacks(): StreamHandlers {
  return {
    onToken: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
  }
}

/** 根据真实 adapter 元数据构造可通过 Core 校验的最小模型配置。 */
function createConfig(adapter: ITextProviderAdapter): TextModelConfig {
  return {
    id: adapter.getProvider().id,
    name: adapter.getProvider().name,
    enabled: true,
    providerMeta: adapter.getProvider(),
    modelMeta: adapter.getModels()[0],
    connectionConfig: { apiKey: 'local-test-key' },
    paramOverrides: {},
  }
}

/** 模拟真正占用中的 provider 请求，只在收到 AbortSignal 后以 AbortError 结束。 */
function waitForProviderAbort(signal?: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error('Provider did not receive AbortSignal'))
      return
    }

    const rejectAsAborted = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    if (signal.aborted) {
      rejectAsAborted()
      return
    }
    signal.addEventListener('abort', rejectAsAborted, { once: true })
  })
}

/** 启动请求、触发取消并验证 provider 观察到同一个 signal。 */
async function expectProviderCancellation(
  start: (signal: AbortSignal) => Promise<void>,
): Promise<void> {
  const controller = new AbortController()
  const pending = start(controller.signal)
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
}

describe('provider stream cancellation', () => {
  it('forwards the LLM service signal to the selected provider adapter', async () => {
    let receivedSignal: AbortSignal | undefined
    const adapter = new OpenAIAdapter()
    const config = createConfig(adapter)
    const fakeAdapter = {
      ...adapter,
      sendMessageStream: async (
        _messages: Message[],
        _config: TextModelConfig,
        _callbacks: StreamHandlers,
        options?: { signal?: AbortSignal },
      ) => {
        receivedSignal = options?.signal
        await waitForProviderAbort(receivedSignal)
      },
    } as unknown as ITextProviderAdapter
    const modelManager = {
      getModel: vi.fn().mockResolvedValue(config),
    }
    const registry = {
      getAdapter: vi.fn().mockReturnValue(fakeAdapter),
    }
    const service = new LLMService(modelManager as never, registry as never)

    await expectProviderCancellation(async (signal) => {
      await service.sendMessageStream(messages, config.id, createCallbacks(), { signal })
    })

    expect(receivedSignal).toBeInstanceOf(AbortSignal)
  })

  it('passes AbortSignal to OpenAI-compatible SDK requests', async () => {
    const adapter = new OpenAIAdapter()
    const config = createConfig(adapter)
    const create = vi.fn((_body, requestOptions) => waitForProviderAbort(requestOptions?.signal))
    ;(adapter as any).createOpenAIInstance = vi.fn().mockResolvedValue({
      chat: { completions: { create } },
      responses: { create: vi.fn() },
    })

    await expectProviderCancellation(async (signal) => {
      await adapter.sendMessageStream(messages, config, createCallbacks(), { signal })
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ stream: true }), {
      signal: expect.any(AbortSignal),
    })
  })

  it('passes AbortSignal to Anthropic SDK stream requests', async () => {
    const adapter = new AnthropicAdapter()
    const config = createConfig(adapter)
    const stream = vi.fn((_body, requestOptions) => waitForProviderAbort(requestOptions?.signal))
    ;(adapter as any).createClient = vi.fn().mockResolvedValue({ messages: { stream } })

    await expectProviderCancellation(async (signal) => {
      await adapter.sendMessageStream(messages, config, createCallbacks(), { signal })
    })

    expect(stream).toHaveBeenCalledWith(expect.any(Object), {
      signal: expect.any(AbortSignal),
    })
  })

  it('passes AbortSignal to Gemini generation config', async () => {
    const adapter = new GeminiAdapter()
    const config = createConfig(adapter)
    const generateContentStream = vi.fn((request) => (
      waitForProviderAbort(request.config?.abortSignal)
    ))
    ;(adapter as any).createClient = vi.fn().mockResolvedValue({
      models: { generateContentStream },
    })

    await expectProviderCancellation(async (signal) => {
      await adapter.sendMessageStream(messages, config, createCallbacks(), { signal })
    })

    expect(generateContentStream).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
    }))
  })

  it('passes AbortSignal to Chrome Prompt API and destroys the active session', async () => {
    const adapter = new ChromeBuiltInAdapter()
    const config = createConfig(adapter)
    const destroy = vi.fn()
    const promptStreaming = vi.fn((_input, options) => waitForProviderAbort(options?.signal))
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ promptStreaming, destroy }),
    })

    await expectProviderCancellation(async (signal) => {
      await adapter.sendMessageStream(messages, config, createCallbacks(), { signal })
    })

    expect(promptStreaming).toHaveBeenCalledWith('cancel me', {
      signal: expect.any(AbortSignal),
    })
    expect(destroy).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
