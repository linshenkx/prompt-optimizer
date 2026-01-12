import { describe, test, expect } from 'vitest'
import { SiliconFlowImageAdapter } from '../../src/services/image/adapters/siliconflow'
import type { ImageRequest, ImageModelConfig } from '../../src/services/image/types'

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('SiliconFlowImageAdapter Integration Test', () => {
  test('should generate image with SiliconFlow API', async () => {
    const apiKey = process.env.VITE_SILICONFLOW_API_KEY
    if (!apiKey) return

    const adapter = new SiliconFlowImageAdapter()
    const models = adapter.getModels()
    expect(models.length).toBeGreaterThan(0)

    const modelId = models[0].id
    const config: ImageModelConfig = {
      id: 'siliconflow-integration',
      name: 'SiliconFlow Kolors Test',
      providerId: 'siliconflow',
      modelId,
      enabled: true,
      connectionConfig: { apiKey, baseURL: 'https://api.siliconflow.cn/v1' },
      paramOverrides: { image_size: '1024x1024', num_inference_steps: 20, guidance_scale: 7.5 }
    } as any

    const request: ImageRequest = {
      prompt: '星际穿越，黑洞，黑洞里冲出一辆快支离破碎的复古列车，蒸汽朋克风格，科幻电影场景，高质量，细节丰富，8K分辨率，壮观震撼',
      count: 1,
      configId: 'siliconflow-integration',
      paramOverrides: { image_size: '1024x1024', num_inference_steps: 20, guidance_scale: 7.5 }
    }

    const result = await adapter.generate(request, config)

    expect(result).toBeDefined()
    expect(Array.isArray(result.images)).toBe(true)
    expect(result.images.length).toBe(1)
    expect(result.images[0]).toHaveProperty('url')
    expect(typeof result.images[0].url).toBe('string')
  }, 60000)
})
