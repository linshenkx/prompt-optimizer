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
  it.each(['success', 'failure'])('ignores an older %s after the latest image model refresh completed', async (outcome) => {
    const { generation, getEnabledConfigs, wrapper } = createGeneration()
    let resolveOlder!: (models: any[]) => void
    let rejectOlder!: (error: Error) => void
    getEnabledConfigs.mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolveOlder = resolve; rejectOlder = reject
    })).mockResolvedValueOnce([{ id: 'latest-model' }])
    const older = generation.loadImageModels()
    await generation.loadImageModels()
    if (outcome === 'success') resolveOlder([{ id: 'disabled-model' }])
    else rejectOlder(new Error('stale failure'))
    await older
    expect(generation.imageModels.value).toEqual([{ id: 'latest-model' }])
    expect(generation.isImageModelListReady.value).toBe(true)
    wrapper.unmount()
  })

  it('ignores a pending image model response after services become unavailable', async () => {
    const { generation, getEnabledConfigs, services, wrapper } = createGeneration()
    let resolveOlder!: (models: any[]) => void
    getEnabledConfigs.mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve }))
    const older = generation.loadImageModels()
    services.value = null
    await generation.loadImageModels()
    resolveOlder([{ id: 'obsolete-model' }])
    await older
    expect(generation.imageModels.value).toEqual([])
    expect(generation.isImageModelListReady.value).toBe(false)
    wrapper.unmount()
  })

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
