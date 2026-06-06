import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: `
      <button
        v-bind="$attrs"
        :disabled="disabled"
        :data-loading="loading ? 'true' : 'false'"
        :data-type="type || ''"
        type="button"
        @click="$emit('click', $event)"
      >
        <slot name="icon" />
        <slot />
      </button>
    `,
    props: ['disabled', 'loading', 'type', 'size'],
    emits: ['click'],
  },
  NButtonGroup: {
    name: 'NButtonGroup',
    template: '<div class="n-button-group" v-bind="$attrs"><slot /></div>',
  },
  NCard: {
    name: 'NCard',
    template: '<section class="n-card"><header><slot name="header" /></header><slot /></section>',
    props: ['embedded', 'size', 'bordered'],
  },
  NIcon: {
    name: 'NIcon',
    template: '<i class="n-icon"><slot /></i>',
    props: ['size'],
  },
  NPopover: {
    name: 'NPopover',
    template: `
      <div class="n-popover-stub" :data-disabled="String(disabled)">
        <slot name="trigger" />
        <section v-if="show" class="n-popover-content">
          <slot />
        </section>
      </div>
    `,
    props: ['show', 'disabled', 'trigger', 'placement', 'flip', 'style', 'contentStyle'],
    emits: ['update:show', 'clickoutside'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['align', 'justify', 'size', 'vertical'],
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag"><slot /></span>',
    props: ['size', 'round', 'bordered', 'type'],
  },
  NText: {
    name: 'NText',
    template: '<p class="n-text"><slot /></p>',
    props: ['depth'],
  },
  NTooltip: {
    name: 'NTooltip',
    template: '<div class="n-tooltip-stub"><slot name="trigger" /><slot /></div>',
    props: ['trigger', 'disabled', 'themeOverrides', 'overlayStyle', 'contentStyle'],
  },
}))

vi.mock('@vicons/tabler', () => ({
  Focus2: {
    name: 'Focus2',
    template: '<span class="focus-icon-stub" />',
  },
}))

vi.mock('../../../src/composables/ui/useTooltipTheme', () => ({
  useTooltipTheme: () => ({
    tooltipThemeOverrides: {},
    tooltipOverlayStyle: {},
    tooltipContentStyle: {},
  }),
}))

vi.mock('../../../src/components/common/ThemedTooltip.vue', () => ({
  default: {
    name: 'ThemedTooltip',
    template: '<div class="themed-tooltip-stub"><slot /></div>',
    props: ['label', 'disabled'],
  },
}))

vi.mock('../../../src/components/evaluation/AnalyzeActionIcon.vue', () => ({
  default: {
    name: 'AnalyzeActionIcon',
    template: '<span class="analyze-action-icon-stub" />',
  },
}))

vi.mock('../../../src/components/evaluation/FeedbackEditor.vue', () => ({
  default: {
    name: 'FeedbackEditor',
    template: `
      <textarea
        class="feedback-editor-stub"
        :disabled="disabled"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    `,
    props: ['modelValue', 'disabled', 'showActions', 'placeholder'],
    emits: ['update:modelValue'],
  },
}))

import FocusAnalyzeButton from '../../../src/components/evaluation/FocusAnalyzeButton.vue'

const NTooltipStub = defineComponent({
  name: 'NTooltip',
  props: {
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'n-tooltip-stub', 'data-disabled': String(props.disabled) }, [
        slots.trigger?.(),
        h('div', { class: 'n-tooltip-content' }, slots.default?.()),
      ])
  },
})

const NButtonStub = defineComponent({
  name: 'NButton',
  props: {
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    type: { type: String, default: '' },
  },
  emits: ['click'],
  setup(props, { slots, emit, attrs }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          disabled: props.disabled,
          'data-loading': String(props.loading),
          'data-type': props.type,
          onClick: (event: MouseEvent) => emit('click', event),
        },
        slots.default?.()
      )
  },
})

const NPopoverStub = defineComponent({
  name: 'NPopover',
  props: {
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:show', 'clickoutside'],
  setup(props, { slots, emit }) {
    return () =>
      h('div', { class: 'n-popover-stub', 'data-disabled': String(props.disabled) }, [
        slots.trigger?.(),
        props.show
          ? h(
              'section',
              {
                class: 'n-popover-content',
                onClickoutside: () => emit('clickoutside'),
              },
              slots.default?.()
            )
          : null,
      ])
  },
})

const FeedbackEditorStub = defineComponent({
  name: 'FeedbackEditor',
  props: {
    modelValue: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('textarea', {
        class: 'feedback-editor-stub',
        disabled: props.disabled,
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      })
  },
})

const simpleStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', { class: name }, slots.default?.())
    },
  })

const stubs = {
  NButton: NButtonStub,
  NButtonGroup: simpleStub('NButtonGroup'),
  NCard: simpleStub('NCard'),
  NIcon: simpleStub('NIcon'),
  NPopover: NPopoverStub,
  NSpace: simpleStub('NSpace'),
  NTag: simpleStub('NTag'),
  NText: simpleStub('NText'),
  NTooltip: NTooltipStub,
  FeedbackEditor: FeedbackEditorStub,
  AnalyzeActionIcon: simpleStub('AnalyzeActionIcon'),
  Focus2: simpleStub('Focus2'),
  ThemedTooltip: simpleStub('ThemedTooltip'),
}

const mountButton = (props: Partial<InstanceType<typeof FocusAnalyzeButton>['$props']> = {}) =>
  mount(FocusAnalyzeButton, {
    props: {
      type: 'result',
      label: '智能评估',
      ...props,
    },
    global: {
      stubs,
    },
  })

describe('FocusAnalyzeButton', () => {
  it('renders disabled reason tooltip content when evaluation is blocked', () => {
    const wrapper = mountButton({
      type: 'compare',
      label: '对比评估',
      disabled: true,
      disabledReason: '对比评估至少需要一个工作区测试结果。',
    })

    expect(wrapper.get('.focus-analyze-tooltip-trigger').attributes('title')).toBe(
      '对比评估至少需要一个工作区测试结果。'
    )
  })

  it('emits default evaluation from the main action', async () => {
    const wrapper = mountButton()

    await wrapper.get('[data-testid="focus-analyze-main"]').trigger('click')

    expect(wrapper.emitted('evaluate')).toEqual([[]])
    expect(wrapper.find('.n-popover-content').exists()).toBe(false)
  })

  it('opens focus input and emits trimmed feedback evaluation', async () => {
    const wrapper = mountButton({
      type: 'compare',
      label: '对比评估',
    })

    await wrapper.get('[data-testid="focus-analyze-trigger"]').trigger('click')
    expect(wrapper.find('.n-popover-content').exists()).toBe(true)

    await wrapper.get('.feedback-editor-stub').setValue('  优先检查飞书 wiki 术语一致性  ')
    await wrapper.find('button[data-type="primary"]').trigger('click')

    expect(wrapper.emitted('evaluate-with-feedback')).toEqual([
      [{ type: 'compare', feedback: '优先检查飞书 wiki 术语一致性' }],
    ])
    expect(wrapper.find('.n-popover-content').exists()).toBe(false)
  })

  it('falls back to default evaluation when focus feedback is blank', async () => {
    const wrapper = mountButton()

    await wrapper.get('[data-testid="focus-analyze-trigger"]').trigger('click')
    await wrapper.get('.feedback-editor-stub').setValue('   ')
    await wrapper.find('button[data-type="primary"]').trigger('click')

    expect(wrapper.emitted('evaluate')).toEqual([[]])
    expect(wrapper.emitted('evaluate-with-feedback')).toBeUndefined()
  })

  it('cancels and clickoutside close the focus popover without evaluating', async () => {
    const wrapper = mountButton()

    await wrapper.get('[data-testid="focus-analyze-trigger"]').trigger('click')
    expect(wrapper.find('.n-popover-content').exists()).toBe(true)

    const cancelButton = wrapper
      .findAll('button')
      .find((button) => !button.attributes('data-testid') && button.attributes('data-type') !== 'primary')
    await cancelButton!.trigger('click')
    expect(wrapper.find('.n-popover-content').exists()).toBe(false)

    await wrapper.get('[data-testid="focus-analyze-trigger"]').trigger('click')
    wrapper.findComponent({ name: 'NPopover' }).vm.$emit('clickoutside')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.n-popover-content').exists()).toBe(false)
    expect(wrapper.emitted('evaluate')).toBeUndefined()
    expect(wrapper.emitted('evaluate-with-feedback')).toBeUndefined()
  })

  it('blocks evaluation and focus input while disabled or loading', async () => {
    const disabledWrapper = mountButton({
      disabled: true,
      disabledReason: '当前没有可评估结果。',
    })

    await disabledWrapper.get('[data-testid="focus-analyze-main"]').trigger('click')
    await disabledWrapper.get('[data-testid="focus-analyze-trigger"]').trigger('click')

    expect(disabledWrapper.emitted('evaluate')).toBeUndefined()
    expect(disabledWrapper.find('.n-popover-content').exists()).toBe(false)

    const loadingWrapper = mountButton({
      loading: true,
    })

    expect(loadingWrapper.get('[data-testid="focus-analyze-main"]').attributes('disabled')).toBeDefined()
    expect(loadingWrapper.get('[data-testid="focus-analyze-main"]').attributes('data-loading')).toBe('true')

    await loadingWrapper.get('[data-testid="focus-analyze-main"]').trigger('click')
    await loadingWrapper.get('[data-testid="focus-analyze-trigger"]').trigger('click')

    expect(loadingWrapper.emitted('evaluate')).toBeUndefined()
    expect(loadingWrapper.find('.n-popover-content').exists()).toBe(false)
  })
})
