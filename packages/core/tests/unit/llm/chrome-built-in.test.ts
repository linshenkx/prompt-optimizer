import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS,
  checkChromeBuiltInAvailability,
  createChromeBuiltInSession,
  prepareChromeBuiltInModel
} from '../../../src/services/llm/chrome-built-in'
import { ChromeBuiltInAdapter } from '../../../src/services/llm/adapters/chrome-built-in-adapter'

describe('Chrome built-in AI integration', () => {
  it('forwards cancellation to an idle native stream and destroys its session', async () => {
    const controller = new AbortController()
    let enter!: () => void
    const entered = new Promise<void>(resolve => { enter = resolve })
    const destroy = vi.fn()
    const promptStreaming = vi.fn(async function* (_prompt: unknown, options: { signal: AbortSignal }) {
      enter()
      await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }))
      yield 'late'
    })
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ promptStreaming, destroy }),
    })
    const adapter = new ChromeBuiltInAdapter()
    const onComplete = vi.fn(), onToken = vi.fn(), onError = vi.fn()
    const running = adapter.sendMessageStream([{ role: 'user', content: 'Generate' }], {
      id: 'chrome-built-in', name: 'Chrome Built-in AI', enabled: true,
      providerMeta: adapter.getProvider(), modelMeta: adapter.getModels()[0], connectionConfig: {}, paramOverrides: {},
    }, { signal: controller.signal, onComplete, onToken, onError })
    const settled = running.catch(() => {})
    await entered
    controller.abort(new Error('Stopped'))
    await settled
    expect(promptStreaming).toHaveBeenCalledWith('Generate', { signal: controller.signal })
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(onToken).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('safely reports api-missing when LanguageModel is absent', async () => {
    vi.stubGlobal('LanguageModel', undefined)

    await expect(checkChromeBuiltInAvailability()).resolves.toEqual({
      availability: 'api-missing'
    })
  })

  it('checks availability without triggering model creation or download', async () => {
    const create = vi.fn()
    const availability = vi.fn().mockResolvedValue('downloadable')
    vi.stubGlobal('LanguageModel', { availability, create })

    await expect(checkChromeBuiltInAvailability()).resolves.toEqual({
      availability: 'downloadable'
    })
    expect(availability).toHaveBeenCalledTimes(1)
    expect(availability).toHaveBeenCalledWith(CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS)
    expect(create).not.toHaveBeenCalled()
  })

  it('creates sessions with explicit default text language expectations', async () => {
    const session = { destroy: vi.fn() }
    const create = vi.fn().mockResolvedValue(session)
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn(),
      create
    })

    await expect(createChromeBuiltInSession()).resolves.toBe(session)

    expect(create).toHaveBeenCalledWith(CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS)
  })

  it('prepares the model only through the explicit prepare path', async () => {
    const availability = vi
      .fn()
      .mockResolvedValueOnce('downloadable')
      .mockResolvedValueOnce('available')
    const create = vi.fn().mockImplementation(async (options) => {
      options.monitor?.({
        addEventListener: (_type: string, listener: (event: { loaded: number }) => void) => {
          listener({ loaded: 0.5 })
        }
      })
      return { destroy: vi.fn() }
    })
    const onProgress = vi.fn()
    vi.stubGlobal('LanguageModel', { availability, create })

    await expect(prepareChromeBuiltInModel(onProgress)).resolves.toEqual({
      availability: 'available'
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      ...CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS,
      monitor: expect.any(Function)
    })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 0.5 })
  })

  it('adapter refuses to trigger download during normal generation', async () => {
    const create = vi.fn()
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create
    })
    const adapter = new ChromeBuiltInAdapter()

    await expect(
      adapter.sendMessage(
        [{ role: 'user', content: 'hello' }],
        {
          id: 'chrome-built-in',
          name: 'Chrome Built-in AI',
          enabled: true,
          providerMeta: adapter.getProvider(),
          modelMeta: adapter.getModels()[0],
          connectionConfig: {},
          paramOverrides: {}
        }
      )
    ).rejects.toThrow(/not downloaded/i)

    expect(create).not.toHaveBeenCalled()
  })

  it('maps system and prior chat context to Chrome initialPrompts', async () => {
    const destroy = vi.fn()
    const prompt = vi.fn().mockResolvedValue('ok')
    const create = vi.fn().mockResolvedValue({ prompt, destroy })
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create
    })
    const adapter = new ChromeBuiltInAdapter()

    await expect(
      adapter.sendMessage(
        [
          { role: 'system', content: 'Follow the system prompt.' },
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
          { role: 'user', content: 'Second question' }
        ],
        {
          id: 'chrome-built-in',
          name: 'Chrome Built-in AI',
          enabled: true,
          providerMeta: adapter.getProvider(),
          modelMeta: adapter.getModels()[0],
          connectionConfig: {},
          paramOverrides: {}
        }
      )
    ).resolves.toEqual({
      content: 'ok',
      metadata: {
        model: 'gemini-nano'
      }
    })

    expect(create).toHaveBeenCalledWith({
      ...CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS,
      initialPrompts: [
        { role: 'system', content: 'Follow the system prompt.' },
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' }
      ]
    })
    expect(prompt).toHaveBeenCalledWith('Second question')
    expect(destroy).toHaveBeenCalled()
  })
})
