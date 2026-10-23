import { mount } from '@vue/test-utils'
import { defineComponent, h, onMounted, reactive, ref, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TestWorkspaceLayout from '../../../src/components/common/TestWorkspaceLayout.vue'
import OptimizeWorkspaceLayout from '../../../src/components/common/OptimizeWorkspaceLayout.vue'

const geometry = reactive({ available: 800, config: 180 })
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { computed } = await import('vue')
  return { ...actual, useElementSize: (target: { value?: HTMLElement }) => ({
    width: computed(() => 360),
    height: computed(() => target.value?.classList.contains('test-config-scroll') ? geometry.config : geometry.available),
  }) }
})
beforeEach(() => { geometry.available = 800; geometry.config = 180 })

describe('co-visible workspace regions', () => {
  it('keeps focused configuration open when the mobile keyboard reduces available space', async () => {
    const configExpanded = ref(true)
    const Host = defineComponent({
      setup: () => () => h(TestWorkspaceLayout, {
        compact: true, configExpanded: configExpanded.value, hasResults: true,
        'onUpdate:configExpanded': value => { configExpanded.value = value },
      }, { input: () => h('input', { 'aria-label': 'Filter test model' }), results: () => h('article', 'Saved answer') }),
    })
    const wrapper = mount(Host, { attachTo: document.body })
    try {
      await nextTick()
      const input = wrapper.get('input').element
      input.focus()
      geometry.available = 400
      await nextTick()
      expect(configExpanded.value).toBe(true)
      expect(document.activeElement).toBe(input)
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      input.blur()
      geometry.available = 350
      await nextTick()
      expect(configExpanded.value).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('leaves configuration visibility controlled by the parent', async () => {
    const wrapper = mount(TestWorkspaceLayout, {
      props: { compact: true, configExpanded: true },
      slots: { input: '<textarea />', results: '<article>Answer</article>' },
    })
    try {
      await wrapper.get('[data-testid="test-config-toggle"]').trigger('click')
      expect(wrapper.emitted('update:configExpanded')).toEqual([[false]])
      expect(wrapper.get('[data-testid="test-config-toggle"]').attributes('aria-expanded')).toBe('true')
      await wrapper.setProps({ configExpanded: false })
      expect(wrapper.get('[data-testid="test-config-toggle"]').attributes('aria-expanded')).toBe('false')
    } finally { wrapper.unmount() }
  })

  it('synchronizes configuration visibility with parent requests and manual toggles', async () => {
    const configExpanded = ref(false)
    const Host = defineComponent({
      setup: () => () => h(TestWorkspaceLayout, {
        compact: true, configExpanded: configExpanded.value,
        'onUpdate:configExpanded': value => { configExpanded.value = value },
      }, { input: () => h('textarea'), results: () => h('article', 'Saved answer') }),
    })
    const wrapper = mount(Host, { attachTo: document.body })
    try {
      const layout = wrapper.getComponent(TestWorkspaceLayout)
      const editor = wrapper.get('textarea').element
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).toBe('none')
      configExpanded.value = true
      await nextTick()
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      await wrapper.get('[data-testid="test-config-toggle"]').trigger('click')
      expect(configExpanded.value).toBe(false)
      expect(layout.emitted('update:configExpanded')).toEqual([[false]])
      configExpanded.value = true
      await nextTick()
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      expect(wrapper.get('textarea').element).toBe(editor)
      expect(layout.emitted('update:configExpanded')).toEqual([[false]])
    } finally { wrapper.unmount() }
  })

  it('keeps automatic sizing responsive to space after v-model echoes and folds each run once', async () => {
    const configExpanded = ref(true)
    const running = ref(false)
    const Host = defineComponent({
      setup: () => () => h(TestWorkspaceLayout, {
        compact: true, configExpanded: configExpanded.value, running: running.value, hasResults: true,
        'onUpdate:configExpanded': value => { configExpanded.value = value },
      }, { input: () => h('textarea'), results: () => h('article', 'Saved answer') }),
    })
    const wrapper = mount(Host, { attachTo: document.body })
    try {
      await nextTick()
      const layout = wrapper.getComponent(TestWorkspaceLayout)
      geometry.available = 400
      await nextTick()
      expect(configExpanded.value).toBe(false)
      geometry.available = 900
      await nextTick()
      expect(configExpanded.value).toBe(true)
      expect(layout.emitted('update:configExpanded')).toEqual([[false], [true]])
      running.value = true
      await nextTick()
      expect(configExpanded.value).toBe(false)
      running.value = false
      await nextTick()
      expect(layout.emitted('update:configExpanded')).toEqual([[false], [true], [false]])
      configExpanded.value = true
      await nextTick()
      geometry.available = 400
      await nextTick()
      expect(configExpanded.value).toBe(true)
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
    } finally { wrapper.unmount() }
  })

  it('budgets restored-answer space on resize, preserves drafts, and respects manual expansion and desktop', async () => {
    geometry.available = 520
    geometry.config = 300
    const wrapper = mount(TestWorkspaceLayout, {
      attachTo: document.body,
      props: { compact: true, configExpanded: true, hasResults: false,
        'onUpdate:configExpanded': value => { void wrapper.setProps({ configExpanded: value }) },
      },
      slots: { input: '<textarea />', results: '<article>Answer</article>' },
    })
    try {
      await wrapper.get('textarea').setValue('unfinished configuration')
      const editor = wrapper.get('textarea').element
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      await wrapper.setProps({ hasResults: true })
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).toBe('none')
      geometry.available = 900
      await nextTick()
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      expect(wrapper.get('textarea').element).toBe(editor)
      expect(editor.value).toBe('unfinished configuration')
      await wrapper.get('[data-testid="test-config-toggle"]').trigger('click')
      geometry.available = 1000
      await nextTick()
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).toBe('none')
      await wrapper.setProps({ compact: false })
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      expect(editor.value).toBe('unfinished configuration')
    } finally { wrapper.unmount() }
  })

  it('folds configuration on a real run without discarding drafts, selections or answers', async () => {
    const wrapper = mount(TestWorkspaceLayout, {
      attachTo: document.body,
      props: { compact: true, configExpanded: true, running: false,
        'onUpdate:configExpanded': value => { void wrapper.setProps({ configExpanded: value }) },
      },
      slots: {
        input: '<textarea />',
        'variant-controls': '<select><option>a</option><option>b</option></select>',
        'config-summary': 'Message used for this answer',
        results: '<article>Saved answer</article>',
      },
    })
    try {
      await wrapper.get('textarea').setValue('unfinished draft')
      await wrapper.get('select').setValue('b')
      const input = wrapper.get('textarea').element
      const answer = wrapper.get('article').element
      await wrapper.setProps({ running: true, configExpanded: false })
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).toBe('none')
      expect(wrapper.get('.test-config-summary').text()).toContain('Message used')
      expect(wrapper.get('article').isVisible()).toBe(true)
      await wrapper.setProps({ running: false })
      expect(wrapper.get('[data-testid="test-config-toggle"]').attributes('aria-expanded')).toBe('false')
      await wrapper.get('[data-testid="test-config-toggle"]').trigger('click')
      expect(wrapper.get('textarea').element).toBe(input)
      expect(wrapper.get('textarea').element.value).toBe('unfinished draft')
      expect(wrapper.get('select').element.value).toBe('b')
      expect(wrapper.get('article').element).toBe(answer)
      await wrapper.get('[data-testid="test-config-toggle"]').trigger('click')
      await wrapper.setProps({ compact: false, running: true })
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      expect(wrapper.find('[data-testid="test-config-toggle"]').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('keeps test drafts, selections and results mounted across folding and desktop switches', async () => {
    let mounts = 0
    const Input = defineComponent({
      setup() {
        const draft = ref('original input')
        onMounted(() => { mounts += 1 })
        return () => h('textarea', {
          value: draft.value,
          onInput: (event: Event) => { draft.value = (event.target as HTMLTextAreaElement).value },
        })
      },
    })
    const wrapper = mount(TestWorkspaceLayout, {
      attachTo: document.body,
      props: { compact: true, configExpanded: true },
      slots: {
        input: () => h(Input),
        'variant-controls': () => h('select', [h('option', 'original'), h('option', 'workspace')]),
        results: '<article>saved answer</article>',
      },
    })
    const input = wrapper.get('textarea').element
    const selector = wrapper.get('select').element
    const answer = wrapper.get('article').element
    try {
      await wrapper.get('textarea').setValue('unfinished test input')
      await wrapper.get('select').setValue('workspace')
      expect(wrapper.find('.workspace-subview-switch').exists()).toBe(false)
      expect(wrapper.get('article').isVisible()).toBe(true)
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await wrapper.setProps({ configExpanded: false })
        expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).toBe('none')
        expect(wrapper.get<HTMLElement>('.test-results-scroll').element.style.display).not.toBe('none')
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        await wrapper.setProps({ configExpanded: true })
        expect(wrapper.get('textarea').element).toBe(input)
        expect(wrapper.get('textarea').element.value).toBe('unfinished test input')
        expect(wrapper.get('select').element).toBe(selector)
        expect(wrapper.get('select').element.value).toBe('workspace')
        expect(wrapper.get('article').element).toBe(answer)
      }
      await wrapper.setProps({ compact: false })
      expect(wrapper.find('.workspace-subview-switch').exists()).toBe(false)
      expect(wrapper.get<HTMLElement>('.test-results-scroll').element.style.display).not.toBe('none')
      expect(wrapper.get<HTMLElement>('.test-config-scroll').element.style.display).not.toBe('none')
      expect(wrapper.get('textarea').element).toBe(input)
      expect(wrapper.get('textarea').element.value).toBe('unfinished test input')
      expect(wrapper.get('article').element).toBe(answer)
      expect(mounts).toBe(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps both optimization editors mounted across responsive changes', async () => {
    let mounts = 0
    const Editor = defineComponent({
      setup() {
        const draft = ref('')
        onMounted(() => { mounts += 1 })
        return () => h('textarea', {
          value: draft.value,
          onInput: (event: Event) => { draft.value = (event.target as HTMLTextAreaElement).value },
        })
      },
    })
    const wrapper = mount(OptimizeWorkspaceLayout, {
      props: { compact: true },
      slots: { original: () => h(Editor), workspace: () => h(Editor) },
    })
    try {
      const original = wrapper.get('.optimize-original-scroll textarea')
      const workspace = wrapper.get('.optimize-workspace-scroll textarea')
      await original.setValue('original draft')
      await workspace.setValue('unsaved working copy')
      expect(wrapper.find('.workspace-subview-switch').exists()).toBe(false)
      expect(wrapper.get<HTMLElement>('.optimize-original-scroll').element.style.display).not.toBe('none')
      expect(wrapper.find('.workspace-subview-switch').exists()).toBe(false)
      await wrapper.setProps({ compact: false })
      expect(wrapper.get<HTMLElement>('.optimize-original-scroll').element.style.display).not.toBe('none')
      expect(wrapper.get<HTMLElement>('.optimize-workspace-scroll').element.style.display).not.toBe('none')
      expect(wrapper.get('.optimize-original-scroll textarea').element).toBe(original.element)
      expect(wrapper.get('.optimize-workspace-scroll textarea').element).toBe(workspace.element)
      expect((original.element as HTMLTextAreaElement).value).toBe('original draft')
      expect((workspace.element as HTMLTextAreaElement).value).toBe('unsaved working copy')
      expect(mounts).toBe(2)
    } finally {
      wrapper.unmount()
    }
  })

  it('exposes scroll and source anchors without requiring the caller to inspect layout markup', () => {
    const wrapper = mount(OptimizeWorkspaceLayout, {
      props: { compact: true },
      slots: { original: '<textarea />', workspace: '<article>Working prompt</article>' },
    })
    try {
      const original = wrapper.get<HTMLElement>('.optimize-original-scroll').element
      const content = wrapper.get<HTMLElement>('article').element
      original.scrollIntoView = vi.fn()
      content.scrollIntoView = vi.fn()
      wrapper.vm.setScrollTop(120)
      expect(wrapper.vm.getScrollTop()).toBe(120)
      wrapper.vm.scrollToSection('original')
      expect(original.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      wrapper.vm.scrollToSection('workspace', 'content')
      expect(content.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    } finally { wrapper.unmount() }
  })
})
