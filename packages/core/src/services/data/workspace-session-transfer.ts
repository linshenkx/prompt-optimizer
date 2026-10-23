import type { IImportExportable } from '../../interfaces/import-export'
import type { IPreferenceService } from '../preference/types'
import { MAX_SESSION_SNAPSHOT_BYTES } from '../preference/service'
import { LEGACY_SESSION_SUB_MODE_KEYS, type LegacySessionSubModeKey } from '../prompt-model/session'
import { DataInvalidFormatError } from './errors'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type Snapshot = { [key: string]: JsonValue }

/** Transport schema; the snapshot itself stays owned by its session store. */
export interface WorkspaceSessionExport {
  version: 1
  sessions: Partial<Record<LegacySessionSubModeKey, Snapshot>>
}

const sessionKey = (mode: LegacySessionSubModeKey) => `session/v1/${mode}`
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const invalid = (detail: string): never => {
  throw new DataInvalidFormatError(`Invalid workspace sessions: ${detail}`)
}

// Imported objects must remain data, including when nested in variable maps or metadata.
const assertJsonTree = (value: unknown, depth = 0, budget = { remaining: 100_000 }): void => {
  if (depth > 64 || --budget.remaining < 0) invalid('snapshot is too complex')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (Array.isArray(value)) {
    for (const item of value) assertJsonTree(item, depth + 1, budget)
    return
  }
  if (!isRecord(value)) invalid('snapshot must contain JSON values only')
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      invalid('unsafe object key')
    }
    assertJsonTree(item, depth + 1, budget)
  }
}

const stringFields = [
  'prompt', 'originalPrompt', 'optimizedPrompt', 'reasoning', 'chainId', 'versionId',
  'testContent', 'selectedMessageId', 'selectedOptimizeModelKey', 'selectedTestModelKey',
  'selectedTextModelKey', 'selectedImageModelKey', 'testImageMimeType', 'inputImageMime',
] as const
const nullableStringFields = [
  'selectedTemplateId', 'selectedIterateTemplateId', 'testImageAssetId', 'inputImageId',
  'testImageB64', 'inputImageB64',
] as const
const stringRecordFields = [
  'temporaryVariables', 'messageChainMap', 'testVariantLastRunFingerprint',
] as const
const variantIds = ['a', 'b', 'c', 'd']

const isImageItem = (item: unknown): boolean => isRecord(item) &&
  ['id', 'assetId', 'b64', 'url', 'mimeType', '_type'].every(key =>
    item[key] === undefined || typeof item[key] === 'string' || (key === 'assetId' && item[key] === null))

const isImageResult = (value: unknown): boolean => value === null || (isRecord(value) &&
  Array.isArray(value.images) && value.images.every(isImageItem) &&
  (value.text === undefined || typeof value.text === 'string') &&
  (value.metadata === undefined || isRecord(value.metadata)))

/** Validate transport and fields consumed without coercion; retain all other safe JSON fields. */
function assertSnapshot(mode: LegacySessionSubModeKey, value: unknown): asserts value is Snapshot {
  if (!isRecord(value)) invalid(`${mode} must be an object`)
  assertJsonTree(value)
  const snapshot = value as Record<string, unknown>
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_SESSION_SNAPSHOT_BYTES) {
    invalid(`${mode} exceeds the session storage limit`)
  }
  for (const key of stringFields) {
    if (snapshot[key] !== undefined && typeof snapshot[key] !== 'string') invalid(`${mode}.${key} must be text`)
  }
  for (const key of nullableStringFields) {
    if (snapshot[key] !== undefined && snapshot[key] !== null && typeof snapshot[key] !== 'string') {
      invalid(`${mode}.${key} must be text or null`)
    }
  }
  // Reject a fabricated empty session instead of replacing an existing draft with defaults.
  if (typeof snapshot.optimizedPrompt !== 'string') invalid(`${mode}.optimizedPrompt is missing`)
  if (mode === 'pro-multi') {
    if (!Array.isArray(snapshot.conversationMessagesSnapshot) ||
      !snapshot.conversationMessagesSnapshot.every(message => isRecord(message) &&
        typeof message.content === 'string' && typeof message.role === 'string' &&
        ['system', 'user', 'assistant', 'tool'].includes(message.role))) {
      invalid(`${mode}.conversationMessagesSnapshot is invalid`)
    }
  } else if (typeof snapshot[mode.startsWith('image-') ? 'originalPrompt' : 'prompt'] !== 'string') {
    invalid(`${mode} original prompt is missing`)
  }
  for (const key of stringRecordFields) {
    const record = snapshot[key]
    if (record !== undefined && (!isRecord(record) || !Object.values(record).every(item => typeof item === 'string'))) {
      invalid(`${mode}.${key} must be a text map`)
    }
  }
  if (snapshot.isCompareMode !== undefined && typeof snapshot.isCompareMode !== 'boolean') invalid(`${mode}.isCompareMode is invalid`)
  if (snapshot.lastActiveAt !== undefined && (typeof snapshot.lastActiveAt !== 'number' || snapshot.lastActiveAt < 0)) {
    invalid(`${mode}.lastActiveAt is invalid`)
  }
  if (snapshot.layout !== undefined) {
    const layout = snapshot.layout
    if (!isRecord(layout) || typeof layout.mainSplitLeftPct !== 'number' ||
      layout.mainSplitLeftPct < 0 || layout.mainSplitLeftPct > 100 ||
      ![2, 3, 4].includes(Number(layout.testColumnCount)) || typeof layout.testColumnCount !== 'number') {
      invalid(`${mode}.layout is invalid`)
    }
  }
  if (snapshot.testVariants !== undefined) {
    const variants = snapshot.testVariants
    if (!Array.isArray(variants) || variants.length > 4 || !variants.every(variant =>
      isRecord(variant) && typeof variant.id === 'string' && variantIds.includes(variant.id) && typeof variant.modelKey === 'string' &&
      (variant.version === 'workspace' || variant.version === 'previous' ||
        (typeof variant.version === 'number' && Number.isInteger(variant.version) && variant.version >= 0))) ||
      new Set(variants.map(variant => (variant as Record<string, unknown>).id)).size !== variants.length) {
      invalid(`${mode}.testVariants is invalid`)
    }
  }
  if (snapshot.testVariantResults !== undefined) {
    const results = snapshot.testVariantResults
    if (!isRecord(results)) invalid(`${mode}.testVariantResults is invalid`)
    for (const [id, result] of Object.entries(results as Record<string, unknown>)) {
      if (!variantIds.includes(id) || (result !== null && !isRecord(result))) invalid(`${mode} test result is invalid`)
      if (result === null) continue
      if (mode.startsWith('image-') && !isImageResult(result)) invalid(`${mode} image test result is invalid`)
      const record = result as Record<string, unknown>
      for (const key of ['result', 'reasoning', 'requestPrompt', 'text']) {
        if (record[key] !== undefined && typeof record[key] !== 'string') invalid(`${mode} result ${key} must be text`)
      }
      if (record.images !== undefined && (!Array.isArray(record.images) || !record.images.every(isImageItem))) {
        invalid(`${mode} result images must be an array of image data or references`)
      }
    }
  }
  for (const key of ['evaluationResults', 'assetBinding', 'origin', 'compareSnapshotRoles', 'compareSnapshotRoleSignatures']) {
    if (snapshot[key] !== undefined && !isRecord(snapshot[key])) invalid(`${mode}.${key} must be an object`)
  }
  for (const key of ['originalImageResult', 'optimizedImageResult']) {
    if (snapshot[key] !== undefined && !isImageResult(snapshot[key])) invalid(`${mode}.${key} is invalid`)
  }
  if (snapshot.inputImages !== undefined && (!Array.isArray(snapshot.inputImages) || !snapshot.inputImages.every(isImageItem))) {
    invalid(`${mode}.inputImages must be an array of image references`)
  }
}

/** Independent section in the existing DataManager backup, never a UI preference setting. */
export class WorkspaceSessionTransfer implements IImportExportable {
  constructor(private readonly preferences: IPreferenceService) {}

  assertValidData(data: unknown): asserts data is WorkspaceSessionExport {
    if (!isRecord(data) || data.version !== 1 || !isRecord(data.sessions)) invalid('unsupported version or sessions map')
    const sessions = (data as Record<string, unknown>).sessions as Record<string, unknown>
    for (const [mode, snapshot] of Object.entries(sessions)) {
      if (!(LEGACY_SESSION_SUB_MODE_KEYS as readonly string[]).includes(mode)) invalid('unknown workspace mode')
      assertSnapshot(mode as LegacySessionSubModeKey, snapshot)
    }
  }

  async exportData(): Promise<WorkspaceSessionExport> {
    const sessions: WorkspaceSessionExport['sessions'] = {}
    // Enumerate known modes, not PreferenceService's process-local key cache.
    for (const mode of LEGACY_SESSION_SUB_MODE_KEYS) {
      const stored = await this.preferences.get<unknown>(sessionKey(mode), null)
      if (stored === null || stored === undefined) continue
      let snapshot = stored
      // Older session stores persisted their JSON representation as a string.
      if (typeof stored === 'string') {
        try { snapshot = JSON.parse(stored) } catch { invalid(`${mode} contains unreadable stored JSON`) }
      }
      assertSnapshot(mode, snapshot)
      sessions[mode] = snapshot
    }
    return { version: 1, sessions }
  }

  async importData(data: unknown): Promise<void> {
    this.assertValidData(data)
    const entries = Object.entries(data.sessions) as [LegacySessionSubModeKey, Snapshot][]
    const previous = new Map<string, unknown>()
    // Read every original before the first write; validation or read failure cannot partially overwrite drafts.
    for (const [mode] of entries) {
      const key = sessionKey(mode)
      previous.set(key, await this.preferences.get<unknown>(key, null))
    }
    const attempted: string[] = []
    const imported = new Map(entries.map(([mode, snapshot]) => [sessionKey(mode), snapshot]))
    try {
      for (const [mode, snapshot] of entries) {
        const key = sessionKey(mode)
        if (this.preferences.compareAndSet) {
          if (!await this.preferences.compareAndSet(key, previous.get(key), snapshot)) {
            throw new Error('Workspace changed in another window during import')
          }
          attempted.push(key)
        } else {
          attempted.push(key)
          await this.preferences.set(key, snapshot)
        }
      }
    } catch (error) {
      const rollbackErrors: string[] = []
      for (const key of attempted.reverse()) {
        try {
          const original = previous.get(key)
          if (this.preferences.compareAndSet) {
            if (!await this.preferences.compareAndSet(key, imported.get(key), original ?? null)) {
              throw new Error('Workspace changed after import; rollback must not overwrite it')
            }
          } else if (original === null || original === undefined) await this.preferences.delete(key)
          else await this.preferences.set(key, original)
        } catch { rollbackErrors.push(key) }
      }
      if (rollbackErrors.length) {
        throw new Error(`Workspace import failed and rollback failed for ${rollbackErrors.join(', ')}; preserve the source backup`)
      }
      throw error
    }
  }

  async validateData(data: unknown): Promise<boolean> {
    try { this.assertValidData(data); return true } catch { return false }
  }

  async getDataType(): Promise<string> { return 'workspaceSessions' }
}
