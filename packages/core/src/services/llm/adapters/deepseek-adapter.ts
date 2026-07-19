import type {
  TextModel,
  TextModelConfig,
  TextProvider,
  Message,
  ImageUnderstandingRequest,
  LLMResponse,
  StreamHandlers,
  StreamRequestOptions,
  ToolDefinition,
  ParameterDefinition
} from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const DEEPSEEK_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    description: 'DeepSeek V4 Flash model via OpenAI-compatible API',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    },
    defaultParameterValues: {
      thinking_type: 'disabled'
    }
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: 'DeepSeek V4 Pro model via OpenAI-compatible API',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    },
    defaultParameterValues: {
      thinking_type: 'disabled'
    }
  }
]

type DeepseekThinkingType = 'enabled' | 'disabled'

export class DeepseekAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'DeepSeek OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.deepseek.com',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://platform.deepseek.com/api_keys',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string'
        }
      }
    }
  }

  public getModels(): TextModel[] {
    return DEEPSEEK_STATIC_MODELS.map((definition) => {
      const baseModel = this.buildDefaultModel(definition.id)

      return {
        ...baseModel,
        name: definition.name,
        description: definition.description,
        capabilities: {
          ...baseModel.capabilities,
          ...(definition.capabilities ?? {})
        },
        defaultParameterValues: definition.defaultParameterValues
          ? {
              ...(baseModel.defaultParameterValues ?? {}),
              ...definition.defaultParameterValues
            }
          : baseModel.defaultParameterValues
      }
    })
  }

  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return [
      {
        name: 'thinking_type',
        labelKey: 'params.deepseek.thinking_type.label',
        descriptionKey: 'params.deepseek.thinking_type.description',
        description: 'Controls DeepSeek thinking mode. Sent as thinking.type in the API request.',
        type: 'string',
        defaultValue: 'disabled',
        default: 'disabled',
        allowedValues: ['disabled', 'enabled'],
        allowedValueLabelKeys: [
          'params.deepseek.thinking_type.disabled',
          'params.deepseek.thinking_type.enabled'
        ]
      },
      {
        name: 'reasoning_effort',
        labelKey: 'params.reasoning_effort.label',
        descriptionKey: 'params.reasoning_effort.description',
        description: 'Reasoning effort for thinking mode. DeepSeek supports high and max.',
        type: 'string',
        allowedValues: ['high', 'max']
      },
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        description: 'Sampling temperature (0-2). Ineffective when thinking mode is enabled.',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 2,
        min: 0,
        max: 2,
        step: 0.1
      },
      {
        name: 'top_p',
        labelKey: 'params.top_p.label',
        descriptionKey: 'params.top_p.description',
        description: 'Nucleus sampling parameter (0-1). Ineffective when thinking mode is enabled.',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 1,
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'max_tokens',
        labelKey: 'params.max_tokens.label',
        descriptionKey: 'params.max_tokens.description',
        description: 'Maximum tokens in the generated completion.',
        type: 'integer',
        minValue: 1,
        maxValue: 393216,
        min: 1,
        max: 393216,
        step: 1,
        unitKey: 'params.tokens.unit'
      },
      {
        name: 'presence_penalty',
        labelKey: 'params.presence_penalty.label',
        descriptionKey: 'params.presence_penalty.description',
        description: 'Presence penalty (-2.0 to 2.0). Ineffective when thinking mode is enabled.',
        type: 'number',
        defaultValue: 0,
        default: 0,
        minValue: -2,
        maxValue: 2,
        min: -2,
        max: 2,
        step: 0.1
      },
      {
        name: 'frequency_penalty',
        labelKey: 'params.frequency_penalty.label',
        descriptionKey: 'params.frequency_penalty.description',
        description: 'Frequency penalty (-2.0 to 2.0). Ineffective when thinking mode is enabled.',
        type: 'number',
        defaultValue: 0,
        default: 0,
        minValue: -2,
        maxValue: 2,
        min: -2,
        max: 2,
        step: 0.1
      },
      {
        name: 'logprobs',
        labelKey: 'params.logprobs.label',
        descriptionKey: 'params.logprobs.description',
        description: 'Return log probabilities of output tokens',
        type: 'boolean',
        defaultValue: false,
        default: false
      },
      {
        name: 'top_logprobs',
        labelKey: 'params.top_logprobs.label',
        descriptionKey: 'params.top_logprobs.description',
        description: 'Number of most likely tokens to return (0-20). Requires logprobs=true.',
        type: 'integer',
        minValue: 0,
        maxValue: 20,
        min: 0,
        max: 20,
        step: 1
      },
      {
        name: 'timeout',
        labelKey: 'params.timeout.label',
        descriptionKey: 'params.timeout.description_openai',
        description: 'Client timeout in milliseconds (OpenAI SDK setting)',
        type: 'integer',
        defaultValue: 60000,
        default: 60000,
        minValue: 1000,
        maxValue: 600000,
        min: 1000,
        max: 600000,
        step: 1000,
        unit: 'ms'
      }
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      thinking_type: 'disabled'
    }
  }

  protected async doSendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
    return super.doSendMessage(messages, this.normalizeDeepseekConfig(config))
  }

  protected async doSendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers,
    options?: StreamRequestOptions
  ): Promise<void> {
    options?.signal?.throwIfAborted()
    await super.doSendMessageStream(messages, this.normalizeDeepseekConfig(config, options), callbacks)
  }

  public async sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers,
    options?: StreamRequestOptions
  ): Promise<void> {
    await super.sendMessageStreamWithTools(
      messages,
      this.normalizeDeepseekConfig(config),
      tools,
      callbacks
    )
  }

  protected async doSendImageUnderstanding(
    request: ImageUnderstandingRequest,
    config: TextModelConfig
  ): Promise<LLMResponse> {
    return super.doSendImageUnderstanding(
      this.normalizeDeepseekImageRequest(request),
      this.normalizeDeepseekConfig(config)
    )
  }

  protected async doSendImageUnderstandingStream(
    request: ImageUnderstandingRequest,
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void> {
    await super.doSendImageUnderstandingStream(
      this.normalizeDeepseekImageRequest(request),
      this.normalizeDeepseekConfig(config),
      callbacks
    )
  }

  private normalizeDeepseekConfig(config: TextModelConfig): TextModelConfig {
    const paramOverrides = this.normalizeDeepseekParamOverrides(config.paramOverrides, true)

    return {
      ...config,
      paramOverrides
    }
  }

  private normalizeDeepseekImageRequest(
    request: ImageUnderstandingRequest
  ): ImageUnderstandingRequest {
    if (!request.paramOverrides) {
      return request
    }

    return {
      ...request,
      paramOverrides: this.normalizeDeepseekParamOverrides(request.paramOverrides, false)
    }
  }

  private normalizeDeepseekParamOverrides(
    paramOverrides?: Record<string, unknown>,
    defaultDisabled = true
  ): Record<string, unknown> {
    const {
      thinking_type: thinkingTypeOverride,
      thinking: explicitThinking,
      ...restParams
    } = paramOverrides || {}

    const thinkingType = this.normalizeThinkingType(thinkingTypeOverride)
      ?? this.extractExplicitThinkingType(explicitThinking)
      ?? (defaultDisabled ? 'disabled' : undefined)

    if (!thinkingType) {
      return restParams
    }

    return {
      ...restParams,
      thinking: {
        type: thinkingType
      }
    }
  }

  private normalizeThinkingType(value: unknown): DeepseekThinkingType | undefined {
    return value === 'enabled' || value === 'disabled' ? value : undefined
  }

  private extractExplicitThinkingType(value: unknown): DeepseekThinkingType | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }

    return this.normalizeThinkingType((value as { type?: unknown }).type)
  }
}
