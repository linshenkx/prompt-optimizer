import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import type { Template } from '@prompt-optimizer/core'
import TemplateManager from '../../../src/components/TemplateManager.vue'
import { mobileManagementStubs } from './mobile-management-stubs'

const compact = ref(true)
const confirm = vi.fn().mockResolvedValue(true)
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: compact }),
}))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ warning: confirm }),
}))

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  id: 'builtin-system', name: 'Careful poet', isBuiltin: true,
  content: [{ role: 'system', content: 'Original system instruction' }, { role: 'user', content: '{{originalPrompt}}' }],
  metadata: { version: '1.0', lastModified: 100, templateType: 'optimize', description: 'Poetry helper' },
  ...overrides,
})
const mounted: ReturnType<typeof mount>[] = []
const mountTemplates = async (templates = [makeTemplate()], templateType: 'optimize' | 'multiimageOptimize' = 'optimize') => {
  const manager = {
    listTemplates: vi.fn().mockResolvedValue(templates),
    saveTemplate: vi.fn().mockResolvedValue(undefined),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
  }
  const wrapper = mount(TemplateManager, {
    props: { show: true, templateType, basicSubMode: 'system' },
    global: { plugins: [createPinia()], stubs: mobileManagementStubs, provide: { services: ref({ templateManager: manager }) } },
  })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, manager }
}
beforeEach(() => {
  compact.value = true
  confirm.mockReset().mockResolvedValue(true)
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks() })

describe('TemplateManager mobile flow', () => {
  it('opens the body without selecting and applies only the explicit use action', async () => {
    const template = makeTemplate()
    const { wrapper } = await mountTemplates([template])
    await wrapper.get('.mobile-template-open').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.get('[data-testid="mobile-template-editor"]').text()).toContain('Original system instruction')
    await wrapper.get('.mobile-template-detail-actions button:last-child').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[template, 'optimize', 'system-optimize']])
    expect(wrapper.find('[data-testid="mobile-template-editor"]').exists()).toBe(false)
  })

  it('offers multiimage directly and searches within message content', async () => {
    const template = makeTemplate({ metadata: { version: '1', lastModified: 1, templateType: 'multiimageOptimize' } })
    const { wrapper } = await mountTemplates([template], 'multiimageOptimize')
    const options = wrapper.get('[data-testid="mobile-template-list"] select').findAll('option')
    expect(options.some(option => option.attributes('value') === 'image-multiimage-optimize')).toBe(true)
    await wrapper.get('.mobile-template-search input').setValue('Original system')
    expect(wrapper.findAll('.mobile-template-open')).toHaveLength(1)
    await wrapper.get('.mobile-template-open').trigger('click')
    await wrapper.get('.mobile-template-detail-actions button:last-child').trigger('click')
    expect(wrapper.emitted('select')?.[0]?.slice(1)).toEqual(['multiimageOptimize', 'image-multiimage-optimize'])
  })

  it('isolates copied messages, retains the same draft across resize, and guards abandoning it', async () => {
    const template = makeTemplate()
    const { wrapper } = await mountTemplates([template])
    await wrapper.get('[data-action="copy"]').trigger('click')
    await wrapper.get('.mobile-template-message textarea').setValue('Unsaved mobile copy')
    expect((template.content as Array<{ content: string }>)[0].content).toBe('Original system instruction')
    compact.value = false
    await nextTick()
    expect(wrapper.findAll('textarea').some(input => (input.element as HTMLTextAreaElement).value === 'Unsaved mobile copy')).toBe(true)
    compact.value = true
    await nextTick()
    expect((wrapper.get('.mobile-template-message textarea').element as HTMLTextAreaElement).value).toBe('Unsaved mobile copy')
    confirm.mockResolvedValueOnce(false)
    const cancel = () => wrapper.findAll('.template-editor-modal footer button').find(button => button.text() === 'Cancel')!
    await cancel().trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="mobile-template-editor"]').exists()).toBe(true)
    await cancel().trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="mobile-template-editor"]').exists()).toBe(false)
  })

  it('keeps a failed save open with its draft and prevents a duplicate in-flight save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper, manager } = await mountTemplates()
    await wrapper.get('[data-action="copy"]').trigger('click')
    await wrapper.get('.mobile-template-message textarea').setValue('Retained on failure')
    let rejectSave!: (error: Error) => void
    manager.saveTemplate.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject }))
    const save = wrapper.findAll('.template-editor-modal footer button').find(button => button.text() === 'Add')!
    await save.trigger('click')
    await save.trigger('click')
    expect(manager.saveTemplate).toHaveBeenCalledTimes(1)
    rejectSave(new Error('storage unavailable'))
    await flushPromises()
    expect((wrapper.get('.mobile-template-message textarea').element as HTMLTextAreaElement).value).toBe('Retained on failure')
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await flushPromises()
    expect(manager.saveTemplate).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="mobile-template-editor"]').exists()).toBe(false)
  })

  it('opens only one discard confirmation for repeated close requests', async () => {
    const { wrapper } = await mountTemplates()
    await wrapper.get('[data-action="copy"]').trigger('click')
    await wrapper.get('.mobile-template-message textarea').setValue('Keep this draft')
    let resolveConfirmation!: (confirmed: boolean) => void
    confirm.mockImplementationOnce(() => new Promise<boolean>(resolve => { resolveConfirmation = resolve }))
    const cancel = () => wrapper.findAll('.template-editor-modal footer button').find(button => button.text() === 'Cancel')!
    await cancel().trigger('click')
    await cancel().trigger('click')
    await cancel().trigger('click')
    expect(confirm).toHaveBeenCalledTimes(1)
    resolveConfirmation(false)
    await flushPromises()
    expect((wrapper.get('.mobile-template-message textarea').element as HTMLTextAreaElement).value).toBe('Keep this draft')
    await cancel().trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="mobile-template-editor"]').exists()).toBe(false)
  })

  it('does not let a late discard confirmation clear a replacement edit session', async () => {
    const { wrapper } = await mountTemplates()
    await wrapper.get('[data-action="copy"]').trigger('click')
    await wrapper.get('.mobile-template-message textarea').setValue('Old draft')
    let resolveConfirmation!: (confirmed: boolean) => void
    confirm.mockImplementationOnce(() => new Promise<boolean>(resolve => { resolveConfirmation = resolve }))
    const cancel = () => wrapper.findAll('.template-editor-modal footer button').find(button => button.text() === 'Cancel')!
    await cancel().trigger('click')

    // Model a new edit session arriving while the old asynchronous dialog settles.
    // The list event is the controller's public entry point for opening a copy.
    wrapper.getComponent({ name: 'MobileTemplateList' }).vm.$emit('copy', makeTemplate({ id: 'second-template', name: 'Second template' }))
    await nextTick()
    await wrapper.get('.mobile-template-message textarea').setValue('New draft must survive')
    resolveConfirmation(true)
    await flushPromises()
    expect((wrapper.get('.mobile-template-message textarea').element as HTMLTextAreaElement).value).toBe('New draft must survive')
    expect(wrapper.findAll('input').some(input => (input.element as HTMLInputElement).value === 'Second template - Copy')).toBe(true)
    await cancel().trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="mobile-template-editor"]').exists()).toBe(false)
  })

  it('preserves desktop card click selection without opening a mobile detail', async () => {
    compact.value = false
    const template = makeTemplate()
    const { wrapper } = await mountTemplates([template])
    await wrapper.get('article').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[template, 'optimize', 'system-optimize']])
    expect(wrapper.find('[data-testid="mobile-template-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-template-editor"]').exists()).toBe(false)
  })
})
