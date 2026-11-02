import { ref, readonly, type Ref } from 'vue'

import type { AppServices } from '../../types/services'
import { usePreferences } from '../storage/usePreferenceManager'
import { UI_SETTINGS_KEYS } from '@prompt-optimizer/core'

export type FunctionMode = 'basic' | 'pro' | 'image' | 'arena'

interface UseFunctionModeApi {
  functionMode: Ref<FunctionMode>
  setFunctionMode: (mode: FunctionMode) => Promise<void>
  switchToBasic: () => Promise<void>
  switchToPro: () => Promise<void>
  switchToImage: () => Promise<void>
  ensureInitialized: () => Promise<void>
}

let singleton: {
  mode: Ref<FunctionMode>
  initialized: boolean
  initializing: Promise<void> | null
} | null = null

/**
 * 全局功能模式（basic/pro）单例。读取/写入 PreferenceService。
 * - 默认值为 'basic'（向后兼容）
 * - 第一次调用时异步初始化
 */
export function useFunctionMode(services: Ref<AppServices | null>): UseFunctionModeApi {
  if (!singleton) {
    singleton = { mode: ref<FunctionMode>('basic'), initialized: false, initializing: null }
  }

  const { getPreference, setPreference } = usePreferences(services)

  const ensureInitialized = async () => {
    if (singleton!.initialized) return
    if (singleton!.initializing) {
      await singleton!.initializing
      return
    }
    singleton!.initializing = (async () => {
      try {
        // 读取 function-mode；若不存在，返回默认 'basic'
        const saved = await getPreference<FunctionMode>(UI_SETTINGS_KEYS.FUNCTION_MODE, 'basic')
        singleton!.mode.value = (saved === 'pro' || saved === 'image') ? saved : 'basic'
        // 将默认值持久化（若未设置过）
        if (saved !== 'pro' && saved !== 'basic' && saved !== 'image') {
          await setPreference(UI_SETTINGS_KEYS.FUNCTION_MODE, 'basic')
        }
        // ✅ 只在成功时标记为已初始化
        singleton!.initialized = true
      } catch (e) {
        // ⚠️ 初始化失败，保持 initialized = false，允许后续重试
        console.warn('[useFunctionMode] Initialization failed, will retry on next call:', e)
        // 保持默认 'basic' 模式，但不标记为已初始化
      } finally {
        // 清理初始化锁，无论成败
        singleton!.initializing = null
      }
    })()
    await singleton!.initializing
  }

  const setFunctionMode = async (mode: FunctionMode) => {
    await ensureInitialized()
    singleton!.mode.value = mode
    await setPreference(UI_SETTINGS_KEYS.FUNCTION_MODE, mode)
  }

  const switchToBasic = () => setFunctionMode('basic')
  const switchToPro = () => setFunctionMode('pro')
  const switchToImage = () => setFunctionMode('image')

  return {
    functionMode: readonly(singleton.mode) as Ref<FunctionMode>,
    setFunctionMode,
    switchToBasic,
    switchToPro,
    switchToImage,
    ensureInitialized
  }
}
