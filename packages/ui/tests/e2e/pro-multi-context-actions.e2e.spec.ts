import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { setActivePinia } from 'pinia'

import ContextSystemWorkspace from '../../src/components/context-mode/ContextSystemWorkspace.vue'
import { useProMultiMessageSession } from '../../src/stores/session/useProMultiMessageSession'
import { useSessionManager } from '../../src/stores/session/useSessionManager'
import { createTestPinia } from '../utils/pinia-test-helpers'

// Keep this test focused on UI wiring (click -> messages update -> open editor).
// Naive UI is mocked so we can trigger events deterministically in JSDOM.
vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()

  const NCard = defineComponent({
    name: 'NCard',
    template: `
      <div class="n-card" v-bind="$attrs">
        <div class="n-card__header"><slot name="header" /></div>
        <div class="n-card__content"><slot /></div>
        <div class="n-card__footer"><slot name="footer" /></div>
      </div>
    `,
  })

  const NFlex = defineComponent({
    name: 'NFlex',
    template: `<div class="n-flex" v-bind="$attrs"><slot /></div>`,
  })

  const NButton = defineComponent({
    name: 'NButton',
    inheritAttrs: false,
    emits: ['click'],
    props: {
      disabled: { type: Boolean, default: false },
      loading: { type: Boolean, default: false },
    },
    template: `
      <button
        class="n-button"
        v-bind="$attrs"
        :disabled="disabled || loading"
        @click="$emit('click')"
      >
        <slot name="icon" />
        <slot />
      </button>
    `,
  })

  const NText = defineComponent({
    name: 'NText',
    template: `<span class="n-text" v-bind="$attrs"><slot /></span>`,
  })

  const NEmpty = defineComponent({
    name: 'NEmpty',
    template: `
      <div class="n-empty" v-bind="$attrs">
        <div class="n-empty__icon"><slot name="icon" /></div>
        <div class="n-empty__content"><slot /></div>
        <div class="n-empty__extra"><slot name="extra" /></div>
      </div>
    `,
  })

  const NSelect = defineComponent({
    name: 'NSelect',
    inheritAttrs: false,
    props: {
      value: { type: [String, Number, Array, Object], default: undefined },
      options: { type: Array, default: () => [] },
    },
    emits: ['update:value'],
    template: `<select class="n-select" v-bind="$attrs"></select>`,
  })

  const NRadioGroup = defineComponent({
    name: 'NRadioGroup',
    inheritAttrs: false,
    props: { value: { type: [String, Number], default: undefined } },
    emits: ['update:value'],
    template: `<div class="n-radio-group" v-bind="$attrs"><slot /></div>`,
  })

  const NRadioButton = defineComponent({
    name: 'NRadioButton',
    inheritAttrs: false,
    template: `<button class="n-radio-button" v-bind="$attrs"><slot /></button>`,
  })

  const NTooltip = defineComponent({
    name: 'NTooltip',
    template: `<span class="n-tooltip" v-bind="$attrs"><slot /></span>`,
  })

  const NTag = defineComponent({
    name: 'NTag',
    template: `<span class="n-tag" v-bind="$attrs"><slot /></span>`,
  })

  const NSpace = defineComponent({
    name: 'NSpace',
    template: `<div class="n-space" v-bind="$attrs"><slot /></div>`,
  })

  const NScrollbar = defineComponent({
    name: 'NScrollbar',
    template: `<div class="n-scrollbar" v-bind="$attrs"><slot /></div>`,
  })

  const NList = defineComponent({
    name: 'NList',
    template: `<div class="n-list" v-bind="$attrs"><slot /></div>`,
  })

  const NListItem = defineComponent({
    name: 'NListItem',
    template: `<div class="n-list-item" v-bind="$attrs"><slot /></div>`,
  })

  const NDropdown = defineComponent({
    name: 'NDropdown',
    template: `<div class="n-dropdown" v-bind="$attrs"><slot /></div>`,
  })

  return {
    ...actual,
    NCard,
    NFlex,
    NButton,
    NText,
    NEmpty,
    NSelect,
    NRadioGroup,
    NRadioButton,
    NTooltip,
    NTag,
    NSpace,
    NScrollbar,
    NList,
    NListItem,
    NDropdown,
  }
})

describe('Pro Multi: context actions wiring (e2e)', () => {
  it('can add first message and open context editor', async () => {
    const { pinia } = createTestPinia()
    setActivePinia(pinia)

    // ContextSystemWorkspace touches temp variables which depend on session manager readers.
    // In the app this is injected by PromptOptimizerApp; in tests we inject a stable default.
    useSessionManager().injectSubModeReaders({
      getFunctionMode: () => 'pro',
      getBasicSubMode: () => 'system',
      getProSubMode: () => 'multi',
      getImageSubMode: () => 'text2image',
    })

    const openContextEditor = vi.fn()

    const wrapper = mount(ContextSystemWorkspace, {
      global: {
        plugins: [pinia],
        provide: {
          // ContextSystemWorkspace expects a Ref<AppServices | null>.
          services: ref(null),
          openContextEditor,
          openModelManager: vi.fn(),
          openTemplateManager: vi.fn(),
        },
        stubs: {
          // Keep the surface area minimal; we only care about ConversationManager wiring.
          PromptPanelUI: true,
          PromptPreviewPanel: true,
          ConversationTestPanel: true,
          OutputDisplay: true,
          SelectWithConfig: true,
          ToolCallDisplay: true,
          EvaluationPanel: true,
          EvaluationScoreBadge: true,
          VariableAwareInput: true,
        },
      },
    })

    await wrapper.find('[data-testid="pro-multi-add-first-message"]').trigger('click')
    await nextTick()

    const proMulti = useProMultiMessageSession()
    expect(proMulti.conversationMessagesSnapshot).toHaveLength(1)
    expect(proMulti.conversationMessagesSnapshot[0]?.role).toBe('user')

    await wrapper.find('[data-testid="pro-multi-open-context-editor"]').trigger('click')
    expect(openContextEditor).toHaveBeenCalledTimes(1)

    const [messages] = openContextEditor.mock.calls[0] ?? []
    expect(messages).toHaveLength(1)
  })
})
