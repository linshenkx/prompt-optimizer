import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import FavoriteSurfaceSection from '../../../src/components/favorites/FavoriteSurfaceSection.vue'
import FavoriteAssetPanelDialog from '../../../src/components/favorites/FavoriteAssetPanelDialog.vue'

const compactViewport = ref(true)
const dirty = ref(true)
const saving = ref(false)
const confirmDiscard = vi.fn()
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: compactViewport }),
}))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ warning: confirmDiscard }),
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

const modalStub = {
  name: 'NModal', props: ['show'], emits: ['update:show'],
  template: '<div v-if="show"><slot /></div>',
}
const formStub = defineComponent({
  name: 'FavoriteEditorForm',
  setup(_, { expose }) {
    expose({ hasUnsavedChanges: dirty, saving })
    return () => h('input', { 'data-testid': 'draft', value: 'retained draft' })
  },
})

beforeEach(() => {
  compactViewport.value = true
  dirty.value = true
  saving.value = false
  confirmDiscard.mockReset()
})

describe('favorite mobile presentation boundaries', () => {
  it('keeps the same editor subtree when folding and changing presentation', async () => {
    let mounts = 0
    const draft = defineComponent({ setup() { mounts++; return () => h('input', { value: 'initial' }) } })
    const wrapper = mount(FavoriteSurfaceSection, {
      props: { title: 'Images', collapsible: true }, slots: { default: () => h(draft) },
      global: { stubs: {
        NCard: { template: '<section><header><slot name="header-extra" /></header><slot /></section>' },
        NButton: { template: '<button><slot /></button>' }, NIcon: true,
      } },
    })
    const input = wrapper.get('input')
    await wrapper.get('button').trigger('click')
    await input.setValue('unsaved value')
    await wrapper.get('button').trigger('click')
    expect(input.element.parentElement?.style.display).toBe('none')
    await wrapper.setProps({ collapsible: false })
    expect(input.element.parentElement?.style.display).toBe('contents')
    expect(wrapper.get('input').element).toBe(input.element)
    expect((input.element as HTMLInputElement).value).toBe('unsaved value')
    expect(mounts).toBe(1)
    wrapper.unmount()
  })

  it('rejects mobile dismissal for an unsaved or saving editor, while desktop keeps its existing close behavior', async () => {
    confirmDiscard.mockResolvedValue(false)
    const wrapper = mount(FavoriteAssetPanelDialog, {
      props: { show: true, mode: 'edit' },
      global: { stubs: { NModal: modalStub, FavoriteEditorForm: formStub,
        FavoritePanelShell: { template: '<div><slot /></div>' } } },
    })
    const modal = wrapper.findComponent({ name: 'NModal' })
    const draftNode = wrapper.get('[data-testid="draft"]').element
    modal.vm.$emit('update:show', false)
    await flushPromises()
    expect(confirmDiscard).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(wrapper.get('[data-testid="draft"]').element).toBe(draftNode)
    saving.value = true
    modal.vm.$emit('update:show', false)
    await flushPromises()
    expect(confirmDiscard).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:show')).toBeUndefined()
    compactViewport.value = false
    modal.vm.$emit('update:show', false)
    await flushPromises()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })

  it('closes a mobile editor only after discard is confirmed', async () => {
    confirmDiscard.mockResolvedValue(true)
    const wrapper = mount(FavoriteAssetPanelDialog, {
      props: { show: true, mode: 'create' },
      global: { stubs: { NModal: modalStub, FavoriteEditorForm: formStub,
        FavoritePanelShell: { template: '<div><slot /></div>' } } },
    })
    wrapper.findComponent({ name: 'NModal' }).vm.$emit('update:show', false)
    await flushPromises()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })
})
