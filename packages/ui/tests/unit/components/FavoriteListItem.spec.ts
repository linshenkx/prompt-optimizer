import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { FavoriteCategory, FavoritePrompt } from '@prompt-optimizer/core'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        const messages: Record<string, string> = {
          'favorites.library.card.copyContent': 'Copy content',
          'favorites.library.card.useNow': 'Use now',
          'favorites.library.card.edit': 'Edit',
          'favorites.library.card.toggleCategory': 'Change category',
          'favorites.library.card.delete': 'Delete',
          'prompt.share': 'Share',
          'favorites.library.time.justNow': 'Just now',
          'favorites.library.time.minutesAgo': `${params?.minutes ?? 0} minutes ago`,
          'favorites.library.time.hoursAgo': `${params?.hours ?? 0} hours ago`,
          'favorites.library.time.yesterday': 'Yesterday',
          'favorites.library.time.daysAgo': `${params?.days ?? 0} days ago`,
        }
        return messages[key] ?? key
      },
    }),
  }
})

vi.mock('naive-ui', () => ({
  NListItem: {
    name: 'NListItem',
    template: '<article class="n-list-item"><div class="prefix"><slot name="prefix" /></div><slot /></article>',
  },
  NThing: {
    name: 'NThing',
    template: '<section class="n-thing"><header><slot name="header" /></header><main><slot name="description" /></main><footer><slot name="footer" /></footer></section>',
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag"><slot /></span>',
    props: ['color', 'size', 'type'],
  },
  NText: {
    name: 'NText',
    template: '<span class="n-text"><slot name="icon" /><slot /></span>',
    props: ['depth'],
  },
  NIcon: {
    name: 'NIcon',
    template: '<i class="n-icon"><slot /></i>',
  },
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot name="icon" /><slot /></button>',
    props: ['quaternary', 'type', 'size'],
    emits: ['click'],
  },
  NButtonGroup: {
    name: 'NButtonGroup',
    template: '<div class="n-button-group"><slot /></div>',
    props: ['size'],
  },
  NCheckbox: {
    name: 'NCheckbox',
    template: '<input class="n-checkbox" type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />',
    props: ['checked'],
    emits: ['update:checked'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['size'],
  },
  NDropdown: {
    name: 'NDropdown',
    template: `
      <div class="n-dropdown">
        <slot />
        <button
          v-for="option in normalizedOptions"
          :key="option.key"
          class="n-dropdown-option"
          :data-key="option.key"
          type="button"
          @click="$emit('select', option.key)"
        >
          {{ option.label }}
        </button>
      </div>
    `,
    props: ['options'],
    emits: ['select'],
    computed: {
      normalizedOptions() {
        return (this.options || []).filter((option: any) => !option.type)
      },
    },
  },
}))

import FavoriteListItem from '../../../src/components/FavoriteListItem.vue'

const baseNow = new Date('2026-06-06T12:00:00.000Z')

const createFavorite = (overrides: Partial<FavoritePrompt> = {}): FavoritePrompt => ({
  id: 'favorite-1',
  title: 'Wiki prompt template',
  content: 'Generate a wiki-aware prompt for Feishu and Hermes.',
  description: 'Reusable XC prompt engineering asset.',
  createdAt: baseNow.getTime() - 10_000,
  updatedAt: baseNow.getTime() - 2 * 60 * 60 * 1000,
  tags: ['wiki', 'mcp'],
  category: 'category-1',
  useCount: 12,
  functionMode: 'basic',
  optimizationMode: 'user',
  ...overrides,
})

const category: FavoriteCategory = {
  id: 'category-1',
  name: 'Knowledge Base',
  color: '#1677ff',
  createdAt: baseNow.getTime(),
  sortOrder: 1,
}

const mountComponent = (props: Partial<InstanceType<typeof FavoriteListItem>['$props']> = {}) =>
  mount(FavoriteListItem, {
    props: {
      favorite: createFavorite(),
      category,
      isSelected: false,
      ...props,
    },
  })

describe('FavoriteListItem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(baseNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders favorite content, category, tags, relative time, and use count', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Wiki prompt template')
    expect(wrapper.text()).toContain('Knowledge Base')
    expect(wrapper.text()).toContain('Generate a wiki-aware prompt')
    expect(wrapper.text()).toContain('Reusable XC prompt engineering asset.')
    expect(wrapper.text()).toContain('wiki')
    expect(wrapper.text()).toContain('mcp')
    expect(wrapper.text()).toContain('2 hours ago')
    expect(wrapper.text()).toContain('12')
  })

  it('emits selection and quick action events with the favorite payload', async () => {
    const favorite = createFavorite()
    const wrapper = mountComponent({ favorite, isSelected: true })

    expect(wrapper.find('.n-checkbox').attributes('checked')).toBeDefined()

    await wrapper.find('.n-checkbox').setValue(false)
    expect(wrapper.emitted('select')).toEqual([[favorite, false]])

    await wrapper.find('button[title="Copy content"]').trigger('click')
    await wrapper.find('button[title="Use now"]').trigger('click')

    expect(wrapper.emitted('copy')?.[0]).toEqual([favorite])
    expect(wrapper.emitted('use')?.[0]).toEqual([favorite])
  })

  it('maps dropdown action keys to edit, copy, share, category, and delete events', async () => {
    const favorite = createFavorite()
    const wrapper = mountComponent({ favorite })

    for (const key of ['edit', 'copy', 'share', 'category', 'delete']) {
      await wrapper.find(`.n-dropdown-option[data-key="${key}"]`).trigger('click')
    }

    expect(wrapper.emitted('edit')?.[0]).toEqual([favorite])
    expect(wrapper.emitted('copy')?.[0]).toEqual([favorite])
    expect(wrapper.emitted('share')?.[0]).toEqual([favorite])
    expect(wrapper.emitted('toggle-category')?.[0]).toEqual([favorite])
    expect(wrapper.emitted('delete')?.[0]).toEqual([favorite])
  })

  it('renders minute, yesterday, recent day, and absolute date labels', async () => {
    const wrapper = mountComponent({
      favorite: createFavorite({ updatedAt: baseNow.getTime() - 45_000 }),
    })
    expect(wrapper.text()).toContain('Just now')

    await wrapper.setProps({
      favorite: createFavorite({ updatedAt: baseNow.getTime() - 30 * 60 * 1000 }),
    })
    expect(wrapper.text()).toContain('30 minutes ago')

    await wrapper.setProps({
      favorite: createFavorite({ updatedAt: baseNow.getTime() - 24 * 60 * 60 * 1000 }),
    })
    expect(wrapper.text()).toContain('Yesterday')

    await wrapper.setProps({
      favorite: createFavorite({ updatedAt: baseNow.getTime() - 3 * 24 * 60 * 60 * 1000 }),
    })
    expect(wrapper.text()).toContain('3 days ago')

    await wrapper.setProps({
      favorite: createFavorite({ updatedAt: new Date('2026-05-01T00:00:00.000Z').getTime() }),
    })
    expect(wrapper.text()).toContain(new Date('2026-05-01T00:00:00.000Z').toLocaleDateString())
  })
})
