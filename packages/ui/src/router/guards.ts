import type { NavigationGuard } from 'vue-router'
import type { SubModeKey } from '../stores/session/useSessionManager'
import {
  getDefaultSubModeForWorkspaceMode,
  parseWorkspaceRoutePath,
  type WorkspaceMode,
} from './workspaceRoutes'

/**
 * 从路由路径解析子模式 key
 * @param path 路由路径，例如 '/basic/system' 或 '/pro/multi'
 * @returns SubModeKey 或 null（如果路径格式无效）
 */
export const parseSubModeKey = (path: string): SubModeKey | null => {
  return parseWorkspaceRoutePath(path)?.subModeKey ?? null
}

/**
 * 路由切换守卫
 *
 * 功能：
 * 1. 验证 subMode 是否合法
 * 2. 重定向非法路由到默认 subMode
 * 3. 兼容旧 pro 路由（/pro/system|/pro/user）
 */
export const beforeRouteSwitch: NavigationGuard = (to) => {
  if (to.path.startsWith('/arena/')) return { path: '/arena', query: to.query, hash: to.hash }
  // ✅ 兼容旧 pro 路由（/pro/system|/pro/user -> /pro/multi|/pro/variable）
  if (to.path === '/pro/system') {
    return { path: '/pro/multi', query: to.query, hash: to.hash }
  }
  if (to.path === '/pro/user') {
    return { path: '/pro/variable', query: to.query, hash: to.hash }
  }

  const subModeKey = parseSubModeKey(to.path)

  if (subModeKey === null && to.path !== '/') {
    const match = to.path.match(/^\/(basic|pro|image)(\/|$)/)
    if (match) {
      const mode = match[1] as WorkspaceMode

      const defaultSubMode = getDefaultSubModeForWorkspaceMode(mode)

      console.warn(`[Router] Invalid subMode: ${to.path}. Redirecting to /${mode}/${defaultSubMode}`)
      return { path: `/${mode}/${defaultSubMode}`, query: to.query, hash: to.hash }
    }
  }

  return true
}
