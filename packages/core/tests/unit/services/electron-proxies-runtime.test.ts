import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElectronContextRepoProxy } from '../../../src/services/context/electron-proxy'
import { ElectronHistoryManagerProxy } from '../../../src/services/history/electron-proxy'
import { ElectronModelManagerProxy } from '../../../src/services/model/electron-proxy'
import { ElectronPreferenceServiceProxy } from '../../../src/services/preference/electron-proxy'
import { ElectronPromptServiceProxy } from '../../../src/services/prompt/electron-proxy'
import { ElectronTemplateManagerProxy } from '../../../src/services/template/electron-proxy'

const setWindow = (electronAPI: Record<string, any>) => {
  ;(globalThis as typeof globalThis & { window?: unknown }).window = { electronAPI }
}

describe('Electron service proxies runtime forwarding', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  })

  it('forwards prompt operations and serializes complex request payloads', async () => {
    const prompt = {
      optimizePrompt: vi.fn().mockResolvedValue('optimized'),
      optimizeMessage: vi.fn().mockResolvedValue('message'),
      iteratePrompt: vi.fn().mockResolvedValue('iterated'),
      testPrompt: vi.fn().mockResolvedValue('tested'),
      getHistory: vi.fn().mockResolvedValue([{ id: 'record-1' }]),
      getIterationChain: vi.fn().mockResolvedValue([{ id: 'chain-record' }]),
      optimizePromptStream: vi.fn().mockResolvedValue(undefined),
      optimizeMessageStream: vi.fn().mockResolvedValue(undefined),
      iteratePromptStream: vi.fn().mockResolvedValue(undefined),
      testPromptStream: vi.fn().mockResolvedValue(undefined),
      testCustomConversationStream: vi.fn().mockResolvedValue(undefined),
    }
    setWindow({ prompt })

    const service = new ElectronPromptServiceProxy()
    const callbacks = { onToken: vi.fn(), onComplete: vi.fn(), onError: vi.fn() }
    const proxiedRequest = new Proxy({
      targetPrompt: 'Draft a concise wiki prompt',
      modelKey: 'model-1',
      optimizationMode: 'user',
      dropped: () => 'not cloneable',
    }, {})

    await expect(service.optimizePrompt(proxiedRequest as any)).resolves.toBe('optimized')
    await expect(service.optimizeMessage({
      selectedMessageId: 'm1',
      messages: [{ id: 'm1', role: 'user', content: 'Hello' }],
      modelKey: 'model-1',
      variables: { tone: 'clear' },
      dropped: () => 'not cloneable',
    } as any)).resolves.toBe('message')
    await expect(service.iteratePrompt(
      'original',
      'optimized',
      'make shorter',
      'model-1',
      'template-1',
      { variables: { sector: 'manufacturing' }, tools: [{ dropped: () => 'nope', name: 'wiki' }] },
    )).resolves.toBe('iterated')
    await expect(service.testPrompt('system', 'user', 'model-1')).resolves.toBe('tested')
    await expect(service.getHistory()).resolves.toEqual([{ id: 'record-1' }])
    await expect(service.getIterationChain('record-1')).resolves.toEqual([{ id: 'chain-record' }])
    await service.optimizePromptStream(proxiedRequest as any, callbacks)
    await service.optimizeMessageStream({ selectedMessageId: 'm1', messages: [{ id: 'm1', role: 'user', content: 'Hello' }], modelKey: 'model-1' }, callbacks)
    await service.iteratePromptStream('original', 'optimized', 'again', 'model-1', callbacks, 'template-1', { variables: { tone: 'brief' } })
    await service.testPromptStream('system', 'user', 'model-1', callbacks)
    await service.testCustomConversationStream({ messages: [{ role: 'user', content: 'Hello' }], modelKey: 'model-1' } as any, callbacks)

    expect(prompt.optimizePrompt).toHaveBeenCalledWith({
      targetPrompt: 'Draft a concise wiki prompt',
      modelKey: 'model-1',
      optimizationMode: 'user',
    })
    expect(prompt.optimizeMessage.mock.calls[0][0]).toEqual({
      selectedMessageId: 'm1',
      messages: [{ id: 'm1', role: 'user', content: 'Hello' }],
      modelKey: 'model-1',
      variables: { tone: 'clear' },
    })
    expect(prompt.iteratePrompt.mock.calls[0][5]).toEqual({
      variables: { sector: 'manufacturing' },
      tools: [{ name: 'wiki' }],
    })
    expect(prompt.optimizePromptStream.mock.calls[0][0]).not.toHaveProperty('dropped')
    expect(prompt.testCustomConversationStream.mock.calls[0][0]).toEqual({
      messages: [{ role: 'user', content: 'Hello' }],
      modelKey: 'model-1',
    })
  })

  it('rejects prompt proxy usage when Electron prompt API is unavailable', async () => {
    setWindow({})

    await expect(new ElectronPromptServiceProxy().getHistory()).rejects.toThrow('Electron Prompt API is not available')
  })

  it('forwards model manager operations and lookup helpers', async () => {
    const model = {
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockResolvedValue(true),
      getAllModels: vi.fn().mockResolvedValue([{ id: 'm1', name: 'Model 1' }, { id: 'm2', name: 'Model 2' }]),
      addModel: vi.fn().mockResolvedValue(undefined),
      updateModel: vi.fn().mockResolvedValue(undefined),
      deleteModel: vi.fn().mockResolvedValue(undefined),
      getEnabledModels: vi.fn().mockResolvedValue([{ id: 'm1' }]),
      exportData: vi.fn().mockResolvedValue([{ id: 'm1' }]),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockResolvedValue('models'),
      validateData: vi.fn().mockResolvedValue(true),
    }
    setWindow({ model })

    const manager = new ElectronModelManagerProxy()

    await manager.ensureInitialized()
    await expect(manager.isInitialized()).resolves.toBe(true)
    await expect(manager.getModel('m2')).resolves.toEqual({ id: 'm2', name: 'Model 2' })
    await manager.addModel('m3', { id: 'm3', name: 'Model 3', dropped: () => 'skip' } as any)
    await manager.updateModel('m3', { enabled: true, dropped: () => 'skip' } as any)
    await manager.enableModel('m3')
    await manager.disableModel('m3')
    await manager.deleteModel('m3')
    await expect(manager.getEnabledModels()).resolves.toEqual([{ id: 'm1' }])
    await expect(manager.exportData()).resolves.toEqual([{ id: 'm1' }])
    await manager.importData({ models: [{ id: 'm1' }], dropped: () => 'skip' })
    await expect(manager.getDataType()).resolves.toBe('models')
    await expect(manager.validateData({ models: [], dropped: () => 'skip' })).resolves.toBe(true)

    expect(model.addModel).toHaveBeenCalledWith({ key: 'm3', id: 'm3', name: 'Model 3' })
    expect(model.updateModel).toHaveBeenCalledWith('m3', { enabled: true })
    expect(model.updateModel).toHaveBeenCalledWith('m3', { enabled: false })
    expect(model.importData).toHaveBeenCalledWith({ models: [{ id: 'm1' }] })
    expect(model.validateData).toHaveBeenCalledWith({ models: [] })
  })

  it('throws a typed model error outside Electron renderer context', () => {
    expect(() => new ElectronModelManagerProxy()).toThrow('can only be used in Electron renderer process')
  })

  it('forwards template manager operations and serializes import/export payloads', async () => {
    const template = {
      getTemplate: vi.fn().mockResolvedValue({ id: 't1' }),
      createTemplate: vi.fn().mockResolvedValue(undefined),
      deleteTemplate: vi.fn().mockResolvedValue(undefined),
      getTemplates: vi.fn().mockResolvedValue([{ id: 't1' }]),
      exportTemplate: vi.fn().mockResolvedValue('{"id":"t1"}'),
      importTemplate: vi.fn().mockResolvedValue(undefined),
      listTemplatesByType: vi.fn().mockResolvedValue([{ id: 't1', metadata: { templateType: 'optimize' } }]),
      changeBuiltinTemplateLanguage: vi.fn().mockResolvedValue(undefined),
      getCurrentBuiltinTemplateLanguage: vi.fn().mockResolvedValue('zh-CN'),
      getSupportedBuiltinTemplateLanguages: vi.fn().mockResolvedValue(['zh-CN', 'en-US']),
      exportData: vi.fn().mockResolvedValue([{ id: 't1' }]),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockResolvedValue('templates'),
      validateData: vi.fn().mockResolvedValue(true),
    }
    setWindow({ template })

    const manager = new ElectronTemplateManagerProxy()

    await expect(manager.getTemplate('t1')).resolves.toEqual({ id: 't1' })
    await manager.saveTemplate({ id: 't2', content: 'Hello', dropped: () => 'skip' } as any)
    await manager.deleteTemplate('t2')
    await expect(manager.listTemplates()).resolves.toEqual([{ id: 't1' }])
    await expect(manager.exportTemplate('t1')).resolves.toBe('{"id":"t1"}')
    await manager.importTemplate('{"id":"t1"}')
    await expect(manager.listTemplatesByType('optimize' as any)).resolves.toEqual([{ id: 't1', metadata: { templateType: 'optimize' } }])
    await manager.changeBuiltinTemplateLanguage('en-US')
    await expect(manager.getCurrentBuiltinTemplateLanguage()).resolves.toBe('zh-CN')
    await expect(manager.getSupportedBuiltinTemplateLanguages()).resolves.toEqual(['zh-CN', 'en-US'])
    await expect(manager.exportData()).resolves.toEqual([{ id: 't1' }])
    await manager.importData({ templates: [{ id: 't1' }], dropped: () => 'skip' })
    await expect(manager.getDataType()).resolves.toBe('templates')
    await expect(manager.validateData({ templates: [], dropped: () => 'skip' })).resolves.toBe(true)

    expect(template.createTemplate).toHaveBeenCalledWith({ id: 't2', content: 'Hello' })
    expect(template.importData).toHaveBeenCalledWith({ templates: [{ id: 't1' }] })
    expect(template.validateData).toHaveBeenCalledWith({ templates: [] })
  })

  it('forwards history operations and handles missing records', async () => {
    const record = { id: 'r1', originalPrompt: 'before', optimizedPrompt: 'after' }
    const history = {
      addRecord: vi.fn().mockResolvedValue(undefined),
      getHistory: vi.fn().mockResolvedValue([record]),
      deleteRecord: vi.fn().mockResolvedValue(undefined),
      getIterationChain: vi.fn().mockResolvedValue([record]),
      clearHistory: vi.fn().mockResolvedValue(undefined),
      getAllChains: vi.fn().mockResolvedValue([{ id: 'c1', records: [record] }]),
      getChain: vi.fn().mockResolvedValue({ id: 'c1', records: [record] }),
      createNewChain: vi.fn().mockResolvedValue({ id: 'c2', records: [record] }),
      addIteration: vi.fn().mockResolvedValue({ id: 'c1', records: [record] }),
      deleteChain: vi.fn().mockResolvedValue(undefined),
      exportData: vi.fn().mockResolvedValue([record]),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockResolvedValue('history'),
      validateData: vi.fn().mockResolvedValue(true),
    }
    setWindow({ history })

    const manager = new ElectronHistoryManagerProxy()

    await manager.addRecord({ ...record, dropped: () => 'skip' } as any)
    await expect(manager.getRecords()).resolves.toEqual([record])
    await expect(manager.getRecord('r1')).resolves.toEqual(record)
    await expect(manager.getRecord('missing')).rejects.toThrow('Record with ID missing not found')
    await manager.deleteRecord('r1')
    await expect(manager.getIterationChain('r1')).resolves.toEqual([record])
    await manager.clearHistory()
    await expect(manager.getAllChains()).resolves.toEqual([{ id: 'c1', records: [record] }])
    await expect(manager.getChain('c1')).resolves.toEqual({ id: 'c1', records: [record] })
    await manager.createNewChain({ originalPrompt: 'before', optimizedPrompt: 'after', dropped: () => 'skip' } as any)
    await manager.addIteration({ chainId: 'c1', originalPrompt: 'before', optimizedPrompt: 'after', modelKey: 'm1', templateId: 't1', dropped: () => 'skip' } as any)
    await manager.deleteChain('c1')
    await expect(manager.exportData()).resolves.toEqual([record])
    await manager.importData({ records: [record], dropped: () => 'skip' })
    await expect(manager.getDataType()).resolves.toBe('history')
    await expect(manager.validateData({ records: [], dropped: () => 'skip' })).resolves.toBe(true)

    expect(history.addRecord).toHaveBeenCalledWith(record)
    expect(history.createNewChain).toHaveBeenCalledWith({ originalPrompt: 'before', optimizedPrompt: 'after' })
    expect(history.addIteration).toHaveBeenCalledWith({ chainId: 'c1', originalPrompt: 'before', optimizedPrompt: 'after', modelKey: 'm1', templateId: 't1' })
    expect(history.importData).toHaveBeenCalledWith({ records: [record] })
    expect(history.validateData).toHaveBeenCalledWith({ records: [] })
  })

  it('forwards preference operations and reports missing preload bridge', async () => {
    const preference = {
      get: vi.fn().mockResolvedValue('dark'),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue(['theme']),
      clear: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue({ theme: 'dark' }),
      exportData: vi.fn().mockResolvedValue({ theme: 'dark' }),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockResolvedValue('preferences'),
      validateData: vi.fn().mockResolvedValue(true),
    }
    setWindow({ preference })

    const service = new ElectronPreferenceServiceProxy()

    await expect(service.get('theme', 'light')).resolves.toBe('dark')
    await service.set('payload', { ok: true, dropped: () => 'skip' } as any)
    await service.delete('payload')
    await expect(service.keys()).resolves.toEqual(['theme'])
    await service.clear()
    await expect(service.getAll()).resolves.toEqual({ theme: 'dark' })
    await expect(service.exportData()).resolves.toEqual({ theme: 'dark' })
    await service.importData({ theme: 'light', dropped: () => 'skip' })
    await expect(service.getDataType()).resolves.toBe('preferences')
    await expect(service.validateData({ theme: 'light', dropped: () => 'skip' })).resolves.toBe(true)

    expect(preference.set).toHaveBeenCalledWith('payload', { ok: true })
    expect(preference.importData).toHaveBeenCalledWith({ theme: 'light' })
    expect(preference.validateData).toHaveBeenCalledWith({ theme: 'light' })

    setWindow({})
    await expect(new ElectronPreferenceServiceProxy().keys()).rejects.toThrow('Electron API not available')
  })

  it('forwards context repository operations and validates import data', async () => {
    const bundle = { type: 'context-bundle', version: 1, items: [] }
    const context = {
      list: vi.fn().mockResolvedValue([{ id: 'ctx1', title: 'Context' }]),
      getCurrentId: vi.fn().mockResolvedValue('ctx1'),
      setCurrentId: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ id: 'ctx1', title: 'Context' }),
      create: vi.fn().mockResolvedValue('ctx2'),
      duplicate: vi.fn().mockResolvedValue('ctx3'),
      rename: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      exportAll: vi.fn().mockResolvedValue(bundle),
      importAll: vi.fn().mockResolvedValue({ imported: 1 }),
      getDataType: vi.fn().mockResolvedValue('context-bundle'),
      validateData: vi.fn().mockResolvedValue(true),
    }
    setWindow({ context })

    const repo = new ElectronContextRepoProxy()

    await expect(repo.list()).resolves.toEqual([{ id: 'ctx1', title: 'Context' }])
    await expect(repo.getCurrentId()).resolves.toBe('ctx1')
    await repo.setCurrentId('ctx2')
    await expect(repo.get('ctx1')).resolves.toEqual({ id: 'ctx1', title: 'Context' })
    await expect(repo.create({ title: 'New', mode: 'system' as any })).resolves.toBe('ctx2')
    await expect(repo.duplicate('ctx1', { mode: 'user' as any })).resolves.toBe('ctx3')
    await repo.rename('ctx1', 'Renamed')
    await repo.save({ id: 'ctx1', title: 'Saved', dropped: () => 'skip' } as any)
    await repo.update('ctx1', { title: 'Updated', dropped: () => 'skip' } as any)
    await repo.remove('ctx1')
    await expect(repo.exportAll()).resolves.toEqual(bundle)
    await expect(repo.importAll({ ...bundle, dropped: () => 'skip' } as any, 'merge')).resolves.toEqual({ imported: 1 })
    await expect(repo.exportData()).resolves.toEqual(bundle)
    await repo.importData(bundle)
    await expect(repo.getDataType()).resolves.toBe('context-bundle')
    await expect(repo.validateData({ ...bundle, dropped: () => 'skip' } as any)).resolves.toBe(true)

    expect(context.save).toHaveBeenCalledWith({ id: 'ctx1', title: 'Saved' })
    expect(context.update).toHaveBeenCalledWith('ctx1', { title: 'Updated' })
    expect(context.importAll).toHaveBeenCalledWith({ type: 'context-bundle', version: 1, items: [] }, 'merge')
    expect(context.validateData).toHaveBeenCalledWith({ type: 'context-bundle', version: 1, items: [] })

    context.validateData.mockResolvedValueOnce(false)
    await expect(repo.importData({ type: 'bad' })).rejects.toThrow('Invalid context bundle data')
  })
})
