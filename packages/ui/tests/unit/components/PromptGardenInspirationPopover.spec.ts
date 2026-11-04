import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide, inject, ref } from 'vue'
import { mount } from '@vue/test-utils'

const fetchSuggestionsMock = vi.hoisted(() => vi.fn())
const fetchCatalogMock = vi.hoisted(() => vi.fn())
const fetchPreviewMock = vi.hoisted(() => vi.fn())
const openExternalUrlMock = vi.hoisted(() => vi.fn())

vi.mock('@prompt-optimizer/core', () => ({
  getEnvVar: (key: string) => {
    if (key === 'VITE_ENABLE_PROMPT_GARDEN_IMPORT') return '1'
    if (key === 'VITE_PROMPT_GARDEN_BASE_URL')
      return 'https://garden.always200.com/'
    return ''
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en-US' },
    t: (key: string) => {
      const messages: Record<string, string> = {
        'common.promptGarden.noExampleImage': 'No example image',
        'common.promptGarden.imageLoadFailed': 'Image could not load',
        'common.promptGarden.inspirationTrigger': 'Inspiration',
        'common.promptGarden.inspirationStartTitle': 'Start with inspiration',
        'common.promptGarden.inspirationTitle': 'Find inspiration',
        'common.promptGarden.loadingSuggestions': 'Loading inspiration...',
        'common.promptGarden.refreshSuggestions': 'Refresh suggestions',
        'common.promptGarden.browseMore': 'Browse more',
        'common.promptGarden.noSuggestions': 'No suggestions right now',
        'common.promptGarden.useShort': 'Use',
        'common.promptGarden.replaceImportShort': 'Replace import',
        'common.promptGarden.importShort': 'Paste code',
      }
      return messages[key] ?? key
    },
  }),
}))

vi.mock('../../../src/utils/open-external-url', () => ({
  openExternalUrl: openExternalUrlMock,
}))

vi.mock('../../../src/utils/prompt-garden-suggestions', () => ({
  fetchPromptGardenSuggestions: fetchSuggestionsMock,
  fetchPromptGardenCatalog: fetchCatalogMock,
  fetchPromptGardenPreview: fetchPreviewMock,
}))

vi.mock('../../../src/components/media/AppPreviewImage.vue', () => ({
  default: defineComponent({
    name: 'AppPreviewImage',
    props: {
      src: String,
      previewSrc: String,
      alt: String,
    },
    setup(props, { attrs }) {
      return () => {
        const { class: className, ...restAttrs } = attrs
        return h(
          'button',
          {
            ...restAttrs,
            type: 'button',
            class: ['app-preview-image-stub', className],
            'data-preview-src': props.previewSrc,
          },
          h('img', { src: props.src, alt: props.alt }),
        )
      }
    },
  }),
}))

vi.mock('../../../src/components/media/AppPreviewImageGroup.vue', () => ({
  default: defineComponent({
    name: 'AppPreviewImageGroup',
    setup(_, { attrs, slots }) {
      return () => {
        const { class: className, ...restAttrs } = attrs
        return h(
          'div',
          {
            ...restAttrs,
            class: ['app-preview-image-group-stub', className],
          },
          slots.default?.(),
        )
      }
    },
  }),
}))

vi.mock('naive-ui', () => ({
  NCard: defineComponent({
    name: 'NCard',
    props: ['size', 'contentStyle'],
    setup(_, { slots, attrs }) {
      return () => h('section', attrs, slots.default?.())
    },
  }),
  NEmpty: defineComponent({
    name: 'NEmpty',
    props: ['description', 'size'],
    setup(props) {
      return () => h('div', { class: 'n-empty-stub' }, props.description)
    },
  }),
  NSkeleton: defineComponent({
    setup: () => () => h('span', { class: 'skeleton' }),
  }),
  useThemeVars: () =>
    ref({ borderColor: '#ccc', actionColor: '#fafafa', primaryColor: '#555' }),
  NInput: defineComponent({
    props: ['value', 'size'],
    emits: ['update:value'],
    setup(props, { emit, attrs }) {
      return () =>
        h('input', {
          ...attrs,
          value: props.value,
          onInput: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).value),
        })
    },
  }),
  NRadioGroup: defineComponent({
    name: 'NRadioGroup',
    props: ['value'],
    emits: ['update:value'],
    setup(_, { emit, slots }) {
      provide('choose-view', (value: string) => emit('update:value', value))
      return () => h('div', slots.default?.())
    },
  }),
  NRadioButton: defineComponent({
    props: ['value'],
    setup(props, { attrs, slots }) {
      const choose = inject<(value: string) => void>('choose-view')!
      return () =>
        h(
          'button',
          { ...attrs, onClick: () => choose(props.value) },
          slots.default?.(),
        )
    },
  }),
  NScrollbar: defineComponent({
    setup(_, { slots, expose }) {
      expose({ scrollTo: vi.fn() })
      return () => h('div', slots.default?.())
    },
  }),
  NButton: defineComponent({
    name: 'NButton',
    props: {
      disabled: Boolean,
    },
    setup(props, { slots, attrs }) {
      return () =>
        h(
          'button',
          {
            ...attrs,
            disabled: props.disabled,
          },
          [slots.icon?.(), slots.default?.()],
        )
    },
  }),
  NIcon: defineComponent({
    name: 'NIcon',
    setup(_, { slots }) {
      return () => h('span', { class: 'n-icon-stub' }, slots.default?.())
    },
  }),
  NPopover: defineComponent({
    name: 'NPopover',
    props: {
      show: Boolean,
    },
    emits: ['update:show', 'clickoutside'],
    setup(props, { slots }) {
      return () =>
        h('div', { class: 'n-popover-stub' }, [
          h('div', { class: 'n-popover-trigger' }, slots.trigger?.()),
          props.show
            ? h('div', { class: 'n-popover-content' }, slots.default?.())
            : null,
        ])
    },
  }),
  NSpin: defineComponent({
    name: 'NSpin',
    setup() {
      return () => h('span', 'spin')
    },
  }),
  NTag: defineComponent({
    name: 'NTag',
    setup(_, { slots }) {
      return () => h('span', { class: 'n-tag-stub' }, slots.default?.())
    },
  }),
  NText: defineComponent({
    name: 'NText',
    setup(_, { slots }) {
      return () => h('span', slots.default?.())
    },
  }),
}))

vi.mock('@lucide/vue', () => ({
  ExternalLink: defineComponent({
    name: 'ExternalLink',
    setup: () => () => h('i'),
  }),
  FileInput: defineComponent({ name: 'FileImport', setup: () => () => h('i') }),
  Sprout: defineComponent({ name: 'Plant2', setup: () => () => h('i') }),
  Search: defineComponent({ setup: () => () => h('i') }),
  ChevronDown: defineComponent({ setup: () => () => h('i') }),
  RefreshCw: defineComponent({ name: 'Refresh', setup: () => () => h('i') }),
}))

import PromptGardenInspirationPopover from '../../../src/components/common/PromptGardenInspirationPopover.vue'

describe('PromptGardenInspirationPopover', () => {
  beforeEach(() => {
    fetchSuggestionsMock.mockReset()
    fetchCatalogMock.mockReset()
    fetchPreviewMock.mockReset()
    openExternalUrlMock.mockReset()
    vi.useFakeTimers()
  })

  it('loads lightweight Garden suggestions on hover and emits an import request', async () => {
    fetchSuggestionsMock.mockResolvedValue({
      items: [
        {
          id: 'prompt-1',
          title: 'Cinematic portrait',
          summary: 'Keep the subject and improve lighting.',
          importCode: 'NB-001',
          tags: ['portrait'],
          mode: 'image-image2image',
          thumbnailUrl: null,
          updatedAt: null,
          source: 'latest',
        },
      ],
      browseUrl: 'https://garden.always200.com/prompts?mode=image-image2image',
      nextExclude: ['NB-001'],
      ttlSeconds: 300,
    })

    const wrapper = mount(PromptGardenInspirationPopover, {
      props: {
        mode: 'image-image2image',
        hasPrompt: true,
        testId: 'garden-test',
      },
    })

    await wrapper
      .find('[data-testid="garden-test-trigger"]')
      .trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchSuggestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gardenBaseUrl: 'https://garden.always200.com',
        mode: 'image-image2image',
        limit: 4,
        strategy: 'mixed',
        locale: 'en-US',
      }),
    )
    expect(wrapper.text()).toContain('Cinematic portrait')
    expect(wrapper.text()).toContain('Replace import')

    await wrapper
      .find('[data-testid="garden-test-suggestion-0-apply"]')
      .trigger('click')

    expect(wrapper.emitted('apply')?.[0]).toEqual([
      {
        importCode: 'NB-001',
        exampleId: null,
        subModeKey: 'image-image2image',
      },
    ])
  })

  it('opens the Garden browse URL from the popover fallback action', async () => {
    fetchSuggestionsMock.mockResolvedValue({
      items: [],
      browseUrl: 'https://garden.always200.com/prompts?mode=image-text2image',
      nextExclude: [],
      ttlSeconds: 300,
    })

    const wrapper = mount(PromptGardenInspirationPopover, {
      props: {
        mode: 'image-text2image',
        testId: 'garden-test',
      },
    })

    await wrapper.find('[data-testid="garden-test-trigger"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.find('[data-testid="garden-test-browse"]').trigger('click')

    expect(openExternalUrlMock).toHaveBeenCalledWith(
      'https://garden.always200.com/prompts?mode=image-text2image',
      { logPrefix: 'PromptGarden' },
    )
  })

  it('renders suggestion thumbnails through the preview image component', async () => {
    fetchSuggestionsMock.mockResolvedValue({
      items: [
        {
          id: 'prompt-1',
          title: 'Cinematic portrait',
          summary: 'Keep the subject and improve lighting.',
          importCode: 'NB-001',
          tags: [],
          mode: 'image-text2image',
          thumbnailUrl: 'https://garden.always200.com/prompt-assets/thumb.webp',
          updatedAt: null,
          source: 'featured',
        },
      ],
      browseUrl: 'https://garden.always200.com/prompts?mode=image-text2image',
      nextExclude: ['NB-001'],
      ttlSeconds: 300,
    })

    const wrapper = mount(PromptGardenInspirationPopover, {
      props: {
        mode: 'image-text2image',
        testId: 'garden-test',
      },
    })

    await wrapper.find('[data-testid="garden-test-trigger"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    const previewImage = wrapper.find('.app-preview-image-stub')
    expect(previewImage.exists()).toBe(true)
    expect(previewImage.attributes('data-preview-src')).toBe(
      'https://garden.always200.com/prompt-assets/thumb.webp',
    )
    expect(previewImage.find('img').attributes('src')).toBe(
      'https://garden.always200.com/prompt-assets/thumb.webp',
    )
  })
  const card = (code: string) => ({
    id: code,
    title: code,
    summary: `Summary ${code}`,
    excerpt: `Question ${code}`,
    importCode: code,
    mode: 'arena',
    tags: [],
    thumbnailUrl: null,
    updatedAt: null,
    source: null,
  })
  const page = (codes: string[], nextOffset: number | null = null) => ({
    items: codes.map(card),
    total: 3,
    nextOffset,
    browseUrl: 'https://garden.always200.com/',
  })
  const scrollList = async (
    wrapper: ReturnType<typeof mount>,
    scrollTop = 600,
  ) => {
    const scroll = wrapper.get('.prompt-garden-inspiration-popover__scroll')
    Object.defineProperties(scroll.element, {
      scrollTop: { value: scrollTop, configurable: true },
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 320, configurable: true },
    })
    await scroll.trigger('scroll')
  }
  const flush = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }

  it('opens arena on the full catalog, previews without importing, and imports only on Use', async () => {
    fetchCatalogMock.mockResolvedValue(page(['BM-001']))
    fetchPreviewMock.mockResolvedValue('The complete question')
    const wrapper = mount(PromptGardenInspirationPopover, {
      props: { mode: 'arena', testId: 'catalog' },
    })
    await wrapper.get('[data-testid="catalog-trigger"]').trigger('click')
    await flush()
    expect(fetchSuggestionsMock).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'NCard' }).exists()).toBe(false)
    expect(wrapper.find('.n-empty-stub').exists()).toBe(false)
    expect(fetchCatalogMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'arena', offset: 0, limit: 20 }),
    )
    expect(wrapper.text()).toContain('Question BM-001')
    await wrapper
      .get('[data-testid="catalog-suggestion-0-preview"]')
      .trigger('click')
    await flush()
    expect(wrapper.text()).toContain('The complete question')
    expect(wrapper.emitted('apply')).toBeUndefined()
    await wrapper
      .get('[data-testid="catalog-suggestion-0-apply"]')
      .trigger('click')
    expect(wrapper.emitted('apply')?.[0]).toEqual([
      { importCode: 'BM-001', exampleId: null, subModeKey: 'arena' },
    ])
    wrapper.unmount()
  })

  it('lets inspiration browse all pages, keeps rows after a load-more failure, and remembers the view on reopening', async () => {
    fetchSuggestionsMock.mockResolvedValue({
      items: [],
      nextExclude: [],
      ttlSeconds: 300,
      browseUrl: '',
    })
    fetchCatalogMock
      .mockResolvedValueOnce(page(['BM-001'], 1))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page(['BM-002']))
    const wrapper = mount(PromptGardenInspirationPopover, {
      props: { mode: 'image-text2image', testId: 'catalog' },
    })
    await wrapper.get('[data-testid="catalog-trigger"]').trigger('click')
    await flush()
    await wrapper.get('[data-testid="catalog-all"]').trigger('click')
    await flush()
    await scrollList(wrapper)
    await flush()
    expect(wrapper.text()).toContain('Summary BM-001')
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.retry')!
    await retry.trigger('click')
    await flush()
    expect(wrapper.text()).toContain('BM-002')
    expect(fetchCatalogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 1 }),
    )
    await wrapper.get('[data-testid="catalog-trigger"]').trigger('click')
    await wrapper.get('[data-testid="catalog-trigger"]').trigger('click')
    await flush()
    expect(fetchCatalogMock).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('BM-001')
    expect(wrapper.text()).toContain('BM-002')
    wrapper.unmount()
  })

  it('preloads near the bottom once, waits for the pending page, and stops at the end', async () => {
    let resolvePage!: (value: ReturnType<typeof page>) => void
    fetchCatalogMock
      .mockResolvedValueOnce(page(['BM-001'], 1))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve
          }),
      )
    const wrapper = mount(PromptGardenInspirationPopover, {
      props: { mode: 'arena', testId: 'catalog' },
    })
    await wrapper.get('[data-testid="catalog-trigger"]').trigger('click')
    await flush()
    await scrollList(wrapper, 0)
    expect(fetchCatalogMock).toHaveBeenCalledTimes(1)
    await scrollList(wrapper)
    await scrollList(wrapper)
    await scrollList(wrapper)
    expect(fetchCatalogMock).toHaveBeenCalledTimes(2)
    expect(fetchCatalogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 1 }),
    )
    expect(wrapper.get('[role="status"]').exists()).toBe(true)
    resolvePage(page(['BM-002']))
    await flush()
    await scrollList(wrapper)
    expect(fetchCatalogMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('BM-001')
    expect(wrapper.text()).toContain('BM-002')
    wrapper.unmount()
  })

  it('reuses image cards and a meaningful empty state, and opens a clearer image preview', async () => {
    fetchSuggestionsMock.mockResolvedValue({
      items: [
        {
          ...card('with-image'),
          mode: 'image-text2image',
          thumbnailUrl: 'https://garden.example/cover.thumb.webp',
          previewUrl: 'https://garden.example/cover.preview.webp',
        },
        { ...card('without-image'), mode: 'image-text2image' },
      ],
      nextExclude: [],
      ttlSeconds: 300,
      browseUrl: '',
    })
    fetchPreviewMock.mockResolvedValue('Original prompt')
    const wrapper = mount(PromptGardenInspirationPopover, {
      props: { mode: 'image-text2image', testId: 'gallery' },
    })
    await wrapper.get('[data-testid="gallery-trigger"]').trigger('click')
    await flush()
    expect(wrapper.findAllComponents({ name: 'NCard' })).toHaveLength(2)
    expect(
      wrapper.get('.app-preview-image-stub').attributes('data-preview-src'),
    ).toBe('https://garden.example/cover.preview.webp')
    expect(
      wrapper.get('[data-testid="gallery-suggestion-1"]').text(),
    ).toContain('No example image')
    await wrapper
      .get('[data-testid="gallery-suggestion-0-preview"]')
      .trigger('click')
    await flush()
    expect(wrapper.text()).toContain('Original prompt')
    expect(wrapper.emitted('apply')).toBeUndefined()
    wrapper.unmount()
  })

  it('ignores an older search response and resets results when the workspace changes', async () => {
    let resolveOld!: (value: ReturnType<typeof page>) => void
    fetchCatalogMock
      .mockResolvedValueOnce(page(['initial']))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValue(page(['new']))
    const wrapper = mount(PromptGardenInspirationPopover, {
      props: { mode: 'arena', testId: 'catalog' },
    })
    await wrapper.get('[data-testid="catalog-trigger"]').trigger('click')
    await flush()
    await wrapper.get('input').setValue('old')
    await vi.advanceTimersByTimeAsync(260)
    await wrapper.get('input').setValue('new')
    await vi.advanceTimersByTimeAsync(260)
    resolveOld(page(['old']))
    await flush()
    expect(wrapper.text()).toContain('Question new')
    expect(wrapper.text()).not.toContain('Question old')
    fetchSuggestionsMock.mockResolvedValue({
      items: [],
      nextExclude: [],
      ttlSeconds: 300,
      browseUrl: '',
    })
    await wrapper.setProps({ mode: 'image-image2image' })
    await flush()
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Question new')
    wrapper.unmount()
  })
})
