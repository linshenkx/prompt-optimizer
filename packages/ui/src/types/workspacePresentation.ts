/** Public layout contract; callers do not depend on the layout's DOM structure. */
export interface WorkspaceScrollHandle {
  getScrollTop: () => number
  setScrollTop: (top: number) => void
}

export interface OptimizeWorkspaceHandle extends WorkspaceScrollHandle {
  scrollToSection: (section: 'original' | 'workspace', anchor?: 'section' | 'content') => void
}
