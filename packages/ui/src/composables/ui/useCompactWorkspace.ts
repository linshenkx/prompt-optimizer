import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useWorkspaceLayout } from './useWorkspaceLayout'
import { useBasicWorkspaceView } from './useBasicWorkspaceView'

export function useCompactWorkspace(mode: Parameters<typeof useBasicWorkspaceView>[0]) {
  const { isCompact, compactInputRows } = useWorkspaceLayout()
  const state = useBasicWorkspaceView(mode)
  const { region, variant, optimizeView, testView, optimizeScroll, testConfigScroll, testScroll } = state
  const splitRootRef = ref<HTMLElement | null>(null)
  let restoring = false
  let frame = 0
  const sources = [region, variant, isCompact] as const
  const rememberOptimizeScroll = (pane: 'original' | 'workspace' | 'desktop', event: Event) => {
    if (!restoring && pane === 'desktop') {
      optimizeScroll.value.desktop = (event.target as HTMLElement).scrollTop
    }
  }
  const rememberTestScroll = (event: Event) => {
    if (!restoring) testScroll.value[variant.value] = (event.target as HTMLElement).scrollTop
  }
  const rememberTestConfigScroll = (event: Event) => {
    if (!restoring && testView.value === 'config') testConfigScroll.value = (event.target as HTMLElement).scrollTop
  }
  watch(sources, (_next, [oldRegion, oldVariant, compact]) => {
    const root = splitRootRef.value
    if (!restoring && root) {
      const pane = root.querySelector<HTMLElement>('.optimize-workspace-layout')
      if (pane && (!compact || oldRegion === 'optimize')) optimizeScroll.value.desktop = pane.scrollTop
      if (compact && oldRegion === 'test') {
        const test = root.querySelector<HTMLElement>('.test-results-scroll')
        if (test) testScroll.value[oldVariant] = test.scrollTop
      }
    }
    restoring = true
  }, { flush: 'sync' })
  const restore = async () => {
    restoring = true
    await nextTick()
    const root = splitRootRef.value
    if (root) {
      const positions: [string, number][] = [
                ['.optimize-workspace-layout', optimizeScroll.value.desktop],
        ['.test-results-scroll', testScroll.value[variant.value]],
      ]
      for (const [selector, position] of positions) {
        const el = root.querySelector<HTMLElement>(selector)
        if (el) el.scrollTop = position
      }
    }
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => { restoring = false })
  }
  watch(sources, restore, { flush: 'post' })
  onMounted(restore)
  onUnmounted(() => cancelAnimationFrame(frame))
  const showOptimization = () => {
    if (!isCompact.value) return
    region.value = 'optimize'
    optimizeView.value = 'workspace'
    optimizeScroll.value.desktop = 0
    void restore()
  }
  const showTestResult = (id: 'a' | 'b' | 'c' | 'd', batch = false) => {
    testScroll.value[id] = 0
    if (!isCompact.value || (batch && id !== 'a')) return
    region.value = 'test'
    variant.value = id
    testView.value = 'results'
    void restore()
  }
  return {
    isCompact, compactInputRows, splitRootRef,
    mobileRegion: region, mobileVariant: variant, mobileOptimizeView: optimizeView, mobileTestView: testView,
    rememberOptimizeScroll, rememberTestScroll, rememberTestConfigScroll,
    showOptimization, showTestResult, resetMobileView: state.resetView,
  }
}
