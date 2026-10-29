import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { NPopover } from 'naive-ui'
import ModelSelector from '../../../src/components/ModelSelector.vue'
import ModelIdSelector from '../../../src/components/ModelIdSelector.vue'
import ImageModelSelector from '../../../src/components/ImageModelSelector.vue'
import type { ImageModelConfig } from '@prompt-optimizer/core'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })
const click = async (element: Element | null) => { (element as HTMLElement).click(); await flushPromises() }

describe('shared model selection surface', () => {
  it('positions the shared menu above the mobile keyboard without changing the selection', async () => {
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { offsetTop: 0, height: 299, scale: 1 }))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 225, bottom: 257, height: 32 } as DOMRect)
    const wrapper = mount(ModelSelector, { attachTo: document.body, props: {
      modelValue: 'one', scopeText: 'Saved on confirmation',
      groups: [{ value: 'group', label: 'Provider', choices: [{ value: 'one', label: 'One' }] }],
    } })
    mounted.push(wrapper)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(NPopover).props('placement')).toBe('top-start')
    expect(Number.parseInt((document.querySelector('.text-model-menu') as HTMLElement).style.getPropertyValue('--selector-list-height'))).toBeLessThanOrEqual(213)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
  it('supports explicit custom IDs and clearing a draft without saving configuration', async () => {
    const wrapper = mount(ModelIdSelector, { attachTo: document.body, props: {
      value: 'retained-custom', options: [{ value: 'known', label: 'Known model' }], groupLabel: 'Provider',
    } })
    mounted.push(wrapper)
    expect(wrapper.text()).toContain('retained-custom')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    const search = document.querySelector('.text-model-menu input') as HTMLInputElement
    search.value = 'brand-new/model'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await click(document.querySelector('[data-model-choice]'))
    expect(wrapper.emitted('update:value')).toEqual([['brand-new/model']])
    expect(wrapper.findComponent(ModelSelector).emitted('update:show')?.at(-1)).toEqual([false])
    expect(wrapper.props('value')).toBe('retained-custom')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    await click(document.querySelector('.text-model-menu__footer button'))
    expect(wrapper.emitted('update:value')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('config')).toBeUndefined()
  })

  it('keeps disabled models out of keyboard navigation', async () => {
    const wrapper = mount(ModelSelector, { attachTo: document.body, props: {
      groups: [{ value: 'group', label: 'Group', choices: [
        { value: 'disabled', label: 'Unavailable', disabled: true }, { value: 'enabled', label: 'Available' },
      ] }],
    } })
    mounted.push(wrapper)
    await wrapper.find('button').trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    document.querySelector('.text-model-menu')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement?.textContent).toContain('Available')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps image selection local, retains the supplied capability filter, and opens the exact shared configuration separately', async () => {
    const options = ['one', 'two'].map(id => ({
      value: id, primary: id, secondary: 'Provider',
      raw: { id, name: id, modelId: id + '-model', model: { name: id + ' model' } } as ImageModelConfig,
    }))
    const before = JSON.stringify(options)
    const a = ref('one'), b = ref('one')
    const openModelManager = vi.fn()
    const wrapper = mount(defineComponent({ setup: () => () => h('div', [
      h(ImageModelSelector, { options, modelValue: a.value, 'onUpdate:modelValue': value => { a.value = value } }),
      h(ImageModelSelector, { options: options.slice(0, 1), modelValue: b.value, 'onUpdate:modelValue': value => { b.value = value } }),
    ]) }), { attachTo: document.body, global: { provide: { openModelManager } } })
    mounted.push(wrapper)
    await wrapper.findAll('.text-model-selector')[0].trigger('click')
    await flushPromises()
    await click(document.querySelector('[data-config-id="two"] [data-model-choice]'))
    expect(a.value).toBe('two')
    expect(b.value).toBe('one')
    expect(JSON.stringify(options)).toBe(before)
    await wrapper.findAll('.text-model-selector')[1].trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-config-id="two"]')).toBeNull()
    await click(document.querySelector('[data-config-id="one"] .text-model-menu__configure'))
    expect(openModelManager).toHaveBeenCalledWith('image', 'one')
    expect(b.value).toBe('one')
  })
})
