import { ref, readonly, type Ref } from 'vue'

import type { AppServices } from '../../types/services'
import { usePreferences } from '../storage/usePreferenceManager'
import { UI_SETTINGS_KEYS, type ProSubMode } from '@prompt-optimizer/core'

interface UseProSubModeApi {
  proSubMode: Ref<ProSubMode>
  setProSubMode: (mode: ProSubMode) => Promise<void>
  switchToSystem: () => Promise<void>
  switchToUser: () => Promise<void>
  ensureInitialized: () => Promise<void>
}

// 默认模式为 user，系统模式（多对话）在任何环境下都可用
const DEFAULT_PRO_SUB_MODE: ProSubMode = 'user'

let singleton: {
  mode: Ref<ProSubMode>
  initialized: boolean
  initializing: Promise<void> | null
} | null = null

/**
 * 上下文模式（Pro模式）的子模式单例。读取/写入 PreferenceService。
 * - 默认值为 'user'
 * - 系统模式（多对话优化）在任何环境下都可用
 * - 第一次调用时异步初始化
 * - 状态独立于基础模式，实现不同功能模式下的子模式状态隔离
 */
export function useProSubMode(services: Ref<AppServices | null>): UseProSubModeApi {
  if (!singleton) {
    singleton = {
      mode: ref<ProSubMode>(DEFAULT_PRO_SUB_MODE),
      initialized: false,
      initializing: null
    }
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
        // 读取 pro-sub-mode；若不存在，返回默认值 'user'
        const saved = await getPreference<ProSubMode>(UI_SETTINGS_KEYS.PRO_SUB_MODE, DEFAULT_PRO_SUB_MODE)

        // 系统模式（多对话）在任何环境下都可用
        singleton!.mode.value = (saved === 'system' || saved === 'user') ? saved : DEFAULT_PRO_SUB_MODE

        console.log(`[useProSubMode] 初始化完成，当前值: ${singleton!.mode.value}`)

        // 将默认值持久化（若未设置过或值无效）
        if (saved !== 'system' && saved !== 'user') {
          await setPreference(UI_SETTINGS_KEYS.PRO_SUB_MODE, DEFAULT_PRO_SUB_MODE)
          console.log(`[useProSubMode] 已持久化默认值: ${DEFAULT_PRO_SUB_MODE}`)
        }
      } catch (e) {
        console.error(`[useProSubMode] 初始化失败，使用默认值 ${DEFAULT_PRO_SUB_MODE}:`, e)
        // 读取失败则保持默认值，并尝试持久化
        try {
          await setPreference(UI_SETTINGS_KEYS.PRO_SUB_MODE, DEFAULT_PRO_SUB_MODE)
        } catch {
          // 忽略设置失败错误
        }
      } finally {
        singleton!.initialized = true
        singleton!.initializing = null
      }
    })()
    await singleton!.initializing
  }

  const setProSubMode = async (mode: ProSubMode) => {
    await ensureInitialized()
    singleton!.mode.value = mode
    await setPreference(UI_SETTINGS_KEYS.PRO_SUB_MODE, mode)
    console.log(`[useProSubMode] 子模式已切换并持久化: ${mode}`)
  }

  const switchToSystem = () => setProSubMode('system')
  const switchToUser = () => setProSubMode('user')

  return {
    proSubMode: readonly(singleton.mode) as Ref<ProSubMode>,
    setProSubMode,
    switchToSystem,
    switchToUser,
    ensureInitialized
  }
}
