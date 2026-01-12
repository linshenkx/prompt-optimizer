import type { NavigationGuard } from 'vue-router'
import type { SubModeKey } from '../stores/session/useSessionManager'

/**
 * 从路由路径解析子模式 key
 * @param path 路由路径，例如 '/basic/system' 或 '/pro/multi'
 * @returns SubModeKey 或 null（如果路径格式无效）
 */
export const parseSubModeKey = (path: string): SubModeKey | null => {
  const validSubModes = {
    basic: ['system', 'user'] as const,
    pro: ['multi', 'variable'] as const,
    image: ['text2image', 'image2image'] as const,
  } as const

  type Mode = keyof typeof validSubModes
  type ValidSubMode<M extends Mode> = (typeof validSubModes)[M][number]
  const isValidSubMode = <M extends Mode>(mode: M, subMode: string): subMode is ValidSubMode<M> => {
    return (validSubModes[mode] as readonly string[]).includes(subMode)
  }

  const match = path.match(/^\/(basic|pro|image)\/([^/]+)$/)
  if (!match) return null

  const [, mode, subMode] = match

  if (!isValidSubMode(mode as Mode, subMode)) {
    return null
  }

  return `${mode}-${subMode}` as SubModeKey
}

/**
 * 路由切换守卫
 *
 * 功能：
 * 1. 验证 subMode 是否合法
 * 2. 重定向非法路由到默认 subMode
 * 3. 兼容旧 pro 路由（/pro/system|/pro/user）
 */
export const beforeRouteSwitch: NavigationGuard = (to, _from, next) => {
  // ✅ 兼容旧 pro 路由（/pro/system|/pro/user -> /pro/multi|/pro/variable）
  if (to.path === '/pro/system') {
    next('/pro/multi')
    return
  }
  if (to.path === '/pro/user') {
    next('/pro/variable')
    return
  }

  const subModeKey = parseSubModeKey(to.path)

  if (subModeKey === null && to.path !== '/') {
    const match = to.path.match(/^\/(basic|pro|image)/)
    if (match) {
      const mode = match[1]

      let defaultSubMode: string
      if (mode === 'image') {
        defaultSubMode = 'text2image'
      } else if (mode === 'pro') {
        defaultSubMode = 'variable'
      } else {
        defaultSubMode = 'system'
      }

      console.warn(`[Router] 非法 subMode: ${to.path}, 重定向到 /${mode}/${defaultSubMode}`)
      next(`/${mode}/${defaultSubMode}`)
      return
    }
  }

  next()
}
