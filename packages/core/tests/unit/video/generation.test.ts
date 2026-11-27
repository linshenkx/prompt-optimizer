import { describe, expect, it, vi } from 'vitest'
import { StaticLoader } from '../../../src/services/template/static-loader'
import { TemplateProcessor } from '../../../src/services/template/processor'
import { buildSeedanceRequest } from '../../../src/services/video/seedance'
import { createVideoService } from '../../../src/services/video/service'
import { DEFAULT_VIDEO_PARAMS, estimateVideoCost, SEEDANCE_MODEL } from '../../../src/services/video-model/catalog'
import { createDefaultVideoCreateState, isVideoSession, readVideoSession } from '../../../src/services/video/session'
import { PreferenceService } from '../../../src/services/preference/service'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'

describe('video authoring and Ark generation', () => {
  it('restores the default split when opening a draft saved before resizable panes', () => {
    const restored = readVideoSession({ originalPrompt: 'A harbor at dawn', optimizedPrompt: 'Pan across the water.' })
    expect(restored.mainSplitLeftPct).toBe(50)
    expect(restored.optimizedPrompt).toBe('Pan across the water.')
  })
  it('migrates single-column jobs and the selected account without losing the reported usage', () => {
    const old = { id: 'cgt-old', status: 'succeeded', model: SEEDANCE_MODEL, prompt: 'A previous edit',
      params: DEFAULT_VIDEO_PARAMS, images: [], submittedAt: 1000, tokens: 673 }
    const session = readVideoSession({ originalPrompt: 'A harbor', optimizedPrompt: '', selectedVideoConfigId: 'studio', runs: [old] })
    expect(session.columnCount).toBe(2)
    expect(session.columns.a).toEqual({ source: 'original', configId: 'studio', params: {} })
    expect(session.columns.b).toEqual({ source: 'workspace', configId: 'studio', params: {} })
    expect(session.runs[0]).toMatchObject({ providerId: 'ark', modelId: SEEDANCE_MODEL, capabilityMode: 'text2video', usage: { outputTokens: 673 } })
    expect(readVideoSession({
      ...session, columns: { ...session.columns, a: { ...session.columns.a, selectedRunKey: 'previous-selection' } },
    })).toEqual(session)
  })
  it.each(['zh', 'en'])('lists all managed video prompts and renders their supplied inputs (%s)', language => {
    const templates = Object.values(new StaticLoader().getTemplatesByType('videoOptimize', language))
    const suffix = language === 'en' ? '-en' : ''
    expect(templates.map(template => template.id)).toEqual([
      'video-natural' + suffix,
      'video-structured' + suffix,
      'video-i2v-motion' + suffix,
      'video-seedance' + suffix,
      'video-wan' + suffix,
    ])
    for (const template of templates) {
      const messages = TemplateProcessor.processTemplate(template, {
        originalPrompt: 'A 7-second square shot of {{boat}} passing a buoy.',
        duration: '8', ratio: '9:16', resolution: '720p',
        hasReferenceImages: true, referenceRoles: '1. Reference image\n2. Reference image',
      })
      expect(messages.map(message => message.role)).toEqual(['system', 'user'])
      for (const value of ['7-second square shot', '{{boat}}', '1. Reference image\n2. Reference image']) {
        expect(messages[1].content).toContain(value)
      }
      expect(messages[1].content).not.toMatch(/@ImageN|@图片N/)
      if (template.id.startsWith('video-seedance')) expect(messages[0].content).toMatch(/@ImageN|@图片N/)
      else expect(messages[0].content).not.toMatch(/@ImageN|@图片N/)
      expect(messages[1].content).not.toMatch(/9:16|720p|\b8\s*(?:s\b|秒)/)
      expect(TemplateProcessor.processTemplate(template, { originalPrompt: 'A shot of a boat' })[1].content)
        .not.toMatch(/@ImageN|@图片N|9:16|720p|\b4\s*(?:s\b|秒)/)
      expect(messages[0].content).not.toMatch(/\[(SUBJECT|ACTION|CAMERA)\]/)
      if (['video-natural', 'video-structured', 'video-i2v-motion'].some(id => template.id.startsWith(id))) {
        expect(messages[0].content).not.toMatch(/\b(Seedance|Wan)\b/i)
      }
    }
  })
  it.each(['zh', 'en'])('renders the managed revision with the edited draft, feedback and references (%s)', language => {
    const [template] = Object.values(new StaticLoader().getTemplatesByType('videoIterate', language))
    expect(template.id).toBe(language === 'en' ? 'video-feedback-en' : 'video-feedback')
    const context = { originalPrompt: 'A red sail.', lastOptimizedPrompt: '{{boat}} glides past buoy 17.',
      iterateInput: 'Change only the camera.', hasFrameImages: true, referenceRoles: '1. First frame\n2. Last frame',
      duration: '8', ratio: '9:16', resolution: '720p' }
    const [, prompt] = TemplateProcessor.processTemplate(template, context)
    for (const value of [context.originalPrompt, context.lastOptimizedPrompt, context.iterateInput, context.referenceRoles]) {
      expect(prompt.content).toContain(value)
    }
    expect(prompt.content).not.toMatch(/@ImageN|@图片N|9:16|720p|\b8\s*(?:s\b|秒)/)
    const [, withImage] = TemplateProcessor.processTemplate(template, { ...context, hasInputImages: true })
    expect(withImage.content).not.toBe(prompt.content)
    expect(readVideoSession({ originalPrompt: '', optimizedPrompt: '' }).selectedIterateTemplateId).toBeNull()
  })
  it('migrates a draft without rewriting the edited text or overriding an explicit template', () => {
    const legacy = { originalPrompt: 'A boat', optimizedPrompt: 'My edit', compiledPrompt: 'An earlier take',
      style: 'compact', selectedTemplateId: null, spec: { subject: 'An obsolete shape' } }
    expect(isVideoSession(legacy)).toBe(true)
    const result = readVideoSession(legacy)
    expect(result).toMatchObject({ optimizedPrompt: 'My edit', lastGeneratedPrompt: 'An earlier take', selectedTemplateId: 'video-natural' })
    for (const key of ['style', 'spec', 'compiledPrompt']) expect(result).not.toHaveProperty(key)
    expect(readVideoSession({ ...legacy, selectedTemplateId: 'my-template' }).selectedTemplateId).toBe('my-template')
    expect(readVideoSession(result)).toEqual(result)
  })
  it('keeps resolvable frames, other image assets and old submitted prompts when reading a legacy snapshot', () => {
    const asset = (id: string, role: string) => ({ _type: 'image-ref', id, name: id + '.png', role })
    const reference = asset('asset-a', 'character')
    const first = asset('asset-b', 'first_frame')
    const extra = asset('asset-c', 'first_frame')
    const last = asset('asset-d', 'last_frame')
    const legacyRun = {
      id: 'cgt-old', status: 'succeeded', model: SEEDANCE_MODEL, prompt: 'Original prompt',
      params: DEFAULT_VIDEO_PARAMS, images: [reference, asset('style', 'style')], submittedAt: 1000,
    }
    const latestRun = { ...legacyRun, id: 'cgt-newer', submittedPrompt: 'Exact text captured at submission' }
    const legacy = {
      originalPrompt: 'A boat', optimizedPrompt: 'My edit', draftParams: DEFAULT_VIDEO_PARAMS,
      params: { ...DEFAULT_VIDEO_PARAMS, duration: 12 }, images: [reference, first, extra, last],
      runs: [latestRun, legacyRun],
    }
    const session = readVideoSession(legacy)
    expect(session.capabilityMode).toBe('references')
    expect(session.images).toEqual([
      { ...reference, role: 'reference_image' }, first, { ...extra, role: 'reference_image' }, last,
    ])
    expect(session.columns.b.params.duration).toBe(12)
    expect(session).not.toHaveProperty('draftParams')
    expect(session.runs[0].submittedPrompt).toBe(latestRun.submittedPrompt)
    expect(session.runs[1].submittedPrompt).toBe('Original prompt\n\nImage 1: character reference. Image 2: style reference.')
    expect(readVideoSession(session)).toEqual(session)
    expect(readVideoSession({ ...legacy, images: [first, last] }).capabilityMode).toBe('frames')
    expect(readVideoSession({ ...legacy, imageMode: 'references', images: [first, last] })).toMatchObject({
      capabilityMode: 'text2video', images: [first, last],
    })
    expect(readVideoSession({ ...legacy, images: [last] }).images[0].role).toBe('reference_image')
  })
  it('submits the exact text and maps reference or frame images in order', () => {
    const url = 'data:image/png;base64,Y2F0'
    const other = 'data:image/jpeg;base64,Ym9hdA=='
    const input = {
      model: SEEDANCE_MODEL, prompt: 'Follow the boat from @图片1 at water level.',
      params: { duration: 8, ratio: '9:16', resolution: '720p' } as const,
    }
    const request = buildSeedanceRequest({
      ...input, references: [{ role: 'reference_image', url }, { role: 'reference_image', url: other }],
    })
    expect(request).toMatchObject({
      content: [
        { type: 'text', text: input.prompt },
        { type: 'image_url', role: 'reference_image', image_url: { url } },
        { type: 'image_url', role: 'reference_image', image_url: { url: other } },
      ],
      generate_audio: false, ...input.params,
    })
    expect(request).not.toHaveProperty('return_last_frame')
    const frames = buildSeedanceRequest({ ...input, references: [
      { role: 'first_frame', url }, { role: 'last_frame', url: other },
    ] })
    expect(frames.content.slice(1)).toEqual([
      { type: 'image_url', role: 'first_frame', image_url: { url } },
      { type: 'image_url', role: 'last_frame', image_url: { url: other } },
    ])
    expect(() => buildSeedanceRequest({ ...input, references: [{ role: 'last_frame', url }] })).toThrow(/firstFrameRequired|references/)
    expect(() => buildSeedanceRequest({ ...input, references: [
      { role: 'reference_image', url }, { role: 'first_frame', url },
    ] })).toThrow(/firstFrameRequired|references/)
    expect(estimateVideoCost({ ...DEFAULT_VIDEO_PARAMS, duration: 5, resolution: '720p' })).toBeCloseTo(4, 2)
  })
  it('keeps zero, missing and invalid usage distinct and never invents input usage', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set('video-model/seedance', { apiKey: 'test', model: SEEDANCE_MODEL })
    const send = vi.fn()
    const service = createVideoService(preferences, send)
    for (const [usage, expected] of [
      [{ completion_tokens: 0, total_tokens: 0 }, { usage: { outputTokens: 0, totalTokens: 0 } }],
      [{ completion_tokens: '10', total_tokens: 53 }, { usage: { totalTokens: 53 } }],
      [{ completion_tokens: -1, total_tokens: 0.5 }, {}],
      [undefined, {}],
    ] as const) {
      send.mockResolvedValueOnce(Response.json({ id: 'cgt-zero', status: 'running', usage }))
      expect(await service.query('cgt-zero')).toEqual({ id: 'cgt-zero', status: 'running', ...expected })
    }
  })
  it('submits once and queries the returned ID, without persisting bytes or authorizing a new submission on transport failure', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set('video-model/seedance',{apiKey:'test',model:SEEDANCE_MODEL})
    const send = vi.fn().mockResolvedValueOnce(Response.json({id:'cgt-1'}))
      .mockResolvedValueOnce(Response.json({id:'cgt-1',status:'succeeded',updated_at:1700000000,content:{video_url:'https://example.org/preview.mp4'},usage:{completion_tokens:42}}))
      .mockRejectedValueOnce(new Error('connection lost'))
    const service = createVideoService(preferences,send)
    const input = {model:SEEDANCE_MODEL, prompt:'A cat', params:DEFAULT_VIDEO_PARAMS, references:[]}
    const id = await service.create(input)
    expect(await service.query(id)).toMatchObject({id,status:'succeeded',expiresAt:1700000000000+86400000,usage:{ outputTokens:42 }})
    await expect(service.create(input)).rejects.toThrow('connection lost')
    expect(send.mock.calls.map(c=>c[1].method)).toEqual(['POST','GET','POST'])
    const snapshot = createDefaultVideoCreateState()
    expect(isVideoSession({...snapshot,runs:[{...input, id, status:'succeeded', videoUrl:'data:video/mp4;base64,QQ=='}]})).toBe(false)
    expect(isVideoSession({...snapshot, apiKey:'test'})).toBe(false)
  })
})
