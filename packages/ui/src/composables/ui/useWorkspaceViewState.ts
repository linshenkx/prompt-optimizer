import { reactive, toRefs } from 'vue'

type WorkspaceRegion = 'optimize' | 'test'
const defaults = () => ({
  region: 'optimize' as WorkspaceRegion,
  configExpanded: true,
  inputCollapsed: false,
  optimizeScrollTop: 0,
  testScrollTop: 0,
})

// Presentation state survives route changes, independently of persisted sessions.
const views = {
  system: reactive(defaults()),
  user: reactive(defaults()),
  'pro-multi': reactive(defaults()),
  'pro-variable': reactive(defaults()),
  'image-text2image': reactive(defaults()),
  'image-image2image': reactive(defaults()),
  'image-multiimage': reactive(defaults()),
}

export type WorkspaceViewMode = keyof typeof views

export function useWorkspaceViewState(mode: WorkspaceViewMode) {
  return {
    ...toRefs(views[mode]),
    resetView: () => Object.assign(views[mode], defaults()),
  }
}
