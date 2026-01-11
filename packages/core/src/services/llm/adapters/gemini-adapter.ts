import { GoogleGenAI } from '@google/genai'
import { AbstractTextProviderAdapter } from './abstract-adapter'
import type {
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  LLMResponse,
  StreamHandlers,
  ParameterDefinition,
  ToolDefinition,
  ToolCall
} from '../types'

// 定义新版 SDK 需要的类型（SDK 可能通过主导出提供）
type Content = any
type GenerateContentConfig = any
type FunctionDeclaration = any
type Tool = any
type FunctionCall = any

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

/**
 * Gemini 静态模型定义
 */
const GEMINI_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Latest Gemini 2.5 Flash model, fast and efficient',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1000000
    }
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Gemini 2.5 Pro model with enhanced reasoning capabilities',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    }
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    description: 'Preview version of Gemini 3 Pro with cutting-edge capabilities',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    }
  }
]

/**
 * Google Gemini适配器实现
 * 使用新版 @google/genai SDK (统一的 Google Gen AI SDK)
 *
 * 职责：
 * - 封装 @google/genai SDK 调用逻辑
 * - 处理系统消息（systemInstruction）
 * - 格式化历史消息（Content格式）
 * - 支持动态模型列表获取（models.list API）
 * - 支持工具调用（Function Calling）
 * - 支持思考功能（Thinking with thinkingConfig）
 * - 处理baseURL规范化（setDefaultBaseUrls）
 * - 保留SDK原始错误堆栈
 */
export class GeminiAdapter extends AbstractTextProviderAdapter {
  // ===== Provider元数据 =====

  /**
   * 获取Provider元数据
   */
  public getProvider(): TextProvider {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Generative AI models',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
      supportsDynamicModels: true, // 新版 SDK 支持动态模型获取
      apiKeyUrl: 'https://aistudio.google.com/apikey',
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
   * 获取静态模型列表（Gemini 系列）
   */
  public getModels(): TextModel[] {
    return GEMINI_STATIC_MODELS.map((definition) => {
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
   * 动态获取模型列表（使用新版 SDK 的 models.list API）
   */
  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    try {
      const apiKey = config.connectionConfig.apiKey || ''

      const customBaseURL = config.connectionConfig.baseURL
      const genAI = new GoogleGenAI(
        customBaseURL
          ? {
              apiKey,
              httpOptions: {
                baseUrl: customBaseURL
              }
            }
          : { apiKey }
      )

      const modelsPager = await genAI.models.list({
        config: {
          pageSize: 100 // 获取更多模型
        }
      })

      const dynamicModels: TextModel[] = []
      const providerId = 'gemini'

      for await (const model of modelsPager) {
        // 只包含支持 generateContent 的模型
        // 注意：新版 SDK 的 Model 类型可能不包含 supportedGenerationMethods，我们暂时包含所有模型
        dynamicModels.push({
          id: model.name?.replace('models/', '') || model.name || '', // 移除 'models/' 前缀
          name: model.displayName || model.name || '',
          description: model.description || '',
          providerId,
          capabilities: {
            supportsTools: true,
            supportsReasoning: false,
            maxContextLength: model.inputTokenLimit || 1000000
          },
          parameterDefinitions: this.getParameterDefinitions(model.name || ''),
          defaultParameterValues: this.getDefaultParameterValues(model.name || '')
        })
      }

      // 如果动态获取失败，返回静态列表
      return dynamicModels.length > 0 ? dynamicModels : this.getModels()
    } catch (error) {
      console.error('[GeminiAdapter] Failed to fetch models dynamically, falling back to static list:', error)
      return this.getModels()
    }
  }

  // ===== 参数定义（用于buildDefaultModel） =====

  /**
   * 获取参数定义
   */
  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        description: 'Sampling temperature (0-2)',
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
        name: 'topP',
        labelKey: 'params.top_p.label',
        descriptionKey: 'params.top_p.description',
        description: 'Nucleus sampling parameter',
        type: 'number',
        defaultValue: 0.95,
        default: 0.95,
        minValue: 0,
        maxValue: 1,
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'topK',
        labelKey: 'params.top_k.label',
        descriptionKey: 'params.top_k.description',
        description: 'Top-k sampling parameter',
        type: 'integer',
        defaultValue: 1,
        default: 1,
        minValue: 1,
        min: 1,
        step: 1
      },
      {
        name: 'maxOutputTokens',
        labelKey: 'params.maxOutputTokens.label',
        descriptionKey: 'params.maxOutputTokens.description',
        description: 'Maximum tokens to generate',
        type: 'integer',
        defaultValue: 8192,
        default: 8192,
        minValue: 1,
        min: 1,
        unitKey: 'params.tokens.unit',
        step: 1
      },
      {
        name: 'candidateCount',
        labelKey: 'params.candidateCount.label',
        descriptionKey: 'params.candidateCount.description',
        description: 'Number of response candidates',
        type: 'integer',
        defaultValue: 1,
        default: 1,
        minValue: 1,
        maxValue: 8,
        min: 1,
        max: 8,
        step: 1
      },
      {
        name: 'stopSequences',
        labelKey: 'params.stopSequences.label',
        descriptionKey: 'params.stopSequences.description',
        description: 'Stop sequences for generation',
        type: 'string',
        defaultValue: [],
        tags: ['string-array']
      },
      {
        name: 'thinkingBudget',
        labelKey: 'params.thinkingBudget.label',
        descriptionKey: 'params.thinkingBudget.description',
        description: 'Thinking budget in tokens (Gemini 2.5+). Set to 0 to disable thinking.',
        type: 'number',
        defaultValue: 0,
        default: 0,
        minValue: 0,
        maxValue: 8192,
        min: 0,
        max: 8192,
        unitKey: 'params.tokens.unit',
        step: 1
      },
      {
        name: 'includeThoughts',
        labelKey: 'params.includeThoughts.label',
        descriptionKey: 'params.includeThoughts.description',
        description: 'Include thinking process in response (Gemini 2.5+)',
        type: 'boolean',
        defaultValue: false
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

  // ===== SDK实例创建和配置构建 =====

  /**
   * 创建 GoogleGenAI 实例
   *
   * @param config 模型配置
   * @returns GoogleGenAI实例
   */
  private createClient(config: TextModelConfig): GoogleGenAI {
    const apiKey = config.connectionConfig.apiKey || ''

    const customBaseURL = config.connectionConfig.baseURL

    return new GoogleGenAI(
      customBaseURL
        ? {
            apiKey,
            httpOptions: {
              baseUrl: customBaseURL
            }
          }
        : { apiKey }
    )
  }

  /**
   * 构建 GenerateContentConfig 配置
   * 从旧版的 buildGeminiGenerationConfig 迁移并适配新版 API
   *
   * @param params 参数对象
   * @param systemInstruction 系统指令（可选）
   * @returns GenerateContentConfig
   */
  private buildGenerationConfig(
    params: Record<string, any> = {},
    systemInstruction?: string
  ): GenerateContentConfig {
    const {
      temperature,
      maxOutputTokens,
      topP,
      topK,
      candidateCount,
      stopSequences,
      thinkingBudget,      // 思考预算（token数）
      includeThoughts,      // 是否包含思考过程
      ...otherParams
    } = params

    const config: GenerateContentConfig = {}

    // 添加系统指令
    if (systemInstruction) {
      config.systemInstruction = systemInstruction
    }

    // 添加已知参数
    if (temperature !== undefined) {
      config.temperature = temperature
    }
    if (maxOutputTokens !== undefined) {
      config.maxOutputTokens = maxOutputTokens
    }
    if (topP !== undefined) {
      config.topP = topP
    }
    if (topK !== undefined) {
      config.topK = topK
    }
    if (candidateCount !== undefined) {
      config.candidateCount = candidateCount
    }
    if (stopSequences !== undefined && Array.isArray(stopSequences)) {
      config.stopSequences = stopSequences
    }

    // 添加思考配置（Gemini 2.5+ 支持）
    if (thinkingBudget !== undefined || includeThoughts !== undefined) {
      ;(config as any).thinkingConfig = {}

      if (thinkingBudget !== undefined) {
        ;(config as any).thinkingConfig.thinkingBudget = thinkingBudget
      }

      if (includeThoughts !== undefined) {
        ;(config as any).thinkingConfig.includeThoughts = includeThoughts
      }
    }

    // 添加其他参数（排除明显不属于 generationConfig 的参数）
    for (const [key, value] of Object.entries(otherParams)) {
      if (!['timeout', 'model', 'messages', 'stream'].includes(key)) {
        ;(config as any)[key] = value
      }
    }

    return config
  }

  /**
   * 转换工具定义为 Gemini 格式
   * 将标准的 ToolDefinition 转换为 Gemini SDK 所需的 Tool 格式
   *
   * @param tools 工具定义数组
   * @returns Gemini 格式的工具数组
   */
  private convertToolsToGemini(tools: ToolDefinition[]): Tool[] {
    if (!tools || tools.length === 0) {
      return []
    }

    const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }))

    return [{ functionDeclarations }]
  }

  /**
   * 转换 Gemini 的 FunctionCall 为标准的 ToolCall 格式
   *
   * @param functionCalls Gemini 返回的函数调用数组
   * @returns 标准格式的工具调用数组
   */
  private convertGeminiFunctionCallsToToolCalls(functionCalls: FunctionCall[]): ToolCall[] {
    if (!functionCalls || functionCalls.length === 0) {
      return []
    }

    return functionCalls.map((fc) => ({
      id: fc.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function' as const,
      function: {
        name: fc.name || '',
        arguments: JSON.stringify(fc.args || {})
      }
    }))
  }

  /**
   * 格式化消息为新版 SDK 的 Content 格式
   * 新版 SDK 使用标准的 Content[] 格式，不再需要区分 history 和 last message
   *
   * @param messages 消息数组
   * @returns Content[] 格式的消息
   */
  private formatMessages(messages: Message[]): Content[] {
    const formattedContents: Content[] = []

    for (const msg of messages) {
      if (msg.role === 'user') {
        formattedContents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        })
      } else if (msg.role === 'assistant') {
        formattedContents.push({
          role: 'model', // Gemini 使用 'model' 而非 'assistant'
          parts: [{ text: msg.content }]
        })
      }
      // 跳过 system 消息，它们会在 systemInstruction 中处理
    }

    return formattedContents
  }

  // ===== 核心方法实现 =====

  /**
   * 发送消息（结构化格式）
   * 使用新版 SDK 的 models.generateContent API
   *
   * @param messages 消息数组
   * @param config 模型配置
   * @returns LLM响应
   * @throws SDK原始错误（保留完整堆栈）
   */
  protected async doSendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
    // 提取系统消息
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    const systemInstruction =
      systemMessages.length > 0 ? systemMessages.map((msg) => msg.content).join('\n') : ''

    // 过滤出用户和助手消息
    const conversationMessages = messages.filter((msg) => msg.role !== 'system')

    // 如果没有对话消息，返回空响应
    if (conversationMessages.length === 0) {
      return {
        content: '',
        metadata: {
          model: config.modelMeta.id
        }
      }
    }

    try {
      const client = this.createClient(config)

      // 构建配置（包含系统指令）
      const generationConfig = this.buildGenerationConfig(
        config.paramOverrides || {},
        systemInstruction
      )

      // 格式化消息
      const contents = this.formatMessages(conversationMessages)

      // 调用新版 API
      const response = await client.models.generateContent({
        model: config.modelMeta.id,
        contents,
        config: generationConfig
      })

      // 提取文本内容和思考内容
      let textContent = ''
      let reasoning: string | undefined

      // 优先使用新版 SDK 推荐的 response.text 属性
      if ((response as any).text) {
        textContent = (response as any).text
      } else if (response.candidates?.[0]?.content?.parts) {
        // 回退到 parts 提取（用于旧版响应格式或特殊情况）
        const contentParts: string[] = []
        const reasoningParts: string[] = []

        for (const part of response.candidates[0].content.parts) {
          // 提取文本内容
          if ((part as any).text) {
            const text = (part as any).text
            // 如果这部分是思考过程，加到 reasoning，否则加到 content
            if ((part as any).thought) {
              reasoningParts.push(text)
            } else {
              contentParts.push(text)
            }
          }
        }

        textContent = contentParts.join('')
        if (reasoningParts.length > 0) {
          reasoning = reasoningParts.join('')
        }
      } else if (response.candidates?.[0]?.content) {
        // 最后尝试直接访问 content 字段
        const content = response.candidates[0].content
        if (typeof content === 'string') {
          textContent = content
        } else if ((content as any).text) {
          textContent = (content as any).text
        }
      }

      return {
        content: textContent,
        reasoning,
        metadata: {
          model: config.modelMeta.id,
          finishReason: response.candidates?.[0]?.finishReason
        }
      }
    } catch (error) {
      console.error('[GeminiAdapter] API call failed:', error)
      throw error // 保留原始错误堆栈
    }
  }

  /**
   * 发送流式消息
   * 使用新版 SDK 的 models.generateContentStream API
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
    // 提取系统消息
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    const systemInstruction =
      systemMessages.length > 0 ? systemMessages.map((msg) => msg.content).join('\n') : ''

    // 过滤出用户和助手消息
    const conversationMessages = messages.filter((msg) => msg.role !== 'system')

    // 如果没有对话消息，发送空响应
    if (conversationMessages.length === 0) {
      const response: LLMResponse = {
        content: '',
        metadata: {
          model: config.modelMeta.id
        }
      }

      callbacks.onComplete(response)
      return
    }

    try {
      const client = this.createClient(config)

      // 构建配置（包含系统指令）
      const generationConfig = this.buildGenerationConfig(
        config.paramOverrides || {},
        systemInstruction
      )

      // 格式化消息
      const contents = this.formatMessages(conversationMessages)

      // 调用新版流式 API
      const responseStream = await client.models.generateContentStream({
        model: config.modelMeta.id,
        contents,
        config: generationConfig
      })

      let accumulatedContent = ''
      let accumulatedReasoning = ''

      // 遍历流式响应
      for await (const chunk of responseStream) {
        let emittedContentToken = false

        // 从 parts 中提取文本内容
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            const partText = (part as any).text
            if (!partText) {
              continue
            }

            if ((part as any).thought) {
              // 这是思考内容
              accumulatedReasoning += partText
              if (callbacks.onReasoningToken) {
                callbacks.onReasoningToken(partText)
              }
            } else {
              // 这是普通内容
              emittedContentToken = true
              accumulatedContent += partText
              callbacks.onToken(partText)
            }
          }
        }

        // 如果 SDK 只提供 chunk.text，则回退到该字段
        const chunkText = (chunk as any).text
        if (chunkText && !emittedContentToken) {
          accumulatedContent += chunkText
          callbacks.onToken(chunkText)
        }
      }

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
      console.error('[GeminiAdapter] Stream error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error // 保留原始错误堆栈
    }
  }

  /**
   * 发送带工具调用的流式消息
   * 使用新版 SDK 的工具调用功能
   *
   * @param messages 消息数组
   * @param config 模型配置
   * @param tools 工具定义数组
   * @param callbacks 流式响应回调
   * @throws SDK原始错误（保留完整堆栈）
   */
  protected async doSendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    // 提取系统消息
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    const systemInstruction =
      systemMessages.length > 0 ? systemMessages.map((msg) => msg.content).join('\n') : ''

    // 过滤出用户和助手消息
    const conversationMessages = messages.filter((msg) => msg.role !== 'system')

    if (conversationMessages.length === 0) {
      const response: LLMResponse = {
        content: '',
        metadata: { model: config.modelMeta.id }
      }
      callbacks.onComplete(response)
      return
    }

    try {
      const client = this.createClient(config)

      // 构建配置（包含系统指令和工具）
      const generationConfig = this.buildGenerationConfig(
        config.paramOverrides || {},
        systemInstruction
      )

      // 添加工具配置
      const geminiTools = this.convertToolsToGemini(tools)
      if (geminiTools.length > 0) {
        ;(generationConfig as any).tools = geminiTools
      }

      // 格式化消息
      const contents = this.formatMessages(conversationMessages)

      // 调用新版流式 API
      const responseStream = await client.models.generateContentStream({
        model: config.modelMeta.id,
        contents,
        config: generationConfig
      })

      let accumulatedContent = ''
      let accumulatedReasoning = ''
      const toolCalls: ToolCall[] = []

      // 遍历流式响应
      for await (const chunk of responseStream) {
        const text = chunk.text
        if (text) {
          accumulatedContent += text
          callbacks.onToken(text)
        }

        // 检查是否有函数调用
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          const convertedCalls = this.convertGeminiFunctionCallsToToolCalls(chunk.functionCalls)
          toolCalls.push(...convertedCalls)

          // 通知每个工具调用
          if (callbacks.onToolCall) {
            convertedCalls.forEach((toolCall) => callbacks.onToolCall!(toolCall))
          }
        }

        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if ((part as any).thought) {
              const rawThought = (part as any).text ?? (part as any).thought
              if (rawThought !== undefined) {
                const thoughtStr = typeof rawThought === 'string'
                  ? rawThought
                  : JSON.stringify(rawThought)

                accumulatedReasoning += thoughtStr

                if (callbacks.onReasoningToken) {
                  callbacks.onReasoningToken(thoughtStr)
                }
              }
            }
          }
        }
      }

      // 构建完整响应
      const response: LLMResponse = {
        content: accumulatedContent,
        reasoning: accumulatedReasoning || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        metadata: {
          model: config.modelMeta.id
        }
      }

      callbacks.onComplete(response)
    } catch (error) {
      console.error('[GeminiAdapter] Stream with tools error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
}
