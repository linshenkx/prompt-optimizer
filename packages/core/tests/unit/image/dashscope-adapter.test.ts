import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { DashScopeImageAdapter } from '../../../src/services/image/adapters/dashscope'
import type { ImageModelConfig, ImageRequest } from '../../../src/services/image/types'

// DashScope adapter uses fetch directly.
describe('DashScopeImageAdapter', () => {
  let adapter: DashScopeImageAdapter
  const realFetch = global.fetch

  beforeEach(() => {
    adapter = new DashScopeImageAdapter()
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  test('should send input image as data URL for image edit models', async () => {
    const config: ImageModelConfig = {
      id: 'test-dashscope-edit-config',
      name: 'Test DashScope Edit Config',
      providerId: 'dashscope',
      modelId: 'qwen-image-edit-plus',
      enabled: true,
      connectionConfig: {
        apiKey: 'test-api-key',
        baseURL: 'https://dashscope.aliyuncs.com'
      },
      paramOverrides: {},
      // Self-contained fields are required by ImageModelConfig but adapter only needs a subset.
      provider: adapter.getProvider(),
      model: adapter.buildDefaultModel('qwen-image-edit-plus')
    }

    const request: ImageRequest = {
      prompt: 'edit this image',
      configId: config.id,
      count: 1,
      inputImage: {
        b64: 'aGVsbG8=',
        mimeType: 'image/png'
      }
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output: {
          choices: [
            {
              message: {
                content: [{ image: 'https://example.com/edited.png' }]
              }
            }
          ]
        },
        usage: { image_count: 1 }
      })
    })

    await adapter.generate(request, config)

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringMatching(/data:image\/png;base64,aGVsbG8=/)
      })
    )
  })

  test('should route Qwen Image 2.0 with multiple inputs through the unified edit payload', async () => {
    const model = adapter.getModels()[0]
    const config: ImageModelConfig = {
      id: 'test-qwen-image-2',
      name: 'Qwen Image 2.0',
      providerId: 'dashscope',
      modelId: model.id,
      enabled: true,
      connectionConfig: {
        apiKey: 'test-api-key',
        baseURL: 'https://dashscope.aliyuncs.com'
      },
      paramOverrides: {},
      provider: adapter.getProvider(),
      model
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output: { choices: [{ message: { content: [{ image: 'https://example.com/image.png' }] } }] }
      })
    })

    await adapter.generate({
      prompt: 'combine these images',
      configId: config.id,
      count: 1,
      inputImages: [
        { b64: 'aGVsbG8=', mimeType: 'image/png' },
        { b64: 'd29ybGQ=', mimeType: 'image/jpeg' }
      ]
    }, config)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('qwen-image-2.0')
    expect(body.input.messages[0].content).toEqual([
      { image: 'data:image/png;base64,aGVsbG8=' },
      { image: 'data:image/jpeg;base64,d29ybGQ=' },
      { text: 'combine these images' }
    ])
  })
})
