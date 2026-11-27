import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

import type { FavoritePrompt } from '@prompt-optimizer/core'

const routerPush = vi.hoisted(() => vi.fn())
const currentRoute = vi.hoisted(() => ({
  value: {
    query: {} as Record<string, unknown>,
  },
}))
const sampleFavorite = vi.hoisted(() => ({
  id: 'favorite-1',
  title: 'Favorite prompt',
  content: 'favorite content',
  description: '',
  category: '',
  tags: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  useCount: 0,
  functionMode: 'basic',
  optimizationMode: 'system',
}) as FavoritePrompt)

vi.mock('../../../src/router', () => ({
  router: {
    push: routerPush,
    currentRoute,
  },
}))

vi.mock('../../../src/components/FavoriteLibraryWorkspace.vue', () => ({
  default: defineComponent({
    name: 'FavoriteLibraryWorkspace',
    props: {
      layout: {
        type: String,
        required: true,
      },
      active: {
        type: Boolean,
        required: true,
      },
      initialModeFilter: {
        type: String,
        default: 'all',
      },
      useFavorite: {
        type: Function,
        default: null,
      },
    },
    emits: ['use-favorite'],
    setup(props, { slots }) {
      return () =>
        h('div', { 'data-testid': 'favorite-library-shell' }, [
          h('div', { 'data-testid': 'favorite-library-leading' }, slots['toolbar-leading']?.()),
          h(
            'button',
            {
              'data-testid': 'favorite-library-use',
              'data-layout': props.layout,
              'data-active': String(props.active),
              'data-initial-mode-filter': props.initialModeFilter,
              onClick: () => props.useFavorite?.(sampleFavorite),
            },
            'Use favorite',
          ),
        ])
    },
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'favorites.page.title': 'Favorites',
          'favorites.page.closeTitle': 'Return to workspace',
          'favorites.page.returnToWorkspace': 'Return',
        }

        return map[key] ?? key
      },
    }),
  }
})

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()

  return {
    ...actual,
    NButton: defineComponent({
      name: 'NButton',
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.())
      },
    }),
    NIcon: defineComponent({
      name: 'NIcon',
      setup(_, { slots }) {
        return () => h('span', { class: 'n-icon-stub' }, slots.default?.())
      },
    }),
    NText: defineComponent({
      name: 'NText',
      props: {
        tag: {
          type: String,
          default: 'span',
        },
      },
      setup(props, { attrs, slots }) {
        return () => h(props.tag, attrs, slots.default?.())
      },
    }),
  }
})

import FavoritesPage from '../../../src/components/favorites/FavoritesPage.vue'
import { favoritesPageActionsKey } from '../../../src/components/favorites/favorites-page-context'
import { DEFAULT_WORKSPACE_PATH } from '../../../src/router/workspaceRoutes'

const mountFavoritesPage = (actions?: {
  useFavorite: ReturnType<typeof vi.fn>
  returnToWorkspace: ReturnType<typeof vi.fn>
}) => mount(FavoritesPage, {
  global: {
    provide: actions
      ? {
          [favoritesPageActionsKey as symbol]: actions,
        }
      : {},
    stubs: {
      ArrowBackUp: true,
    },
  },
})

describe('FavoritesPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
    currentRoute.value = {
      query: {},
    }
  })

  it('renders the shared library in page layout', () => {
    const actions = {
      useFavorite: vi.fn(),
      returnToWorkspace: vi.fn(),
    }
    const wrapper = mountFavoritesPage(actions)

    const library = wrapper.find('[data-testid="favorite-library-use"]')
    expect(library.attributes('data-layout')).toBe('page')
    expect(library.attributes('data-active')).toBe('true')
    expect(library.attributes('data-initial-mode-filter')).toBe('all')
    expect(wrapper.find('[data-testid="favorite-library-leading"] [data-testid="favorites-page-return"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('uses the workspace route query as the initial library mode filter', () => {
    for (const [from, expected] of [
      ['/image/text2image', 'image-text2image'],
      ['/video/create', 'video-create'],
      ['/arena', 'all'],
    ] as const) {
      currentRoute.value = { query: { from } }
      const actions = {
        useFavorite: vi.fn(),
        returnToWorkspace: vi.fn(),
      }
      const wrapper = mountFavoritesPage(actions)

      expect(wrapper.find('[data-testid="favorite-library-use"]').attributes('data-initial-mode-filter')).toBe(expected)

      wrapper.unmount()
    }
  })

  it('returns to the workspace through the app action from the explicit button and Escape', async () => {
    const actions = {
      useFavorite: vi.fn(),
      returnToWorkspace: vi.fn(),
    }
    const wrapper = mountFavoritesPage(actions)

    await wrapper.find('[data-testid="favorites-page-return"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(actions.returnToWorkspace).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('keeps Escape inside nested interactions', () => {
    const actions = {
      useFavorite: vi.fn(),
      returnToWorkspace: vi.fn(),
    }
    const wrapper = mountFavoritesPage(actions)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    const modal = document.createElement('div')
    modal.className = 'n-modal'
    document.body.appendChild(modal)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    modal.remove()
    const drawer = document.createElement('div')
    drawer.className = 'n-drawer'
    document.body.appendChild(drawer)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    drawer.remove()
    const dropdown = document.createElement('div')
    dropdown.className = 'n-dropdown-menu'
    document.body.appendChild(dropdown)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(actions.returnToWorkspace).not.toHaveBeenCalled()

    input.remove()
    dropdown.remove()
    wrapper.unmount()
  })

  it('delegates use-favorite to the app action', async () => {
    const actions = {
      useFavorite: vi.fn(async () => true),
      returnToWorkspace: vi.fn(),
    }
    const wrapper = mountFavoritesPage(actions)

    await wrapper.find('[data-testid="favorite-library-use"]').trigger('click')
    await flushPromises()

    expect(actions.useFavorite).toHaveBeenCalledWith(sampleFavorite, undefined)

    wrapper.unmount()
  })

  it('falls back to the default workspace when mounted outside the app shell', async () => {
    const wrapper = mountFavoritesPage()

    await wrapper.find('[data-testid="favorites-page-return"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith(DEFAULT_WORKSPACE_PATH)

    wrapper.unmount()
  })
})
