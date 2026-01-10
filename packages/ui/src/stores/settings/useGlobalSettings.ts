/**
 * Global Settings Store
 *
 * 管理跨会话的全局 UI 配置（Phase 1）。
 *
 * 设计原则：
 * - 使用 Pinia 统一管理状态边界
 * - 使用 PreferenceService 进行持久化（Web/Electron 统一，异步）
 * - 全量快照存储（单 key）：'global-settings/v1'
 *
 * 迁移策略（一次性，restore 时执行）：
 * - 若 'global-settings/v1' 不存在或字段缺失，则从旧的 UI_SETTINGS_KEYS 读取并填充
 */

import { defineStore } from 'pinia'
import { ref, watch, type Ref } from 'vue'
import { UI_SETTINGS_KEYS } from '@prompt-optimizer/core'
import { getPiniaServices } from '../../plugins/pinia'

export type FunctionMode = 'basic' | 'pro' | 'image'
export type BasicSubMode = 'system' | 'user'
export type ProSubMode = 'multi' | 'variable'
export type ImageSubMode = 'text2image' | 'image2image'

export interface GlobalSettingsState {
  selectedThemeId: string
  preferredLanguage: string
  builtinTemplateLanguage: string

  functionMode: FunctionMode
  basicSubMode: BasicSubMode
  proSubMode: ProSubMode
  imageSubMode: ImageSubMode

  lastActiveAt: number
}

const STORAGE_KEY = 'global-settings/v1'

const createDefaultState = (): GlobalSettingsState => ({
  selectedThemeId: 'auto',
  preferredLanguage: 'zh-CN',
  builtinTemplateLanguage: 'zh-CN',
  functionMode: 'basic',
  basicSubMode: 'system',
  proSubMode: 'variable',
  imageSubMode: 'text2image',
  lastActiveAt: Date.now(),
})

const isFunctionMode = (value: unknown): value is FunctionMode =>
  value === 'basic' || value === 'pro' || value === 'image'

const isBasicSubMode = (value: unknown): value is BasicSubMode =>
  value === 'system' || value === 'user'

const isProSubMode = (value: unknown): value is ProSubMode =>
  value === 'multi' || value === 'variable'

const normalizeLegacyProSubMode = (value: unknown): ProSubMode | null => {
  if (value === 'multi' || value === 'variable') return value
  if (value === 'system') return 'multi'
  if (value === 'user') return 'variable'
  return null
}

const isImageSubMode = (value: unknown): value is ImageSubMode =>
  value === 'text2image' || value === 'image2image'

export const useGlobalSettings = defineStore('globalSettings', () => {
  /**
   * 全局配置快照（可持久化）
   */
  const state: Ref<GlobalSettingsState> = ref(createDefaultState())

  /**
   * restore 标志（防止“默认值 + watch”在 restore 前覆盖持久化内容）
   */
  const isInitialized = ref(false)
  const hasRestored = ref(false)
  const restoreInFlight = ref<Promise<void> | null>(null)
  const isRestoring = ref(false)

  /**
   * 保存互斥（避免并发写入）
   */
  const saveInFlight = ref(false)
  const saveQueued = ref(false)

  const touch = () => {
    state.value.lastActiveAt = Date.now()
  }

  const updateSelectedThemeId = (themeId: string) => {
    if (state.value.selectedThemeId === themeId) return
    state.value.selectedThemeId = themeId
    touch()
  }

  // ✅ 对外统一命名：updateThemeId
  const updateThemeId = (themeId: string) => updateSelectedThemeId(themeId)

  const updatePreferredLanguage = (language: string) => {
    if (state.value.preferredLanguage === language) return
    state.value.preferredLanguage = language
    touch()
  }

  const updateBuiltinTemplateLanguage = (language: string) => {
    if (state.value.builtinTemplateLanguage === language) return
    state.value.builtinTemplateLanguage = language
    touch()
  }

  const updateFunctionMode = (mode: FunctionMode) => {
    if (state.value.functionMode === mode) return
    state.value.functionMode = mode
    touch()
  }

  const updateBasicSubMode = (mode: BasicSubMode) => {
    if (state.value.basicSubMode === mode) return
    state.value.basicSubMode = mode
    touch()
  }

  const updateProSubMode = (mode: ProSubMode) => {
    if (state.value.proSubMode === mode) return
    state.value.proSubMode = mode
    touch()
  }

  const updateImageSubMode = (mode: ImageSubMode) => {
    if (state.value.imageSubMode === mode) return
    state.value.imageSubMode = mode
    touch()
  }

  const reset = () => {
    state.value = createDefaultState()
  }

  /**
   * 保存到持久化存储
   * 使用 PreferenceService
   */
  const saveGlobalSettings = async () => {
    if (!hasRestored.value) return
    if (isRestoring.value) return

    if (saveInFlight.value) {
      saveQueued.value = true
      return
    }

    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[GlobalSettings] PreferenceService 不可用，无法保存全局配置')
      return
    }

    saveInFlight.value = true
    try {
      do {
        saveQueued.value = false
        const snapshot = JSON.stringify(state.value)
        await $services.preferenceService.set(STORAGE_KEY, snapshot)
      } while (saveQueued.value)
    } catch (error) {
      console.error('[GlobalSettings] 保存全局配置失败:', error)
    } finally {
      saveInFlight.value = false
    }
  }

  type MigrationMode = 'fill-empty' | 'override-defaults'

  /**
   * 从旧的 UI_SETTINGS_KEYS 迁移
   * - fill-empty：仅在字段为空/缺失时补齐
   * - override-defaults：当字段为默认值时允许覆盖（用于首次引入 global-settings/v1 的迁移）
   */
  const migrateFromUiSettingsKeys = async (mode: MigrationMode) => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) return

    try {
      const defaults = createDefaultState()
      const shouldOverride = (current: unknown, fallback: unknown) =>
        mode === 'override-defaults' ? current === fallback : !current

      if (shouldOverride(state.value.selectedThemeId, defaults.selectedThemeId)) {
        const themeId = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.THEME_ID,
          ''
        )
        if (themeId) state.value.selectedThemeId = themeId
      }

      if (shouldOverride(state.value.preferredLanguage, defaults.preferredLanguage)) {
        const language = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.PREFERRED_LANGUAGE,
          ''
        )
        if (language) state.value.preferredLanguage = language
      }

      if (shouldOverride(state.value.builtinTemplateLanguage, defaults.builtinTemplateLanguage)) {
        const language = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.BUILTIN_TEMPLATE_LANGUAGE,
          ''
        )
        if (language) state.value.builtinTemplateLanguage = language
      }

      if (shouldOverride(state.value.functionMode, defaults.functionMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.FUNCTION_MODE,
          ''
        )
        if (isFunctionMode(mode)) state.value.functionMode = mode
      }

      if (shouldOverride(state.value.basicSubMode, defaults.basicSubMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.BASIC_SUB_MODE,
          ''
        )
        if (isBasicSubMode(mode)) state.value.basicSubMode = mode
      }

      if (shouldOverride(state.value.proSubMode, defaults.proSubMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.PRO_SUB_MODE,
          ''
        )
        const normalized = normalizeLegacyProSubMode(mode)
        if (normalized) {
          state.value.proSubMode = normalized
          if (mode !== normalized) {
            await $services.preferenceService.set(UI_SETTINGS_KEYS.PRO_SUB_MODE, normalized)
          }
        }
      }

      if (shouldOverride(state.value.imageSubMode, defaults.imageSubMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.IMAGE_SUB_MODE,
          ''
        )
        if (isImageSubMode(mode)) state.value.imageSubMode = mode
      }
    } catch (error) {
      console.warn('[GlobalSettings] 从 UI_SETTINGS_KEYS 迁移失败（忽略）:', error)
    }
  }

  /**
   * 从持久化存储恢复
   * 使用 PreferenceService
   */
  const restoreGlobalSettings = async () => {
    if (isInitialized.value) return

    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[GlobalSettings] PreferenceService 不可用，无法恢复全局配置')
      return
    }

    if (restoreInFlight.value) {
      await restoreInFlight.value
      return
    }

    const task = (async () => {
      isRestoring.value = true
      try {
        const defaults = createDefaultState()
        const saved = await $services.preferenceService.get(STORAGE_KEY, '')
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<GlobalSettingsState>
          state.value = {
            ...defaults,
            ...parsed,
            functionMode: isFunctionMode(parsed.functionMode)
              ? parsed.functionMode
              : defaults.functionMode,
            basicSubMode: isBasicSubMode(parsed.basicSubMode)
              ? parsed.basicSubMode
              : defaults.basicSubMode,
            proSubMode: normalizeLegacyProSubMode(parsed.proSubMode) ?? defaults.proSubMode,
            imageSubMode: isImageSubMode(parsed.imageSubMode)
              ? parsed.imageSubMode
              : defaults.imageSubMode,
            lastActiveAt: Date.now(),
          }
        } else {
          // 无快照：保留当前内存值（可能已被 legacy localStorage 等写入），并补齐默认字段
          state.value = {
            ...defaults,
            ...state.value,
            functionMode: isFunctionMode(state.value.functionMode)
              ? state.value.functionMode
              : defaults.functionMode,
            basicSubMode: isBasicSubMode(state.value.basicSubMode)
              ? state.value.basicSubMode
              : defaults.basicSubMode,
            proSubMode: normalizeLegacyProSubMode(state.value.proSubMode) ?? defaults.proSubMode,
            imageSubMode: isImageSubMode(state.value.imageSubMode)
              ? state.value.imageSubMode
              : defaults.imageSubMode,
            lastActiveAt: Date.now(),
          }
        }

        // 迁移：
        // - 有快照：只补齐空字段
        // - 无快照：允许覆盖默认值（首次引入 global-settings/v1）
        await migrateFromUiSettingsKeys(saved ? 'fill-empty' : 'override-defaults')

        state.value.lastActiveAt = Date.now()
        hasRestored.value = true
        isInitialized.value = true

        // 迁移后落盘一次，确保写入新 key（best-effort）
        await saveGlobalSettings()
      } catch (error) {
        console.error('[GlobalSettings] 恢复全局配置失败:', error)
        // 恢复失败时降级为默认值，但不阻止后续继续使用
        reset()
        hasRestored.value = true
        isInitialized.value = true
      } finally {
        isRestoring.value = false
      }
    })()

    restoreInFlight.value = task
    try {
      await task
    } finally {
      restoreInFlight.value = null
    }
  }

  // 自动持久化：监听 state 变化保存（restore 完成后才生效）
  watch(
    state,
    () => {
      void saveGlobalSettings()
    },
    { deep: true }
  )

  return {
    // 状态
    state,
    isInitialized,
    hasRestored,

    // 持久化
    saveGlobalSettings,
    restoreGlobalSettings,

    // 更新方法
    updateThemeId,
    updateSelectedThemeId, // backward-compatible alias
    updatePreferredLanguage,
    updateBuiltinTemplateLanguage,
    updateFunctionMode,
    updateBasicSubMode,
    updateProSubMode,
    updateImageSubMode,

    // 工具方法
    reset,
  }
})

export type GlobalSettingsApi = ReturnType<typeof useGlobalSettings>
