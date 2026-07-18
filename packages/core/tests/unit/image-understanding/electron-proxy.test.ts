import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElectronImageUnderstandingServiceProxy } from '../../../src/services/image-understanding/electron-proxy'
import type { ImageUnderstandingExecutionRequest } from '../../../src/services/image-understanding/types'

const createRequest = (): ImageUnderstandingExecutionRequest => ({
  modelConfig: {
    id: 'judge-model',
    name: 'Judge model',
    enabled: true,
    providerMeta: { id: 'openai', name: 'OpenAI' },
    modelMeta: { id: 'gpt-image-judge', name: 'Image judge' },
    connectionConfig: { apiKey: 'secret' },
    paramOverrides: {},
    customParamOverrides: {},
  },
  systemPrompt: 'Judge the answer',
  userPrompt: 'What is shown?',
  images: [{ b64: 'RAW_IMAGE', mimeType: 'image/png' }],
})

describe('ElectronImageUnderstandingServiceProxy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  })

  it('serializes image-understanding requests through the Electron bridge', async () => {
    const understand = vi.fn().mockResolvedValue({ content: 'evaluation result' })
    ;(globalThis as typeof globalThis & { window?: unknown }).window = {
      electronAPI: { imageUnderstanding: { understand } },
    }

    const request = new Proxy(createRequest(), {})
    const proxy = new ElectronImageUnderstandingServiceProxy()

    await expect(proxy.understand(request)).resolves.toEqual({ content: 'evaluation result' })
    expect(understand).toHaveBeenCalledOnce()
    expect(understand).toHaveBeenCalledWith(createRequest())
    expect(understand.mock.calls[0]?.[0]).not.toBe(request)
  })

  it('adapts the non-stream bridge response to stream callbacks', async () => {
    const response = { content: 'answer', reasoning: 'reasoning' }
    const understand = vi.fn().mockResolvedValue(response)
    ;(globalThis as typeof globalThis & { window?: unknown }).window = {
      electronAPI: { imageUnderstanding: { understand } },
    }

    const callbacks = {
      onToken: vi.fn(),
      onReasoningToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    }
    const proxy = new ElectronImageUnderstandingServiceProxy()

    await proxy.understandStream(createRequest(), callbacks)

    expect(callbacks.onReasoningToken).toHaveBeenCalledWith('reasoning')
    expect(callbacks.onToken).toHaveBeenCalledWith('answer')
    expect(callbacks.onComplete).toHaveBeenCalledWith(response)
    expect(callbacks.onError).not.toHaveBeenCalled()
  })
})
