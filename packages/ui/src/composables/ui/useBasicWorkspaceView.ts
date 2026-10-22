import { reactive, toRefs } from 'vue'

type Region = 'optimize' | 'test'
type Variant = 'a' | 'b' | 'c' | 'd'
const defaults = () => ({
  region: 'optimize' as Region,
  variant: 'a' as Variant,
  optimizeView: 'original' as 'original' | 'workspace',
  testView: 'config' as 'config' | 'results',
  inputCollapsed: false,
  optimizeScroll: { original: 0, workspace: 0, desktop: 0 },
  testConfigScroll: 0,
  testScroll: { a: 0, b: 0, c: 0, d: 0 },
})

// UI state lives across route changes, separately from persisted prompt/history data.
const views = {
  system: reactive(defaults()),
  user: reactive(defaults()),
  'pro-multi': reactive(defaults()),
  'pro-variable': reactive(defaults()),
  'image-text2image': reactive(defaults()),
  'image-image2image': reactive(defaults()),
  'image-multiimage': reactive(defaults()),
}

export function useBasicWorkspaceView(mode: keyof typeof views) {
  return {
    ...toRefs(views[mode]),
    resetView: () => Object.assign(views[mode], defaults()),
  }
}
