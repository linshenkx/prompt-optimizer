import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => {
        const messages: Record<string, string> = {
          'evaluation.feedbackTitle': 'Evaluation feedback',
          'evaluation.feedbackPlaceholder': 'Describe what should improve',
          'evaluation.feedbackHint': 'Ctrl+Enter to submit',
          'evaluation.feedbackSubmit': 'Submit feedback',
          'common.cancel': 'Cancel',
        }
        return messages[key] ?? key
      },
    }),
  }
})

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: `
      <button
        class="n-button"
        :disabled="disabled"
        :data-type="type || ''"
        type="button"
        @click="$emit('click', $event)"
      >
        <slot />
      </button>
    `,
    props: ['disabled', 'size', 'type'],
    emits: ['click'],
  },
  NForm: {
    name: 'NForm',
    template: '<form class="n-form"><slot /></form>',
    props: ['showFeedback'],
  },
  NFormItem: {
    name: 'NFormItem',
    template: `
      <label class="n-form-item">
        <span v-if="showLabel" class="n-form-item-label">{{ label }}</span>
        <slot />
      </label>
    `,
    props: ['label', 'showLabel'],
  },
  NInput: {
    name: 'NInput',
    template: `
      <textarea
        class="n-input"
        :aria-label="ariaLabel"
        :disabled="disabled"
        :placeholder="placeholder"
        :rows="rows"
        :value="value"
        @input="$emit('update:value', $event.target.value)"
        @keydown="$emit('keydown', $event)"
      />
    `,
    props: ['value', 'type', 'rows', 'autosize', 'placeholder', 'ariaLabel', 'disabled'],
    emits: ['update:value', 'keydown'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['vertical', 'size', 'justify'],
  },
  NText: {
    name: 'NText',
    template: '<p class="n-text"><slot /></p>',
    props: ['depth'],
  },
}))

import FeedbackEditor from '../../../src/components/evaluation/FeedbackEditor.vue'

const mountEditor = (props: Partial<InstanceType<typeof FeedbackEditor>['$props']> = {}) =>
  mount(FeedbackEditor, { props })

describe('FeedbackEditor', () => {
  it('renders localized defaults and disables submit for blank feedback', () => {
    const wrapper = mountEditor({
      showTitle: true,
      showHint: true,
    })

    expect(wrapper.text()).toContain('Evaluation feedback')
    expect(wrapper.text()).toContain('Ctrl+Enter to submit')
    expect(wrapper.find('textarea').attributes('placeholder')).toBe('Describe what should improve')
    expect(wrapper.find('button[data-type="primary"]').attributes('disabled')).toBeDefined()
  })

  it('submits trimmed uncontrolled feedback and clears the input', async () => {
    const wrapper = mountEditor()

    await wrapper.find('textarea').setValue('  focus on wiki context  ')
    await wrapper.find('button[data-type="primary"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[{ feedback: 'focus on wiki context' }]])
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('emits controlled updates and requests clearing after submit', async () => {
    const wrapper = mountEditor({
      modelValue: 'existing feedback',
    })

    await wrapper.find('textarea').setValue('  updated feedback  ')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['  updated feedback  '])

    await wrapper.setProps({ modelValue: '  updated feedback  ' })
    await wrapper.find('button[data-type="primary"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[{ feedback: 'updated feedback' }]])
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })

  it('cancels and clears existing feedback', async () => {
    const wrapper = mountEditor()

    await wrapper.find('textarea').setValue('cancel this')
    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('cancel')).toEqual([[]])
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('supports Escape cancel and Ctrl or Cmd Enter submit shortcuts when actions are shown', async () => {
    const wrapper = mountEditor()

    await wrapper.find('textarea').setValue('keyboard submit')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('submit')).toEqual([[{ feedback: 'keyboard submit' }]])

    await wrapper.find('textarea').setValue('keyboard cancel')
    await wrapper.find('textarea').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toEqual([[]])

    await wrapper.find('textarea').setValue('keyboard submit again')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', metaKey: true })
    expect(wrapper.emitted('submit')?.at(-1)).toEqual([{ feedback: 'keyboard submit again' }])
  })

  it('does not intercept shortcuts when action buttons are hidden', async () => {
    const wrapper = mountEditor({
      showActions: false,
    })

    await wrapper.find('textarea').setValue('external container owns shortcuts')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await wrapper.find('textarea').trigger('keydown', { key: 'Escape' })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })
})
