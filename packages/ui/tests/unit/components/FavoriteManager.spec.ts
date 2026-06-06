import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

import type { FavoriteCategory, FavoritePrompt } from '@prompt-optimizer/core'

import FavoriteLibraryWorkspace from '../../../src/components/FavoriteLibraryWorkspace.vue'
import FavoriteManager from '../../../src/components/FavoriteManager.vue'
import type { AppServices } from '../../../src/types/services'
import { dispatchFavoriteUpdatedEvent } from '../../../src/utils/favorite-events'

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}
const ensureDefaultCategoriesMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('../../../src/composables/storage/useFavoriteInitializer', () => ({
  useFavoriteInitializer: () => ({
    ensureDefaultCategories: ensureDefaultCategoriesMock,
  }),
}))

const naiveStubs = {
  NModal: {
    name: 'NModal',
    template: '<div v-if="show" class="n-modal"><slot /><slot name="action" /></div>',
    props: ['show', 'style', 'title', 'preset', 'size', 'bordered', 'segmented', 'maskClosable'],
    emits: ['update:show'],
  },
  NDrawer: {
    name: 'NDrawer',
    template: '<aside v-if="show" class="n-drawer"><slot /></aside>',
    props: ['show', 'placement', 'width', 'blockScroll', 'displayDirective'],
    emits: ['update:show'],
  },
  NDrawerContent: {
    name: 'NDrawerContent',
    template: '<section class="n-drawer-content"><header class="n-drawer-content-header">{{ title }}</header><div class="n-drawer-content-body"><slot /></div></section>',
    props: ['title', 'closable', 'bodyContentStyle'],
  },
  Drawer: {
    name: 'Drawer',
    template: '<aside v-if="show" class="n-drawer"><slot /></aside>',
    props: ['show', 'placement', 'width', 'blockScroll', 'displayDirective'],
    emits: ['update:show'],
  },
  DrawerContent: {
    name: 'DrawerContent',
    template: '<section class="n-drawer-content"><header class="n-drawer-content-header">{{ title }}</header><div class="n-drawer-content-body"><slot /></div></section>',
    props: ['title', 'closable', 'bodyContentStyle'],
  },
  NCard: {
    name: 'NCard',
    template: '<section class="n-card"><header class="n-card-header"><slot name="header" /></header><div class="n-card-content"><slot /></div><footer class="n-card-footer"><slot name="footer" /></footer></section>',
    props: ['size', 'segmented', 'title'],
  },
  NScrollbar: {
    name: 'NScrollbar',
    template: '<div class="n-scrollbar"><slot /></div>',
    props: ['class'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['vertical', 'size', 'align', 'justify', 'wrap', 'class'],
  },
  NInput: {
    name: 'NInput',
    template: `
      <label class="n-input">
        <slot name="prefix" />
        <input :value="value" @input="$emit('update:value', $event.target.value)" />
      </label>
    `,
    props: ['value', 'placeholder', 'clearable', 'type', 'autosize', 'class'],
    emits: ['update:value'],
  },
  NSelect: {
    name: 'NSelect',
    template: `
      <select
        class="n-select"
        multiple
        @change="$emit('update:value', Array.from($event.target.selectedOptions).map((option) => option.value))"
      >
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    `,
    props: ['value', 'options', 'placeholder', 'multiple', 'clearable', 'filterable', 'maxTagCount', 'class'],
    emits: ['update:value'],
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
          @click="$emit('select', option.key)"
        >
          {{ option.key }}
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
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot name="icon" /><slot /></button>',
    props: ['disabled', 'type', 'secondary', 'size'],
    emits: ['click'],
  },
  NIcon: {
    name: 'NIcon',
    template: '<i class="n-icon"><slot /></i>',
    props: ['size'],
  },
  NEmpty: {
    name: 'NEmpty',
    template: '<div class="n-empty">{{ description }}<slot name="extra" /></div>',
    props: ['description', 'size'],
  },
  NPagination: {
    name: 'NPagination',
    template: '<div class="n-pagination" :data-page-size="pageSize"><slot name="prefix" :item-count="itemCount" /></div>',
    props: ['page', 'pageSize', 'itemCount', 'pageSlot'],
    emits: ['update:page'],
  },
  NText: {
    name: 'NText',
    template: '<span class="n-text"><slot /></span>',
    props: ['depth', 'strong'],
  },
  NForm: {
    name: 'NForm',
    template: '<form class="n-form"><slot /></form>',
    props: ['labelPlacement'],
  },
  NFormItem: {
    name: 'NFormItem',
    template: '<div class="n-form-item"><slot /></div>',
    props: ['label'],
  },
  NRadioGroup: {
    name: 'NRadioGroup',
    template: '<div class="n-radio-group"><slot /></div>',
    props: ['value'],
    emits: ['update:value'],
  },
  NRadio: {
    name: 'NRadio',
    template: '<label class="n-radio"><input type="radio" :value="value" @change="$emit(\'update:checked\', value)" /><slot /></label>',
    props: ['value'],
    emits: ['update:checked'],
  },
  NUpload: {
    name: 'NUpload',
    template: '<div class="n-upload"><slot /></div>',
    props: ['max', 'accept', 'defaultUpload', 'fileList'],
    emits: ['change'],
  },
  NUploadDragger: {
    name: 'NUploadDragger',
    template: '<div class="n-upload-dragger"><slot /></div>',
  },
  NThing: {
    name: 'NThing',
    template: '<div class="n-thing"><div><slot name="header" /></div><div><slot name="description" /></div><div><slot /><slot name="footer" /></div></div>',
  },
  CategoryTreeSelect: {
    name: 'CategoryTreeSelect',
    template: `
      <select
        class="category-tree-select"
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value); $emit('change', $event.target.value)"
      >
        <option value="">all</option>
        <option value="category-a">category-a</option>
        <option value="category-a-child">category-a-child</option>
        <option value="category-b">category-b</option>
      </select>
    `,
    props: ['modelValue', 'placeholder', 'showAllOption'],
    emits: ['update:modelValue', 'change', 'category-updated'],
  },
  FavoriteWorkspaceListItem: {
    name: 'FavoriteWorkspaceListItem',
    template: `
      <article class="favorite-list-item-stub" :data-selected="isSelected ? 'yes' : 'no'" :data-variant="variant || 'list'">
        <button class="favorite-card-select" @click="$emit('select', favorite)">{{ favorite.title }}</button>
        <button v-if="showQuickActions" class="favorite-card-use" @click="$emit('use', favorite)">use</button>
        <button v-if="showQuickActions" class="favorite-card-copy" @click="$emit('copy', favorite)">copy</button>
        <button class="favorite-card-edit" @click="$emit('edit', favorite)">edit</button>
        <button class="favorite-card-delete" @click="$emit('delete', favorite)">delete</button>
      </article>
    `,
    props: ['favorite', 'category', 'isSelected', 'showQuickActions', 'variant'],
    emits: ['select', 'delete', 'edit', 'copy', 'use'],
  },
  FavoriteDetailPanel: {
    name: 'FavoriteDetailPanel',
    template: `
      <div
        class="favorite-detail-panel-stub"
        data-testid="favorite-detail-panel"
        :data-favorite-id="favorite?.id || ''"
        :data-show-back="showBack ? 'yes' : 'no'"
      >
        <button v-if="showBack" class="favorite-detail-back" @click="$emit('back')">back</button>
        <span class="favorite-detail-title">{{ favorite?.title || 'empty' }}</span>
      </div>
    `,
    props: ['favorite', 'category', 'showBack'],
    emits: ['back', 'use', 'copy', 'edit', 'delete', 'fullscreen', 'favorite-updated'],
  },
  FavoriteEditorForm: {
    name: 'FavoriteEditorForm',
    template: `
      <div class="favorite-editor-form-stub" :data-mode="mode">
        <button class="favorite-editor-cancel" @click="$emit('cancel')">cancel</button>
        <button class="favorite-editor-save" @click="$emit('saved', favorite?.id || 'created-id')">save</button>
      </div>
    `,
    props: ['mode', 'favorite', 'embedded'],
    emits: ['cancel', 'saved'],
  },
  FavoriteImportPanel: {
    name: 'FavoriteImportPanel',
    template: `
      <div class="favorite-import-panel-stub">
        <button class="favorite-import-cancel" @click="$emit('cancel')">cancel</button>
        <button class="favorite-import-confirm" @click="$emit('imported')">import</button>
      </div>
    `,
    emits: ['cancel', 'imported'],
  },
  OutputDisplayFullscreen: {
    name: 'OutputDisplayFullscreen',
    template: '<div class="output-display-fullscreen"><slot /><slot name="extra-content" /></div>',
    props: ['modelValue', 'title', 'content', 'originalContent', 'reasoning', 'mode', 'enabledActions'],
    emits: ['update:modelValue', 'copy'],
  },
  FavoriteMediaPreviewPanel: {
    name: 'FavoriteMediaPreviewPanel',
    template: '<div class="favorite-media-preview-panel"></div>',
    props: ['favorite'],
  },
  FavoritePreviewExtensionHost: {
    name: 'FavoritePreviewExtensionHost',
    template: '<div class="favorite-preview-extension-host"></div>',
    props: ['favorite'],
    emits: ['favorite-updated'],
  },
  CategoryManager: {
    name: 'CategoryManager',
    template: '<div class="category-manager"></div>',
    emits: ['category-updated'],
  },
  TagManager: {
    name: 'TagManager',
    template: '<div class="tag-manager"></div>',
    props: ['show'],
    emits: ['update:show', 'updated'],
  },
  ToastUI: {
    name: 'ToastUI',
    template: '<div class="toast-ui"><slot /></div>',
  },
}

const categories: FavoriteCategory[] = [
  {
    id: 'category-a',
    name: 'Alpha',
    createdAt: Date.now(),
    sortOrder: 1,
  },
  {
    id: 'category-a-child',
    name: 'Alpha Child',
    parentId: 'category-a',
    createdAt: Date.now(),
    sortOrder: 2,
  },
  {
    id: 'category-b',
    name: 'Beta',
    createdAt: Date.now(),
    sortOrder: 3,
  },
]

const createFavorite = (index: number, overrides: Partial<FavoritePrompt> = {}): FavoritePrompt => ({
  id: `favorite-${index}`,
  title: `Favorite ${index}`,
  content: `Prompt content ${index}`,
  description: `Description ${index}`,
  createdAt: Date.now() - index * 1000,
  updatedAt: Date.now() - index * 1000,
  tags: index % 2 === 0 ? ['shared', 'alpha'] : ['shared', 'beta'],
  category: index % 2 === 0 ? 'category-a' : 'category-b',
  useCount: index,
  functionMode: index % 2 === 0 ? 'basic' : 'image',
  optimizationMode: index % 2 === 0 ? 'system' : undefined,
  imageSubMode: index % 2 === 0 ? undefined : 'text2image',
  ...overrides,
})

const createServices = (favorites: FavoritePrompt[]) => ({
  favoriteManager: {
    getFavorites: vi.fn().mockResolvedValue(favorites),
    getCategories: vi.fn().mockResolvedValue(categories),
    importFavorites: vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] }),
    incrementUseCount: vi.fn().mockResolvedValue(undefined),
    deleteFavorite: vi.fn().mockResolvedValue(undefined),
    deleteFavorites: vi.fn().mockResolvedValue(undefined),
    exportFavorites: vi.fn().mockResolvedValue('{}'),
  },
})

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

const mountComponent = async (favorites: FavoritePrompt[]) => {
  const services = createServices(favorites)
  const wrapper = mount(FavoriteManager, {
    props: {
      show: true,
    },
    global: {
      stubs: naiveStubs,
      provide: {
        services: ref(services as any),
      },
    },
  })

  await flushPromises()
  return { wrapper, services }
}

const mountLibraryWorkspace = async (
  favorites: FavoritePrompt[],
  props: Partial<InstanceType<typeof FavoriteLibraryWorkspace>['$props']> = {},
) => {
  const services = createServices(favorites)
  const wrapper = mount(FavoriteLibraryWorkspace, {
    props: {
      active: true,
      layout: 'page',
      ...props,
    },
    global: {
      stubs: naiveStubs,
      provide: {
        services: ref(services as any),
      },
    },
  })

  await flushPromises()
  return { wrapper, services }
}

describe('FavoriteManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ensureDefaultCategoriesMock.mockReset()
    ensureDefaultCategoriesMock.mockResolvedValue(undefined)
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.warning.mockReset()
    toastMock.info.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders desktop list layout and opens details in the unified dialog', async () => {
    setViewportWidth(1400)
    const favorites = Array.from({ length: 4 }, (_, index) => createFavorite(index + 1))
    const { wrapper } = await mountComponent(favorites)

    expect(wrapper.find('[data-testid="favorites-manager-workspace"]').exists()).toBe(true)
    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(4)
    expect(wrapper.find('[data-testid="favorite-detail-panel"]').exists()).toBe(false)

    await wrapper.findAll('.favorite-card-select')[1].trigger('click')
    await flushPromises()

    expect(wrapper.find('.n-modal').exists()).toBe(true)
    expect(wrapper.find('[data-testid="favorite-detail-panel"]').attributes('data-favorite-id')).toBe('favorite-2')
  }, 15000)

  it('renders page layout as a list-first surface and opens details in the unified dialog', async () => {
    setViewportWidth(1400)
    const favorites = Array.from({ length: 4 }, (_, index) => createFavorite(index + 1))
    const { wrapper } = await mountLibraryWorkspace(favorites)

    expect(wrapper.find('[data-testid="favorites-manager-workspace"]').classes()).toContain('favorites-manager-workspace--page')
    expect(wrapper.find('.favorites-manager-grid').exists()).toBe(true)
    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(4)
    expect(wrapper.findAll('.favorite-list-item-stub').every((item) => item.attributes('data-variant') === 'card')).toBe(true)
    expect(wrapper.find('.favorites-manager-pane--detail').exists()).toBe(false)
    expect(wrapper.find('[data-testid="favorite-detail-panel"]').exists()).toBe(false)

    await wrapper.findAll('.favorite-card-select')[1].trigger('click')
    await flushPromises()

    expect(wrapper.find('.n-drawer').exists()).toBe(false)
    expect(wrapper.find('.n-modal').exists()).toBe(true)
    expect(wrapper.find('[data-testid="favorite-detail-panel"]').attributes('data-favorite-id')).toBe('favorite-2')
    expect(wrapper.find('[data-testid="favorite-detail-panel"]').attributes('data-show-back')).toBe('no')
  })

  it('filters page layout favorites by the selected workspace mode chip', async () => {
    setViewportWidth(1400)
    const favorites = [
      createFavorite(1, {
        title: 'Basic system favorite',
        functionMode: 'basic',
        optimizationMode: 'system',
        imageSubMode: undefined,
      }),
      createFavorite(2, {
        title: 'Image text favorite',
        functionMode: 'image',
        optimizationMode: undefined,
        imageSubMode: 'text2image',
      }),
      createFavorite(3, {
        title: 'Image edit favorite',
        functionMode: 'image',
        optimizationMode: undefined,
        imageSubMode: 'image2image',
      }),
    ]
    const { wrapper } = await mountLibraryWorkspace(favorites)

    await wrapper.find('[data-testid="favorites-manager-mode-filter-image-text2image"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(1)
    expect(wrapper.text()).toContain('Image text favorite')
    expect(wrapper.text()).not.toContain('Basic system favorite')
    expect(wrapper.text()).not.toContain('Image edit favorite')
  })

  it('treats legacy pro favorites as context favorites when filtering', async () => {
    setViewportWidth(1400)
    const legacyProMode = 'pro' as unknown as FavoritePrompt['functionMode']
    const favorites = [
      createFavorite(1, {
        title: 'Legacy pro variable favorite',
        functionMode: legacyProMode,
        optimizationMode: 'user',
        imageSubMode: undefined,
      }),
      createFavorite(2, {
        title: 'Context system favorite',
        functionMode: 'context',
        optimizationMode: 'system',
        imageSubMode: undefined,
      }),
      createFavorite(3, {
        title: 'Basic user favorite',
        functionMode: 'basic',
        optimizationMode: 'user',
        imageSubMode: undefined,
      }),
    ]
    const { wrapper } = await mountLibraryWorkspace(favorites)

    await wrapper.find('[data-testid="favorites-manager-mode-filter-context-user"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(1)
    expect(wrapper.text()).toContain('Legacy pro variable favorite')
    expect(wrapper.text()).not.toContain('Context system favorite')
    expect(wrapper.text()).not.toContain('Basic user favorite')
  })

  it('uses the initial workspace mode filter and lets common tag chips narrow results', async () => {
    setViewportWidth(1400)
    const favorites = [
      createFavorite(1, {
        title: 'Basic alpha',
        tags: ['alpha', 'shared'],
        functionMode: 'basic',
        optimizationMode: 'system',
        imageSubMode: undefined,
      }),
      createFavorite(2, {
        title: 'Image alpha',
        tags: ['alpha', 'shared'],
        functionMode: 'image',
        optimizationMode: undefined,
        imageSubMode: 'text2image',
      }),
      createFavorite(3, {
        title: 'Image beta',
        tags: ['beta', 'shared'],
        functionMode: 'image',
        optimizationMode: undefined,
        imageSubMode: 'text2image',
      }),
    ]
    const { wrapper } = await mountLibraryWorkspace(favorites, {
      initialModeFilter: 'image-text2image',
    })

    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(2)
    expect(wrapper.text()).toContain('Image alpha')
    expect(wrapper.text()).toContain('Image beta')
    expect(wrapper.text()).not.toContain('Basic alpha')

    await wrapper.find('[data-testid="favorites-manager-popular-tag-beta"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(1)
    expect(wrapper.text()).toContain('Image beta')
    expect(wrapper.text()).not.toContain('Image alpha')
  })

  it('includes child categories when filtering by a parent category', async () => {
    setViewportWidth(1400)
    const favorites = [
      createFavorite(1, {
        title: 'Parent category favorite',
        category: 'category-a',
      }),
      createFavorite(2, {
        title: 'Child category favorite',
        category: 'category-a-child',
      }),
      createFavorite(3, {
        title: 'Other category favorite',
        category: 'category-b',
      }),
    ]
    const { wrapper } = await mountLibraryWorkspace(favorites)

    await wrapper.find('.category-tree-select').setValue('category-a')
    await flushPromises()

    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(2)
    expect(wrapper.text()).toContain('Parent category favorite')
    expect(wrapper.text()).toContain('Child category favorite')
    expect(wrapper.text()).not.toContain('Other category favorite')
  })

  it('keeps page layout quick actions on the list without opening the detail drawer', async () => {
    setViewportWidth(1400)
    const favorites = Array.from({ length: 2 }, (_, index) => createFavorite(index + 1))
    const { wrapper, services } = await mountLibraryWorkspace(favorites)

    await wrapper.findAll('.favorite-card-use')[0].trigger('click')
    await flushPromises()

    expect(wrapper.emitted('use-favorite')?.[0]?.[0]).toMatchObject({ id: 'favorite-1' })
    expect(services.favoriteManager.incrementUseCount).toHaveBeenCalledWith('favorite-1')
    expect(wrapper.find('.n-drawer').exists()).toBe(false)
  })

  it('does not increment usage when the provided use favorite action fails', async () => {
    setViewportWidth(1400)
    const favorites = Array.from({ length: 2 }, (_, index) => createFavorite(index + 1))
    const useFavorite = vi.fn(async () => false)
    const { wrapper, services } = await mountLibraryWorkspace(favorites, {
      useFavorite,
    })

    await wrapper.findAll('.favorite-card-use')[0].trigger('click')
    await flushPromises()

    expect(useFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'favorite-1' }), undefined)
    expect(services.favoriteManager.incrementUseCount).not.toHaveBeenCalled()
    expect(wrapper.find('.n-drawer').exists()).toBe(false)
  })

  it('initializes default categories when the favorite manager becomes available after mount', async () => {
    setViewportWidth(1400)
    const servicesRef = ref<AppServices | null>(null)
    const wrapper = mount(FavoriteLibraryWorkspace, {
      props: {
        active: true,
        layout: 'page',
      },
      global: {
        stubs: naiveStubs,
        provide: {
          services: servicesRef,
        },
      },
    })
    await flushPromises()

    expect(ensureDefaultCategoriesMock).not.toHaveBeenCalled()

    servicesRef.value = createServices([createFavorite(1)]) as unknown as AppServices
    await flushPromises()

    expect(ensureDefaultCategoriesMock).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(1)

    wrapper.unmount()
  })

  it('reloads favorites when the manager is reopened after an external save', async () => {
    setViewportWidth(1400)
    const favorites = [createFavorite(1)]
    const { wrapper, services } = await mountComponent(favorites)

    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(1)

    await wrapper.setProps({ show: false })
    await flushPromises()

    services.favoriteManager.getFavorites.mockResolvedValueOnce([
      ...favorites,
      createFavorite(2),
    ])
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(services.favoriteManager.getFavorites).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(2)
  }, 15000)

  it('refreshes an active favorite workspace after an external favorite update without changing selection', async () => {
    setViewportWidth(1400)
    const favorites = [createFavorite(1), createFavorite(2)]
    const { wrapper, services } = await mountLibraryWorkspace(favorites)

    await wrapper.findAll('.favorite-card-select')[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="favorite-detail-panel"]').attributes('data-favorite-id')).toBe('favorite-2')

    services.favoriteManager.getFavorites.mockResolvedValueOnce([
      createFavorite(1, { title: 'Favorite 1 with saved example' }),
      favorites[1],
    ])
    dispatchFavoriteUpdatedEvent('favorite-1')
    await flushPromises()

    expect(services.favoriteManager.getFavorites).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Favorite 1 with saved example')
    expect(wrapper.find('[data-testid="favorite-detail-panel"]').attributes('data-favorite-id')).toBe('favorite-2')
  }, 15000)

  it('uses the same detail dialog on mobile', async () => {
    setViewportWidth(640)
    const favorites = Array.from({ length: 3 }, (_, index) => createFavorite(index + 1))
    const { wrapper } = await mountComponent(favorites)

    expect(wrapper.find('[data-testid="favorite-detail-panel"]').exists()).toBe(false)
    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(3)

    await wrapper.findAll('.favorite-card-select')[0].trigger('click')
    await flushPromises()

    const detailPanel = wrapper.find('[data-testid="favorite-detail-panel"]')
    expect(detailPanel.exists()).toBe(true)
    expect(detailPanel.attributes('data-show-back')).toBe('no')
  })

  it('filters before pagination and hides pagination when the result fits on one page', async () => {
    setViewportWidth(1400)
    const favorites = Array.from({ length: 7 }, (_, index) =>
      createFavorite(index + 1, {
        title: index === 0 ? 'Alpha landing' : `Favorite ${index + 1}`,
      }),
    )
    const { wrapper } = await mountComponent(favorites)

    expect(wrapper.find('[data-testid="favorites-manager-pagination"]').exists()).toBe(true)

    await wrapper.find('.n-input input').setValue('Alpha')
    await flushPromises()

    expect(wrapper.findAll('.favorite-list-item-stub')).toHaveLength(1)
    expect(wrapper.find('[data-testid="favorites-manager-pagination"]').exists()).toBe(false)
  })

  it('keeps import and add actions visible and does not show an optimize action in the empty state', async () => {
    setViewportWidth(1400)
    const { wrapper } = await mountComponent([])

    expect(wrapper.text()).toContain('No favorites yet')
    expect(wrapper.text()).not.toContain('Optimize')
    expect(wrapper.find('[data-testid="favorites-manager-import"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="favorites-manager-add"]').exists()).toBe(true)
  })

  it('switches create and import flows into the unified dialog', async () => {
    setViewportWidth(1400)
    const favorites = Array.from({ length: 2 }, (_, index) => createFavorite(index + 1))
    const { wrapper } = await mountComponent(favorites)

    await wrapper.find('[data-testid="favorites-manager-add"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.favorite-editor-form-stub').attributes('data-mode')).toBe('create')

    await wrapper.find('.favorite-editor-cancel').trigger('click')
    await flushPromises()

    expect(wrapper.find('.favorite-editor-form-stub').exists()).toBe(false)

    await wrapper.find('[data-testid="favorites-manager-import"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.favorite-import-panel-stub').exists()).toBe(true)
  })
})
