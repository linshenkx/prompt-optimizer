import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import NetworkSettingsModal from '../../../src/components/NetworkSettingsModal.vue'
import type { ModelNetworkState } from '../../../src/types/model-network'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const confirm = vi.hoisted(() => vi.fn().mockResolvedValue(true))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({ useConfirmDialog: () => ({ warning: confirm }) }))

const defaultState = (): ModelNetworkState => ({
  saved: { mode: 'system', proxyUrl: '', bypassRules: [] },
  active: { mode: 'system', proxyUrl: '', bypassRules: [] },
  restartRequired: false, busy: false, lastConnection: null,
})
const originalApi = window.electronAPI
afterEach(() => { window.electronAPI = originalApi; vi.clearAllMocks() })

const mountDialog = (initial = defaultState()) => {
  const getSettings = vi.fn().mockResolvedValue(initial)
  const saveSettings = vi.fn(async settings => ({ ...initial, saved: structuredClone(settings), restartRequired: true }))
  const restart = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { network: { getSettings, saveSettings, restart } } as unknown as typeof window.electronAPI
  const wrapper = mount(NetworkSettingsModal, {
    props: { show: true },
  })
  return { wrapper, getSettings, saveSettings, restart }
}

const field = (wrapper: VueWrapper, id: string) => {
  const container = wrapper.get(`[data-testid="${id}"]`)
  return container.element.matches('input,textarea') ? container : container.get('input,textarea')
}

describe('desktop model network settings', () => {
  it('starts with no changes, shows manual fields conditionally and retains them when switching modes', async () => {
    const { wrapper } = mountDialog()
    await flushPromises()
    expect(wrapper.get('[data-testid="network-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="network-proxy-url"]').exists()).toBe(false)
    wrapper.findComponent('[data-testid="network-mode"]').vm.$emit('update:value', 'manual')
    await nextTick()
    await field(wrapper, 'network-proxy-url').setValue('http://localhost:7890')
    await wrapper.get('.n-collapse-item__header-main').trigger('click')
    await flushPromises()
    await field(wrapper, 'network-bypass-rules').setValue('llm.company.com\n*.company.com')
    wrapper.findComponent('[data-testid="network-mode"]').vm.$emit('update:value', 'direct')
    await nextTick()
    expect(wrapper.find('[data-testid="network-proxy-url"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="network-bypass-rules"]').exists()).toBe(false)
    wrapper.findComponent('[data-testid="network-mode"]').vm.$emit('update:value', 'manual')
    await nextTick()
    expect((field(wrapper, 'network-proxy-url').element as HTMLInputElement).value).toBe('http://localhost:7890')
    await wrapper.get('.n-collapse-item__header-main').trigger('click')
    await flushPromises()
    expect((field(wrapper, 'network-bypass-rules').element as HTMLTextAreaElement).value).toContain('*.company.com')
    wrapper.unmount()
  })

  it('saves through the desktop bridge while the current mode stays unchanged, and cancel never saves', async () => {
    const { wrapper, saveSettings } = mountDialog()
    await flushPromises()
    wrapper.findComponent('[data-testid="network-mode"]').vm.$emit('update:value', 'manual')
    await nextTick()
    await field(wrapper, 'network-proxy-url').setValue(' http://localhost:7890 ')
    await wrapper.get('.n-collapse-item__header-main').trigger('click')
    await flushPromises()
    await field(wrapper, 'network-bypass-rules').setValue('llm.company.com\n\n*.company.com')
    await wrapper.get('[data-testid="network-save"]').trigger('click')
    await flushPromises()
    expect(saveSettings).toHaveBeenCalledWith({ mode: 'manual', proxyUrl: 'http://localhost:7890', bypassRules: ['llm.company.com', '*.company.com'] })
    expect(wrapper.text()).toContain('networkSettings.pendingRestart')
    expect(wrapper.get('[data-testid="network-active-mode"]').text()).toContain('networkSettings.activeMode')
    expect(wrapper.find('[data-testid="network-restart"]').exists()).toBe(true)
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    await flushPromises()
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(saveSettings).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('shows localized validation failures and keeps unsaved edits', async () => {
    const { wrapper, saveSettings } = mountDialog()
    saveSettings.mockRejectedValueOnce({ message: 'invalid', code: 'networkSettings.errors.invalidProxy' })
    await flushPromises()
    wrapper.findComponent('[data-testid="network-mode"]').vm.$emit('update:value', 'manual')
    await nextTick()
    await field(wrapper, 'network-proxy-url').setValue('socks5://localhost:7890')
    await wrapper.get('[data-testid="network-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('networkSettings.errors.invalidProxy')
    expect((field(wrapper, 'network-proxy-url').element as HTMLInputElement).value).toBe('socks5://localhost:7890')
    expect(wrapper.find('[data-testid="network-restart"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('blocks restart while a model call is active and requires a confirmation when idle', async () => {
    const initial = defaultState()
    initial.saved.mode = 'direct'
    initial.restartRequired = true
    initial.busy = true
    const { wrapper, getSettings, restart } = mountDialog(initial)
    await flushPromises()
    await wrapper.get('[data-testid="network-restart"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('networkSettings.errors.busy')
    expect(restart).not.toHaveBeenCalled()
    getSettings.mockResolvedValue({ ...initial, busy: false })
    confirm.mockResolvedValueOnce(false)
    await wrapper.get('[data-testid="network-restart"]').trigger('click')
    await flushPromises()
    expect(restart).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="network-restart"]').trigger('click')
    await flushPromises()
    expect(restart).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('closes safely without a desktop bridge', async () => {
    const { wrapper, getSettings } = mountDialog()
    await flushPromises()
    await wrapper.setProps({ show: false })
    window.electronAPI = undefined
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(getSettings).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
