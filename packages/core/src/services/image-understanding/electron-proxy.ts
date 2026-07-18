import { InitializationError } from '../llm/errors'
import type { LLMResponse, StreamHandlers } from '../llm/types'
import { safeSerializeForIPC } from '../../utils/ipc-serialization'
import type { IImageUnderstandingService, ImageUnderstandingExecutionRequest } from './types'

type ElectronImageUnderstandingApi = {
  understand: (request: ImageUnderstandingExecutionRequest) => Promise<LLMResponse>
}

/**
 * Renderer-side bridge for image-understanding requests.
 *
 * Desktop networking must stay in the main process so it shares the same
 * proxy dispatcher and avoids renderer CORS restrictions.
 */
export class ElectronImageUnderstandingServiceProxy implements IImageUnderstandingService {
  private readonly api: ElectronImageUnderstandingApi

  constructor() {
    const electronApi = typeof window !== 'undefined'
      ? (window as unknown as {
          electronAPI?: { imageUnderstanding?: ElectronImageUnderstandingApi }
        }).electronAPI
      : undefined

    if (!electronApi?.imageUnderstanding) {
      throw new InitializationError(
        'ElectronImageUnderstandingServiceProxy can only be used in Electron renderer process',
      )
    }

    this.api = electronApi.imageUnderstanding
  }

  async understand(request: ImageUnderstandingExecutionRequest): Promise<LLMResponse> {
    return await this.api.understand(safeSerializeForIPC(request))
  }

  async understandStream(
    request: ImageUnderstandingExecutionRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      const response = await this.understand(request)
      if (response.reasoning && callbacks.onReasoningToken) {
        callbacks.onReasoningToken(response.reasoning)
      }
      if (response.content) {
        callbacks.onToken(response.content)
      }
      callbacks.onComplete(response)
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      callbacks.onError(normalizedError)
      throw normalizedError
    }
  }
}
