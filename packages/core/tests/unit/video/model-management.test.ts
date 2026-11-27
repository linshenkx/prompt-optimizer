import { describe, expect, it, vi } from 'vitest'
import { PreferenceService } from '../../../src/services/preference/service'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { VIDEO_CREATE_SESSION_KEY } from '../../../src/constants/storage-keys'
import { defaultVideoConfig, VIDEO_MODEL_PREFERENCE, VideoModelManager } from '../../../src/services/video-model/manager'
import { createVideoService } from '../../../src/services/video/service'
import { ARK_VIDEO_BASE_URL, DEFAULT_VIDEO_PARAMS, SEEDANCE_MODEL } from '../../../src/services/video-model/catalog'

vi.mock('../../../src/utils/environment', async original => ({
  ...await original<typeof import('../../../src/utils/environment')>(),
  getEnvVar: (key: string) => key === 'VITE_SEEDANCE_API_KEY' ? 'fixture-env-key' : '',
}))

function fixture() {
  const prefs = new PreferenceService(new MemoryStorageProvider())
  return { prefs, manager: new VideoModelManager(prefs) }
}

describe('managed Ark video configurations', () => {
  it('reads a legacy singleton, keeps its identity and persists an explicitly empty list', async () => {
    const { prefs, manager } = fixture()
    await prefs.set(VIDEO_MODEL_PREFERENCE, { apiKey: 'old-key', model: 'ep-legacy' })
    const [legacy] = await manager.listModels()
    expect(legacy).toMatchObject({ id: 'seedance', name: 'ep-legacy', modelId: SEEDANCE_MODEL, customModel: 'ep-legacy', keySource: 'saved' })
    expect(legacy).not.toHaveProperty('apiKey')
    const previous = await manager.getConfig(legacy.id)
    await manager.saveConfig({ ...previous, name: 'Studio', customModel: undefined }, previous)
    await expect(manager.saveConfig({ ...previous, name: 'Stale' }, previous)).rejects.toThrow('configChanged')
    await manager.removeConfig(legacy.id)
    expect(await new VideoModelManager(prefs).listModels()).toEqual([])
  })

  it('exports saved settings, preserves IDs on import and never copies an environment credential', async () => {
    const { manager } = fixture()
    expect(await manager.listModels()).toMatchObject([{ keySource: 'environment', configured: true }])
    expect(await manager.exportData()).toBeNull()
    const custom = { ...defaultVideoConfig(), id: 'other', name: 'Other', apiKey: 'saved-only', baseURL: 'https://ark.invalid/v3/' }
    await manager.saveConfig(custom, null)
    const backup = await manager.exportData()
    expect(JSON.stringify(backup)).not.toContain('fixture-env-key')
    const imported = fixture().manager
    await imported.importData(backup)
    expect(await imported.getConfig('other')).toMatchObject({ ...custom, baseURL: 'https://ark.invalid/v3' })
    const old = await imported.getConfig('other')
    await imported.saveConfig({ ...old, apiKey: '' }, old)
    expect(await imported.listModels()).toMatchObject([{ keySource: 'environment' }, { keySource: 'none' }])
    expect(await imported.validateData([custom, custom])).toBe(false)
  })

  it('checks connectivity with one read and uses the submitting config to poll and cancel even if disabled', async () => {
    const { manager, prefs } = fixture()
    const custom = { ...defaultVideoConfig(), id: 'other', name: 'Other', customModel: 'ep-fast', baseURL: 'https://ark.invalid/v3', apiKey: 'saved-only' }
    await manager.saveConfig(custom, null)
    const send = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ items: [], total: 0 }))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-test' }))
      .mockResolvedValueOnce(Response.json({ id: 'cgt-test', status: 'queued' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const api = createVideoService(prefs, send)
    await api.testConnection(custom.id)
    const input = { configId: custom.id, baseURL: custom.baseURL, model: custom.customModel, prompt: 'A pan', params: DEFAULT_VIDEO_PARAMS, references: [] }
    const id = await api.create(input)
    await prefs.set(VIDEO_CREATE_SESSION_KEY, { runs: [{ configId: custom.id, status: 'queued' }] })
    await manager.setEnabled(custom.id, false)
    await expect(manager.removeConfig(custom.id)).rejects.toThrow('configInUse')
    const disabled = await manager.getConfig(custom.id)
    await expect(manager.saveConfig({ ...disabled, baseURL: ARK_VIDEO_BASE_URL }, disabled)).rejects.toThrow('configInUse')
    await expect(api.create(input)).rejects.toThrow('configChanged')
    await expect(api.query(id, custom.id, ARK_VIDEO_BASE_URL)).rejects.toThrow('configChanged')
    expect((await api.query(id, custom.id, custom.baseURL)).status).toBe('queued')
    await api.cancel(id, custom.id, custom.baseURL)
    const endpoint = custom.baseURL + '/contents/generations/tasks'
    expect(send.mock.calls.map(([url, options]) => [url, options?.method, new Headers(options?.headers).get('Authorization')])).toEqual([
      [endpoint + '?page_size=1', 'GET', 'Bearer saved-only'], [endpoint, 'POST', 'Bearer saved-only'],
      [endpoint + '/' + id, 'GET', 'Bearer saved-only'], [endpoint + '/' + id, 'DELETE', 'Bearer saved-only'],
    ])
    expect(JSON.parse(String(send.mock.calls[1][1]?.body))).toMatchObject({ model: 'ep-fast' })
    expect(JSON.parse(String(send.mock.calls[1][1]?.body))).not.toHaveProperty('configId')
    expect(await api.model()).toMatchObject({ id: 'seedance', modelId: SEEDANCE_MODEL, keySource: 'environment' })
  })

  it.each([
    ['saved-key', 'replacement-key'],
    ['', 'saved-key'],
    ['saved-key', ''],
    ['', 'fixture-env-key'],
  ])('protects credentials from %j to %j while a task is active', async (apiKey, nextKey) => {
    const { prefs, manager } = fixture()
    const initial = await manager.getConfig('seedance')
    if (apiKey) await manager.saveConfig({ ...initial, apiKey }, initial)
    const previous = await manager.getConfig('seedance')
    const update = { ...previous, apiKey: nextKey }
    await prefs.set(VIDEO_CREATE_SESSION_KEY, { runs: [{ configId: previous.id, status: 'running' }] })
    await expect(manager.saveConfig(update, previous)).rejects.toThrow('configInUse')
    await expect(manager.importData([update])).rejects.toThrow('configInUse')
    expect((await manager.getConfig(previous.id)).apiKey).toBe(apiKey)
    await prefs.set(VIDEO_CREATE_SESSION_KEY, { runs: [{ configId: previous.id, status: 'untracked' }] })
    await manager.saveConfig(update, previous)
    expect((await manager.getConfig(previous.id)).apiKey).toBe(nextKey)
  })

  it('rejects non-Ark responses and never sends the environment key to a custom URL', async () => {
    const { manager, prefs } = fixture()
    const custom = { ...defaultVideoConfig(), id: 'proxy', baseURL: 'https://proxy.invalid/api/v3' }
    await manager.saveConfig(custom, null)
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}))
    const api = createVideoService(prefs, send)
    await expect(api.testConnection(custom.id)).rejects.toThrow('video.error.key')
    expect(send).not.toHaveBeenCalled()
    await expect(api.testConnection('seedance')).rejects.toThrow('connectionResponse')
    expect(send).toHaveBeenCalledTimes(1)
  })
})
