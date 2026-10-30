import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NRadioGroup } from 'naive-ui'
import ImageModeSelector from '../../../src/components/image-mode/ImageModeSelector.vue'

describe('ImageModeSelector', () => {
  it('emits the selected mode once through the radio group and ignores a normal reselect', async () => {
    const wrapper = mount(ImageModeSelector, { props: { modelValue: 'text2image' } })
    try {
      wrapper.getComponent(NRadioGroup).vm.$emit('update:value', 'image2image')
      expect(wrapper.emitted('update:modelValue')).toEqual([['image2image']])
      expect(wrapper.emitted('change')).toEqual([['image2image']])
      await wrapper.setProps({ modelValue: 'image2image' })
      await wrapper.get('[data-testid="image-sub-mode-image2image"]').trigger('click')
      expect(wrapper.emitted('change')).toHaveLength(1)
    } finally { wrapper.unmount() }
  })

  it('preserves intentional reselect while suppressing all changes when disabled', async () => {
    const wrapper = mount(ImageModeSelector, { props: { modelValue: 'text2image', allowReselect: true } })
    try {
      await wrapper.get('[data-testid="image-sub-mode-text2image"]').trigger('click')
      expect(wrapper.emitted('change')).toEqual([['text2image']])
      await wrapper.setProps({ disabled: true })
      await wrapper.get('[data-testid="image-sub-mode-text2image"]').trigger('click')
      wrapper.getComponent(NRadioGroup).vm.$emit('update:value', 'multiimage')
      expect(wrapper.emitted('change')).toHaveLength(1)
    } finally { wrapper.unmount() }
  })
})
