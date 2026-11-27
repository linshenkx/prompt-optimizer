import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProviderPillSelect from '../../../src/components/ProviderPillSelect.vue'

describe('ProviderPillSelect', () => {
  const options = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'Custom API', value: 'openai-compatible' },
    { label: 'SiliconFlow', value: 'siliconflow' },
    { label: 'MiniMax', value: 'minimax' },
    { label: 'Xiaomi MiMo Token Plan', value: 'xiaomi-mimo-token-plan' },
    { label: 'Ollama', value: 'ollama' },
    { label: 'Disabled', value: 'disabled', disabled: true }
  ]

  const mountComponent = (props: Record<string, unknown>) =>
    mount(ProviderPillSelect, {
      props
    })

  it('renders provider options as selectable pills', () => {
    const wrapper = mountComponent({
      value: 'openai',
      options,
      ariaLabel: 'Provider'
    })

    const pills = wrapper.findAll('button[role="radio"]')
    expect(pills).toHaveLength(3)
    expect(pills[0].attributes('aria-checked')).toBe('true')
    expect(pills[0].classes()).toContain('provider-pill-select__pill--selected')
    expect(wrapper.find('[role="radiogroup"]').attributes('aria-label')).toBe('Provider')
  })

  it('orders common providers first, groups niche providers, and keeps custom last', async () => {
    const wrapper = mountComponent({
      value: 'openai-compatible',
      options,
      moreLabel: '更多',
      labelOverrides: {
        'openai-compatible': 'OpenAI 兼容（自定义）'
      }
    })

    const buttons = wrapper.findAll('.provider-pill-select > button')
    expect(buttons.map(button => button.text())).toEqual([
      'OpenAI',
      'Ollama',
      'OpenAI 兼容（自定义）',
      '更多'
    ])
    expect(buttons.at(2)?.attributes('aria-checked')).toBe('true')
    expect(buttons.at(2)?.classes()).toContain('provider-pill-select__pill--custom')
    expect(buttons.at(3)?.attributes('aria-expanded')).toBe('false')

    await buttons[3].trigger('click')

    expect(wrapper.findAll('.provider-pill-select > button').map(button => button.text())).toEqual([
      'OpenAI',
      'Ollama',
      'OpenAI 兼容（自定义）',
      '更多',
      'SiliconFlow',
      'MiniMax',
      'Xiaomi MiMo Token Plan',
      'Disabled'
    ])
  })

  it('places Rapid-MLX next to Ollama as a visible provider', () => {
    const wrapper = mountComponent({
      value: 'rapid-mlx',
      options: [...options, { label: 'Rapid-MLX', value: 'rapid-mlx' }]
    })
    expect(wrapper.findAll('button[role="radio"]').map(button => button.text()))
      .toEqual(['OpenAI', 'Ollama', 'Rapid-MLX', 'Custom API'])
    expect(wrapper.find('button[aria-checked="true"]').text()).toBe('Rapid-MLX')
  })

  it('emits updates only for enabled non-current options', async () => {
    const wrapper = mountComponent({
      value: 'openai',
      options
    })

    const pills = wrapper.findAll('button[role="radio"]')
    await pills[0].trigger('click')
    await pills[2].trigger('click')

    expect(wrapper.emitted('update:value')).toEqual([['openai-compatible']])
  })

  it('emits updates when selecting an expanded overflow provider', async () => {
    const wrapper = mountComponent({
      value: 'openai',
      options
    })

    await wrapper.find('.provider-pill-select__pill--more').trigger('click')
    await wrapper.findAll('.provider-pill-select__pill--overflow')[0].trigger('click')

    expect(wrapper.emitted('update:value')).toEqual([['siliconflow']])
  })
})
