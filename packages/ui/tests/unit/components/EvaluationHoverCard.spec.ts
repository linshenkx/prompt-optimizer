import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EvaluationHoverCard from '../../../src/components/evaluation/EvaluationHoverCard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

const naiveStubs = {
  NText: {
    name: 'NText',
    template: '<span><slot /></span>',
    props: ['depth', 'type'],
  },
  NTag: {
    name: 'NTag',
    template: '<span><slot /></span>',
    props: ['type', 'size', 'round'],
  },
  NProgress: {
    name: 'NProgress',
    template: '<div class="n-progress" />',
    props: ['percentage', 'status', 'showIndicator', 'height'],
  },
  NButton: {
    name: 'NButton',
    template: '<button @click="$emit(\'click\', $event)"><slot /><slot name="icon" /></button>',
    props: ['text', 'size', 'type', 'disabled'],
    emits: ['click'],
  },
  NSpin: {
    name: 'NSpin',
    template: '<div class="n-spin" />',
    props: ['size'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['justify', 'size', 'align'],
  },
  NDivider: {
    name: 'NDivider',
    template: '<hr class="n-divider" />',
    props: ['vertical', 'titlePlacement'],
  },
  NIcon: {
    name: 'NIcon',
    template: '<span class="n-icon"><slot /></span>',
    props: ['size', 'depth'],
  },
  NCard: {
    name: 'NCard',
    template: '<div class="n-card"><slot /></div>',
    props: ['embedded', 'size', 'bordered'],
  },
  NList: {
    name: 'NList',
    template: '<div class="n-list"><slot /></div>',
    props: ['showDivider', 'hoverable'],
  },
  NListItem: {
    name: 'NListItem',
    template: '<div class="n-list-item"><slot /></div>',
    props: [],
  },
  NEmpty: {
    name: 'NEmpty',
    template: '<div class="n-empty"><slot /><slot name="extra" /></div>',
    props: ['description'],
  },
  NTooltip: {
    name: 'NTooltip',
    template: '<span class="n-tooltip"><slot name="trigger" /><slot /></span>',
    props: ['trigger'],
  },
}

const feedbackEditorStub = {
  name: 'FeedbackEditor',
  template:
    '<div data-testid="feedback-editor-stub"><button data-testid="set-feedback" @click="$emit(\'update:modelValue\', \'needs work\')">set</button></div>',
  props: ['modelValue', 'showActions', 'disabled'],
  emits: ['update:modelValue'],
}

const baseResult = {
  type: 'optimized',
  score: {
    overall: 88,
    dimensions: [
      {
        key: 'clarity',
        label: '清晰度',
        score: 90,
      },
    ],
  },
  improvements: [],
  summary: 'summary',
  patchPlan: [],
}

const createWrapper = () =>
  mount(EvaluationHoverCard, {
    props: {
      result: baseResult,
      type: 'optimized',
      loading: false,
    },
    global: {
      stubs: {
        ...naiveStubs,
        InlineDiff: { name: 'InlineDiff', template: '<div class="inline-diff" />' },
        FeedbackEditor: feedbackEditorStub,
      },
    },
  })

describe('EvaluationHoverCard feedback editor interaction', () => {
  it('默认应展示反馈编辑器', async () => {
    const wrapper = createWrapper()

    expect(wrapper.find('[data-testid="feedback-editor-stub"]').exists()).toBe(true)
  })

  it('点击重新评估：无反馈则 emit evaluate；有反馈则 emit evaluate-with-feedback', async () => {
    const wrapper = createWrapper()

    const findReEvaluateButton = () =>
      wrapper
        .findAll('button')
        .find((btn) => btn.text().trim() === 'evaluation.reEvaluate')

    const reEvaluateButton1 = findReEvaluateButton()
    expect(reEvaluateButton1).toBeTruthy()

    await reEvaluateButton1!.trigger('click')
    await nextTick()

    expect(wrapper.emitted('evaluate')).toBeTruthy()
    expect(wrapper.emitted('evaluate-with-feedback')).toBeFalsy()

    await wrapper.find('[data-testid="set-feedback"]').trigger('click')
    await nextTick()

    const reEvaluateButton2 = findReEvaluateButton()
    expect(reEvaluateButton2).toBeTruthy()

    await reEvaluateButton2!.trigger('click')
    await nextTick()

    const withFeedback = wrapper.emitted('evaluate-with-feedback')
    expect(withFeedback).toBeTruthy()
    expect(withFeedback?.[0]?.[0]).toEqual({ feedback: 'needs work' })

    // feedback 会在触发后清空：再次点击应回退到无反馈逻辑
    const reEvaluateButton3 = findReEvaluateButton()
    expect(reEvaluateButton3).toBeTruthy()

    await reEvaluateButton3!.trigger('click')
    await nextTick()

    expect((wrapper.emitted('evaluate') || []).length).toBeGreaterThanOrEqual(2)
  })
})
