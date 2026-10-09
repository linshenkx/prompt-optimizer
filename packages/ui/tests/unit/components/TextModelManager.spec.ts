import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import TextModelManager from '../../../src/components/TextModelManager.vue'

const { manager } = vi.hoisted(() => ({ manager: { current: null as any } }))
vi.mock('../../../src/composables/model/useTextModelManager', () => ({ useTextModelManager: () => manager.current }))
vi.mock('naive-ui', async (original) => ({
  ...await original<typeof import('naive-ui')>(), useDialog: () => ({}),
}))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({ useConfirmDialog: () => ({ warning: async () => true }) }))

describe('TextModelManager deletion updates', () => {
  it.each([false, true])('notifies consumers after deleting a model (remaining models: %s)', async (hasRemaining) => {
    const models = ref([{ id: 'delete-me' }, ...(hasRemaining ? [{ id: 'remaining' }] : [])])
    manager.current = {
      models, testingConnections: ref({}), isDefaultModel: () => false,
      loadProviders: vi.fn(), loadModels: vi.fn(),
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
