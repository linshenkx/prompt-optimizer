import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { decodeTextModelSelection, encodeTextModelSelection } from '@prompt-optimizer/core'
import TextModelSelector from '../../../src/components/TextModelSelector.vue'
import { loadTextModelCatalog, getTextModelCatalog } from '../../../src/composables/model/textModelCatalog'
import type { AppServices } from '../../../src/types/services'
import type { ModelSelectOption } from '../../../src/types/select-options'

function fixture() {
  const options = ['office', 'personal'].map(id => ({
    value: id, primary: id, secondary: 'Provider',
    raw: { id, name: id, enabled: true, providerId: 'custom',
      providerMeta: { id: 'custom', supportsDynamicModels: true },
      modelId: 'model-1', modelMeta: { id: 'model-1', name: 'Model 1', providerId: 'custom', capabilities: {}, parameterDefinitions: [] },
      connectionConfig: { baseURL: 'https://' + id + '.example/v1', apiKey: 'test-key' },
    },
  })) as ModelSelectOption[]
  const services = {
    textAdapterRegistry: { getStaticModels: vi.fn(() => []) },
    llmService: { fetchModelList: vi.fn(async () => Array.from({ length: 6 }, (_, i) => ({ value: 'model-' + (i + 1), label: 'Model ' + (i + 1) }))) },
    preferenceService: { get: vi.fn(async () => ['model-4']), set: vi.fn(async () => {}) },
    modelManager: { updateModel: vi.fn() },
  } as unknown as AppServices
  return { options, services }
}
const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = '' })
async function open(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.text-model-selector').trigger('click')
  await flushPromises()
}
const click = async (element: Element | null) => { (element as HTMLElement).click(); await flushPromises() }

describe('shared text model selector', () => {
  it('opens the clicked configuration, not the current selection, without changing either model', async () => {
    const { options, services } = fixture()
    const openModelManager = vi.fn()
    const wrapper = mount(TextModelSelector, { attachTo: document.body, props: { options, modelValue: 'office' },
      global: { provide: { services: ref(services), openModelManager } } })
    mounted.push(wrapper)
    await open(wrapper)
    await click(document.querySelector('[data-config-id="personal"] .text-model-menu__configure'))
    expect(openModelManager).toHaveBeenCalledWith('text', 'personal')
    expect(wrapper.find('.text-model-selector').attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(services.modelManager.updateModel).not.toHaveBeenCalled()
  })
  it('limits each group to three, ranks current/recent choices, and searches models beyond the first three', async () => {
    const { options, services } = fixture()
    const wrapper = mount(TextModelSelector, { attachTo: document.body, props: { options, modelValue: 'office' },
      global: { provide: { services: ref(services) } } })
    mounted.push(wrapper)
    await open(wrapper)
    const group = document.querySelector('[data-config-id="office"]')!
    expect(group.querySelectorAll('[data-model-choice]')).toHaveLength(3)
    expect(group.querySelectorAll('[data-model-choice]')[1].textContent).toContain('Model 4')
    await click(group.querySelector('.text-model-menu__more'))
    expect(document.querySelectorAll('[data-config-id]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-model-choice]')).toHaveLength(6)
    const search = document.querySelector('.text-model-menu input') as HTMLInputElement
    search.value = 'Model 6'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(document.querySelectorAll('[data-model-choice]')).toHaveLength(1)
    await click(document.querySelector('[data-model-choice]'))
    const emitted = wrapper.emitted('update:modelValue')![0][0] as string
    expect(decodeTextModelSelection(emitted)).toEqual({ configId: 'office', modelId: 'model-6' })
    expect(services.modelManager.updateModel).not.toHaveBeenCalled()
    expect(services.preferenceService.set).toHaveBeenCalledWith('model-selector:recent:v1:office', ['model-6', 'model-4'])
    await open(wrapper)
    await click(document.querySelector('[data-config-id="office"] [data-model-choice]'))
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBe('office')
  })

  it('keeps two selectors independent, preserves explicit selection across remounts and supports keyboard dismissal', async () => {
    const { options, services } = fixture()
    const a = ref('office')
    const b = ref('office')
    const Parent = defineComponent({ setup: () => () => h('div', [
      h(TextModelSelector, { options, modelValue: a.value, 'onUpdate:modelValue': (value: string) => { a.value = value } }),
      h(TextModelSelector, { options, modelValue: b.value, 'onUpdate:modelValue': (value: string) => { b.value = value } }),
    ]) })
    const wrapper = mount(Parent, { attachTo: document.body, global: { provide: { services: ref(services) } } })
    mounted.push(wrapper)
    await open(wrapper)
    await click(document.querySelectorAll('[data-config-id="office"] [data-model-choice]')[1])
    expect(decodeTextModelSelection(a.value)?.modelId).toBe('model-4')
    expect(b.value).toBe('office')
    await wrapper.findAll('.text-model-selector')[1].trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    document.querySelector('.text-model-menu')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.findAll('.text-model-selector')[1].attributes('aria-expanded')).toBe('false')
    const restored = mount(TextModelSelector, { props: { options, modelValue: encodeTextModelSelection('office', 'model-4') },
      global: { provide: { services: ref(services) } } })
    mounted.push(restored)
    expect(restored.text()).toContain('Model 4')
  })

  it('deduplicates discovery and ignores a stale list after connection settings change', async () => {
    const { options, services } = fixture()
    let finish!: (value: { value: string; label: string }[]) => void
    vi.mocked(services.llmService.fetchModelList).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const old = loadTextModelCatalog(services, options[0].raw)
    const same = loadTextModelCatalog(services, options[0].raw)
    await flushPromises()
    expect(services.llmService.fetchModelList).toHaveBeenCalledTimes(1)
    await loadTextModelCatalog(services, { ...options[0].raw, connectionConfig: { baseURL: 'https://new.example/v1' } })
    finish([{ value: 'stale', label: 'Stale' }])
    await Promise.all([old, same])
    expect(getTextModelCatalog(services).entries.office.models.some(model => model.value === 'stale')).toBe(false)
  })

  it('keeps the saved model selectable when discovery fails; disabled controls do not open', async () => {
    const { options, services } = fixture()
    vi.mocked(services.llmService.fetchModelList).mockRejectedValue(new Error('offline'))
    const wrapper = mount(TextModelSelector, { attachTo: document.body, props: { options, modelValue: 'office', disabled: true },
      global: { provide: { services: ref(services) } } })
    mounted.push(wrapper)
    await open(wrapper)
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false')
    await wrapper.setProps({ disabled: false })
    await open(wrapper)
    expect(document.querySelector('[data-config-id="office"] [data-model-choice]')?.textContent).toContain('Model 1')
    expect(document.querySelector('[data-config-id="office"]')?.textContent).toContain('Could not load models')
  })
})
