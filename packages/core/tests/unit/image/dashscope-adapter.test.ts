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
})
