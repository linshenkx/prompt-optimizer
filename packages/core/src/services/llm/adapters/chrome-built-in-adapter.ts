import type {
  LLMResponse,
  Message,
  ParameterDefinition,
  StreamHandlers,
  StreamRequestOptions,
  TextModel,
  TextModelConfig,
  TextProvider
} from '../types'
import { RequestConfigError } from '../errors'
import { AbstractTextProviderAdapter } from './abstract-adapter'
import {
  CHROME_BUILT_IN_MODEL_ID,
  CHROME_BUILT_IN_PROVIDER_ID,
  checkChromeBuiltInAvailability,
  createChromeBuiltInSession
} from '../chrome-built-in'
import type { ChromeLanguageModelPrompt, ChromeLanguageModelPromptInput } from '../chrome-built-in'

export class ChromeBuiltInAdapter extends AbstractTextProviderAdapter {
  public getProvider(): TextProvider {
    return {
      id: CHROME_BUILT_IN_PROVIDER_ID,
      name: 'Chrome Built-in AI',
      description: 'Local Gemini Nano model managed by Chrome. No API key required.',
      corsRestricted: false,
      requiresApiKey: false,
      defaultBaseURL: '',
      supportsDynamicModels: false,
      connectionSchema: {
        required: [],
        optional: [],
        fieldTypes: {}
      }
    }
  }

  public getModels(): TextModel[] {
    return [
      {
        id: CHROME_BUILT_IN_MODEL_ID,
        name: 'Gemini Nano (managed by Chrome)',
        description: 'Browser-managed local model exposed through Chrome Prompt API',
        providerId: CHROME_BUILT_IN_PROVIDER_ID,
        capabilities: {
          supportsTools: false,
          supportsReasoning: false
        },
        parameterDefinitions: [],
        defaultParameterValues: {}
      }
    ]
  }

  protected async doSendMessage(
    messages: Message[],
    _config: TextModelConfig
  ): Promise<LLMResponse> {
    const { initialPrompts, prompt } = this.buildPrompt(messages)
    const session = await this.createReadySession(initialPrompts)

    try {
      const content = await session.prompt(prompt)
      return {
        content,
        metadata: {
          model: CHROME_BUILT_IN_MODEL_ID
        }
      }
    } finally {
      session.destroy?.()
    }
  }

  protected async doSendMessageStream(
    messages: Message[],
    _config: TextModelConfig,
    callbacks: StreamHandlers,
    options?: StreamRequestOptions
  ): Promise<void> {
    const { initialPrompts, prompt } = this.buildPrompt(messages)
    const session = await this.createReadySession(initialPrompts)
    let content = ''

    try {
      // 将 AbortSignal 交给 Prompt API；结束/取消后都销毁 session 释放本地资源
      const streamOptions = options?.signal ? { signal: options.signal } : undefined
      const stream = await session.promptStreaming(prompt, streamOptions)
      for await (const token of stream) {
        content += token
        callbacks.onToken(token)
      }
      callbacks.onComplete({
        content,
        metadata: {
          model: CHROME_BUILT_IN_MODEL_ID
        }
      })
    } finally {
      session.destroy?.()
    }
  }

  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return []
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {}
  }

  private async createReadySession(initialPrompts?: ChromeLanguageModelPrompt[]) {
    const status = await checkChromeBuiltInAvailability()
    if (status.availability === 'downloadable') {
      throw new RequestConfigError('Chrome built-in AI model is not downloaded. Open the model manager and click download to prepare it.')
    }
    if (status.availability === 'downloading') {
      throw new RequestConfigError('Chrome built-in AI model is still downloading. Please wait for the download to finish.')
    }
    if (status.availability !== 'available') {
      throw new RequestConfigError(status.error || 'Chrome built-in AI is not available in this browser.')
    }

    return await createChromeBuiltInSession(initialPrompts?.length ? { initialPrompts } : {})
  }

  private buildPrompt(messages: Message[]): {
    initialPrompts?: ChromeLanguageModelPrompt[]
    prompt: ChromeLanguageModelPromptInput
  } {
    const normalizedMessages = messages
      .map((message) => ({
        role: message.role,
        content: message.content.trim()
      }))
      .filter((message) => message.content)
    const promptIndex = this.findPromptMessageIndex(normalizedMessages)
    const initialPrompts = normalizedMessages
      .filter((_message, index) => index !== promptIndex)
      .map((message) => this.toInitialPrompt(message))
    const promptMessage = normalizedMessages[promptIndex]

    return {
      initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
      prompt: promptMessage ? this.toPromptInput(promptMessage) : messages.map((message) => message.content).join('\n\n')
    }
  }

  private findPromptMessageIndex(messages: Array<Pick<Message, 'role' | 'content'>>): number {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role !== 'system') {
        return index
      }
    }
    return messages.length - 1
  }

  private toInitialPrompt(message: Pick<Message, 'role' | 'content'>): ChromeLanguageModelPrompt {
    if (message.role === 'tool') {
      return { role: 'user', content: `tool: ${message.content}` }
    }
    return {
      role: message.role === 'system' || message.role === 'assistant' ? message.role : 'user',
      content: message.content
    }
  }

  private toPromptInput(message: Pick<Message, 'role' | 'content'>): ChromeLanguageModelPromptInput {
    if (message.role === 'user') {
      return message.content
    }
    if (message.role === 'system') {
      return message.content
    }
    return `${message.role}: ${message.content}`
  }
}
