import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { OptimizeWorkspaceHandle, WorkspaceScrollHandle } from '../../types/workspacePresentation'
import { useWorkspaceLayout } from './useWorkspaceLayout'
import { useWorkspaceViewState, type WorkspaceViewMode } from './useWorkspaceViewState'

/** Shared presentation orchestration for all seven workspaces. */
export function useWorkspacePresentation(mode: WorkspaceViewMode) {
  const { isCompact, compactInputRows } = useWorkspaceLayout()
  const state = useWorkspaceViewState(mode)
  const { region, configExpanded, optimizeScrollTop, testScrollTop } = state
  const optimizeLayoutRef = ref<OptimizeWorkspaceHandle | null>(null)
  const testLayoutRef = ref<WorkspaceScrollHandle | null>(null)
  let restoring = false
  let pendingRestore: Promise<void> | undefined
  let frame = 0
  let disposed = false
  const sources = [region, isCompact] as const

  const rememberOptimizeScroll = (event: Event) => {
    if (!restoring) optimizeScrollTop.value = (event.target as HTMLElement).scrollTop
  }
  const rememberTestScroll = (event: Event) => {
    if (!restoring) testScrollTop.value = (event.target as HTMLElement).scrollTop
  }

  // Capture the outgoing pane before v-show can clamp its scroll position.
  watch(sources, (_next, [oldRegion, compact]) => {
    if (!restoring) {
      if (optimizeLayoutRef.value && (!compact || oldRegion === 'optimize')) {
        optimizeScrollTop.value = optimizeLayoutRef.value.getScrollTop()
      }
      if (testLayoutRef.value && compact && oldRegion === 'test') {
        testScrollTop.value = testLayoutRef.value.getScrollTop()
      }
    }
    restoring = true
  }, { flush: 'sync' })

  const restoreScroll = () => {
    // A region change and an explicit navigation can request restoration in the
    // same Vue flush. Share that operation so a later watcher cannot undo a jump.
    if (pendingRestore) return pendingRestore
    restoring = true
    pendingRestore = (async () => {
      await nextTick()
      if (!disposed) {
        optimizeLayoutRef.value?.setScrollTop(optimizeScrollTop.value)
        testLayoutRef.value?.setScrollTop(testScrollTop.value)
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => { restoring = false })
      }
      pendingRestore = undefined
    })()
    return pendingRestore
  }
  watch(sources, restoreScroll, { flush: 'post' })
  onMounted(restoreScroll)
  onUnmounted(() => {
    disposed = true
    cancelAnimationFrame(frame)
  })

  const resetTestScroll = () => {
    testScrollTop.value = 0
    testLayoutRef.value?.setScrollTop(0)
  }
  const showOptimization = () => {
    if (!isCompact.value) return
    region.value = 'optimize'
    optimizeScrollTop.value = 0
    void restoreScroll()
  }
  const showOptimizationSection = async (
    section: 'original' | 'workspace',
    anchor: 'section' | 'content' = 'section',
  ) => {
    if (!isCompact.value) return
    region.value = 'optimize'
    // Wait for v-show, unfolding and the shared reading-position restoration.
    await restoreScroll()
    if (disposed || !isCompact.value || region.value !== 'optimize') return
    const layout = optimizeLayoutRef.value
    if (!layout) return
    layout.scrollToSection(section, anchor)
    // The scroll event may still be suppressed while restoration is settling.
    // Save the new position explicitly for the next region or mode transition.
    optimizeScrollTop.value = layout.getScrollTop()
  }
  const showTestResult = (id: 'a' | 'b' | 'c' | 'd', batch = false) => {
    // Later batch groups must not move the reader or override a manual expansion.
    if (!isCompact.value || (batch && id !== 'a')) return
    region.value = 'test'
    configExpanded.value = false
    testScrollTop.value = 0
    void restoreScroll()
  }

  return {
    isCompact, compactInputRows, optimizeLayoutRef, testLayoutRef,
    mobileRegion: region, testConfigExpanded: configExpanded,
    inputCollapsed: state.inputCollapsed,
    rememberOptimizeScroll, rememberTestScroll,
    resetTestScroll, showOptimization, showOptimizationSection, showTestResult, resetMobileView: state.resetView,
  }
}
