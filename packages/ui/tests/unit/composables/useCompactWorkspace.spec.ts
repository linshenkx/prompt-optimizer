import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useBasicWorkspaceView } from '../../../src/composables/ui/useBasicWorkspaceView'
import { useCompactWorkspace } from '../../../src/composables/ui/useCompactWorkspace'
import { useWorkspaceLayout } from '../../../src/composables/ui/useWorkspaceLayout'

describe('mobile workspace navigation', () => {
  it('keeps per-mode navigation independent and avoids redirecting for later batch groups', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const state = useBasicWorkspaceView('pro-multi')
    state.resetView()
    let workspace!: ReturnType<typeof useCompactWorkspace>
    let layout!: ReturnType<typeof useWorkspaceLayout>
    const wrapper = mount(defineComponent({
      setup() {
        layout = useWorkspaceLayout()
        layout.containerWidth.value = 393
        workspace = useCompactWorkspace('pro-multi')
        return () => h('div', { ref: workspace.splitRootRef }, [
          h('div', { class: 'optimize-workspace-layout' }),
        ])
      },
    }))
    try {
      await nextTick()
      workspace.showTestResult('a', true)
      expect([state.region.value, state.testView.value, state.variant.value]).toEqual(['test', 'results', 'a'])
      state.testView.value = 'config'
      workspace.showTestResult('b', true)
      expect([state.testView.value, state.variant.value]).toEqual(['config', 'a'])
      workspace.showTestResult('b')
      expect([state.testView.value, state.variant.value]).toEqual(['results', 'b'])
      workspace.showOptimization()
      expect([state.region.value, state.optimizeView.value]).toEqual(['optimize', 'workspace'])
      await nextTick()
      const output = wrapper.get('.optimize-workspace-layout').element
      output.scrollTop = 140
      state.optimizeScroll.value.desktop = 140
      // Starting another optimization from the same view must reveal its beginning.
      workspace.showOptimization()
      await nextTick()
      expect(output.scrollTop).toBe(0)
      const other = useBasicWorkspaceView('image-multiimage')
      other.resetView()
      expect([other.region.value, other.optimizeView.value]).toEqual(['optimize', 'original'])
      layout.containerWidth.value = 1280
      workspace.showTestResult('c')
      expect(state.region.value).toBe('optimize')
    } finally {
      layout.containerWidth.value = undefined
      state.resetView()
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })
})
