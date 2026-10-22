import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { flushPromises, mount, shallowMount, DOMWrapper } from '@vue/test-utils'
import VariableEditor from '../../../src/components/variable/VariableEditor.vue'
import VariableManagerModal from '../../../src/components/variable/VariableManagerModal.vue'
import VariableImporter from '../../../src/components/variable/VariableImporter.vue'
import { allowConsole } from '../../utils/error-detection'

const mocks = vi.hoisted(() => ({ compact: { current: null as unknown }, warning: vi.fn() }))
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: mocks.compact.current }),
}))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ warning: mocks.warning }),
}))

vi.mock('../../../src/composables/ui/useCompactModalBack', () => ({ useCompactModalBack: vi.fn() }))

const Modal = defineComponent({ props: ['show'], emits: ['update:show'], template: '<div><slot/><slot name="footer"/></div>' })
const stubs = { NModal: Modal, AdaptiveModal: Modal }

beforeEach(() => { mocks.compact.current = ref(true); mocks.warning.mockReset().mockResolvedValue(false) })

function editor() {
  return mount(VariableEditor, { props: { show: true, variable: { name: 'project', value: 'original' }, existingNames: ['project'] }, global: { stubs } })
}

describe('mobile variable edit sessions', () => {
  it('retains the single draft across responsive changes without saving', async () => {
    const wrapper = editor()
    await wrapper.get('textarea').setValue('draft on phone')
    ;(mocks.compact.current as ReturnType<typeof ref>).value = false
    await nextTick()
    ;(mocks.compact.current as ReturnType<typeof ref>).value = true
    await nextTick()
    expect(wrapper.get('textarea').element).toHaveProperty('value', 'draft on phone')
    expect(wrapper.emitted('save')).toBeUndefined()
    wrapper.unmount()
  })

  it('guards Android-back and cancel with the same dirty check, allowing continued editing', async () => {
    const wrapper = editor()
    await wrapper.get('textarea').setValue('unsaved')
    wrapper.findComponent(Modal).vm.$emit('update:show', false)
    await flushPromises()
    expect(mocks.warning).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(wrapper.get('textarea').element).toHaveProperty('value', 'unsaved')
    mocks.warning.mockResolvedValueOnce(true)
    await wrapper.findAll('button')[0].trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })

  it('preserves the desktop immediate-close behavior and does not claim unchanged drafts are dirty', async () => {
    const wrapper = editor()
    wrapper.findComponent(Modal).vm.$emit('update:show', false)
    await flushPromises()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    ;(mocks.compact.current as ReturnType<typeof ref>).value = false
    await nextTick()
    await wrapper.get('textarea').setValue('desktop edit')
    wrapper.findComponent(Modal).vm.$emit('update:show', false)
    await flushPromises()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:show')).toEqual([[false], [false]])
    wrapper.unmount()
  })

  it('keeps a failed save visible and the draft intact, and blocks duplicate saves while busy', async () => {
    const wrapper = editor()
    await wrapper.get('textarea').setValue('keep me')
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')).toEqual([[{ name: 'project', value: 'keep me' }]])
    await wrapper.setProps({ saveError: 'Storage unavailable', saving: true })
    expect(wrapper.text()).toContain('Storage unavailable')
    expect(wrapper.get('textarea').element).toHaveProperty('value', 'keep me')
    wrapper.findComponent(Modal).vm.$emit('update:show', false)
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('update:show')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('variable management persistence boundary', () => {
  it('keeps the editor open on service failure and never rolls back saved values on parent close', async () => {
    const addVariable = vi.fn().mockImplementationOnce(() => { throw new Error('Storage unavailable') })
    const wrapper = shallowMount(VariableManagerModal, { props: { visible: true, variableManager: {
      variableManager: ref({ resolveAllVariables: () => ({}), getVariableSource: () => 'custom' }), addVariable,
    } as any } })
    const vm = wrapper.vm as any
    vm.showAddVariable()
    allowConsole(/Failed to save variable:/)
    await vm.onVariableSave({ name: 'kept', value: 'saved' })
    expect(vm.showEditor).toBe(true)
    expect(vm.editorError).toBe('Storage unavailable')
    await vm.onVariableSave({ name: 'kept', value: 'saved' })
    expect(vm.showEditor).toBe(false)
    expect(wrapper.emitted('variableChange')).toEqual([['kept', 'saved', 'add']])
    vm.handleCancel()
    expect(addVariable).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    wrapper.unmount()
  })

  it('preserves import text on resize and canceled back, then clears it only for a new mobile import', async () => {
    const wrapper = shallowMount(VariableImporter, { props: { show: true }, global: { stubs: { NModal: Modal, AdaptiveModal: Modal } } })
    const vm = wrapper.vm as any
    vm.activeMethod = 'text'
    await nextTick()
    vm.importText = 'name,value\nproject,keep me'
    await nextTick()
    ;(mocks.compact.current as ReturnType<typeof ref>).value = false
    await nextTick()
    ;(mocks.compact.current as ReturnType<typeof ref>).value = true
    await nextTick()
    vm.cancel()
    await flushPromises()
    expect(mocks.warning).toHaveBeenCalledOnce()
    expect(vm.importText).toContain('keep me')
    expect(wrapper.emitted('update:show')).toBeUndefined()
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(vm.importText).toBe('')
    wrapper.unmount()
  })
})


describe('variable import through the real modal hierarchy', () => {
  it('persists imported values and returns to the list without an unsaved confirmation', async () => {
    const values = ref<Record<string, string>>({ existing: 'retained' })
    const addVariable = vi.fn((name: string, value: string) => {
      values.value = { ...values.value, [name]: value }
    })
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount(VariableManagerModal, {
      attachTo: host,
      props: {
        visible: true,
        variableManager: {
          variableManager: ref({ resolveAllVariables: () => values.value, getVariableSource: () => 'custom' }),
          addVariable,
        } as any,
      },
      global: { stubs: { Teleport: false } },
    })
    try {
      // Keep the manager, importer, AdaptiveModal and Naive modal callbacks real.
      ;(wrapper.vm as any).showImportModal()
      await flushPromises()
      const surface = new DOMWrapper(document.body).get('.mobile-variable-importer')
      await surface.get('.n-tabs-tab[data-name="text"]').trigger('click')
      await flushPromises()
      await surface.get('textarea').setValue('name,value\nimported_project,phone value')
      const submit = surface.findAll('button').find(button => button.text() === 'Import')!
      expect(submit).toBeDefined()
      await submit.trigger('click')
      await flushPromises()
      expect(addVariable).toHaveBeenCalledExactlyOnceWith('imported_project', 'phone value')
      expect((wrapper.vm as any).showImporter).toBe(false)
      expect(mocks.warning).not.toHaveBeenCalled()
      expect(values.value).toEqual({ existing: 'retained', imported_project: 'phone value' })
      expect(wrapper.findComponent(VariableImporter).props('show')).toBe(false)
      expect(wrapper.emitted('import')?.[0][0]).toMatchObject({
        version: '1.0', variables: [{ name: 'imported_project', value: 'phone value', type: 'custom', required: false }],
      })
      expect(new DOMWrapper(document.body).get('.mobile-variable-list').text()).toContain('imported_project')
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })
})
