import type { SubModeKey } from '../stores/session/useSessionManager'

export const DEFAULT_WORKSPACE_PATH = '/basic/system'

export const WORKSPACE_SUB_MODE_KEYS: ReadonlyArray<SubModeKey> = [
  'arena',
  'basic-system',
  'basic-user',
  'pro-multi',
  'pro-variable',
  'image-text2image',
  'image-image2image',
  'image-multiimage',
]

const WORKSPACE_SUB_MODES = {
  basic: ['system', 'user'],
  pro: ['multi', 'variable'],
  image: ['text2image', 'image2image', 'multiimage'],
} as const

export type WorkspaceMode = keyof typeof WORKSPACE_SUB_MODES | 'arena'

export interface WorkspaceRouteInfo {
  mode: WorkspaceMode
  subMode: string
  subModeKey: SubModeKey
  path: string
}

export const parseWorkspaceRoutePath = (path: string): WorkspaceRouteInfo | null => {
  const cleanPath = path.split('?')[0].split('#')[0]
  if (cleanPath === '/arena') return { mode: 'arena', subMode: '', subModeKey: 'arena', path: '/arena' }
  const match = cleanPath.match(/^\/(basic|pro|image)\/([^/]+)$/)
  if (!match) return null

  const [, mode, subMode] = match as [string, keyof typeof WORKSPACE_SUB_MODES, string]
  const allowedSubModes = WORKSPACE_SUB_MODES[mode] as readonly string[]
  if (!allowedSubModes.includes(subMode)) return null

  return {
    mode,
    subMode,
    subModeKey: `${mode}-${subMode}` as SubModeKey,
    path: `/${mode}/${subMode}`,
  }
}

export const isWorkspaceRoutePath = (path: string): boolean => {
  return parseWorkspaceRoutePath(path) !== null
}

export const normalizeWorkspacePath = (value: unknown): string | null => {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate !== 'string') return null

  const parsed = parseWorkspaceRoutePath(candidate)
  return parsed?.path ?? null
}

export const resolveWorkspacePathFallback = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const value = typeof candidate === 'function' ? candidate() : candidate
    const workspacePath = normalizeWorkspacePath(value)
    if (workspacePath) return workspacePath
  }

  return DEFAULT_WORKSPACE_PATH
}

export const getDefaultSubModeForWorkspaceMode = (mode: WorkspaceMode): string => {
  if (mode === 'image') return 'text2image'
  if (mode === 'pro') return 'variable'
  return 'system'
}
