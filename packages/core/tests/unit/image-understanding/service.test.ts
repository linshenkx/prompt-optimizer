import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ImageUnderstandingService,
  createImageUnderstandingService,
} from '../../../src/services/image-understanding/service'
import { RequestConfigError } from '../../../src/services/llm/errors'
import type { ITextAdapterRegistry } from '../../../src/services/llm/types'

describe('ImageUnderstandingService', () => {
  let registry: ITextAdapterRegistry
  let adapter: any
  let service: ImageUnderstandingService

  const request = {
    modelConfig: {
      id: 'vision-model',
      name: 'Vision Model',
      enabled: true,
      providerMeta: {
        id: 'openai',
        name: 'OpenAI',
        requiresApiKey: true,
        defaultBaseURL: 'https://example.com',
        supportsDynamicModels: false,
      },
      modelMeta: {
        id: 'gpt-vision',
        name: 'GPT Vision',
        providerId: 'openai',
        capabilities: {
          supportsTools: false,
        },
        parameterDefinitions: [],
      },
      connectionConfig: {
        apiKey: 'test',
      },
      paramOverrides: {},
    },
    systemPrompt: 'system',
    userPrompt: 'user',
    images: [
      {
        b64: 'ZmFrZQ==',
        mimeType: 'image/png',
      },
    ],
  }

  beforeEach(() => {
    adapter = {
      sendImageUnderstanding: vi.fn().mockResolvedValue({ content: 'ok' }),
      sendImageUnderstandingStream: vi.fn(),
    }

    registry = {
      getAdapter: vi.fn().mockReturnValue(adapter),
    } as unknown as ITextAdapterRegistry

    service = new ImageUnderstandingService({ registry })
  })

  it('creates a service through the factory with injected dependencies', async () => {
    const factoryService = createImageUnderstandingService({ registry })

    await factoryService.understand(request as any)

    expect(registry.getAdapter).toHaveBeenCalledWith('openai')
    expect(adapter.sendImageUnderstanding).toHaveBeenCalledWith(request, request.modelConfig)
  })

  it.each([
    ['empty request', undefined, 'Image understanding request cannot be empty'],
    ['missing model config', { ...request, modelConfig: undefined }, 'Model config cannot be empty'],
    [
      'missing provider metadata',
      {
        ...request,
        modelConfig: { ...request.modelConfig, providerMeta: undefined },
      },
      'Model provider metadata cannot be empty',
    ],
    [
      'missing provider id',
      {
        ...request,
        modelConfig: {
          ...request.modelConfig,
          providerMeta: { ...request.modelConfig.providerMeta, id: '' },
        },
      },
      'Model provider metadata cannot be empty',
    ],
    [
      'missing model metadata',
      {
        ...request,
        modelConfig: { ...request.modelConfig, modelMeta: undefined },
      },
      'Model metadata cannot be empty',
    ],
    [
      'missing model id',
      {
        ...request,
        modelConfig: {
          ...request.modelConfig,
          modelMeta: { ...request.modelConfig.modelMeta, id: '' },
        },
      },
      'Model metadata cannot be empty',
    ],
    [
      'disabled model',
      {
        ...request,
        modelConfig: { ...request.modelConfig, enabled: false },
      },
      'Model is not enabled',
    ],
  ])('rejects invalid image understanding requests: %s', async (_caseName, invalidRequest, expectedMessage) => {
    const generation = service.understand(invalidRequest as any)

    await expect(generation).rejects.toMatchObject({
      name: 'RequestConfigError',
      message: expect.stringContaining(expectedMessage),
    })
    await expect(generation).rejects.toBeInstanceOf(RequestConfigError)
    expect(registry.getAdapter).not.toHaveBeenCalled()
    expect(adapter.sendImageUnderstanding).not.toHaveBeenCalled()
  })

  it('rejects invalid streaming requests before adapter lookup', async () => {
    const callbacks = {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    }
    const generation = service.understandStream(
      {
        ...request,
        modelConfig: { ...request.modelConfig, enabled: false },
      } as any,
      callbacks,
    )

    await expect(generation).rejects.toBeInstanceOf(RequestConfigError)
    expect(registry.getAdapter).not.toHaveBeenCalled()
    expect(adapter.sendImageUnderstandingStream).not.toHaveBeenCalled()
  })

  it('converts non-standard inputs before delegating understand to the adapter', async () => {
    const imageInputConverter = vi.fn().mockResolvedValue({
      b64: 'PNG_BASE64',
      mimeType: 'image/png',
    })
    service = new ImageUnderstandingService({ registry, imageInputConverter })

    await service.understand({
      ...request,
      images: [
        {
          b64: 'WEBP_BASE64',
          mimeType: 'image/webp',
        },
      ],
    } as any)

    expect(imageInputConverter).toHaveBeenCalledWith({ b64: 'WEBP_BASE64', mimeType: 'image/webp' })
    expect(adapter.sendImageUnderstanding).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [{ b64: 'PNG_BASE64', mimeType: 'image/png' }],
      }),
      request.modelConfig,
    )
  })

  it('keeps original image understanding inputs when conversion fails', async () => {
    const imageInputConverter = vi.fn().mockRejectedValue(new Error('decode failed'))
    service = new ImageUnderstandingService({ registry, imageInputConverter })

    await service.understand({
      ...request,
      images: [
        {
          b64: 'WEBP_BASE64',
          mimeType: 'image/webp',
        },
      ],
    } as any)

    expect(adapter.sendImageUnderstanding).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [{ b64: 'WEBP_BASE64', mimeType: 'image/webp' }],
      }),
      request.modelConfig,
    )
  })

  it('delegates understandStream to the provider adapter', async () => {
    const callbacks = {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    }

    adapter.sendImageUnderstandingStream.mockImplementation(async (_req: any, _config: any, streamCallbacks: any) => {
      streamCallbacks.onToken('A')
      await streamCallbacks.onComplete({ content: 'A' })
    })

    await service.understandStream(request as any, callbacks)

    expect(adapter.sendImageUnderstandingStream).toHaveBeenCalledTimes(1)
    expect(adapter.sendImageUnderstandingStream).toHaveBeenCalledWith(
      request,
      request.modelConfig,
      callbacks,
    )
  })

  it('converts non-standard inputs before delegating understandStream to the adapter', async () => {
    const callbacks = {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    }
    const imageInputConverter = vi.fn().mockResolvedValue({
      b64: 'PNG_BASE64',
      mimeType: 'image/png',
    })
    service = new ImageUnderstandingService({ registry, imageInputConverter })

    await service.understandStream({
      ...request,
      images: [
        {
          b64: 'WEBP_BASE64',
          mimeType: 'image/webp',
        },
      ],
    } as any, callbacks)

    expect(adapter.sendImageUnderstandingStream).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [{ b64: 'PNG_BASE64', mimeType: 'image/png' }],
      }),
      request.modelConfig,
      callbacks,
    )
  })
})
