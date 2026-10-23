import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OptimizeWorkspaceLayout from '../../../src/components/common/OptimizeWorkspaceLayout.vue'
import TestWorkspaceLayout from '../../../src/components/common/TestWorkspaceLayout.vue'
import { useWorkspaceViewState, type WorkspaceViewMode } from '../../../src/composables/ui/useWorkspaceViewState'
import { useWorkspacePresentation } from '../../../src/composables/ui/useWorkspacePresentation'
import { useWorkspaceLayout } from '../../../src/composables/ui/useWorkspaceLayout'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => vi.unstubAllGlobals())

const modes: WorkspaceViewMode[] = ['system', 'user', 'pro-multi', 'pro-variable', 'image-text2image', 'image-image2image', 'image-multiimage']

function mountWorkspace(mode: WorkspaceViewMode) {
  let workspace!: ReturnType<typeof useWorkspacePresentation>
  let layout!: ReturnType<typeof useWorkspaceLayout>
  const wrapper = mount(defineComponent({
    setup() {
      layout = useWorkspaceLayout()
      layout.containerWidth.value = 393
      workspace = useWorkspacePresentation(mode)
      return () => h('div', [
        h(OptimizeWorkspaceLayout, {
          ref: workspace.optimizeLayoutRef,
          compact: workspace.isCompact.value,
          style: { display: workspace.isCompact.value && workspace.mobileRegion.value !== 'optimize' ? 'none' : '' },
          onScroll: workspace.rememberOptimizeScroll,
        }, { original: () => h('textarea'), workspace: () => h('article', 'Working prompt') }),
        h(TestWorkspaceLayout, {
          ref: workspace.testLayoutRef,
          compact: workspace.isCompact.value,
          configExpanded: workspace.testConfigExpanded.value,
          'onUpdate:configExpanded': value => { workspace.testConfigExpanded.value = value },
          style: { display: workspace.isCompact.value && workspace.mobileRegion.value !== 'test' ? 'none' : '' },
          onScroll: workspace.rememberTestScroll,
        }, { input: () => h('textarea'), results: () => [h('article', 'A answer'), h('article', 'B answer')] }),
      ])
    },
  }))
  return { wrapper, workspace, layout }
}

const settle = async () => { await nextTick(); await nextTick() }

describe('workspace presentation', () => {
  it.each(modes)('retains both reader positions across regions, responsive changes and remounts in %s', async mode => {
    const state = useWorkspaceViewState(mode)
    state.resetView()
    const { wrapper, workspace, layout } = mountWorkspace(mode)
    try {
      await settle()
      const optimize = wrapper.get<HTMLElement>('.optimize-workspace-layout')
      const test = wrapper.get<HTMLElement>('.test-workspace-layout')
      optimize.element.scrollTop = 140
      await optimize.trigger('scroll')
      workspace.mobileRegion.value = 'test'
      await settle()
      test.element.scrollTop = 320
      await test.trigger('scroll')
      workspace.testConfigExpanded.value = false
      workspace.mobileRegion.value = 'optimize'
      await settle()
      expect(optimize.element.scrollTop).toBe(140)
      workspace.mobileRegion.value = 'test'
      await settle()
      expect(test.element.scrollTop).toBe(320)
      expect(workspace.testConfigExpanded.value).toBe(false)
      expect(wrapper.findAll('textarea')).toHaveLength(2)
      expect(wrapper.findAll('article')).toHaveLength(3)
      layout.containerWidth.value = 1440
      await settle()
      expect(wrapper.get<HTMLElement>('.test-results-scroll').element.scrollTop).toBe(320)
      layout.containerWidth.value = 393
      await settle()
      expect(test.element.scrollTop).toBe(320)
      expect(optimize.element.scrollTop).toBe(140)
      expect(state.testScrollTop.value).toBe(320)
    } finally {
      layout.containerWidth.value = undefined
      wrapper.unmount()
    }
    const remounted = mountWorkspace(mode)
    try {
      await settle()
      expect(remounted.workspace.mobileRegion.value).toBe('test')
      expect(remounted.wrapper.get<HTMLElement>('.test-workspace-layout').element.scrollTop).toBe(320)
      expect(remounted.workspace.testConfigExpanded.value).toBe(false)
    } finally {
      remounted.wrapper.unmount()
      remounted.layout.containerWidth.value = undefined
      state.resetView()
    }
  })

  it('keeps modes independent, restarts the visible reader, and ignores later batch groups and desktop redirects', async () => {
    const state = useWorkspaceViewState('pro-multi')
    const other = useWorkspaceViewState('image-multiimage')
    state.resetView()
    other.resetView()
    const { wrapper, workspace, layout } = mountWorkspace('pro-multi')
    try {
      await settle()
      workspace.showTestResult('a', true)
      await settle()
      expect([state.region.value, state.configExpanded.value]).toEqual(['test', false])
      const reader = wrapper.get<HTMLElement>('.test-workspace-layout')
      reader.element.scrollTop = 90
      await reader.trigger('scroll')
      state.configExpanded.value = true
      for (const id of ['b', 'c', 'd'] as const) {
        workspace.showTestResult(id, true)
        await settle()
        expect(state.configExpanded.value).toBe(true)
        expect(reader.element.scrollTop).toBe(90)
      }
      workspace.showTestResult('b')
      await settle()
      expect(state.configExpanded.value).toBe(false)
      expect(reader.element.scrollTop).toBe(0)
      workspace.showOptimization()
      await settle()
      expect(state.region.value).toBe('optimize')
      const output = wrapper.get<HTMLElement>('.optimize-workspace-layout')
      output.element.scrollTop = 140
      await output.trigger('scroll')
      workspace.showOptimization()
      await settle()
      expect(output.element.scrollTop).toBe(0)
      expect(other.region.value).toBe('optimize')
      expect(other.configExpanded.value).toBe(true)
      layout.containerWidth.value = 1280
      await settle()
      workspace.showTestResult('c')
      expect(state.region.value).toBe('optimize')
    } finally {
      layout.containerWidth.value = undefined
      state.resetView()
      other.resetView()
      wrapper.unmount()
    }
  })

  it('captures outgoing positions before hidden panes clamp, even before their scroll event', async () => {
    const state = useWorkspaceViewState('system')
    state.resetView()
    const { wrapper, workspace, layout } = mountWorkspace('system')
    try {
      await settle()
      const optimize = wrapper.get<HTMLElement>('.optimize-workspace-layout').element
      const test = wrapper.get<HTMLElement>('.test-workspace-layout').element
      optimize.scrollTop = 175
      workspace.mobileRegion.value = 'test'
      optimize.scrollTop = 0
      await settle()
      test.scrollTop = 390
      workspace.mobileRegion.value = 'optimize'
      test.scrollTop = 0
      await settle()
      expect(optimize.scrollTop).toBe(175)
      workspace.mobileRegion.value = 'test'
      await settle()
      expect(test.scrollTop).toBe(390)
    } finally {
      wrapper.unmount()
      layout.containerWidth.value = undefined
      state.resetView()
    }
  })

  it('locates an editable source after region restoration and retains that new reading position', async () => {
    const state = useWorkspaceViewState('system')
    state.resetView()
    const { wrapper, workspace, layout } = mountWorkspace('system')
    try {
      await settle()
      const optimize = wrapper.get<HTMLElement>('.optimize-workspace-layout').element
      const original = wrapper.get<HTMLElement>('.optimize-original-scroll textarea').element
      const workingPrompt = wrapper.get<HTMLElement>('.optimize-workspace-scroll article').element
      original.scrollIntoView = vi.fn(() => { optimize.scrollTop = 0 })
      workingPrompt.scrollIntoView = vi.fn(() => { optimize.scrollTop = 240 })
      workspace.mobileRegion.value = 'test'
      await settle()

      // Both the explicit jump and region watcher restore in this same flush.
      await workspace.showOptimizationSection('workspace', 'content')
      await settle()
      expect(workingPrompt.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      expect(optimize.scrollTop).toBe(240)
      expect(state.optimizeScrollTop.value).toBe(240)
      workspace.mobileRegion.value = 'test'
      await settle()
      workspace.mobileRegion.value = 'optimize'
      await settle()
      expect(optimize.scrollTop).toBe(240)

      workspace.mobileRegion.value = 'test'
      await settle()
      await workspace.showOptimizationSection('original', 'content')
      await settle()
      expect(original.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      expect(optimize.scrollTop).toBe(0)
      expect(state.optimizeScrollTop.value).toBe(0)

      layout.containerWidth.value = 1440
      await settle()
      await workspace.showOptimizationSection('workspace', 'content')
      expect(workingPrompt.scrollIntoView).toHaveBeenCalledTimes(1)
      expect(optimize.scrollTop).toBe(0)
    } finally {
      wrapper.unmount()
      layout.containerWidth.value = undefined
      state.resetView()
    }
  })

  it('does not perform a pending source jump after leaving or unmounting the workspace', async () => {
    const state = useWorkspaceViewState('system')
    state.resetView()
    const { wrapper, workspace, layout } = mountWorkspace('system')
    await settle()
    const jump = vi.spyOn(workspace.optimizeLayoutRef.value!, 'scrollToSection')
    workspace.mobileRegion.value = 'test'
    await settle()
    const pending = workspace.showOptimizationSection('workspace')
    workspace.mobileRegion.value = 'test'
    await pending
    expect(jump).not.toHaveBeenCalled()
    const pendingUnmount = workspace.showOptimizationSection('workspace')
    wrapper.unmount()
    await pendingUnmount
    expect(jump).not.toHaveBeenCalled()
    layout.containerWidth.value = undefined
    state.resetView()
  })

  it('cancels pending restoration when a workspace unmounts', async () => {
    const state = useWorkspaceViewState('system')
    state.resetView()
    const { wrapper, workspace, layout } = mountWorkspace('system')
    await settle()
    const restore = vi.spyOn(workspace.testLayoutRef.value!, 'setScrollTop')
    workspace.mobileRegion.value = 'test'
    wrapper.unmount()
    await settle()
    expect(restore).not.toHaveBeenCalled()
    layout.containerWidth.value = undefined
    state.resetView()
  })
})
