import { describe, expect, it, vi } from 'vitest'
import { StaticLoader } from '../../../src/services/template/static-loader'
import { TemplateProcessor } from '../../../src/services/template/processor'
import { buildSeedanceRequest, createSeedanceService, DEFAULT_VIDEO_PARAMS, estimateVideoCost, SEEDANCE_MODEL, seedancePromptText } from '../../../src/services/video/seedance'
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
    expect(session.columns.a).toEqual({ source: 'original', configId: 'studio' })
    expect(session.columns.b).toEqual({ source: 'workspace', configId: 'studio' })
    expect(session.runs).toEqual([old])
    expect(readVideoSession(session)).toEqual(session)
  })
  it.each(['zh', 'en'])('lists both managed video prompts and renders their supplied inputs (%s)', language => {
    const templates = Object.values(new StaticLoader().getTemplatesByType('videoOptimize', language))
    const suffix = language === 'en' ? '-en' : ''
    expect(templates.map(template => template.id)).toEqual(['video-natural' + suffix, 'video-structured' + suffix])
    for (const template of templates) {
      const messages = TemplateProcessor.processTemplate(template, {
        originalPrompt: 'A boat named {{boat}} passes a buoy.', duration: '8', ratio: '9:16',
        resolution: '720p', referenceRoles: '1. character\n2. style',
      })
      expect(messages.map(message => message.role)).toEqual(['system', 'user'])
      for (const value of ['{{boat}}', '8', '1. character\n2. style']) {
        expect(messages[1].content).toContain(value)
      }
      expect(messages[0].content).not.toMatch(/Seedance|@ImageN|@图片N/)
      expect(messages[0].content).not.toMatch(/\[(SUBJECT|ACTION|CAMERA)\]/)
    }
  })
  it.each(['zh', 'en'])('renders the managed revision with the edited draft, feedback and references (%s)', language => {
    const [template] = Object.values(new StaticLoader().getTemplatesByType('videoIterate', language))
    expect(template.id).toBe(language === 'en' ? 'video-feedback-en' : 'video-feedback')
    const context = { originalPrompt: 'A red sail.', lastOptimizedPrompt: '{{boat}} glides past buoy 17.',
      iterateInput: 'Change only the camera.', referenceRoles: '1. style', duration: '4', ratio: '16:9', resolution: '480p' }
    const [, prompt] = TemplateProcessor.processTemplate(template, context)
    for (const value of [context.originalPrompt, context.lastOptimizedPrompt, context.iterateInput, context.referenceRoles, context.duration]) expect(prompt.content).toContain(value)
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
  it('preserves roles in the wire prompt and rejects unsupported frame combinations before submitting', () => {
    const url = 'data:image/png;base64,Y2F0'
    const input = {model: SEEDANCE_MODEL, prompt: 'Keep my edit', params: DEFAULT_VIDEO_PARAMS, references: []}
    const request = buildSeedanceRequest({...input, references: [{role:'character',url},{role:'style',url}]})
    expect(request).toMatchObject({
      content: [{ type:'text',text:'Keep my edit\n\n@Image1 is a character reference. @Image2 is a style reference.'},
        {role:'reference_image'},{role:'reference_image'}], generate_audio:false, duration:4, resolution:'480p' })
    expect(request).not.toHaveProperty('return_last_frame')
    expect(() => buildSeedanceRequest({...input, references:[{role:'last_frame', url}]})).toThrow('frames')
    expect(() => buildSeedanceRequest({...input, references:[{role:'style', url}, {role:'first_frame',url}]})).toThrow('frames')
    expect(estimateVideoCost({...DEFAULT_VIDEO_PARAMS, duration:5, resolution:'720p'})).toBeCloseTo(4, 2)
  })
  it('keeps explicit image roles and fills in only missing references', () => {
    const references = [{ role: 'character' }, { role: 'style' }] as const
    const zh = '保留 @图片1 中帆船的外观，参考图20是旧设定。'
    expect(seedancePromptText(zh, [...references])).toBe(zh + '\n\n@图片2 用作风格参考。')
    const en = 'Use Image 1 for the boat and @Image2 for lighting.'
    expect(seedancePromptText(en, [...references])).toBe(en + '\n\n@Image1 is a character reference.')
    expect(seedancePromptText(en, [...references], true)).toBe(en + '\n\nImage 1: character reference. Image 2: style reference.')
  })
  it('keeps zero, missing and invalid usage distinct and never invents input usage', async () => {
    const preferences = new PreferenceService(new MemoryStorageProvider())
    await preferences.set('video-model/seedance', { apiKey: 'test', model: SEEDANCE_MODEL })
    const send = vi.fn()
    const service = createSeedanceService(preferences, send)
    for (const [usage, expected] of [
      [{ completion_tokens: 0, total_tokens: 0 }, { tokens: 0, totalTokens: 0 }],
      [{ completion_tokens: '10', total_tokens: 53 }, { totalTokens: 53 }],
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
    const service = createSeedanceService(preferences,send)
    const input = {model:SEEDANCE_MODEL, prompt:'A cat', params:DEFAULT_VIDEO_PARAMS, references:[]}
    const id = await service.create(input)
    expect(await service.query(id)).toMatchObject({id,status:'succeeded',expiresAt:1700000000000+86400000,tokens:42})
    await expect(service.create(input)).rejects.toThrow('connection lost')
    expect(send.mock.calls.map(c=>c[1].method)).toEqual(['POST','GET','POST'])
    const snapshot = createDefaultVideoCreateState()
    expect(isVideoSession({...snapshot,runs:[{...input, id, status:'succeeded', videoUrl:'data:video/mp4;base64,QQ=='}]})).toBe(false)
    expect(isVideoSession({...snapshot, apiKey:'test'})).toBe(false)
  })
})
