import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref, watch } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useImageGeneration } from '../../../src/composables/image/useImageGeneration'
import type { AppServices } from '../../../src/types/services'

const createGeneration = () => {
  const getEnabledConfigs = vi.fn().mockResolvedValue([])
  const services = ref<AppServices | null>({ imageModelManager: { getEnabledConfigs } } as unknown as AppServices)
  let generation!: ReturnType<typeof useImageGeneration>
  const wrapper = mount(defineComponent({
    setup() { generation = useImageGeneration(); return {} },
    template: '<div />',
  }), { global: { provide: { services } } })
  return { generation, getEnabledConfigs, services, wrapper }
}

describe('image model list readiness', () => {
  it('distinguishes an unloaded list from a successfully loaded empty list', async () => {
    const { generation, wrapper } = createGeneration()
    expect(generation.imageModels.value).toEqual([])
    expect(generation.isImageModelListReady.value).toBe(false)
    await generation.loadImageModels()
    expect(generation.imageModels.value).toEqual([])
    expect(generation.isImageModelListReady.value).toBe(true)
    wrapper.unmount()
  })

  it('does not publish a failed reload as an authoritative empty model list', async () => {
    const { generation, getEnabledConfigs, wrapper } = createGeneration()
    getEnabledConfigs.mockResolvedValueOnce([{ id: 'saved-model' }])
    await generation.loadImageModels()
    const observedReadiness: boolean[] = []
    const stop = watch(generation.imageModels, () => { observedReadiness.push(generation.isImageModelListReady.value) })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    getEnabledConfigs.mockRejectedValueOnce(new Error('temporary read failure'))
    await generation.loadImageModels()
    await flushPromises()
    expect(generation.isImageModelListReady.value).toBe(false)
    expect(observedReadiness).toEqual([false])
    await generation.loadImageModels()
    await flushPromises()
    expect(observedReadiness).toEqual([false, true])
    stop()
    wrapper.unmount()
  })
})
