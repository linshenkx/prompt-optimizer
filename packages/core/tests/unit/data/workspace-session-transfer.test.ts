import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataManager } from '../../../src/services/data/manager'
import { WorkspaceSessionTransfer } from '../../../src/services/data/workspace-session-transfer'
import { PreferenceService, MAX_SESSION_SNAPSHOT_BYTES } from '../../../src/services/preference/service'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { LEGACY_SESSION_SUB_MODE_KEYS, type LegacySessionSubModeKey } from '../../../src/services/prompt-model/session'
import { DATA_ERROR_CODES } from '../../../src/constants/error-codes'
import type { IModelManager } from '../../../src/services/model/types'
import type { IHistoryManager } from '../../../src/services/history/types'
import type { ITemplateManager } from '../../../src/services/template/types'
import type { ContextRepo } from '../../../src/services/context/types'

const imageResult = {
  images: [{ _type: 'image-ref', id: 'generated-image-1', mimeType: 'image/png' }],
  text: 'Image description',
  metadata: { providerId: 'openai', modelId: 'image-model', configId: 'image-config' },
}

const snapshotFor = (mode: LegacySessionSubModeKey) => ({
  ...(mode === 'pro-multi' ? {
    conversationMessagesSnapshot: [{ id: 'message-1', role: 'user', content: '原始消息', originalContent: '原始消息' }],
    selectedMessageId: 'message-1', messageChainMap: { 'message-1': 'chain-1' },
  } : mode.startsWith('image-') ? { originalPrompt: '画一朵花' } : { prompt: '你是科学老师', testContent: '为什么冰会浮起来？' }),
  optimizedPrompt: '优化后的工作区草稿\n不要丢失最后一行', reasoning: '思考过程',
  chainId: 'chain-1', versionId: 'version-2',
  temporaryVariables: { subject: '冰块', details: '第一行\n第二行' },
  selectedOptimizeModelKey: 'text-config', selectedTestModelKey: 'test-config',
  selectedTextModelKey: 'text-config', selectedImageModelKey: 'image-config',
  selectedTemplateId: 'optimize-template', selectedIterateTemplateId: null,
  layout: { mainSplitLeftPct: 45, testColumnCount: 2 },
  testVariants: [{ id: 'a', version: 0, modelKey: 'test-config' }, { id: 'b', version: 'workspace', modelKey: 'test-config' }],
  testVariantResults: mode.startsWith('image-')
    ? { a: imageResult, b: null, c: null, d: null }
    : { a: { result: 'A 的完整结果', reasoning: 'A 思考', requestPrompt: '原始稿' }, b: { result: 'B 的最后一行', reasoning: '', requestPrompt: '发送时的工作区稿' } },
  testVariantLastRunFingerprint: { a: 'fingerprint-a', b: 'fingerprint-b' },
  evaluationResults: { prompt: null, compare: null },
  isCompareMode: true, lastActiveAt: 1792713600000,
  ...(mode === 'basic-system' ? { testImageAssetId: 'test-image-1', testImageB64: null, testImageMimeType: 'image/png' } : {}),
  ...(mode === 'image-image2image' ? { inputImageId: 'input-image-1', inputImageB64: null, inputImageMime: 'image/png' } : {}),
  ...(mode === 'image-multiimage' ? { inputImages: [{ id: 'runtime-image-1', assetId: 'input-image-2', mimeType: 'image/png' }] } : {}),
  ...(mode.startsWith('image-') ? { originalImageResult: imageResult, optimizedImageResult: null } : {}),
})

const createDataManager = (preferences: PreferenceService) => {
  const history = { exportData: vi.fn().mockResolvedValue([{ id: 'version-2', chainId: 'chain-1', version: 2 }]), importData: vi.fn().mockResolvedValue(undefined) }
  const models = { exportData: vi.fn().mockResolvedValue([]), importData: vi.fn().mockResolvedValue(undefined) }
  const templates = { exportData: vi.fn().mockResolvedValue([]), importData: vi.fn().mockResolvedValue(undefined) }
  const contexts = { exportData: vi.fn().mockResolvedValue({}), importData: vi.fn().mockResolvedValue(undefined) }
  const manager = new DataManager(models as unknown as IModelManager, templates as unknown as ITemplateManager,
    history as unknown as IHistoryManager, preferences, contexts as unknown as ContextRepo)
  return { manager, models, history, templates, contexts }
}

describe('Workspace session transfer in unified backups', () => {
  let storage: MemoryStorageProvider
  let preferences: PreferenceService

  beforeEach(() => {
    storage = new MemoryStorageProvider()
    preferences = new PreferenceService(storage)
  })

  it('round-trips every mode as structured data after reopening, preserving drafts, versions, A/B results and image IDs', async () => {
    for (const mode of LEGACY_SESSION_SUB_MODE_KEYS) {
      await preferences.set(`session/v1/${mode}`, snapshotFor(mode))
    }
    await preferences.set('app:settings:ui:theme-id', 'dark')
    // New PreferenceService has not read any workspace key yet.
    const source = createDataManager(new PreferenceService(storage))
    const exported = JSON.parse(await source.manager.exportAllData())
    expect(exported.data.workspaceSessions.version).toBe(1)
    expect(Object.keys(exported.data.workspaceSessions.sessions)).toHaveLength(7)
    expect(exported.data.userSettings).toEqual({ 'app:settings:ui:theme-id': 'dark' })

    const destination = new PreferenceService(new MemoryStorageProvider())
    const target = createDataManager(destination)
    await target.manager.importAllData(JSON.stringify(exported))
    for (const mode of LEGACY_SESSION_SUB_MODE_KEYS) {
      expect(await destination.get(`session/v1/${mode}`, null)).toEqual(snapshotFor(mode))
    }
    expect(target.history.importData).toHaveBeenCalledWith([{ id: 'version-2', chainId: 'chain-1', version: 2 }])
    expect(await destination.get('app:settings:ui:theme-id', null)).toBe('dark')
  })

  it('keeps session payloads out of the string-valued UI settings export', async () => {
    await preferences.set('session/v1/basic-system', snapshotFor('basic-system'))
    await preferences.set('app:settings:ui:theme-id', 'light')
    expect(await preferences.exportData()).toEqual({ 'app:settings:ui:theme-id': 'light' })
  })

  it('reads legacy JSON-string storage without double encoding its snapshot', async () => {
    const original = snapshotFor('basic-user')
    await preferences.set('session/v1/basic-user', JSON.stringify(original))
    expect((await new WorkspaceSessionTransfer(preferences).exportData()).sessions['basic-user']).toEqual(original)
  })

  it.each([
    { version: 1, data: { userSettings: { 'theme-id': 'dark', 'session/v1/basic-system': '[object Object]' } } },
    { userSettings: { 'theme-id': 'dark' } },
  ])('imports old backups without clearing existing workspace state', async backup => {
    const original = snapshotFor('basic-system')
    await preferences.set('session/v1/basic-system', original)
    await createDataManager(preferences).manager.importAllData(JSON.stringify(backup))
    expect(await preferences.get('session/v1/basic-system', null)).toEqual(original)
    expect(await preferences.get('app:settings:ui:theme-id', null)).toBe('dark')
  })

  it('only replaces modes present in a partial workspace section', async () => {
    await preferences.set('session/v1/basic-user', snapshotFor('basic-user'))
    const replacement = { ...snapshotFor('basic-system'), prompt: '替换系统稿' }
    await new WorkspaceSessionTransfer(preferences).importData({ version: 1, sessions: { 'basic-system': replacement } })
    expect(await preferences.get('session/v1/basic-system', null)).toEqual(replacement)
    expect(await preferences.get('session/v1/basic-user', null)).toEqual(snapshotFor('basic-user'))
  })

  it.each([
    { version: 2, sessions: {} },
    { version: 1, sessions: { 'session/v1/basic-system': snapshotFor('basic-system') } },
    { version: 1, sessions: { 'basic-system': '[object Object]' } },
    { version: 1, sessions: { 'basic-system': {} } },
    { version: 1, sessions: { 'basic-system': { ...snapshotFor('basic-system'), prompt: { injected: true } } } },
    { version: 1, sessions: { 'basic-system': { ...snapshotFor('basic-system'), testVariants: [{ id: 'a', version: -1, modelKey: 'test' }] } } },
    { version: 1, sessions: { 'basic-user': { ...snapshotFor('basic-user'), testVariantResults: { a: { result: 123 } } } } },
    { version: 1, sessions: { 'image-multiimage': { ...snapshotFor('image-multiimage'), inputImages: [{ assetId: { invalid: true } }] } } },
    { version: 1, sessions: { 'basic-system': JSON.parse('{"prompt":"x","optimizedPrompt":"y","metadata":{"__proto__":{"polluted":true}}}') } },
  ])('rejects malformed workspace sections before any manager or preference mutation', async workspaceSessions => {
    await preferences.set('session/v1/basic-system', snapshotFor('basic-system'))
    const set = vi.spyOn(preferences, 'set')
    const { manager, models, history, templates, contexts } = createDataManager(preferences)
    await expect(manager.importAllData(JSON.stringify({ version: 1, data: {
      models: [], history: [], userTemplates: [], contexts: {},
      userSettings: { 'app:settings:ui:theme-id': 'dark' }, workspaceSessions,
    } }))).rejects.toMatchObject({ code: DATA_ERROR_CODES.INVALID_FORMAT })
    expect(set).not.toHaveBeenCalled()
    for (const service of [models, history, templates, contexts]) expect(service.importData).not.toHaveBeenCalled()
    expect(await preferences.get('session/v1/basic-system', null)).toEqual(snapshotFor('basic-system'))
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('bounds snapshot bytes before writing any mode', async () => {
    const set = vi.spyOn(preferences, 'set')
    await expect(new WorkspaceSessionTransfer(preferences).importData({ version: 1, sessions: {
      'basic-system': snapshotFor('basic-system'),
      'basic-user': { ...snapshotFor('basic-user'), prompt: '中'.repeat(MAX_SESSION_SNAPSHOT_BYTES / 2) },
    } })).rejects.toMatchObject({ code: DATA_ERROR_CODES.INVALID_FORMAT })
    expect(set).not.toHaveBeenCalled()
  })

  it.each(['models', 'history', 'templates', 'contexts', 'preferences'] as const)(
    'does not commit workspaces after %s fails, and allows a clean retry', async failingService => {
      const original = snapshotFor('basic-system')
      const replacement = { ...original, prompt: '导入的新提示词', optimizedPrompt: '新的优化稿' }
      await preferences.set('session/v1/basic-system', original)
      const services = createDataManager(preferences)
      const importer = failingService === 'preferences'
        ? vi.spyOn(preferences, 'importData')
        : services[failingService].importData
      importer.mockRejectedValueOnce(new Error('storage temporarily unavailable'))
      const input = JSON.stringify({ version: 1, data: {
        models: [], history: [], userTemplates: [], contexts: {}, userSettings: {},
        workspaceSessions: { version: 1, sessions: { 'basic-system': replacement } },
      } })

      await expect(services.manager.importAllData(input)).rejects.toMatchObject({
        code: DATA_ERROR_CODES.IMPORT_PARTIAL_FAILED,
      })
      expect(await preferences.get('session/v1/basic-system', null)).toEqual(original)

      await services.manager.importAllData(input)
      expect(await preferences.get('session/v1/basic-system', null)).toEqual(replacement)
    },
  )

  it('does not silently omit unreadable stored snapshots from an export', async () => {
    await preferences.set('session/v1/basic-user', '[object Object]')
    await expect(createDataManager(preferences).manager.exportAllData()).rejects.toMatchObject({ code: DATA_ERROR_CODES.INVALID_FORMAT })
  })

  it('restores earlier modes if storage fails midway through the workspace import', async () => {
    const original = snapshotFor('basic-system')
    await preferences.set('session/v1/basic-system', original)
    const compareAndSet = storage.compareAndSetItem.bind(storage)
    let failOnce = true
    vi.spyOn(storage, 'compareAndSetItem').mockImplementation(async (key, expected, value) => {
      if (key === 'pref:session/v1/basic-user' && failOnce) { failOnce = false; throw new Error('quota exceeded') }
      return compareAndSet(key, expected, value)
    })
    await expect(new WorkspaceSessionTransfer(preferences).importData({ version: 1, sessions: {
      'basic-system': { ...original, prompt: '不应残留的替换稿' },
      'basic-user': snapshotFor('basic-user'),
    } })).rejects.toThrow('quota exceeded')
    expect(await preferences.get('session/v1/basic-system', null)).toEqual(original)
    expect(await preferences.get('session/v1/basic-user', null)).toBeNull()
  })

  it('aborts a conflicting import and rolls back only its own earlier snapshots', async () => {
    const first = snapshotFor('basic-system')
    const second = snapshotFor('basic-user')
    await preferences.set('session/v1/basic-system', first)
    await preferences.set('session/v1/basic-user', second)
    const commit = storage.compareAndSetItem.bind(storage)
    vi.spyOn(storage, 'compareAndSetItem').mockImplementationOnce(async (key, expected, value) => {
      await preferences.set('session/v1/basic-user', { ...second, prompt: 'another window saved this' })
      return commit(key, expected, value)
    })
    await expect(new WorkspaceSessionTransfer(preferences).importData({ version: 1, sessions: {
      'basic-system': { ...first, prompt: 'imported system' },
      'basic-user': { ...second, prompt: 'imported user' },
    } })).rejects.toThrow('another window')
    expect(await preferences.get('session/v1/basic-system', null)).toEqual(first)
    expect(await preferences.get('session/v1/basic-user', null)).toEqual({ ...second, prompt: 'another window saved this' })
  })

  it('does not roll back over a newer commit made after an imported snapshot', async () => {
    const first = snapshotFor('basic-system')
    await preferences.set('session/v1/basic-system', first)
    const commit = storage.compareAndSetItem.bind(storage)
    vi.spyOn(storage, 'compareAndSetItem').mockImplementation(async (key, expected, value) => {
      if (key === 'pref:session/v1/basic-user') {
        await preferences.set('session/v1/basic-system', { ...first, prompt: 'newer independent commit' })
        throw new Error('quota exceeded')
      }
      return commit(key, expected, value)
    })
    await expect(new WorkspaceSessionTransfer(preferences).importData({ version: 1, sessions: {
      'basic-system': { ...first, prompt: 'imported system' },
      'basic-user': snapshotFor('basic-user'),
    } })).rejects.toThrow('rollback failed')
    expect(await preferences.get('session/v1/basic-system', null)).toEqual({ ...first, prompt: 'newer independent commit' })
  })
})
