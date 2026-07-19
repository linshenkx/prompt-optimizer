import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import CategoryManager from '../../../src/components/CategoryManager.vue'

const mountManager = (categoryName: string) => {
  const category = {
    id: 'category-1',
    name: categoryName,
    createdAt: 1,
    sortOrder: 1,
  }
  const favoriteManager = {
    getCategories: vi.fn().mockResolvedValue([category]),
    getCategoryUsage: vi.fn().mockResolvedValue(0),
  }

  return {
    category,
    wrapper: mount(CategoryManager, {
      global: {
        provide: {
          services: ref({ favoriteManager }),
        },
        stubs: {
          NButton: true,
          NIcon: true,
          NSpace: true,
          NTree: true,
          NForm: true,
          NFormItem: true,
          NInput: true,
          NTreeSelect: true,
          NColorPicker: true,
          NDropdown: true,
          // Keep modal content in-tree for XSS assertions without full Naive UI dialog plumbing.
          NModal: {
            template: '<div class="n-dialog__content"><slot /></div>',
          },
        },
      },
    }),
  }
}

describe('CategoryManager', () => {
  it('renders an untrusted category name as text in the delete confirmation', async () => {
    const categoryName = '<img src=x onerror="window.__categoryXss = true">'
    const { category, wrapper } = mountManager(categoryName)
    await flushPromises()

    await (wrapper.vm as unknown as {
      handleDeleteCategory: (category: typeof category) => Promise<void>
    }).handleDeleteCategory(category)
    await flushPromises()

    const modal = wrapper.get('.n-dialog__content')
    // Must not parse the untrusted name into a real DOM node.
    expect(modal.find('img').exists()).toBe(false)
    expect(modal.element.querySelector('img')).toBeNull()
    // Vue text interpolation keeps the payload visible as text, not executable HTML.
    expect(modal.text()).toContain(categoryName)
    expect(modal.html()).toContain('&lt;img')
  })
})
