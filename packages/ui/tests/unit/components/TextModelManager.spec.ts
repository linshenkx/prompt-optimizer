import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import TextModelManager from '../../../src/components/TextModelManager.vue'
import LocalServiceDiscovery from '../../../src/components/LocalServiceDiscovery.vue'

const { manager } = vi.hoisted(() => ({ manager: { current: null as any } }))
vi.mock('../../../src/composables/model/useTextModelManager', () => ({ useTextModelManager: () => manager.current }))
vi.mock('naive-ui', async (original) => ({
  ...await original<typeof import('naive-ui')>(), useDialog: () => ({}),
}))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({ useConfirmDialog: () => ({ warning: async () => true }) }))

describe('TextModelManager deletion updates', () => {
  it('opens a prefilled new-provider draft from the discovered service shortcut', async () => {
    const service = {
      kind: 'magpie' as const, name: 'Magpie', baseURL: 'http://localhost:3425/v1', status: 'ready' as const,
      models: [{ id: 'first', name: 'First' }],
    }
    manager.current = {
      models: ref([]), testingConnections: ref({}), isDefaultModel: () => false,
      cancelLocalModelRequest: vi.fn(), loadProviders: vi.fn(), loadModels: vi.fn(), prepareForLocalService: vi.fn().mockResolvedValue(true),
    }
    const wrapper = mount(TextModelManager, { props: { active: true }, global: { stubs: {
      TextModelList: true, TextModelEditModal: true, LocalServiceDiscovery: true,
    } } })
    await flushPromises()
    const discovery = wrapper.findComponent(LocalServiceDiscovery)
    expect(discovery.props('active')).toBe(true)
    const before = wrapper.emitted('modelsUpdated')?.length ?? 0
    discovery.vm.$emit('select', service)
    await flushPromises()
    expect(manager.current.prepareForLocalService).toHaveBeenCalledWith(service)
    expect(wrapper.findComponent({ name: 'TextModelEditModal' }).props('show')).toBe(true)
    expect(wrapper.emitted('modelsUpdated')?.length ?? 0).toBe(before)
    wrapper.findComponent({ name: 'TextModelEditModal' }).vm.$emit('update:show', false)
    await flushPromises()
    expect(manager.current.cancelLocalModelRequest).toHaveBeenCalledOnce()
    expect(wrapper.findComponent({ name: 'TextModelEditModal' }).props('show')).toBe(false)
    wrapper.unmount()
  })

  it('does not open a late draft after the model manager closes', async () => {
    const pending = Promise.withResolvers<boolean>()
    manager.current = {
      models: ref([]), testingConnections: ref({}), isDefaultModel: () => false,
      cancelLocalModelRequest: vi.fn(), loadProviders: vi.fn(), loadModels: vi.fn(), prepareForLocalService: vi.fn().mockReturnValue(pending.promise),
    }
    const wrapper = mount(TextModelManager, { props: { active: true }, global: { stubs: {
      TextModelList: true, TextModelEditModal: true, LocalServiceDiscovery: true,
    } } })
    await flushPromises()
    wrapper.findComponent(LocalServiceDiscovery).vm.$emit('select', { kind: 'magpie' })
    await wrapper.setProps({ active: false })
    expect(manager.current.cancelLocalModelRequest).toHaveBeenCalledOnce()
    pending.resolve(true)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'TextModelEditModal' }).props('show')).toBe(false)
    expect(wrapper.findComponent(LocalServiceDiscovery).props('active')).toBe(false)
    wrapper.unmount()
  })
  it.each([false, true])('notifies consumers after deleting a model (remaining models: %s)', async (hasRemaining) => {
    const models = ref([{ id: 'delete-me' }, ...(hasRemaining ? [{ id: 'remaining' }] : [])])
    manager.current = {
      models, testingConnections: ref({}), isDefaultModel: () => false,
      cancelLocalModelRequest: vi.fn(), loadProviders: vi.fn(), loadModels: vi.fn(),
      deleteModel: async (id: string) => { models.value = models.value.filter(model => model.id !== id) },
    }
    const wrapper = mount(TextModelManager, { global: { stubs: { TextModelList: true, TextModelEditModal: true } } })
    await flushPromises()
    const before = wrapper.emitted('modelsUpdated')?.length || 0
    wrapper.findComponent({ name: 'TextModelList' }).vm.$emit('delete', 'delete-me')
    await flushPromises()
    expect(wrapper.emitted('modelsUpdated')).toHaveLength(before + 1)
    expect(wrapper.emitted('modelsUpdated')?.at(-1)).toEqual([hasRemaining ? 'remaining' : undefined])
    wrapper.unmount()
  })
})


describe('Chrome placeholder visibility', () => {
  it('hides only the untouched placeholder and preserves explicitly disabled connections', async () => {
    const placeholder = { id: 'chrome-built-in', providerId: 'chrome-built-in', providerMeta: { id: 'chrome-built-in' }, enabled: false, connectionConfig: {}, activationState: { userConfigured: false } }
    const saved = { ...placeholder, id: 'custom-chrome', activationState: { userConfigured: true } }
    manager.current = { models: ref([placeholder, saved]), testingConnections: ref({}), isDefaultModel: () => false, cancelLocalModelRequest: vi.fn(), loadProviders: vi.fn(), loadModels: vi.fn() }
    const wrapper = mount(TextModelManager, { global: { stubs: { TextModelList: true, TextModelEditModal: true, LocalServiceDiscovery: true } } })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'TextModelList' }).props('models')).toEqual([saved])
    expect(wrapper.findComponent(LocalServiceDiscovery).props('models')).toHaveLength(2)
    wrapper.unmount()
  })
})
