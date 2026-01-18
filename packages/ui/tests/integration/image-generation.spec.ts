import { describe, it, expect, vi } from 'vitest'
import { defineComponent, ref, type Ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn()
}

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  const t = (key: string) => key

  return {
    ...actual,
    useI18n: () => ({ t }),
    createI18n: (_opts: unknown) => ({
      global: {
        t,
        te: (_key: string) => true,
        locale: { value: 'zh-CN' },
      },
    }),
  }
})

vi.mock('../../src/composables/ui/useToast', () => ({
  useToast: () => toast
}))

import type { AppServices } from '../../src/types/services'
import { useImageGeneration } from '../../src/composables/image/useImageGeneration'

describe('Image generation (integration)', () => {
  it('loads enabled image models and generates image via service', async () => {
    const services = ref<AppServices | null>({
      imageModelManager: {
        getEnabledConfigs: vi.fn(async () => [{ id: 'img-model-1' }])
      } as any,
      imageService: {
        generate: vi.fn(async (_req: any) => ({
          requestId: 'r1',
          items: [{ b64: 'aGVsbG8=', mimeType: 'image/png' }]
        }))
      } as any
    } as any)

    const apiRef = ref<any>(null)

    const Harness = defineComponent({
      name: 'ImageGenerationHarness',
      setup() {
        apiRef.value = useImageGeneration()
        return () => null
      }
    })

    mount(Harness, {
      global: {
        provide: {
          services: services as Ref<AppServices | null>
        }
      }
    })

    await apiRef.value.loadImageModels()
    expect(apiRef.value.imageModels).toHaveLength(1)

    await apiRef.value.generate({ prompt: 'p', configId: 'img-model-1', count: 1 })
    await nextTick()

    expect(services.value!.imageService!.generate).toHaveBeenCalledTimes(1)
    expect(apiRef.value.progress).toBe('done')
    expect(apiRef.value.result).toMatchObject({ requestId: 'r1' })
  })
})
