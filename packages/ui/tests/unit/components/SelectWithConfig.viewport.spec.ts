import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { NSelect } from 'naive-ui'
import { afterEach, expect, it, vi } from 'vitest'
import SelectWithConfig from '../../../src/components/SelectWithConfig.vue'

const compact = ref(true)
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({ useWorkspaceLayout: () => ({ isCompact: compact }) }))
let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  compact.value = true
})

it.each([false, true])('preserves search and selection through resize with the real Naive menu (virtualScroll=%s)', async (virtualScroll) => {
  const viewport = Object.assign(new EventTarget(), { offsetTop: 0, height: 669, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const height = this.hasAttribute('data-action') ? 64 : 32
    return { top: 225, bottom: 225 + height, left: 12, right: 252, width: 240, height, x: 12, y: 225, toJSON: () => ({}) }
  })
  wrapper = mount(SelectWithConfig, {
    attachTo: document.body,
    attrs: { virtualScroll },
    props: {
      modelValue: 'preview',
      options: [{ value: 'preview', primary: 'Mobile Preview' }, { value: 'qa', primary: 'QA phone' }] as any,
      getPrimary: (option: any) => option.primary,
      getValue: (option: any) => option.value,
      showConfigAction: true,
    },
  })
  await wrapper.find('.n-base-selection').trigger('click')
  await nextTick()
  const search = wrapper.find('input')
  await search.setValue('QA')
  viewport.height = 299
  viewport.dispatchEvent(new Event('resize'))
  const select = wrapper.findComponent(NSelect)
  await vi.waitFor(() => expect(select.props('placement')).toBe('top-start'))
  expect(select.props('filterable')).toBe(true)
  expect(wrapper.find('input').element).toBe(search.element)
  expect((search.element as HTMLInputElement).value).toBe('QA')
  const menu = document.getElementById(select.props('menuProps')!.id!)!
  expect(menu.style.getPropertyValue('--n-height')).toBe('149px')
  expect(menu.style.maxHeight).toBe('213px')
  expect(menu.querySelector('[data-action]')).not.toBeNull()
  if (virtualScroll) {
    // JSDOM has no scroll layout for virtual row mounting; exercise native keyboard selection.
    expect(menu.querySelector('.n-virtual-list')).not.toBeNull()
    await search.trigger('keydown', { key: 'Enter' })
  } else {
    // Naive's follower teleports the real menu outside the component's root.
    const option = menu.querySelector<HTMLElement>('.n-base-select-option')
    expect(option?.textContent).toContain('QA phone')
    option!.click()
  }
  await nextTick()
  expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['qa'])
  expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
})
