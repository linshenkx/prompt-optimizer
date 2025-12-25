import OpenAI from 'openai'
import { AbstractTextProviderAdapter } from './abstract-adapter'
import type {
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  LLMResponse,
  StreamHandlers,
  ToolDefinition,
  ParameterDefinition
} from '../types'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

/**
 * OpenAI 静态模型定义
 */
const OPENAI_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Fast, capable, and efficient small model with significant improvements in instruction-following and coding',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1047576
    }
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'Latest GPT-5.1 flagship model with enhanced capabilities',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1047576
    }
  }
]

/**
 * OpenAI SDK适配器实现
 * 同时支持OpenAI官方API和OpenAI兼容API（DeepSeek, Zhipu等）
 *
 * 职责：
 * - 封装OpenAI SDK调用逻辑
 * - 处理baseURL规范化（移除'/chat/completions'后缀）
 * - 支持浏览器环境（dangerouslyAllowBrowser）
 * - 支持动态模型获取（models.list() API）
 * - 保留SDK原始错误堆栈
 */
export class OpenAIAdapter extends AbstractTextProviderAdapter {
  // ===== Provider元数据 =====

  /**
   * 获取Provider元数据
   */
  public getProvider(): TextProvider {
    return {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT models and OpenAI-compatible APIs',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.openai.com/v1',
      supportsDynamicModels: true,
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

  /**
   * 获取静态模型列表（OpenAI官方模型）
   */
  public getModels(): TextModel[] {
    return OPENAI_STATIC_MODELS.map((definition) => {
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

  /**
   * 动态获取模型列表（调用OpenAI models.list() API）
   * @param config 连接配置
   * @returns 动态获取的模型列表
   */
  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    // 验证baseURL以/v1结尾
    const baseURL = config.connectionConfig.baseURL || this.getProvider().defaultBaseURL

    const openai = this.createOpenAIInstance(config, false)

    try {
      const response = await openai.models.list()
      console.log('[OpenAIAdapter] API returned models:', response)

      // 检查返回格式
      if (response && response.data && Array.isArray(response.data)) {
        const models = response.data
          .map((model) => {
            // 使用buildDefaultModel为每个模型ID创建TextModel对象
            return this.buildDefaultModel(model.id)
          })
          .sort((a, b) => a.id.localeCompare(b.id))

        if (models.length === 0) {
          throw new Error('EMPTY_MODEL_LIST: API returned empty model list')
        }

        return models
      }

      throw new Error('INVALID_RESPONSE: Unexpected API response format')
    } catch (error: any) {
      console.error('[OpenAIAdapter] Failed to fetch models:', error)

      // 连接错误处理（包括跨域检测）
      if (error.message && (error.message.includes('Failed to fetch') ||
          error.message.includes('Connection error'))) {
        const isCrossOriginError = this.detectCrossOriginError(error, baseURL)

        if (isCrossOriginError) {
          throw new Error(`CROSS_ORIGIN_CONNECTION_FAILED: ${error.message}`)
        } else {
          throw new Error(`CONNECTION_FAILED: ${error.message}`)
        }
      }

      // API返回的错误信息
      if (error.response?.data) {
        throw new Error(`API_ERROR: ${JSON.stringify(error.response.data)}`)
      }

      // 其他错误,保持原始信息
      throw new Error(`UNKNOWN_ERROR: ${error.message || 'Unknown error'}`)
    }
  }

  // ===== 参数定义（用于buildDefaultModel） =====

  /**
   * 获取参数定义
   * 基于 OpenAI 官方文档: https://platform.openai.com/docs/api-reference/chat/create
   */
  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        description: 'Sampling temperature (0-2). Higher values make output more random.',
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
        description: 'Nucleus sampling parameter (0-1). Alternative to temperature.',
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
        name: 'max_completion_tokens',
        labelKey: 'params.max_completion_tokens.label',
        descriptionKey: 'params.max_completion_tokens.description',
        description: 'Maximum tokens in completion (recommended over max_tokens)',
        type: 'integer',
        minValue: 1,
        maxValue: 1000000,
        min: 1,
        max: 1000000,
        step: 1,
        unitKey: 'params.tokens.unit'
      },
      {
        name: 'max_tokens',
        labelKey: 'params.max_tokens.label',
        descriptionKey: 'params.max_tokens.description',
        description: 'Deprecated: Use max_completion_tokens instead',
        type: 'integer',
        minValue: 1,
        maxValue: 1000000,
        min: 1,
        max: 1000000,
        step: 1,
        unitKey: 'params.tokens.unit'
      },
      {
        name: 'presence_penalty',
        labelKey: 'params.presence_penalty.label',
        descriptionKey: 'params.presence_penalty.description',
        description: 'Presence penalty (-2.0 to 2.0). Penalizes tokens based on presence.',
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
        description: 'Frequency penalty (-2.0 to 2.0). Penalizes tokens based on frequency.',
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
        description: 'Number of most likely tokens to return (0-20)',
        type: 'integer',
        minValue: 0,
        maxValue: 20,
        min: 0,
        max: 20,
        step: 1
      },
      {
        name: 'seed',
        labelKey: 'params.seed.label',
        descriptionKey: 'params.seed.description',
        description: 'Seed for deterministic sampling (integer)',
        type: 'integer',
        minValue: 0,
        maxValue: 2147483647,
        min: 0,
        max: 2147483647,
        step: 1
      },
      {
        name: 'n',
        labelKey: 'params.n.label',
        descriptionKey: 'params.n.description',
        description: 'Number of completions to generate (default: 1)',
        type: 'integer',
        defaultValue: 1,
        default: 1,
        minValue: 1,
        maxValue: 10,
        min: 1,
        max: 10,
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

  /**
   * 获取默认参数值
   * 返回空对象,让服务器使用官方默认值,避免客户端错误默认值影响效果
   */
  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {}
  }

  // ===== 错误检测辅助方法 =====

  /**
   * 检测是否为跨域错误
   * 从 service.ts.backup 迁移的逻辑 (L1048-1094)
   *
   * 功能说明:
   * - 区分跨域错误(CORS)和普通网络错误
   * - 只在浏览器环境中进行检测
   * - 通过URL origin对比和错误特征识别
   *
   * @param error 捕获的错误对象
   * @param baseURL API的baseURL
   * @returns true表示是跨域错误,false表示其他错误
   */
  private detectCrossOriginError(error: any, baseURL: string): boolean {
    // 非浏览器环境不存在跨域问题
    if (typeof window === 'undefined') {
      return false
    }

    try {
      const apiUrl = new URL(baseURL)
      const currentUrl = new URL(window.location.href)

      const errorString = error.toString()

      // 只有在不同origin且没有明显的DNS/连接错误时才认为是跨域
      const isDifferentOrigin = apiUrl.origin !== currentUrl.origin
      const hasNetworkError =
        errorString.includes('ERR_NAME_NOT_RESOLVED') ||
        errorString.includes('ERR_CONNECTION_REFUSED') ||
        errorString.includes('ERR_NETWORK_CHANGED') ||
        errorString.includes('ERR_INTERNET_DISCONNECTED') ||
        errorString.includes('ERR_EMPTY_RESPONSE')

      return isDifferentOrigin && !hasNetworkError
    } catch (urlError) {
      // URL解析失败,当作普通连接错误处理
      console.warn('[OpenAIAdapter] Failed to parse URL for CORS detection:', urlError)
      return false
    }
  }

  // ===== SDK实例创建（从service.ts迁移） =====

  /**
   * 创建OpenAI SDK实例
   * 从service.ts的getOpenAIInstance方法迁移
   *
   * @param config 模型配置
   * @param isStream 是否为流式请求
   * @returns OpenAI SDK实例
   */
  private createOpenAIInstance(config: TextModelConfig, isStream: boolean = false): OpenAI {
    const apiKey = config.connectionConfig.apiKey || ''

    // 处理baseURL，如果以'/chat/completions'结尾则去掉
    let processedBaseURL = config.connectionConfig.baseURL || this.getProvider().defaultBaseURL
    if (processedBaseURL?.endsWith('/chat/completions')) {
      processedBaseURL = processedBaseURL.slice(0, -'/chat/completions'.length)
    }

    // 创建OpenAI实例配置
    const defaultTimeout = isStream ? 90000 : 60000
    const timeout =
      config.paramOverrides?.timeout !== undefined
        ? (config.paramOverrides.timeout as number)
        : defaultTimeout

    const sdkConfig: any = {
      apiKey: apiKey,
      baseURL: processedBaseURL,
      timeout: timeout,
      maxRetries: isStream ? 2 : 3
    }

    // 浏览器环境检测
    if (typeof window !== 'undefined') {
      sdkConfig.dangerouslyAllowBrowser = true
      console.log('[OpenAIAdapter] Browser environment detected. Setting dangerouslyAllowBrowser=true.')
    }

    const instance = new OpenAI(sdkConfig)

    return instance
  }

  // ===== 核心方法实现 =====

  /**
   * 发送消息（结构化格式）
   * 从service.ts的sendOpenAIMessageStructured迁移 (L126-186)
   *
   * @param messages 消息数组
   * @param config 模型配置
   * @returns LLM响应
   * @throws SDK原始错误（保留完整堆栈）
   */
  protected async doSendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
    const openai = this.createOpenAIInstance(config, false)

    // 格式化消息
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))

    // 从paramOverrides提取参数，排除特殊字段
    const {
      timeout, // 已在createOpenAIInstance中处理
      model: _paramModel, // 避免覆盖主model
      messages: _paramMessages, // 避免覆盖主messages
      ...restParams
    } = (config.paramOverrides || {}) as any

    const completionConfig: any = {
      model: config.modelMeta.id,
      messages: formattedMessages,
      ...restParams // 展开其他参数
    }

    try {
      const response: any = await openai.chat.completions.create(completionConfig)

      // 处理原始 SSE 字符串响应（某些 API 返回未解析的 SSE 格式）
      if (typeof response === 'string') {
        return this.parseSSEResponse(response, config.modelMeta.id)
      }

      // 检测是否为流式响应（某些 API 强制返回流式响应）
      if (this.isStreamResponse(response)) {
        return await this.consumeStreamResponse(response as AsyncIterable<any>, config.modelMeta.id)
      }

      // 处理响应中的 reasoning_content 和普通 content
      if (!response.choices || response.choices.length === 0) {
        throw new Error('API returned invalid response: choices is empty or missing')
      }

      const choice = response.choices[0]
      if (!choice?.message) {
        throw new Error('No valid response received')
      }

      let content = choice.message.content || ''
      let reasoning = ''

      // 处理推理内容（如果存在）
      // SiliconFlow 等提供商在 choice.message 中并列提供 reasoning_content 字段
      if ((choice.message as any).reasoning_content) {
        reasoning = (choice.message as any).reasoning_content
      } else {
        // 检测并分离content中的think标签
        const processed = this.processThinkTags(content)
        content = processed.content
        reasoning = processed.reasoning || ''
      }

      const result: LLMResponse = {
        content: content,
        reasoning: reasoning || undefined,
        metadata: {
          model: config.modelMeta.id,
          finishReason: choice.finish_reason || undefined
        }
      }

      return result
    } catch (error) {
      console.error('[OpenAIAdapter] API call failed:', error)
      throw error // 保留原始错误堆栈，不包装
    }
  }

  /**
   * 解析原始 SSE 字符串响应
   * 某些 OpenAI 兼容 API 会返回未解析的 SSE 格式字符串
   */
  private parseSSEResponse(sseString: string, modelId: string): LLMResponse {
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let finishReason: string | undefined

    // 按行分割 SSE 数据
    const lines = sseString.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // 跳过空行
      if (!trimmed) {
        continue
      }

      // 跳过 [DONE] 标记（兼容 data: [DONE] 和 data:[DONE]）
      if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
        continue
      }

      // 解析 data: 前缀的行（兼容有无空格：data: 或 data:）
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trimStart() // 移除 'data:' 前缀和可能的前导空格
        if (!jsonStr) {
          continue
        }
        try {
          const chunk = JSON.parse(jsonStr)

          // 处理推理内容
          const reasoningContent = chunk.choices?.[0]?.delta?.reasoning_content || ''
          if (reasoningContent) {
            accumulatedReasoning += reasoningContent
          }

          // 处理主要内容
          const content = chunk.choices?.[0]?.delta?.content || ''
          if (content) {
            accumulatedContent += content
          }

          // 记录完成原因
          if (chunk.choices?.[0]?.finish_reason && chunk.choices[0].finish_reason !== '') {
            finishReason = chunk.choices[0].finish_reason
          }
        } catch (e) {
          // 忽略无法解析的 chunk
        }
      }
    }

    // 兜底：如果 SSE 解析未得到任何内容，尝试直接解析为 JSON
    if (!accumulatedContent && !accumulatedReasoning) {
      try {
        const fallbackJson = JSON.parse(sseString)
        // 尝试提取标准 OpenAI 响应格式
        const fallbackContent = fallbackJson.choices?.[0]?.message?.content || ''
        const fallbackReasoning = fallbackJson.choices?.[0]?.message?.reasoning_content || ''
        if (fallbackContent || fallbackReasoning) {
          const processed = this.processThinkTags(fallbackContent)
          return {
            content: processed.content,
            reasoning: fallbackReasoning || processed.reasoning || undefined,
            metadata: {
              model: modelId,
              finishReason: fallbackJson.choices?.[0]?.finish_reason
            }
          }
        }
      } catch {
        // JSON 解析失败，继续抛出错误
      }
      // SSE 和 JSON 解析都失败，抛出明确错误
      throw new Error(
        `SSE response parsing failed: unable to extract any content from response. First 200 chars: ${sseString.slice(0, 200)}`
      )
    }

    // 处理 think 标签
    const processed = this.processThinkTags(accumulatedContent)

    return {
      content: processed.content,
      reasoning: accumulatedReasoning || processed.reasoning || undefined,
      metadata: {
        model: modelId,
        finishReason
      }
    }
  }

  /**
   * 检测响应是否为流式响应
   * 某些 OpenAI 兼容 API会强制返回流式响应
   */
  private isStreamResponse(response: any): boolean {
    // 首先检查是否为标准的非流式响应格式
    // 如果响应包含 choices 数组且第一个 choice 有 message 属性，则是非流式响应
    if (response && response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
      const firstChoice = response.choices[0]
      // 非流式响应有 message 属性，流式响应有 delta 属性
      if (firstChoice && firstChoice.message !== undefined) {
        return false
      }
    }

    // 检测是否为异步迭代器（流式响应的特征）
    if (response && typeof response[Symbol.asyncIterator] === 'function') {
      return true
    }

    return false
  }

  /**
   * 消费流式响应并聚合为完整响应
   * 用于处理强制返回流式响应的 API
   */
  private async consumeStreamResponse(stream: AsyncIterable<any>, modelId: string): Promise<LLMResponse> {
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let finishReason: string | undefined

    for await (const chunk of stream) {
      // 处理推理内容
      const reasoningContent = chunk.choices?.[0]?.delta?.reasoning_content || ''
      if (reasoningContent) {
        accumulatedReasoning += reasoningContent
      }

      // 处理主要内容
      const content = chunk.choices?.[0]?.delta?.content || ''
      if (content) {
        accumulatedContent += content
      }

      // 记录完成原因
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason
      }
    }

    // 处理 think 标签
    const processed = this.processThinkTags(accumulatedContent)

    return {
      content: processed.content,
      reasoning: accumulatedReasoning || processed.reasoning || undefined,
      metadata: {
        model: modelId,
        finishReason
      }
    }
  }

  /**
   * 发送流式消息
   * 从service.ts的streamOpenAIMessage迁移 (L504-585)
   *
   * @param messages 消息数组
   * @param config 模型配置
   * @param callbacks 流式响应回调
   * @throws SDK原始错误（保留完整堆栈）
   */
  protected async doSendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      // 获取流式OpenAI实例
      const openai = this.createOpenAIInstance(config, true)

      const formattedMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))

      console.log('[OpenAIAdapter] Creating stream request...')
      const {
        timeout, // 已在createOpenAIInstance中处理
        model: _paramModel, // 避免覆盖主model
        messages: _paramMessages, // 避免覆盖主messages
        stream: _paramStream, // 避免覆盖stream标志
        ...restParams
      } = (config.paramOverrides || {}) as any

      const completionConfig: any = {
        model: config.modelMeta.id,
        messages: formattedMessages,
        stream: true, // 流式标志
        ...restParams // 用户自定义参数
      }

      // 直接使用流式响应
      const stream = await openai.chat.completions.create(completionConfig)

      console.log('[OpenAIAdapter] Stream response received')

      // 累积内容
      let accumulatedReasoning = ''
      let accumulatedContent = ''

      // think标签状态跟踪
      const thinkState = { isInThinkMode: false, buffer: '' }

      for await (const chunk of stream as any) {
        // 处理推理内容（SiliconFlow 等提供商在 delta 中提供 reasoning_content）
        const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || ''
        if (reasoningContent) {
          accumulatedReasoning += reasoningContent

          // 如果有推理回调，发送推理内容
          if (callbacks.onReasoningToken) {
            callbacks.onReasoningToken(reasoningContent)
          }
        }

        // 处理主要内容
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          accumulatedContent += content

          // 使用流式think标签处理
          this.processStreamContentWithThinkTags(content, callbacks, thinkState)
        }
      }

      console.log('[OpenAIAdapter] Stream completed')

      // 构建完整响应
      const response: LLMResponse = {
        content: accumulatedContent,
        reasoning: accumulatedReasoning || undefined,
        metadata: {
          model: config.modelMeta.id
        }
      }

      callbacks.onComplete(response)
    } catch (error) {
      console.error('[OpenAIAdapter] Stream error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error // 保留原始错误堆栈
    }
  }

  /**
   * 发送支持工具调用的流式消息
   * 从service.ts的streamOpenAIMessageWithTools迁移 (L591-702)
   *
   * @param messages 消息数组
   * @param config 模型配置
   * @param tools 工具定义数组
   * @param callbacks 流式响应回调
   * @throws SDK原始错误（保留完整堆栈）
   */
  public async sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      // 获取流式OpenAI实例
      const openai = this.createOpenAIInstance(config, true)

      const formattedMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))

      console.log('[OpenAIAdapter] Creating stream request with tools...')
      const {
        timeout,
        model: _paramModel,
        messages: _paramMessages,
        stream: _paramStream,
        tools: _paramTools,
        ...restParams
      } = (config.paramOverrides || {}) as any

      const completionConfig: any = {
        model: config.modelMeta.id,
        messages: formattedMessages,
        tools: tools,
        tool_choice: 'auto',
        stream: true,
        ...restParams
      }

      const stream = await openai.chat.completions.create(completionConfig)
      console.log('[OpenAIAdapter] Stream response with tools received')

      let accumulatedReasoning = ''
      let accumulatedContent = ''
      const toolCalls: any[] = []
      const thinkState = { isInThinkMode: false, buffer: '' }

      for await (const chunk of stream as any) {
        // 处理推理内容
        const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || ''
        if (reasoningContent) {
          accumulatedReasoning += reasoningContent
          if (callbacks.onReasoningToken) {
            callbacks.onReasoningToken(reasoningContent)
          }
        }

        // 处理工具调用
        const toolCallDeltas = chunk.choices[0]?.delta?.tool_calls
        if (toolCallDeltas) {
          for (const toolCallDelta of toolCallDeltas) {
            if (toolCallDelta.index !== undefined) {
              while (toolCalls.length <= toolCallDelta.index) {
                toolCalls.push({
                  id: '',
                  type: 'function' as const,
                  function: { name: '', arguments: '' }
                })
              }

              const currentToolCall = toolCalls[toolCallDelta.index]

              if (toolCallDelta.id) currentToolCall.id = toolCallDelta.id
              if (toolCallDelta.type) currentToolCall.type = toolCallDelta.type
              if (toolCallDelta.function) {
                if (toolCallDelta.function.name) {
                  currentToolCall.function.name += toolCallDelta.function.name
                }
                if (toolCallDelta.function.arguments) {
                  currentToolCall.function.arguments += toolCallDelta.function.arguments
                }

                // 当工具调用完整时，通知回调
                if (
                  currentToolCall.id &&
                  currentToolCall.function.name &&
                  toolCallDelta.function.arguments &&
                  callbacks.onToolCall
                ) {
                  try {
                    JSON.parse(currentToolCall.function.arguments)
                    callbacks.onToolCall(currentToolCall)
                  } catch {
                    // JSON 还不完整
                  }
                }
              }
            }
          }
        }

        // 处理主要内容
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          accumulatedContent += content
          this.processStreamContentWithThinkTags(content, callbacks, thinkState)
        }
      }

      console.log('[OpenAIAdapter] Stream with tools completed, tool calls:', toolCalls.length)

      const response: LLMResponse = {
        content: accumulatedContent,
        reasoning: accumulatedReasoning || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        metadata: { model: config.modelMeta.id }
      }

      callbacks.onComplete(response)
    } catch (error) {
      console.error('[OpenAIAdapter] Stream with tools error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error // 保留原始错误堆栈
    }
  }
}

