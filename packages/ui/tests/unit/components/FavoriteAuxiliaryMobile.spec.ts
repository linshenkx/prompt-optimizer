import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import TagManager from '../../../src/components/TagManager.vue'
import CategoryManager from '../../../src/components/CategoryManager.vue'

const compact = ref(true)
const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: compact }),
}))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => toast }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

const stubs = {
  NModal: {
    name: 'NModal', props: ['show', 'title'], emits: ['positive-click', 'update:show'],
    template: '<section v-if="show" :data-title="title"><slot /><slot name="action" /><button class="confirm" @click="$emit(\'positive-click\')">confirm</button></section>',
  },
  NSpace: { template: '<div><slot /></div>' },
  NButton: { template: '<button><slot name="icon" /><slot /></button>' },
  NIcon: { template: '<i><slot /></i>' },
  NText: { template: '<span><slot /></span>' },
  NSpin: { template: '<div><slot /></div>' },
  NEmpty: true,
  NDataTable: { name: 'NDataTable', props: ['columns', 'data'], template: '<div class="desktop-table" />' },
  NDropdown: {
    name: 'NDropdown', props: ['options', 'trigger'], emits: ['select'],
    template: '<div class="dropdown"><slot /><button v-for="option in options" :key="option.key" :data-action="option.key" @click="$emit(\'select\', option.key)">{{ option.label }}</button></div>',
  },
  NInput: {
    props: ['value', 'placeholder'], emits: ['update:value'],
    template: '<input :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  NSelect: {
    props: ['value', 'options'], emits: ['update:value'],
    template: '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
  },
  NForm: defineComponent({
    props: ['labelPlacement', 'labelWidth'],
    setup(_, { slots, expose }) { expose({ validate: async () => {} }); return () => h('form', slots.default?.()) },
  }),
  NFormItem: { template: '<div><slot /></div>' },
  NTreeSelect: true,
  NColorPicker: true,
  NTree: defineComponent({
    props: ['data', 'renderLabel', 'renderSuffix'],
    setup(props) {
      return () => h('div', { class: 'tree' }, props.data.map((option: unknown) =>
        h('div', [props.renderLabel({ option }), props.renderSuffix({ option })])))
    },
  }),
}

// Naive registers components by their unprefixed names (for example Dropdown).
const componentStubs = Object.fromEntries(Object.entries(stubs).flatMap(([name, stub]) => [
  [name, stub], [name.slice(1), stub],
]))

beforeEach(() => {
  compact.value = true
  vi.clearAllMocks()
})

const tags = () => ({
  getAllTags: vi.fn(async () => [{ tag: 'Alpha', count: 2 }, { tag: 'Beta', count: 1 }]),
  addTag: vi.fn(async () => {}),
  renameTag: vi.fn(async () => {}),
  mergeTags: vi.fn(async () => {}),
  deleteTag: vi.fn(async () => {}),
})

describe('favorite auxiliary mobile workflows', () => {
  it('retains a tag rename draft, search, and desktop table across presentation changes without reloading', async () => {
    const manager = tags()
    const wrapper = mount(TagManager, { props: { show: true }, global: { stubs: componentStubs, provide: { services: ref({ favoriteManager: manager }) } } })
    await flushPromises()
    const table = wrapper.get('.desktop-table').element
    expect(wrapper.get('.desktop-table').attributes('style')).toContain('display: none')
    await wrapper.get('input[placeholder="favorites.manager.tagManager.searchPlaceholder"]').setValue('Alpha')
    await wrapper.get('.tag-manager__row-main').trigger('click')
    const input = wrapper.get('input[placeholder="favorites.manager.tagManager.renameDialog.newNamePlaceholder"]')
    await input.setValue('Edited Alpha')
    compact.value = false
    await flushPromises()
    expect(wrapper.get('.desktop-table').element).toBe(table)
    expect(wrapper.get('input[placeholder="favorites.manager.tagManager.renameDialog.newNamePlaceholder"]').element).toBe(input.element)
    compact.value = true
    await flushPromises()
    expect(manager.getAllTags).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.tag-manager__row')).toHaveLength(1)
    await wrapper.get('[data-title="favorites.manager.tagManager.renameDialog.title"] .confirm').trigger('click')
    await flushPromises()
    expect(manager.renameTag).toHaveBeenCalledWith('Alpha', 'Edited Alpha')
    expect(wrapper.emitted('updated')).toHaveLength(1)
    wrapper.unmount()
  })

  it('uses the existing merge validation and requires confirmation before deleting a mobile tag', async () => {
    const manager = tags()
    const wrapper = mount(TagManager, { props: { show: true }, global: { stubs: componentStubs, provide: { services: ref({ favoriteManager: manager }) } } })
    await flushPromises()
    await wrapper.findAll('.tag-manager__row')[0].get('[data-action="merge"]').trigger('click')
    const dialog = wrapper.get('[data-title="favorites.manager.tagManager.mergeDialog.title"]')
    await dialog.get('.confirm').trigger('click')
    await flushPromises()
    expect(manager.mergeTags).not.toHaveBeenCalled()
    await dialog.get('select').setValue('Beta')
    await dialog.get('.confirm').trigger('click')
    await flushPromises()
    expect(manager.mergeTags).toHaveBeenCalledWith(['Alpha'], 'Beta')
    await wrapper.findAll('.tag-manager__row')[0].get('[data-action="delete"]').trigger('click')
    await flushPromises()
    expect(manager.deleteTag).not.toHaveBeenCalled()
    wrapper.getComponent('[data-title="favorites.manager.tagManager.delete"]').vm.$emit('update:show', false)
    await flushPromises()
    expect(manager.deleteTag).not.toHaveBeenCalled()
    await wrapper.findAll('.tag-manager__row')[0].get('[data-action="delete"]').trigger('click')
    await wrapper.get('[data-title="favorites.manager.tagManager.delete"] .confirm').trigger('click')
    await flushPromises()
    expect(manager.deleteTag).toHaveBeenCalledWith('Alpha')
    wrapper.unmount()
  })

  it('keeps category editing and expansion on the same controller, with touch menus only on compact screens', async () => {
    const manager = {
      getCategories: vi.fn(async () => [{ id: 'c1', name: 'Category', description: '', sortOrder: 1 }]),
      updateCategory: vi.fn(async () => {}),
    }
    const wrapper = mount(CategoryManager, { global: { stubs: componentStubs, provide: { services: ref({ favoriteManager: manager }) } } })
    await flushPromises()
    const loads = manager.getCategories.mock.calls.length
    expect(wrapper.getComponent({ name: 'NDropdown' }).props('trigger')).toBe('click')
    await wrapper.get('[data-action="edit"]').trigger('click')
    const name = wrapper.get('input[placeholder="favorites.categoryManager.categoryNamePlaceholder"]')
    await name.setValue('Changed category')
    compact.value = false
    await flushPromises()
    expect(wrapper.getComponent({ name: 'NDropdown' }).props('trigger')).toBe('hover')
    expect(wrapper.get('input[placeholder="favorites.categoryManager.categoryNamePlaceholder"]').element).toBe(name.element)
    expect(manager.getCategories).toHaveBeenCalledTimes(loads)
    await wrapper.findAll('button').find(button => button.text() === 'common.save')!.trigger('click')
    await flushPromises()
    expect(manager.updateCategory).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Changed category' }))
    expect(wrapper.emitted('category-updated')).toHaveLength(1)
    wrapper.unmount()
  })
})
