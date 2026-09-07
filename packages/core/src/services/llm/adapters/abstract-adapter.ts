import type {
  ITextProviderAdapter,
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  ImageUnderstandingRequest,
  LLMResponse,
  StreamHandlers,
  ToolDefinition,
  ParameterDefinition
} from '../types'
import { RequestConfigError } from '../errors'

/**
 * 抽象文本模型Provider适配器基类
 * 使用模板方法模式提供统一的验证和工具方法
 *
 * 职责：
 * - 提供公共验证逻辑（validateMessages）
 * - 提供工具方法（processThinkTags, buildDefaultModel）
 * - 定义抽象方法供子类实现（doSendMessage, doSendMessageStream）
 */
export abstract class AbstractTextProviderAdapter implements ITextProviderAdapter {
  // ===== 子类必须实现的抽象方法 =====

  /**
   * 获取Provider元数据
   */
  public abstract getProvider(): TextProvider

  /**
   * 获取静态模型列表
   */
  public abstract getModels(): TextModel[]

  /**
   * 发送消息（结构化格式）- 具体实现
   * @param messages 消息数组
   * @param config 模型配置
   * @returns LLM响应
   * @throws SDK原始错误（保留完整堆栈）
   */
  protected abstract doSendMessage(
    messages: Message[],
    config: TextModelConfig
  ): Promise<LLMResponse>

  /**
   * 发送流式消息 - 具体实现
   * @param messages 消息数组
   * @param config 模型配置
   * @param callbacks 流式响应回调
   * @throws SDK原始错误（保留完整堆栈）
   */
  protected abstract doSendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void>

  /**
   * 获取参数定义（用于buildDefaultModel）
   * @param modelId 模型ID
   * @returns 参数定义数组
   */
  protected abstract getParameterDefinitions(modelId: string): readonly ParameterDefinition[]

  /**
   * 获取默认参数值（用于buildDefaultModel）
   * @param modelId 模型ID
   * @returns 默认参数值
   */
  protected abstract getDefaultParameterValues(modelId: string): Record<string, unknown>

  /**
   * Send image-understanding request - concrete implementation.
   * Adapters can override this to support multimodal text understanding.
   */
  protected async doSendImageUnderstanding(
    _request: ImageUnderstandingRequest,
    _config: TextModelConfig
  ): Promise<LLMResponse> {
    throw new RequestConfigError(
      `${this.getProvider().name} does not support image understanding requests`
    )
  }

  /**
   * Stream image-understanding request - concrete implementation.
   * Adapters can override this to support multimodal streaming text understanding.
   */
  protected async doSendImageUnderstandingStream(
    _request: ImageUnderstandingRequest,
    _config: TextModelConfig,
    _callbacks: StreamHandlers
  ): Promise<void> {
    throw new RequestConfigError(
      `${this.getProvider().name} does not support streaming image understanding requests`
    )
  }

  // ===== 模板方法（公共接口） =====

  /**
   * 发送消息（模板方法）
   * 统一验证后调用doSendMessage
   */
  public async sendMessage(
    messages: Message[],
    config: TextModelConfig
  ): Promise<LLMResponse> {
    // 1. 验证消息数组
    this.validateMessages(messages)

    // 2. 调用具体实现
    return await this.doSendMessage(messages, config)
  }

  /**
   * 发送流式消息（模板方法）
   * 统一验证后调用doSendMessageStream
   */
  public async sendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void> {
    // 1. 验证消息数组
    this.validateMessages(messages)

    // 2. 调用具体实现
    await this.doSendMessageStream(messages, config, callbacks)
  }

  /**
   * 发送支持工具调用的流式消息（模板方法）
   * 默认实现调用doSendMessageStream，子类可覆盖
   */
  public async sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    _tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    // 验证消息数组
    this.validateMessages(messages)

    // 默认实现：工具参数传递给具体实现处理
    // 子类应该覆盖此方法以处理工具调用
    await this.doSendMessageStream(messages, config, callbacks)
  }

  public async sendImageUnderstanding(
    request: ImageUnderstandingRequest,
    config: TextModelConfig
  ): Promise<LLMResponse> {
    this.validateImageUnderstandingRequest(request)
    return await this.doSendImageUnderstanding(request, config)
  }

  public async sendImageUnderstandingStream(
    request: ImageUnderstandingRequest,
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void> {
    this.validateImageUnderstandingRequest(request)
    await this.doSendImageUnderstandingStream(request, config, callbacks)
  }

  // ===== 公共验证方法 =====

  /**
   * 验证消息数组格式
   * @param messages 消息数组
   * @throws {RequestConfigError} 当消息数组无效时
   */
  protected validateMessages(messages: Message[]): void {
    if (!Array.isArray(messages)) {
      throw new RequestConfigError('Messages must be an array')
    }

    if (messages.length === 0) {
      throw new RequestConfigError('Messages array cannot be empty')
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new RequestConfigError('Each message must have role and content')
      }

      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        throw new RequestConfigError(`Invalid message role: ${msg.role}`)
      }

      if (typeof msg.content !== 'string') {
        throw new RequestConfigError('Message content must be a string')
      }
    }
  }

  protected validateImageUnderstandingRequest(request: ImageUnderstandingRequest): void {
    if (!request || typeof request !== 'object') {
      throw new RequestConfigError('Image understanding request cannot be empty')
    }

    if (typeof request.userPrompt !== 'string' || !request.userPrompt.trim()) {
      throw new RequestConfigError('Image understanding user prompt cannot be empty')
    }

    if (!Array.isArray(request.images) || request.images.length === 0) {
      throw new RequestConfigError('Image understanding request requires at least one image')
    }

    request.images.forEach((image, index) => {
      if (!image || typeof image !== 'object') {
        throw new RequestConfigError(`Image at index ${index} is invalid`)
      }

      if (typeof image.b64 !== 'string' || !image.b64.trim()) {
        throw new RequestConfigError(`Image at index ${index} is missing base64 data`)
      }
    })
  }

  // ===== 工具方法 =====

  /**
   * 处理<think>标签，分离推理内容和主要内容
   * 从现有service.ts中的processStreamContentWithThinkTags逻辑迁移
   *
   * @param content 原始内容
   * @returns 处理后的结果 {content: 主要内容, reasoning?: 推理内容}
   */
  protected processThinkTags(content: string): { content: string; reasoning?: string } {
    // 如果内容不包含think标签，直接返回
    if (!content.includes('<think>')) {
      return { content }
    }

    // 提取<think>...</think>内容作为推理内容
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g
    const reasoningParts: string[] = []
    let match

    while ((match = thinkRegex.exec(content)) !== null) {
      reasoningParts.push(match[1])
    }

    // 移除所有<think>标签及其内容，得到主要内容
    const mainContent = content.replace(thinkRegex, '').trim()

    return {
      content: mainContent,
      reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n') : undefined
    }
  }

  /**
   * 流式处理<think>标签（用于流式场景）
   * 从现有service.ts中的processStreamContentWithThinkTags逻辑迁移
   *
   * @param content 当前chunk内容
   * @param callbacks 流式回调
   * @param thinkState 状态对象 {isInThinkMode: boolean, buffer: string}
   */
  protected processStreamContentWithThinkTags(
    content: string,
    callbacks: StreamHandlers,
    thinkState: { isInThinkMode: boolean; buffer: string }
  ): void {
    // 将新内容添加到缓冲区
    thinkState.buffer += content
    let remaining = thinkState.buffer
    let processed = ''

    while (remaining.length > 0) {
      if (!thinkState.isInThinkMode) {
        // 不在think模式中，查找<think>标签
        const thinkStartIndex = remaining.indexOf('<think>')

        if (thinkStartIndex !== -1) {
          // 找到了开始标签
          // 发送开始标签前的内容到主要流
          if (thinkStartIndex > 0) {
            const beforeThink = remaining.slice(0, thinkStartIndex)
            callbacks.onToken(beforeThink)
            processed += beforeThink + '<think>'
          } else {
            processed += '<think>'
          }

          // 进入think模式
          thinkState.isInThinkMode = true
          remaining = remaining.slice(thinkStartIndex + 7) // 7 = '<think>'.length
        } else {
          // 没有找到开始标签
          // 检查buffer末尾是否可能是不完整的标签开始
          if (
            remaining.endsWith('<') ||
            remaining.endsWith('<t') ||
            remaining.endsWith('<th') ||
            remaining.endsWith('<thi') ||
            remaining.endsWith('<thin') ||
            remaining.endsWith('<think')
          ) {
            // 可能是不完整的标签，保留在buffer中等待更多内容
            thinkState.buffer = remaining
            return
          } else {
            // 确定没有标签，发送所有内容到主要流
            callbacks.onToken(remaining)
            processed += remaining
            remaining = ''
          }
        }
      } else {
        // 在think模式中，查找</think>标签
        const thinkEndIndex = remaining.indexOf('</think>')

        if (thinkEndIndex !== -1) {
          // 找到了结束标签
          // 发送结束标签前的内容到推理流
          if (thinkEndIndex > 0) {
            const reasoningContent = remaining.slice(0, thinkEndIndex)
            callbacks.onReasoningToken?.(reasoningContent)
            processed += reasoningContent + '</think>'
          } else {
            processed += '</think>'
          }

          // 退出think模式
          thinkState.isInThinkMode = false
          remaining = remaining.slice(thinkEndIndex + 8) // 8 = '</think>'.length
        } else {
          // 没有找到结束标签
          // 检查buffer末尾是否可能是不完整的标签结束
          if (
            remaining.endsWith('<') ||
            remaining.endsWith('</') ||
            remaining.endsWith('</t') ||
            remaining.endsWith('</th') ||
            remaining.endsWith('</thi') ||
            remaining.endsWith('</thin') ||
            remaining.endsWith('</think')
          ) {
            // 可能是不完整的标签，保留在buffer中等待更多内容
            thinkState.buffer = remaining
            return
          } else {
            // 确定没有结束标签，发送所有内容到推理流
            callbacks.onReasoningToken?.(remaining)
            processed += remaining
            remaining = ''
          }
        }
      }
    }

    // 更新缓冲区为已处理的内容
    thinkState.buffer = ''
  }

  /**
   * 根据modelId获取模型信息
   * @param modelId 模型ID
   * @returns 模型对象或undefined
   */
  protected getModelById(modelId: string): TextModel | undefined {
    const models = this.getModels()
    return models.find((m) => m.id === modelId)
  }

  /**
   * 为未知模型ID构建默认元数据（兜底逻辑）
   * @param modelId 模型ID
   * @returns 包含默认capabilities的TextModel对象
   */
  public buildDefaultModel(modelId: string): TextModel {
    const provider = this.getProvider()

    return {
      id: modelId,
      name: modelId, // 默认使用ID作为名称
      description: `Custom model ${modelId} for ${provider.name}`,
      providerId: provider.id,
      capabilities: {
        supportsTools: true, // 默认支持工具
        supportsReasoning: true, // 默认支持推理
        maxContextLength: 128000 // 默认上下文长度
      },
      parameterDefinitions: this.getParameterDefinitions(modelId),
      defaultParameterValues: this.getDefaultParameterValues(modelId)
    }
  }
}
