import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import EvaluationScoreBadge from '../../../src/components/evaluation/EvaluationScoreBadge.vue'

const NPopoverStub = defineComponent({
  name: 'NPopover',
  props: {
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:show', 'clickoutside'],
  setup(props, { slots, expose }) {
    expose({
      syncPosition: () => {
        // no-op in unit tests
      },
    })

    return () =>
      h('div', { class: 'n-popover-stub' }, [
        slots.trigger?.(),
        props.show ? h('div', { class: 'n-popover-content' }, slots.default?.()) : null,
      ])
  },
})

const NButtonStub = defineComponent({
  name: 'NButton',
  props: {
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },
  emits: ['click', 'mouseenter', 'mouseleave'],
  setup(props, { slots, emit, attrs }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          disabled: props.disabled,
          onClick: (e: MouseEvent) => emit('click', e),
          onMouseenter: (e: MouseEvent) => emit('mouseenter', e),
          onMouseleave: (e: MouseEvent) => emit('mouseleave', e),
        },
        slots.default?.()
      )
  },
})

const EvaluationHoverCardStub = defineComponent({
  name: 'EvaluationHoverCard',
  props: ['result', 'type', 'loading', 'visible'],
  emits: ['show-detail', 'evaluate', 'evaluate-with-feedback', 'apply-improvement', 'apply-patch'],
  setup() {
    return () => h('div', { class: 'hover-card-stub' }, [h('textarea', { 'data-testid': 'feedback-input' })])
  },
})

describe('EvaluationScoreBadge popover focus interaction', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('focus within popover should prevent hover auto-close while typing', async () => {
    vi.useFakeTimers()

    const wrapper = mount(EvaluationScoreBadge, {
      props: {
        score: 80,
        level: 'good',
        loading: false,
        result: null,
        type: 'original',
      },
      global: {
        stubs: {
          NPopover: NPopoverStub,
          NButton: NButtonStub,
          EvaluationHoverCard: EvaluationHoverCardStub,
        },
      },
    })

    const badgeButton = wrapper.find('[data-testid="score-badge-original"]')
    expect(badgeButton.exists()).toBe(true)

    // Open popover via hover
    await badgeButton.trigger('mouseenter')
    await nextTick()
    expect(wrapper.find('.hover-card-wrapper').exists()).toBe(true)

    // Enter focus state (e.g., user clicks into textarea and starts typing)
    await wrapper.find('.hover-card-wrapper').trigger('focusin')

    // Simulate mouse leaving the popover while still focused
    await wrapper.find('.hover-card-wrapper').trigger('mouseleave')
    vi.advanceTimersByTime(300)
    await nextTick()

    // Should still be visible because focus prevents scheduleClose
    expect(wrapper.find('.hover-card-wrapper').exists()).toBe(true)
  })
})
