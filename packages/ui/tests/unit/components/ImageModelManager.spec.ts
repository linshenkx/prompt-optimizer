import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { NInput } from 'naive-ui'
import ImageModelManager from '../../../src/components/ImageModelManager.vue'
import MobileModelRow from '../../../src/components/common/MobileModelRow.vue'

const state = vi.hoisted(() => ({ current: null as any, compact: null as any, createManager: vi.fn(), confirm: vi.fn() }))
vi.mock('@prompt-optimizer/core', () => ({ isRunningInElectron: () => false }))
vi.mock('../../../src/composables/model/useImageModelManager', () => ({
  useImageModelManager: () => { state.createManager(); return state.current },
}))
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({ useWorkspaceLayout: () => ({ isCompact: state.compact }) }))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({ useConfirmDialog: () => ({ warning: state.confirm }) }))
vi.mock('naive-ui', async original => ({ ...await original<typeof import('naive-ui')>(), useDialog: () => ({ warning: vi.fn() }) }))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

const model = () => ({
  id: 'image-a', name: 'Image A', providerId: 'openai', modelId: 'image-model-a', enabled: true,
  provider: { id: 'openai', name: 'OpenAI' }, model: { id: 'image-model-a', name: 'Image Model A', capabilities: { text2image: true } },
})
const stubs = {
  NSpace: { template: '<div><slot /></div>' },
  NCard: { template: '<div><slot name="header" /><slot name="header-extra" /><slot /></div>' },
  NButton: { template: '<button><slot /></button>' },
  NText: { template: '<span><slot /></span>' },
  NTag: { template: '<span><slot /></span>' },
  NEmpty: true,
  NInput: true,
  MobileModelRow: { name: 'MobileModelRow', props: ['title', 'testing'], template: '<article><slot /><slot name="test-result" /></article>' },
  AppPreviewImage: { name: 'AppPreviewImage', props: ['src'], template: '<img :src="src" />' },
}

beforeEach(() => {
  vi.clearAllMocks()
  state.compact = ref(true)
  state.confirm.mockResolvedValue(true)
  state.current = {
    configs: ref([model()]), initialize: vi.fn().mockResolvedValue(undefined), loadConfigs: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn().mockResolvedValue(undefined), deleteConfig: vi.fn().mockResolvedValue(undefined),
  }
})

describe('image model mobile list', () => {
  it('keeps one request and its preview across responsive changes and editor navigation', async () => {
    let finish!: (value: unknown) => void
    const testConnection = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const wrapper = shallowMount(ImageModelManager, { global: { renderStubDefaultSlot: true, stubs, provide: { imageService: { testConnection } } } })
    await flushPromises()
    wrapper.findComponent(MobileModelRow).vm.$emit('test')
    await flushPromises()
    expect(testConnection).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(MobileModelRow).props('testing')).toBe(true)
    wrapper.findComponent(MobileModelRow).vm.$emit('test')
    state.compact.value = false
    await flushPromises()
    state.compact.value = true
    await flushPromises()
    expect(state.createManager).toHaveBeenCalledTimes(1)
    expect(testConnection).toHaveBeenCalledTimes(1)
    finish({ images: [{ b64: 'preview' }] })
    await flushPromises()
    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,preview')
    wrapper.findComponent(MobileModelRow).vm.$emit('edit')
    expect(wrapper.emitted('edit')).toEqual([['image-a']])
    expect(wrapper.find('img').exists()).toBe(true)
    wrapper.unmount()
  })

  it('filters only the mobile presentation without changing configured models', async () => {
    const wrapper = shallowMount(ImageModelManager, { global: { renderStubDefaultSlot: true, stubs, provide: { imageService: { testConnection: vi.fn() } } } })
    wrapper.findComponent(NInput).vm.$emit('update:value', 'missing')
    await flushPromises()
    expect(wrapper.findAllComponents(MobileModelRow)).toHaveLength(0)
    expect(state.current.configs.value).toHaveLength(1)
    state.compact.value = false
    await flushPromises()
    expect(wrapper.find('.image-model-card').exists()).toBe(true)
    state.compact.value = true
    await flushPromises()
    wrapper.findComponent(NInput).vm.$emit('update:value', 'OPENAI')
    await flushPromises()
    expect(wrapper.findAllComponents(MobileModelRow)).toHaveLength(1)
    wrapper.unmount()
  })

  it('uses existing clone, enable and delete actions without mutating the source draft', async () => {
    const wrapper = shallowMount(ImageModelManager, { global: { renderStubDefaultSlot: true, stubs, provide: { imageService: { testConnection: vi.fn() } } } })
    const row = wrapper.findComponent(MobileModelRow)
    row.vm.$emit('action', 'clone')
    const clone = wrapper.emitted('clone')![0][0] as any
    expect(clone.id).toBe('')
    expect(state.current.configs.value[0].id).toBe('image-a')
    row.vm.$emit('action', 'toggle')
    await flushPromises()
    expect(state.current.updateConfig).toHaveBeenCalledWith('image-a', { enabled: false })
    row.vm.$emit('action', 'delete')
    await flushPromises()
    expect(state.confirm).toHaveBeenCalledOnce()
    expect(state.current.deleteConfig).toHaveBeenCalledWith('image-a')
    wrapper.unmount()
  })
})
