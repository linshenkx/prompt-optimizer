import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ImageTokenUsage from '../../../src/components/image-mode/ImageTokenUsage.vue'

describe('ImageTokenUsage', () => {
  it('folds mobile metadata while preserving every value and the normal desktop presentation', async () => {
    const wrapper = mount(ImageTokenUsage, {
      props: { compact: true, metadata: { usage: { promptTokenCount: 123, totalTokenCount: 456 } } },
    })
    try {
      expect(wrapper.get('details').attributes('open')).toBeUndefined()
      expect(wrapper.get('summary').text()).toBe('Generation details')
      expect(wrapper.text()).toContain('All tokens: 456')
      await wrapper.setProps({ compact: false })
      expect(wrapper.find('details').exists()).toBe(false)
      expect(wrapper.find('summary').exists()).toBe(false)
      expect(wrapper.text()).toContain('Prompt tokens: 123')
    } finally { wrapper.unmount() }
  })

  it('keeps single-image input usage rendering intact', () => {
    const wrapper = mount(ImageTokenUsage, {
      props: {
        inputImageInfo: {
          width: 1024,
          height: 768,
          mimeType: 'image/jpeg',
        },
        metadata: {
          usage: {
            promptTokenCount: 123,
            totalTokenCount: 456,
          },
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('Image (JPEG): 1024x768px')
    expect(text).toContain('Prompt tokens: 123')
    expect(text).toContain('All tokens: 456')
  })

  it('renders ordered multi-image input usage without collapsing it into one fake input image', () => {
    const wrapper = mount(ImageTokenUsage, {
      props: {
        inputImagesInfo: [
          {
            width: 1024,
            height: 1024,
            mimeType: 'image/jpeg',
          },
          {
            width: 768,
            height: 1344,
            mimeType: 'image/png',
          },
        ],
        metadata: {
          usage: {
            promptTokenCount: 321,
          },
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('Image 1 (JPEG): 1024x1024px')
    expect(text).toContain('Image 2 (PNG): 768x1344px')
    expect(text).toContain('Prompt tokens: 321')
    expect(text).not.toContain('Image (JPEG): 1024x1024px')
  })
})
