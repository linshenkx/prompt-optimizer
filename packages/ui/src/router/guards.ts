import type { NavigationGuard } from 'vue-router'
import type { SubModeKey } from '../stores/session/useSessionManager'

/**
 * 从路由路径解析子模式 key
 * @param path 路由路径，例如 '/basic/system' 或 '/pro/multi'
 * @returns SubModeKey 或 null（如果路径格式无效）
 */
export const parseSubModeKey = (path: string): SubModeKey | null => {
  // 严格的 subMode 枚举值
  const validSubModes = {
    basic: ['system', 'user'] as const,
    // pro 模式：支持新旧两种命名（过渡期）
    pro: ['system', 'user', 'multi', 'variable'] as const,
    image: ['text2image', 'image2image'] as const
  } as const

  type Mode = keyof typeof validSubModes
  type ValidSubMode<M extends Mode> = (typeof validSubModes)[M][number]
  const isValidSubMode = <M extends Mode>(mode: M, subMode: string): subMode is ValidSubMode<M> => {
    return (validSubModes[mode] as readonly string[]).includes(subMode)
  }

  const match = path.match(/^\/(basic|pro|image)\/([^/]+)$/)
  if (!match) return null

  const [, mode, subMode] = match

  // 严格检查 subMode 是否在允许的枚举中
  if (!isValidSubMode(mode as Mode, subMode)) {
    return null
  }

  // pro 模式的命名兼容（过渡期）
  if (mode === 'pro' && (subMode === 'multi' || subMode === 'variable')) {
    // 映射回旧的 session key
    const mapped = subMode === 'multi' ? 'system' : 'user'
    return `pro-${mapped}` as SubModeKey
  }

  return `${mode}-${subMode}` as SubModeKey
}

/**
 * 路由切换守卫
 *
 * 功能：
 * 1. 验证 subMode 是否合法
 * 2. 重定向非法路由到默认 subMode
 * 3. 未来可以添加：session 切换、数据保存验证等逻辑
 */
export const beforeRouteSwitch: NavigationGuard = (to, from, next) => {
  console.log('[Router] 路由切换:', from.path, '->', to.path)

  // ✅ 验证路由参数
  const subModeKey = parseSubModeKey(to.path)

  // 如果 subMode 非法，重定向到默认值
  if (subModeKey === null && to.path !== '/') {
    const match = to.path.match(/^\/(basic|pro|image)/)
    if (match) {
      const mode = match[1]
      const defaultSubMode = mode === 'image' ? 'text2image' : 'system'
      console.warn(`[Router] 非法 subMode: ${to.path}, 重定向到 /${mode}/${defaultSubMode}`)
      next(`/${mode}/${defaultSubMode}`)
      return
    }
  }

  // 合法路由，放行
  next()
}
