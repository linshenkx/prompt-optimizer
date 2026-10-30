import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { NRadioGroup } from 'naive-ui'
import LocalProviderHelp from '../../../src/components/LocalProviderHelp.vue'

const copyText = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../../../src/composables/ui/useClipboard', () => ({ useClipboard: () => ({ copyText }) }))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
afterEach(() => { vi.restoreAllMocks(); copyText.mockClear() })
const render = (providerId: string, serviceKind?: unknown) => mount(LocalProviderHelp, {
  props: { providerId, serviceKind },
})

describe('provider connection help', () => {
  it.each([['Win32', 'windows'], ['MacIntel', 'macos'], ['Linux x86_64', 'linux']])('defaults to the current system %s', (platform, expected) => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)
    const wrapper = render('magpie')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.getComponent(NRadioGroup).props('value')).toBe(expected)
    expect(copyText).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('switches and copies literal commands without executing them', async () => {
    const wrapper = render('magpie')
    for (const system of ['windows', 'macos', 'linux']) {
      wrapper.getComponent(NRadioGroup).vm.$emit('update:value', system)
      await flushPromises()
      const expected = system === 'windows'
        ? String.raw`& "$env:LOCALAPPDATA\Programs\Magpie\magpie-cli.exe" gateway-key add "Prompt Optimizer"`
        : 'magpie gateway-key add "Prompt Optimizer"'
      expect(wrapper.get('pre').text()).toBe(expected)
      await wrapper.get('button').trigger('click')
      expect(copyText).toHaveBeenLastCalledWith(expected)
    }
    expect(wrapper.text()).toContain('creates a new gateway key')
    expect(wrapper.text()).toContain('does not require enabling LAN sharing')
    wrapper.unmount()
  })

  it('explains Ollama key and origin configuration without a key-creation command', () => {
    const wrapper = render('ollama')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.text()).toContain('leave it blank')
    expect(wrapper.text()).toContain('OLLAMA_ORIGINS')
    expect(wrapper.text()).toContain('restart Ollama')
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(wrapper.get('a').attributes('href')).toContain('docs.ollama.com/faq')
    wrapper.unmount()
  })

  it('does not show local gateway instructions for other providers', () => {
    const wrapper = render('openai-compatible')
    expect(wrapper.find('details').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['lmstudio', 'cc-switch'])('hides paused %s help', serviceKind => {
    const wrapper = render('openai-compatible', serviceKind)
    expect(wrapper.find('details').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['cliproxyapi', 'litellm', 'llamacpp'])('uses explicit discovery identity for %s help', serviceKind => {
    const wrapper = render('openai-compatible', serviceKind)
    expect(wrapper.get('details').attributes('data-testid')).toBe(`${serviceKind}-connection-help`)
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.text()).not.toContain('modelManager.localProviderHelp.')
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(wrapper.get('a').attributes('href')).toMatch(/^https:\/\//)
    wrapper.unmount()
  })

  it('hides paused CC Switch help on Anthropic and other providers', async () => {
    const wrapper = render('anthropic', 'cc-switch')
    expect(wrapper.find('details').exists()).toBe(false)
    await wrapper.setProps({ providerId: 'openai' })
    expect(wrapper.find('details').exists()).toBe(false)
    await wrapper.setProps({ providerId: 'openai-compatible', serviceKind: 'unknown' })
    expect(wrapper.find('details').exists()).toBe(false)
    await wrapper.setProps({ serviceKind: 'toString' })
    expect(wrapper.find('details').exists()).toBe(false)
    wrapper.unmount()
  })
})
