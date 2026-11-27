import type { IStorageProvider } from './types'
import type { FavoritePrompt } from '../favorite/types'
import {
  FAVORITES_HARD_LIMIT_BYTES,
  FAVORITES_SOFT_LIMIT_BYTES,
  INLINE_IMAGE_DATA_URL_RE,
  assertFavoritesPayloadWithinBudget,
  getSerializedByteLength,
  normalizeFavoriteRecord,
} from '../favorite/storage-guards'

const MAX_SESSION_SNAPSHOT_BYTES = 1024 * 1024
const GENERIC_MAX_STRING_BYTES = 512 * 1024
const CONTEXT_STORE_MAX_STRING_BYTES = 1024 * 1024

const DEFAULT_SESSION_STORAGE_KEYS = [
  'pref:session/v1/basic-system',
  'pref:session/v1/basic-user',
  'pref:session/v1/pro-multi',
  'pref:session/v1/pro-variable',
  'pref:session/v1/image-text2image',
  'pref:session/v1/image-image2image',
  'pref:session/v1/image-multiimage',
] as const

export const STARTUP_REPAIR_REPORT_PREFERENCE_KEY = 'startup-repair-report/v1'
export const STARTUP_REPAIR_REPORT_STORAGE_KEY = `pref:${STARTUP_REPAIR_REPORT_PREFERENCE_KEY}`

type StartupRepairReason =
  | 'invalid_json'
  | 'invalid_structure'
  | 'inline_image_detected'
  | 'abnormal_string_detected'
  | 'budget_exceeded'
  | 'invalid_entries_removed'
  | 'budget_trimmed'
  | 'soft_limit_exceeded'
  | 'orphan_assets_removed'

export interface StartupRepairAction {
  key: string
  action: 'removed' | 'rewritten' | 'warning'
  reason: StartupRepairReason
  droppedCount?: number
  keptCount?: number
  deletedCount?: number
  details?: string
}

export interface StartupRepairReport {
  checkedAt: number
  actions: StartupRepairAction[]
}

type StorageWithOptionalKeyEnumeration = IStorageProvider & {
  getAllKeys?: () => string[] | Promise<string[]>
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const parseStoredJsonDocument = (raw: string): unknown => {
  const parsed = JSON.parse(raw)
  if (typeof parsed !== 'string') {
    return parsed
  }

  const nested = parsed.trim()
  if (!nested) {
    return parsed
  }

  if (
    (nested.startsWith('{') && nested.endsWith('}')) ||
    (nested.startsWith('[') && nested.endsWith(']'))
  ) {
    return JSON.parse(nested)
  }

  return parsed
}

const findInlineImagePath = (
  value: unknown,
  path = '$',
  seen: WeakSet<object> = new WeakSet(),
): string | null => {
  if (typeof value === 'string') {
    return INLINE_IMAGE_DATA_URL_RE.test(value.trim()) ? path : null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  if (seen.has(value as object)) {
    return null
  }
  seen.add(value as object)

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findInlineImagePath(value[index], `${path}[${index}]`, seen)
      if (match) return match
    }
    return null
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const match = findInlineImagePath(child, `${path}.${key}`, seen)
    if (match) return match
  }

  return null
}

const findOversizedString = (
  value: unknown,
  maxBytes: number,
  path = '$',
  seen: WeakSet<object> = new WeakSet(),
): { path: string; bytes: number } | null => {
  if (typeof value === 'string') {
    const bytes = getSerializedByteLength(value)
    return bytes > maxBytes ? { path, bytes } : null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  if (seen.has(value as object)) {
    return null
  }
  seen.add(value as object)

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findOversizedString(value[index], maxBytes, `${path}[${index}]`, seen)
      if (match) return match
    }
    return null
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const match = findOversizedString(child, maxBytes, `${path}.${key}`, seen)
    if (match) return match
  }

  return null
}

const isValidGlobalSettings = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false

  const functionMode = value.functionMode
  const basicSubMode = value.basicSubMode
  const proSubMode = value.proSubMode
  const imageSubMode = value.imageSubMode

  return (
    (value.selectedThemeId === undefined || typeof value.selectedThemeId === 'string') &&
    (value.preferredLanguage === undefined || typeof value.preferredLanguage === 'string') &&
    (value.builtinTemplateLanguage === undefined || typeof value.builtinTemplateLanguage === 'string') &&
    (functionMode === undefined || functionMode === 'basic' || functionMode === 'pro' || functionMode === 'image' || functionMode === 'video' || functionMode === 'arena') &&
    (basicSubMode === undefined || basicSubMode === 'system' || basicSubMode === 'user') &&
    (proSubMode === undefined || proSubMode === 'multi' || proSubMode === 'variable') &&
    (
      imageSubMode === undefined ||
      imageSubMode === 'text2image' ||
      imageSubMode === 'image2image' ||
      imageSubMode === 'multiimage'
    ) &&
    (value.lastActiveAt === undefined || typeof value.lastActiveAt === 'number')
  )
}

const isValidContextStore = (value: unknown): boolean =>
  isPlainObject(value) &&
  typeof value.currentId === 'string' &&
  isPlainObject(value.contexts)

const isValidVariableStorage = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false

  const customVariables = value.customVariables
  if (customVariables !== undefined) {
    if (!isPlainObject(customVariables)) return false
    const invalidEntry = Object.values(customVariables).some((item) => typeof item !== 'string')
    if (invalidEntry) return false
  }

  return (
    (value.advancedModeEnabled === undefined || typeof value.advancedModeEnabled === 'boolean') &&
    (
      value.lastConversationMessages === undefined ||
      Array.isArray(value.lastConversationMessages)
    )
  )
}

const isValidSessionSnapshot = (value: unknown): boolean =>
  Array.isArray(value) || isPlainObject(value)

const removeKeyAndReport = async (
  storageProvider: IStorageProvider,
  report: StartupRepairReport,
  action: StartupRepairAction,
): Promise<void> => {
  await storageProvider.removeItem(action.key)
  report.actions.push(action)
}

const validateStructuredKey = async (
  storageProvider: IStorageProvider,
  report: StartupRepairReport,
  options: {
    key: string
    validator: (value: unknown) => boolean
    maxStringBytes: number
    hardLimitBytes?: number
  },
): Promise<void> => {
  const raw = await storageProvider.getItem(options.key)
  if (raw === null) {
    return
  }

  if (
    typeof options.hardLimitBytes === 'number' &&
    getSerializedByteLength(raw) > options.hardLimitBytes
  ) {
    await removeKeyAndReport(storageProvider, report, {
      key: options.key,
      action: 'removed',
      reason: 'budget_exceeded',
    })
    return
  }

  let parsed: unknown
  try {
    parsed = parseStoredJsonDocument(raw)
  } catch {
    await removeKeyAndReport(storageProvider, report, {
      key: options.key,
      action: 'removed',
      reason: 'invalid_json',
    })
    return
  }

  if (!options.validator(parsed)) {
    await removeKeyAndReport(storageProvider, report, {
      key: options.key,
      action: 'removed',
      reason: 'invalid_structure',
    })
    return
  }

  const inlineImagePath = findInlineImagePath(parsed)
  if (inlineImagePath) {
    await removeKeyAndReport(storageProvider, report, {
      key: options.key,
      action: 'removed',
      reason: 'inline_image_detected',
      details: inlineImagePath,
    })
    return
  }

  const oversizedString = findOversizedString(parsed, options.maxStringBytes)
  if (oversizedString) {
    await removeKeyAndReport(storageProvider, report, {
      key: options.key,
      action: 'removed',
      reason: 'abnormal_string_detected',
      details: `${oversizedString.path} (${oversizedString.bytes} bytes)`,
    })
  }
}

const sortFavoritesByUpdatedAtDesc = (favorites: FavoritePrompt[]): FavoritePrompt[] =>
  [...favorites].sort((left, right) => right.updatedAt - left.updatedAt)

const trimFavoritesToBudget = (favorites: FavoritePrompt[]): FavoritePrompt[] => {
  const kept: FavoritePrompt[] = []

  sortFavoritesByUpdatedAtDesc(favorites).forEach((favorite) => {
    const candidate = [...kept, favorite]
    const totalBytes = getSerializedByteLength(JSON.stringify(candidate))
    if (totalBytes <= FAVORITES_HARD_LIMIT_BYTES) {
      kept.push(favorite)
    }
  })

  return kept
}

const repairFavoritesKey = async (
  storageProvider: IStorageProvider,
  report: StartupRepairReport,
): Promise<void> => {
  const raw = await storageProvider.getItem('favorites')
  if (raw === null) {
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    await removeKeyAndReport(storageProvider, report, {
      key: 'favorites',
      action: 'removed',
      reason: 'invalid_json',
    })
    return
  }

  if (!Array.isArray(parsed)) {
    await removeKeyAndReport(storageProvider, report, {
      key: 'favorites',
      action: 'removed',
      reason: 'invalid_structure',
    })
    return
  }

  const sanitizedFavorites: FavoritePrompt[] = []
  let droppedCount = 0
  const fallbackTimestamp = Date.now()

  parsed.forEach((item, index) => {
    try {
      sanitizedFavorites.push(normalizeFavoriteRecord(item, fallbackTimestamp + index))
    } catch {
      droppedCount += 1
    }
  })

  let finalFavorites = sanitizedFavorites
  let reason: StartupRepairReason | null = droppedCount > 0 ? 'invalid_entries_removed' : null

  try {
    const { totalBytes } = assertFavoritesPayloadWithinBudget(finalFavorites)
    if (totalBytes > FAVORITES_SOFT_LIMIT_BYTES) {
      report.actions.push({
        key: 'favorites',
        action: 'warning',
        reason: 'soft_limit_exceeded',
        keptCount: finalFavorites.length,
      })
    }
  } catch {
    finalFavorites = trimFavoritesToBudget(finalFavorites)
    reason = 'budget_trimmed'
  }

  const serializedFinalFavorites = JSON.stringify(finalFavorites)
  if (serializedFinalFavorites !== raw || reason) {
    await storageProvider.setItem('favorites', serializedFinalFavorites)
    report.actions.push({
      key: 'favorites',
      action: 'rewritten',
      reason: reason || 'invalid_entries_removed',
      droppedCount: parsed.length - finalFavorites.length,
      keptCount: finalFavorites.length,
    })
  }
}

const collectSessionStorageKeys = async (storageProvider: StorageWithOptionalKeyEnumeration): Promise<string[]> => {
  const enumeratedKeys = typeof storageProvider.getAllKeys === 'function'
    ? await storageProvider.getAllKeys()
    : []

  return Array.from(
    new Set([
      ...DEFAULT_SESSION_STORAGE_KEYS,
      ...enumeratedKeys.filter((key) =>
        key.startsWith('pref:session/v1/') && key !== 'pref:session/v1/video-create',
      ),
    ]),
  )
}

export async function writeStartupRepairReport(
  storageProvider: IStorageProvider,
  report: StartupRepairReport,
): Promise<void> {
  if (report.actions.length === 0) {
    await storageProvider.removeItem(STARTUP_REPAIR_REPORT_STORAGE_KEY)
    return
  }

  await storageProvider.setItem(
    STARTUP_REPAIR_REPORT_STORAGE_KEY,
    JSON.stringify(report),
  )
}

export async function runStorageStartupSafetyCheck(
  storageProvider: IStorageProvider,
): Promise<StartupRepairReport> {
  const report: StartupRepairReport = {
    checkedAt: Date.now(),
    actions: [],
  }

  await validateStructuredKey(storageProvider, report, {
    key: 'pref:global-settings/v1',
    validator: isValidGlobalSettings,
    maxStringBytes: GENERIC_MAX_STRING_BYTES,
  })

  const sessionKeys = await collectSessionStorageKeys(storageProvider as StorageWithOptionalKeyEnumeration)
  for (const key of sessionKeys) {
    await validateStructuredKey(storageProvider, report, {
      key,
      validator: isValidSessionSnapshot,
      maxStringBytes: MAX_SESSION_SNAPSHOT_BYTES,
      hardLimitBytes: MAX_SESSION_SNAPSHOT_BYTES,
    })
  }

  await validateStructuredKey(storageProvider, report, {
    key: 'ctx:store',
    validator: isValidContextStore,
    maxStringBytes: CONTEXT_STORE_MAX_STRING_BYTES,
  })

  await validateStructuredKey(storageProvider, report, {
    key: 'pref:variableManager.storage',
    validator: isValidVariableStorage,
    maxStringBytes: GENERIC_MAX_STRING_BYTES,
  })

  await repairFavoritesKey(storageProvider, report)

  return report
}
