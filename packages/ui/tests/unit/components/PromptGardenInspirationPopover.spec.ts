import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const fetchSuggestionsMock = vi.hoisted(() => vi.fn())
const openExternalUrlMock = vi.hoisted(() => vi.fn())

vi.mock('@prompt-optimizer/core', () => ({
  getEnvVar: (key: string) => {
    if (key === 'VITE_ENABLE_PROMPT_GARDEN_IMPORT') return '1'
    if (key === 'VITE_PROMPT_GARDEN_BASE_URL') return 'https://garden.always200.com/'
    return ''
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en-US' },
    t: (key: string) => {
      const messages: Record<string, string> = {
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
          props.show ? h('div', { class: 'n-popover-content' }, slots.default?.()) : null,
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
  ExternalLink: defineComponent({ name: 'ExternalLink', setup: () => () => h('i') }),
  FileInput: defineComponent({ name: 'FileImport', setup: () => () => h('i') }),
  Sprout: defineComponent({ name: 'Plant2', setup: () => () => h('i') }),
  RefreshCw: defineComponent({ name: 'Refresh', setup: () => () => h('i') }),
}))

import PromptGardenInspirationPopover from '../../../src/components/common/PromptGardenInspirationPopover.vue'

describe('PromptGardenInspirationPopover', () => {
  beforeEach(() => {
    fetchSuggestionsMock.mockReset()
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

    await wrapper.find('[data-testid="garden-test-trigger"]').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchSuggestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gardenBaseUrl: 'https://garden.always200.com',
        mode: 'image-image2image',
        limit: 3,
        strategy: 'mixed',
        locale: 'en-US',
      }),
    )
    expect(wrapper.text()).toContain('Cinematic portrait')
    expect(wrapper.text()).toContain('Replace import')

    await wrapper.find('[data-testid="garden-test-suggestion-0-apply"]').trigger('click')

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
})
