import { describe, expect, it, vi } from 'vitest'
import { createPromptService } from '../../../src/services/prompt/factory'
import { PromptService } from '../../../src/services/prompt/service'
import {
  IterationError,
  OptimizationError,
  PromptError,
  ServiceDependencyError,
  TestError,
} from '../../../src/services/prompt/errors'

function createPromptServiceMocks() {
  const modelManager = {
    getModel: vi.fn().mockResolvedValue({
      id: 'model',
      enabled: true,
      providerMeta: { id: 'openai', name: 'OpenAI' },
      modelMeta: { id: 'gpt-test', name: 'GPT Test' },
    }),
  }
  const llmService = {
    sendMessage: vi.fn().mockResolvedValue('ok'),
    sendMessageStream: vi.fn(),
  }
  const templateManager = {
    getTemplate: vi.fn().mockResolvedValue({
      id: 'iterate',
      name: 'Iterate',
      content: [
        { role: 'system', content: 'Iterate system' },
        { role: 'user', content: '{{lastOptimizedPrompt}} -> {{iterateInput}}' },
      ],
      metadata: {
        version: '1.0',
        lastModified: 0,
        templateType: 'iterate',
      },
    }),
  }
  const historyManager = {
    getRecords: vi.fn().mockResolvedValue([{ id: 'record-1' }]),
    getIterationChain: vi.fn().mockResolvedValue([{ id: 'record-1' }, { id: 'record-2' }]),
  }
  const imageUnderstandingService = {
    understand: vi.fn(),
    understandStream: vi.fn(),
  }

  return {
    modelManager,
    llmService,
    templateManager,
    historyManager,
    imageUnderstandingService,
  }
}

describe('PromptService factory and base error paths', () => {
  it('creates PromptService through the factory with all dependencies wired', async () => {
    const mocks = createPromptServiceMocks()

    const service = createPromptService(
      mocks.modelManager as any,
      mocks.llmService as any,
      mocks.templateManager as any,
      mocks.historyManager as any,
      mocks.imageUnderstandingService as any,
    )

    expect(service).toBeInstanceOf(PromptService)
    await service.testPrompt('', 'hello', 'model')
    expect(mocks.llmService.sendMessage).toHaveBeenCalledWith(
      [{ role: 'user', content: 'hello' }],
      'model',
    )
  })

  it('preserves structured prompt error metadata for UI i18n', () => {
    const base = new PromptError('error.prompt.custom', 'custom details', { context: 'prompt' })
    const optimization = new OptimizationError('original prompt', 'bad response')
    const iteration = new IterationError('original', 'make it shorter', 'bad iteration')
    const test = new TestError('system', 'user', 'bad test')
    const dependency = new ServiceDependencyError('LLMService', 'missing')

    expect(base).toMatchObject({
      name: 'PromptError',
      code: 'error.prompt.custom',
      params: { context: 'prompt' },
      message: '[error.prompt.custom] custom details',
    })
    expect(optimization).toMatchObject({
      name: 'OptimizationError',
      code: 'error.prompt.optimization',
      originalPrompt: 'original prompt',
      params: { details: 'bad response' },
    })
    expect(iteration).toMatchObject({
      name: 'IterationError',
      code: 'error.prompt.iteration',
      originalPrompt: 'original',
      iterateInput: 'make it shorter',
    })
    expect(test).toMatchObject({
      name: 'TestError',
      code: 'error.prompt.test',
      prompt: 'system',
      testInput: 'user',
    })
    expect(dependency).toMatchObject({
      name: 'ServiceDependencyError',
      code: 'error.prompt.service_dependency',
      serviceName: 'LLMService',
    })
  })

  it('fails fast when required constructor dependencies are missing', () => {
    const mocks = createPromptServiceMocks()

    expect(
      () =>
        new PromptService(
          undefined as any,
          mocks.llmService as any,
          mocks.templateManager as any,
          mocks.historyManager as any,
        ),
    ).toThrow(ServiceDependencyError)

    expect(
      () =>
        new PromptService(
          mocks.modelManager as any,
          mocks.llmService as any,
          undefined as any,
          mocks.historyManager as any,
        ),
    ).toThrow('Template manager not initialized')
  })

  it('delegates history reads and iteration-chain reads to the history manager', async () => {
    const mocks = createPromptServiceMocks()
    const service = createPromptService(
      mocks.modelManager as any,
      mocks.llmService as any,
      mocks.templateManager as any,
      mocks.historyManager as any,
    )

    await expect(service.getHistory()).resolves.toEqual([{ id: 'record-1' }])
    await expect(service.getIterationChain('record-1')).resolves.toEqual([
      { id: 'record-1' },
      { id: 'record-2' },
    ])
    expect(mocks.historyManager.getIterationChain).toHaveBeenCalledWith('record-1')
  })

  it('wraps iteration template loading failures with original prompt and iterate input context', async () => {
    const mocks = createPromptServiceMocks()
    mocks.templateManager.getTemplate.mockRejectedValue(new Error('template backend down'))
    const service = createPromptService(
      mocks.modelManager as any,
      mocks.llmService as any,
      mocks.templateManager as any,
      mocks.historyManager as any,
    )

    await expect(
      service.iteratePrompt('original', 'last optimized', 'shorter', 'model'),
    ).rejects.toMatchObject({
      name: 'IterationError',
      originalPrompt: 'original',
      iterateInput: 'shorter',
    })
  })

  it('streams test prompts without adding an empty system message', async () => {
    const mocks = createPromptServiceMocks()
    mocks.llmService.sendMessageStream.mockImplementation(async (_messages: any, _model: string, callbacks: any) => {
      callbacks.onToken('partial')
      await callbacks.onComplete({ content: 'done' })
    })
    const service = createPromptService(
      mocks.modelManager as any,
      mocks.llmService as any,
      mocks.templateManager as any,
      mocks.historyManager as any,
    )
    const callbacks = {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    }

    await service.testPromptStream('', 'user only', 'model', callbacks)

    expect(mocks.llmService.sendMessageStream).toHaveBeenCalledWith(
      [{ role: 'user', content: 'user only' }],
      'model',
      expect.objectContaining({
        onToken: callbacks.onToken,
        onComplete: callbacks.onComplete,
        onError: callbacks.onError,
      }),
    )
    expect(callbacks.onToken).toHaveBeenCalledWith('partial')
    expect(callbacks.onComplete).toHaveBeenCalledWith({ content: 'done' })
  })
})
