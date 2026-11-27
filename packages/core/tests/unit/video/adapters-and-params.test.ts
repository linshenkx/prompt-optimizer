import { describe, expect, it, vi } from 'vitest'
import { PreferenceService } from '../../../src/services/preference/service'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { defaultVideoConfig, VIDEO_MODEL_PREFERENCE, VideoModelManager } from '../../../src/services/video-model/manager'
import { ARK_VIDEO_BASE_URL, BYTEPLUS_SEEDANCE_FAST, BYTEPLUS_SEEDANCE_FLAGSHIP, BYTEPLUS_VIDEO_BASE_URL,
  getVideoModelSpec, listVideoModelPresets, MINIMAX_CN_VIDEO_BASE_URL, MINIMAX_H3, MINIMAX_H3_HIGHSPEED, MINIMAX_H3_LITE, MINIMAX_INTL_VIDEO_BASE_URL,
  SEEDANCE_FLAGSHIP, SEEDANCE_MODEL, VIDEO_PROVIDERS } from '../../../src/services/video-model/catalog'
import { checkVideoInputCompatibility, partitionVideoColumnParams, resolveVideoParams, totalVideoCosts } from '../../../src/services/video/params'
import { createDesktopServiceBridge } from '../../utils/desktop-service-bridge'
import { createVideoService, type VideoService } from '../../../src/services/video/service'
import type { VideoCapabilityMode, VideoProviderId, VideoReference } from '../../../src/services/video/types'

const refs = (n: number): VideoReference[] => Array.from({ length: n }, () => ({ role: 'reference_image', url: 'data:image/png;base64,AAAA' }))
const frames: VideoReference[] = (['first_frame', 'last_frame'] as const).map(role => ({ role, url: refs(1)[0].url }))
const spec = (id: string, providerId?: VideoProviderId) => getVideoModelSpec(id, providerId)!
const text = { mode: 'text2video', images: [] } as const
const hailuo = 'MiniMax-Hailuo-2.3'
const hailuoFast = 'MiniMax-Hailuo-2.3-Fast'
const hailuo02 = 'MiniMax-Hailuo-02'

async function fixture(modelId: string, baseURL: string, providerId?: VideoProviderId) {
  const preferences = new PreferenceService(new MemoryStorageProvider())
  const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('Unexpected mock request'))
  const service = createVideoService(preferences, send)
  const model = spec(modelId, providerId)
  const config = { ...defaultVideoConfig(), id: 'test', name: model.name, modelId, providerId: model.providerId, baseURL, apiKey: 'mock-key' }
  await service.saveConfig(config, null)
  const create = (mode: VideoCapabilityMode, references: VideoReference[]) =>
    service.create({ model: modelId, providerId: model.providerId, configId: config.id, modelId, prompt: 'A slow pan', params: {}, capabilityMode: mode, references })
  const calls = () => send.mock.calls.map(([url, init]) => [url, init?.method])
  return { service, config, send, create, calls }
}

describe('provider adapters', () => {
  it.each([[SEEDANCE_MODEL, 4, '480p'], [SEEDANCE_FLAGSHIP, 5, '720p']] as const)('creates and cancels %s', async (id, duration, resolution) => {
    const { service, config, send, create, calls } = await fixture(id, ARK_VIDEO_BASE_URL)
    send.mockResolvedValueOnce(Response.json({ id: 'ark-id' })).mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await create('frames', frames)).toBe('ark-id')
    await service.cancel('ark-id', config.id)
    const base = ARK_VIDEO_BASE_URL + '/contents/generations/tasks'
    expect(calls()).toEqual([[base, 'POST'], [base + '/ark-id', 'DELETE']])
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toMatchObject({
      model: id, duration, resolution, generate_audio: false, content: [
        { type: 'text', text: 'A slow pan' }, { role: 'first_frame' }, { role: 'last_frame' },
      ],
    })
  })

  it.each([false, true])('handles H3 status and result (retrieve file: %s)', async retrieve => {
    const { service, config, send, create, calls } = await fixture(MINIMAX_H3, MINIMAX_INTL_VIDEO_BASE_URL, 'minimax-intl')
    const videoUrl = 'https://cdn.example.test/movie.mp4'
    send.mockResolvedValueOnce(Response.json({ task: { id: 'h3-id' } }))
      .mockResolvedValueOnce(Response.json({ task: { id: 'h3-id', status: 'running' } }))
      .mockResolvedValueOnce(Response.json({ task: { id: 'h3-id', status: 'succeeded',
        ...(retrieve ? { file_id: 'file' } : { content: { url: videoUrl } }),
      } }))
    if (retrieve) send.mockResolvedValueOnce(Response.json({ file: { download_url: videoUrl }, base_resp: { status_code: 0 } }))
    expect(await create('references', refs(9))).toBe('h3-id')
    expect(await service.query('h3-id', config.id)).toEqual({ id: 'h3-id', status: 'running' })
    expect(await service.query('h3-id', config.id)).toEqual({ id: 'h3-id', status: 'succeeded', videoUrl })
    await expect(service.cancel('h3-id', config.id)).rejects.toThrow('noCancel')
    const base = config.baseURL
    expect(calls()).toEqual([[base + '/v2/video_generation', 'POST'], [base + '/v2/query/video_generation/h3-id', 'GET'],
      [base + '/v2/query/video_generation/h3-id', 'GET'], ...(retrieve ? [[base + '/v1/files/retrieve?file_id=file', 'GET']] : [])])
    const payload = JSON.parse(String(send.mock.calls[0][1]?.body))
    expect(payload).toMatchObject({ model: MINIMAX_H3, resolution: '768P', duration: 6, ratio: '16:9',
      generate_audio: false, aigc_watermark: false })
    expect(payload.content).toHaveLength(10)
    expect(payload.content[9]).toEqual({ type: 'image_url', role: 'reference_image', image_url: { url: refs(1)[0].url } })
  })

  it.each([hailuo, hailuoFast, hailuo02])('uses the V1 API and retrieves the file for %s', async model => {
    const { service, config, send, create, calls } = await fixture(model, MINIMAX_CN_VIDEO_BASE_URL)
    const task = (status: string, file_id?: string) => Response.json({ task_id: 'hailuo-id', status, file_id, base_resp: { status_code: 0 } })
    const videoUrl = 'https://cdn.example.test/hailuo.mp4'
    send.mockResolvedValueOnce(Response.json({ task_id: 'hailuo-id', base_resp: { status_code: 0 } }))
      .mockResolvedValueOnce(task('Preparing')).mockResolvedValueOnce(task('Queueing')).mockResolvedValueOnce(task('Processing'))
      .mockResolvedValueOnce(task('Success', 'file-id')).mockResolvedValueOnce(Response.json({ file: { download_url: videoUrl } }))
      .mockResolvedValueOnce(task('Fail'))
    const images = model === hailuo02 ? frames : frames.slice(0, 1)
    const id = await create('frames', images)
    for (const status of ['queued', 'queued', 'running', 'succeeded', 'failed']) {
      expect(await service.query(id, config.id)).toMatchObject({ status, ...(status === 'succeeded' && { videoUrl }) })
    }
    expect(calls()[0]).toEqual([config.baseURL + '/v1/video_generation', 'POST'])
    expect(calls()[1]).toEqual([config.baseURL + '/v1/query/video_generation?task_id=hailuo-id', 'GET'])
    expect(calls()[5]).toEqual([config.baseURL + '/v1/files/retrieve?file_id=file-id', 'GET'])
    const payload = JSON.parse(String(send.mock.calls[0][1]?.body))
    expect(payload).toEqual({ model, prompt: 'A slow pan', resolution: '768P', duration: 6,
      prompt_optimizer: false, first_frame_image: frames[0].url, ...(model === hailuo02 && { last_frame_image: frames[1].url }),
    })
  })

  it.each([
    ['minimax', MINIMAX_CN_VIDEO_BASE_URL],
    ['minimax-intl', MINIMAX_INTL_VIDEO_BASE_URL],
  ] as const)('verifies a key with GET only for %s at %s', async (providerId, endpoint) => {
    const { service, config, send, calls } = await fixture(MINIMAX_H3, endpoint, providerId)
    send.mockResolvedValueOnce(Response.json({ base_resp: { status_code: 0 }, files: [] }))
      .mockResolvedValueOnce(Response.json({ base_resp: { status_code: 1004 }, files: [] }))
      .mockResolvedValueOnce(Response.json({ base_resp: { status_code: 2049 }, files: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(Response.json({}))
    await service.testConnection(config.id)
    for (const error of ['auth', 'auth', 'HTTP 401', 'HTTP 403', 'connectionResponse']) {
      await expect(service.testConnection(config.id)).rejects.toThrow(error)
    }
    expect(calls()).toEqual(Array.from({ length: 6 }, () => [endpoint + '/v1/files/list', 'GET']))
    expect(new Headers(send.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer mock-key')
  })

  it('coerces numeric MiniMax task IDs and surfaces base_resp.status_msg on non-2xx HTTP errors', async () => {
    const { service, config, send, create } = await fixture(hailuo, MINIMAX_CN_VIDEO_BASE_URL)
    send.mockResolvedValueOnce(Response.json({ task_id: 106916112212032, base_resp: { status_code: 0 } }))
      .mockResolvedValueOnce(Response.json({ task_id: 106916112212032, status: 'Processing', base_resp: { status_code: 0 } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ base_resp: { status_code: 1004, status_msg: 'invalid api key' } }), { status: 401 }))
    expect(await create('text2video', [])).toBe('106916112212032')
    expect(await service.query('106916112212032', config.id)).toEqual({ id: '106916112212032', status: 'running' })
    await expect(service.testConnection(config.id)).rejects.toThrow('MiniMax HTTP 401: invalid api key')
  })

  it.each([MINIMAX_H3_LITE, MINIMAX_H3_HIGHSPEED])('creates and queries %s through IPC using an existing official account', async modelId => {
    const { service, config, send, calls } = await fixture(hailuo02, MINIMAX_INTL_VIDEO_BASE_URL, 'minimax-intl')
    const { video } = createDesktopServiceBridge({ createVideoService: () => service }) as { video: VideoService }
    const identity = { providerId: config.providerId, modelId, configModelId: config.modelId, model: modelId }
    const input = { ...identity, configId: config.id, baseURL: config.baseURL, prompt: 'A slow pan',
      params: { duration: 4, ratio: 'adaptive' }, references: refs(1) }
    await expect(service.create({ ...input, configModelId: undefined })).rejects.toThrow('configChanged')
    send.mockResolvedValueOnce(Response.json({ task_id: 'desktop-h3' }))
      .mockResolvedValueOnce(Response.json({ task: { id: 'desktop-h3', status: 'running' } }))
    expect(await video.create(input)).toBe('desktop-h3')
    expect(await video.query('desktop-h3', config.id, config.baseURL, identity))
      .toEqual({ id: 'desktop-h3', status: 'running' })
    expect(calls()).toEqual([[config.baseURL + '/v2/video_generation', 'POST'], [config.baseURL + '/v2/query/video_generation/desktop-h3', 'GET']])
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toMatchObject({
      model: modelId, resolution: '480P', duration: 4, ratio: modelId === MINIMAX_H3_LITE ? '16:9' : 'adaptive',
    })
    expect(new Headers(send.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer mock-key')
    expect(await service.getConfig(config.id)).toEqual(config)
  })

  it('creates BytePlus Dreamina tasks and migrates legacy MiniMax international configs', async () => {
    const { service, config, send, create, calls } = await fixture(BYTEPLUS_SEEDANCE_FLAGSHIP, BYTEPLUS_VIDEO_BASE_URL, 'byteplus')
    send.mockResolvedValueOnce(Response.json({ id: 'bp-id' }))
    expect(await create('text2video', [])).toBe('bp-id')
    expect(calls()).toEqual([[BYTEPLUS_VIDEO_BASE_URL + '/contents/generations/tasks', 'POST']])
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toMatchObject({ model: BYTEPLUS_SEEDANCE_FLAGSHIP, duration: 5, resolution: '720p' })
    expect(config.providerId).toBe('byteplus')

    const prefs = new PreferenceService(new MemoryStorageProvider())
    await prefs.set(VIDEO_MODEL_PREFERENCE, [{
      id: 'intl-legacy', providerId: 'minimax', name: 'Old Intl', modelId: MINIMAX_H3,
      baseURL: MINIMAX_INTL_VIDEO_BASE_URL, apiKey: 'k', enabled: true,
    }])
    const manager = new VideoModelManager(prefs)
    expect((await manager.getConfig('intl-legacy')).providerId).toBe('minimax-intl')
    for (const provider of Object.values(VIDEO_PROVIDERS)) {
      expect(provider.apiKeyUrl).toMatch(/^https:\/\//)
    }
  })

  it('imports a legacy Ark array and keeps IDs and custom wire models on round trip', async () => {
    const prefs = new PreferenceService(new MemoryStorageProvider())
    const manager = new VideoModelManager(prefs)
    const legacy = [{ id: 'studio', providerId: 'ark', name: 'Studio', model: 'ep-legacy',
      baseURL: ARK_VIDEO_BASE_URL + '/', apiKey: 'test-key', enabled: false }]
    await prefs.set(VIDEO_MODEL_PREFERENCE, legacy)
    const backup = await manager.exportData()
    expect(backup).toEqual([{ ...defaultVideoConfig(), id: 'studio', name: 'Studio', customModel: 'ep-legacy', apiKey: 'test-key', enabled: false }])
    const imported = new VideoModelManager(new PreferenceService(new MemoryStorageProvider()))
    await imported.importData(legacy)
    expect(await imported.exportData()).toEqual(backup)
  })
})

describe('capabilities, pricing and column settings', () => {
  it('distinguishes unsupported models and incomplete inputs', () => {
    expect(checkVideoInputCompatibility(spec(hailuoFast), 'text2video', [])).toMatchObject({ kind: 'unsupported', reasonKey: 'video.error.noTextToVideo' })
    expect(checkVideoInputCompatibility(spec(hailuo), 'frames', frames)).toMatchObject({ kind: 'unsupported', reasonKey: 'video.error.noLastFrame' })
    expect(checkVideoInputCompatibility(spec(hailuo), 'references', refs(1))).toMatchObject({ kind: 'unsupported', reasonKey: 'video.error.noReferences' })
    expect(checkVideoInputCompatibility(spec(SEEDANCE_MODEL), 'references', refs(5))).toMatchObject({ kind: 'unsupported', params: { max: 4 } })
    expect(checkVideoInputCompatibility(spec(MINIMAX_H3), 'references', refs(9)).compatible).toBe(true)
    expect(checkVideoInputCompatibility(spec(MINIMAX_H3), 'references', []).compatible).toBe(false)
    expect(checkVideoInputCompatibility(spec(MINIMAX_H3), 'frames', [])).toMatchObject({ kind: 'missing-input', reasonKey: 'video.error.firstFrameRequired' })
  })

  it('resolves context constraints and hoists only equivalent effective controls', () => {
    for (const id of [SEEDANCE_FLAGSHIP, MINIMAX_H3]) {
      expect(resolveVideoParams(spec(id), { ratio: 'adaptive' }, text).params.ratio).toBe('16:9')
      expect(resolveVideoParams(spec(id), { ratio: 'adaptive' }, { mode: 'frames', images: frames }).params.ratio).toBe('adaptive')
    }
    expect(resolveVideoParams(spec(hailuo), { resolution: '1080P', duration: 10 }, text).params.duration).toBe(6)
    expect(resolveVideoParams(spec(MINIMAX_H3_LITE), {}, text).params).toEqual({ duration: 4, ratio: '16:9', resolution: '480P', audio: false })
    expect(resolveVideoParams(spec(MINIMAX_H3_LITE), { ratio: '9:16' }, { mode: 'frames', images: frames }).params.ratio).toBe('adaptive')
    expect(resolveVideoParams(spec(hailuo02), { resolution: '512P' }, { mode: 'frames', images: frames }).params.resolution).toBe('768P')
    const columns = [SEEDANCE_MODEL, MINIMAX_H3].map((id, i) => ({ variantId: ['a', 'b'][i], definitions: resolveVideoParams(spec(id), {}, text).definitions }))
    const partition = partitionVideoColumnParams(columns, ['duration'])
    expect(partition.shared.map(def => def.key)).toEqual(['ratio', 'audio'])
    expect(partition.perColumn.a?.map(def => def.key)).toEqual(['duration', 'resolution'])
    expect(partition.mergeableSplitKeys).toEqual(['duration'])
    expect(partitionVideoColumnParams(columns, []).shared.map(def => def.key)).toEqual(['duration', 'ratio', 'audio'])
    const withDifferentRange = [...columns, { variantId: 'c', definitions: spec(SEEDANCE_FLAGSHIP).params }]
    expect(partitionVideoColumnParams(withDifferentRange, ['duration']).mergeableSplitKeys).toEqual([])
  })

  it('prices per token, second and clip, and groups currencies separately', () => {
    const ark = { ...text, baseURL: ARK_VIDEO_BASE_URL }
    const byteplus = { ...text, baseURL: BYTEPLUS_VIDEO_BASE_URL }
    const cn = { ...text, baseURL: MINIMAX_CN_VIDEO_BASE_URL }
    const intl = { ...text, baseURL: MINIMAX_INTL_VIDEO_BASE_URL }
    const fast = spec(SEEDANCE_MODEL, 'ark').pricing.actual?.({ outputTokens: 40000 }, {}, ark)
    expect(fast).toMatchObject({ currency: 'CNY', amount: 1.48 })
    expect(spec(SEEDANCE_FLAGSHIP, 'ark').pricing.actual?.({ outputTokens: 1_000_000 }, {}, ark)?.amount).toBe(70)
    expect(spec(BYTEPLUS_SEEDANCE_FLAGSHIP, 'byteplus').pricing.actual?.({ outputTokens: 1_000_000 }, { resolution: '720p' }, byteplus))
      .toMatchObject({ currency: 'USD', amount: 10.7 })
    expect(spec(BYTEPLUS_SEEDANCE_FLAGSHIP, 'byteplus').pricing.actual?.({ outputTokens: 1_000_000 }, { resolution: '1080p' }, byteplus))
      .toMatchObject({ currency: 'USD', amount: 11.7 })
    expect(spec(BYTEPLUS_SEEDANCE_FAST, 'byteplus').pricing.actual?.({ outputTokens: 1_000_000 }, { resolution: '480p' }, byteplus))
      .toMatchObject({ currency: 'USD', amount: 5.6 })
    expect(spec(MINIMAX_H3, 'minimax').pricing.estimate({ resolution: '2K', duration: 6 }, cn)?.amount).toBeCloseTo(4.8)
    expect(spec(MINIMAX_H3, 'minimax-intl').pricing.estimate({ resolution: '2K', duration: 6 }, intl)?.amount).toBeCloseTo(.78)
    const lite = { resolution: '480P', duration: 4 }
    expect(spec(MINIMAX_H3_LITE, 'minimax').pricing.estimate(lite, { ...cn, mode: 'references', images: refs(5) }))
      .toMatchObject({ amount: .64, currency: 'CNY', basis: 'duration' })
    expect(spec(MINIMAX_H3_LITE, 'minimax').pricing.estimate(lite, { ...cn, mode: 'references', images: refs(6) }))
      .toMatchObject({ amount: .77, basis: 'durationAndImages' })
    expect(spec(MINIMAX_H3_LITE, 'minimax-intl').pricing.estimate(lite, intl)).toMatchObject({ amount: .10, currency: 'USD' })
    expect(spec(hailuoFast, 'minimax').pricing.estimate({ resolution: '1080P', duration: 6 }, cn)?.amount).toBe(2.31)
    expect(spec(hailuo02, 'minimax-intl').pricing.estimate({ resolution: '512P', duration: 10 }, intl)?.amount).toBe(.15)
    const clip = spec(hailuo, 'minimax-intl').pricing.estimate({ resolution: '768P', duration: 6 }, intl)
    expect(clip).toMatchObject({ currency: 'USD', amount: .28 })
    expect(spec(hailuo, 'minimax-intl').pricing.estimate({ resolution: '768P', duration: 6 }, { ...text, baseURL: 'https://proxy.invalid' })).toBeNull()
    expect([...totalVideoCosts([fast, clip, null])]).toEqual([['CNY', 1.48], ['USD', .28]])
  })

  it('offers the H3 family for new MiniMax configurations and keeps the saved legacy choice', () => {
    for (const providerId of ['minimax', 'minimax-intl'] as const) {
      expect(VIDEO_PROVIDERS[providerId].defaultModelId).toBe(MINIMAX_H3_LITE)
      const ids = [MINIMAX_H3_LITE, MINIMAX_H3_HIGHSPEED, MINIMAX_H3]
      expect(listVideoModelPresets(providerId).map(model => model.id)).toEqual(ids)
      expect(listVideoModelPresets(providerId, hailuo).map(model => model.id)).toEqual([...ids, hailuo])
    }
  })
})
