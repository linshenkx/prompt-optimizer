import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => {
        const messages: Record<string, string> = {
          'evaluation.button': 'Evaluate',
          'evaluation.type.result': 'Evaluate result',
          'evaluation.type.compare': 'Evaluate comparison',
        }
        return messages[key] ?? key
      },
    }),
  }
})

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: `
      <button
        class="n-button"
        :disabled="disabled"
        :data-loading="loading ? 'true' : 'false'"
      >
        <slot name="icon" />
        <slot />
      </button>
    `,
    props: ['disabled', 'loading', 'quaternary', 'size'],
  },
  NDropdown: {
    name: 'NDropdown',
    template: `
      <div class="n-dropdown">
        <slot />
        <button
          v-for="option in selectableOptions"
          :key="option.key"
          class="n-dropdown-option"
          :data-key="option.key"
          type="button"
          :disabled="option.disabled"
          @click="$emit('select', option.key)"
        >
          {{ option.label }}
        </button>
      </div>
    `,
    props: ['options', 'trigger'],
    emits: ['select'],
    computed: {
      selectableOptions() {
        return (this.options || []).filter((option: any) => !option.type)
      },
    },
  },
  NIcon: {
    name: 'NIcon',
    template: '<i class="n-icon"><slot /></i>',
  },
}))

import EvaluateButton from '../../../src/components/evaluation/EvaluateButton.vue'

const mountButton = (props: Partial<InstanceType<typeof EvaluateButton>['$props']> = {}) =>
  mount(EvaluateButton, {
    props: {
      hasResult: false,
      hasCompareResult: false,
      isEvaluating: false,
      ...props,
    },
  })

describe('EvaluateButton', () => {
  it('disables the entry when no result can be evaluated', () => {
    const wrapper = mountButton()

    expect(wrapper.find('.n-button').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.n-dropdown-option')).toHaveLength(0)
    expect(wrapper.text()).toContain('Evaluate')
  })

  it('emits result evaluation when a result is available', async () => {
    const wrapper = mountButton({ hasResult: true })

    expect(wrapper.find('.n-button').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.n-dropdown-option[data-key="result"]').text()).toBe('Evaluate result')

    await wrapper.find('.n-dropdown-option[data-key="result"]').trigger('click')

    expect(wrapper.emitted('evaluate')).toEqual([['result']])
  })

  it('offers comparison evaluation only when both results are available', async () => {
    const wrapper = mountButton({
      hasResult: true,
      hasCompareResult: true,
    })

    expect(wrapper.findAll('.n-dropdown-option').map((option) => option.text())).toEqual([
      'Evaluate result',
      'Evaluate comparison',
    ])

    await wrapper.find('.n-dropdown-option[data-key="compare"]').trigger('click')

    expect(wrapper.emitted('evaluate')).toEqual([['compare']])
  })

  it('keeps the button disabled while evaluation is running', () => {
    const wrapper = mountButton({
      hasResult: true,
      isEvaluating: true,
    })

    expect(wrapper.find('.n-button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.n-button').attributes('data-loading')).toBe('true')
  })
})
