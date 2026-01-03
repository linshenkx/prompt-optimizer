import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OptimizationModeSelector from '../../src/components/OptimizationModeSelector.vue'

describe('OptimizationModeSelector', () => {
  it('renders correctly with text content', () => {
    const wrapper = mount(OptimizationModeSelector, {
      props: {
        modelValue: 'system'
      },
    })

    const radioButtons = wrapper.findAll('.n-radio-button, [role="radio"]')
    expect(radioButtons.length).toBeGreaterThan(0)

    // 文案由 i18n 决定（全局 setup.ts 已注入），这里只验证可渲染且有内容
    expect(wrapper.text().length).toBeGreaterThan(0)
  })
})
