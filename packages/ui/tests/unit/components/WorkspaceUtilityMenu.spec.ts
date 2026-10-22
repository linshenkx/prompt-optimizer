import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const { pushMock, routerKeyMock, currentRoute, routerMock } = vi.hoisted(() => {
  const pushMock = vi.fn()
  const routerKeyMock = Symbol('router')
  const currentRoute = {
    value: {
      path: '/image/text2image',
      query: { keep: '1' },
    },
  }
  const routerMock = {
    currentRoute,
    push: pushMock,
  }

  return {
    pushMock,
    routerKeyMock,
    currentRoute,
    routerMock,
  }
})

vi.mock('vue-router', () => ({
  routerKey: routerKeyMock,
  useRouter: () => routerMock,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'common.promptGarden.title': 'Prompt Garden',
        'common.promptGarden.discover': 'Discover Garden Prompts',
        'common.promptGarden.importPrompt': 'Import Garden Prompt',
        'common.promptGarden.importFavorite': 'Import as Favorite',
        'common.promptGarden.importTitle': 'Import Prompt Garden Prompt',
        'common.promptGarden.importHint': 'Paste import code',
        'common.promptGarden.importFavoriteTitle': 'Import Prompt Garden Favorite',
        'common.promptGarden.importFavoriteHint': 'Paste import code and save favorite',
        'common.promptGarden.importPlaceholder': 'Enter import code',
        'common.workspaceTools': 'Workspace Tools',
        'common.clearContent': 'Clear Content',
        'common.import': 'Import',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
        'common.clearContentWillLabel': 'Clears:',
        'common.clearContentWill': 'content',
        'common.clearContentKeepLabel': 'Keeps:',
        'common.clearContentKeep': 'settings',
      }
      return messages[key] ?? key
    },
  }),
}))

vi.mock('@prompt-optimizer/core', () => ({
  getEnvVar: (key: string) => {
    if (key === 'VITE_ENABLE_PROMPT_GARDEN_IMPORT') return '1'
    if (key === 'VITE_PROMPT_GARDEN_BASE_URL') return 'https://garden.always200.com/'
    return ''
  },
}))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()

  return {
    ...actual,
    NButton: defineComponent({
      name: 'NButton',
      setup(_, { slots, attrs }) {
        return () => h('button', attrs, slots.default?.())
      },
    }),
    NDropdown: defineComponent({
      name: 'NDropdown',
      props: {
        options: {
          type: Array,
          default: () => [],
        },
      },
      emits: ['select'],
      setup(props, { slots, emit }) {
        return () =>
          h('div', { class: 'n-dropdown-stub' }, [
            h('div', { class: 'n-dropdown-trigger' }, slots.default?.()),
            h(
              'div',
              { class: 'n-dropdown-menu' },
              (props.options as Array<{ key: string; label: string }>).map((option) =>
                h(
                  'button',
                  {
                    type: 'button',
                    'data-dropdown-key': option.key,
                    onClick: () => emit('select', option.key),
                  },
                  option.label,
                ),
              ),
            ),
          ])
      },
    }),
    NIcon: defineComponent({
      name: 'NIcon',
      setup(_, { slots }) {
        return () => h('span', { class: 'n-icon-stub' }, slots.default?.())
      },
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: '',
        },
      },
      emits: ['update:value'],
      setup(props, { emit, attrs }) {
        return () =>
          h('input', {
            ...attrs,
            value: props.value,
            onInput: (event: Event) => {
              emit('update:value', (event.target as HTMLInputElement).value)
            },
          })
      },
    }),
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: Boolean,
        title: String,
        positiveText: String,
        negativeText: String,
        onPositiveClick: Function,
      },
      setup(props, { slots }) {
        return () =>
          props.show
            ? h('div', { class: 'n-modal-stub' }, [
                h('h2', props.title),
                slots.default?.(),
                h(
                  'button',
                  {
                    type: 'button',
                    'data-testid': 'modal-positive',
                    onClick: () => props.onPositiveClick?.(),
                  },
                  props.positiveText,
                ),
              ])
            : null
      },
    }),
  }
})

vi.mock('../../../src/components/common/ThemedTooltip.vue', () => ({
  default: defineComponent({
    name: 'ThemedTooltip',
    props: {
      label: String,
    },
    setup(props, { slots }) {
      return () => h('div', { 'data-tooltip': props.label }, slots.default?.())
    },
  }),
}))

vi.mock('../../../src/components/source/SourceAssetBadge.vue', () => ({
  default: defineComponent({
    name: 'SourceAssetBadge',
    setup() {
      return () => h('button', { type: 'button' }, 'source')
    },
  }),
}))

import WorkspaceUtilityMenu from '../../../src/components/common/WorkspaceUtilityMenu.vue'

const mountComponent = (props: { compact?: boolean } = {}) =>
  mount(WorkspaceUtilityMenu, {
    props,
    global: {
      renderStubDefaultSlot: true,
      provide: {
        [routerKeyMock]: routerMock,
      },
    },
  })

describe('WorkspaceUtilityMenu Prompt Garden actions', () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentRoute.value = {
      path: '/image/text2image',
      query: { keep: '1' },
    }
    vi.stubGlobal('open', vi.fn())
    window.electronAPI = undefined
  })

  it('shows a compact Garden menu and opens discovery externally', async () => {
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="workspace-prompt-garden-menu"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Discover Garden Prompts')
    expect(wrapper.text()).toContain('Import Garden Prompt')
    expect(wrapper.text()).toContain('Import as Favorite')

    await wrapper.find('[data-dropdown-key="discover"]').trigger('click')

    expect(window.open).toHaveBeenCalledWith('https://garden.always200.com', '_blank', 'noopener,noreferrer')
  })

  it('applies pasted Garden import links through the current route query', async () => {
    const wrapper = mountComponent()

    await wrapper.find('[data-dropdown-key="import-code"]').trigger('click')
    await wrapper.find('[data-testid="workspace-prompt-garden-import-code"]').setValue(
      'https://prompt.always200.com/#/image/text2image?importCode=garden_123&exampleId=ex-2&subModeKey=image-text2image&saveToFavorites=confirm',
    )
    await wrapper.find('[data-testid="modal-positive"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith({
      path: '/image/text2image',
      query: {
        keep: '1',
        importCode: 'garden_123',
        exampleId: 'ex-2',
        subModeKey: 'image-text2image',
      },
    })
  })

  it('can import a pasted Garden link as a favorite through the route query', async () => {
    const wrapper = mountComponent()

    await wrapper.find('[data-dropdown-key="import-favorite"]').trigger('click')
    expect(wrapper.text()).toContain('Import Prompt Garden Favorite')

    await wrapper.find('[data-testid="workspace-prompt-garden-import-code"]').setValue(
      'https://prompt.always200.com/#/image/text2image?importCode=garden_fav&exampleId=ex-2',
    )
    await wrapper.find('[data-testid="modal-positive"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith({
      path: '/image/text2image',
      query: {
        keep: '1',
        importCode: 'garden_fav',
        saveToFavorites: 'confirm',
      },
    })
  })

  it('keeps Garden actions reachable from one mobile utility trigger', async () => {
    const wrapper = mountComponent({ compact: true })
    expect(wrapper.find('[data-testid="workspace-prompt-garden-menu"]').exists()).toBe(false)
    expect(wrapper.findAll('.workspace-utility-button')).toHaveLength(1)
    expect(wrapper.findAll('.n-dropdown-trigger')).toHaveLength(1)
    await wrapper.get('[data-dropdown-key="import-code"]').trigger('click')
    await wrapper.get('[data-testid="workspace-prompt-garden-import-code"]').setValue(
      'https://prompt.always200.com/#/image/text2image?importCode=mobile_code&exampleId=ex-1',
    )
    await wrapper.get('[data-testid="modal-positive"]').trigger('click')
    expect(pushMock).toHaveBeenCalledWith({
      path: '/image/text2image',
      query: { keep: '1', importCode: 'mobile_code', exampleId: 'ex-1' },
    })
    wrapper.unmount()
  })

  it('retains the clear confirmation after consolidating mobile tools', async () => {
    const wrapper = mountComponent({ compact: true })
    await wrapper.get('[data-dropdown-key="clear-content"]').trigger('click')
    expect(wrapper.text()).toContain('Clears:')
    expect(wrapper.emitted('clear')).toBeUndefined()
    await wrapper.get('[data-testid="modal-positive"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    wrapper.unmount()
  })
})
