/**
 * 多格式数据转换器实现
 */

import type {
  DataConverter,
  StandardPromptData,
  OpenAIRequest,
  ConversionResult,
  StandardMessage,
  ConversationMessage,
  ToolDefinition
} from '../types'

export class PromptDataConverter implements DataConverter {
  /**
   * 从LangFuse trace数据转换为标准格式
   * 支持多种LangFuse数据结构：
   * 1. 手工复制的消息列表: [{"role":"","content":""}]
   * 2. LangFuse官方导出: [{"id":"","input":[消息列表]}]
   * 3. 工具调用消息分离处理
   */
  fromLangFuse(langfuseData: unknown): ConversionResult<StandardPromptData> {
    try {
      const extractedTools: ToolDefinition[] = []
      let metadata: Record<string, unknown> = {}
      let messages: unknown[] | undefined

      const coerceRole = (value: unknown): StandardMessage['role'] => {
        const allowed: StandardMessage['role'][] = ['system', 'user', 'assistant', 'tool']
        return typeof value === 'string' && allowed.includes(value as StandardMessage['role'])
          ? (value as StandardMessage['role'])
          : 'user'
      }

      const ensureRecord = (value: unknown): Record<string, unknown> | undefined => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return value as Record<string, unknown>
        }
        return undefined
      }

      if (Array.isArray(langfuseData)) {
        if (langfuseData.length === 0) {
          return {
            success: false,
            error: 'Invalid LangFuse data: empty array'
          }
        }

        const firstRecord = ensureRecord(langfuseData[0])
        if (firstRecord && typeof firstRecord.role === 'string') {
          messages = langfuseData
        } else if (firstRecord && firstRecord.input !== undefined) {
          const input = firstRecord.input
          const inputRecord = ensureRecord(input)
          if (Array.isArray(input)) {
            messages = input as unknown[]
          } else if (inputRecord && Array.isArray(inputRecord.messages)) {
            messages = inputRecord.messages as unknown[]
          } else {
            messages = []
          }

          metadata = {
            ...metadata,
            langfuse_trace_id: firstRecord.id,
            timestamp: firstRecord.timestamp,
            ...(ensureRecord(firstRecord.metadata) ?? {})
          }
        } else {
          return {
            success: false,
            error: 'Invalid LangFuse data: unrecognized array structure'
          }
        }
      } else {
        const record = ensureRecord(langfuseData)
        if (record && record.input !== undefined) {
          const input = record.input
          const inputRecord = ensureRecord(input)

          if (Array.isArray(input)) {
            messages = input as unknown[]
          } else if (inputRecord && Array.isArray(inputRecord.messages)) {
            messages = inputRecord.messages as unknown[]
          } else {
            messages = []
          }

          metadata = {
            ...metadata,
            langfuse_trace_id: record.id,
            timestamp: record.timestamp,
            ...(ensureRecord(record.metadata) ?? {})
          }
        }
      }

      if (!messages) {
        return {
          success: false,
          error: 'Invalid LangFuse data: missing input or messages'
        }
      }

      const standardMessages: StandardMessage[] = []

      for (const raw of messages) {
        const messageRecord = ensureRecord(raw)
        if (!messageRecord) {
          continue
        }

        const role = coerceRole(messageRecord.role)
        if (typeof role !== 'string' || !['system', 'user', 'assistant', 'tool'].includes(role)) {
          continue
        }

        const rawContent = messageRecord.content
        let content = ''
        if (typeof rawContent === 'string') {
          content = rawContent
        } else if (rawContent != null) {
          try {
            content = JSON.stringify(rawContent)
          } catch {
            content = String(rawContent)
          }
        }

        const standardMessage: StandardMessage = {
          role,
          content
        }

        if (typeof messageRecord.name === 'string') {
          standardMessage.name = messageRecord.name
        }
        if (Array.isArray(messageRecord.tool_calls)) {
          standardMessage.tool_calls = messageRecord.tool_calls as StandardMessage['tool_calls']
        }
        if (typeof messageRecord.tool_call_id === 'string') {
          standardMessage.tool_call_id = messageRecord.tool_call_id
        }

        if (role === 'tool') {
          const contentRecord = ensureRecord(rawContent)
          const functionPayload = contentRecord?.function
          if (contentRecord?.type === 'function' && ensureRecord(functionPayload)) {
            extractedTools.push({
              type: 'function',
              function: functionPayload as ToolDefinition['function']
            })
          }
        }

        standardMessages.push(standardMessage)
      }

      const getMetadataString = (key: string): string | undefined => {
        const value = metadata[key]
        if (typeof value === 'string') {
          return value
        }
        return value != null ? String(value) : undefined
      }

      const getMetadataNumber = (key: string): number | undefined => {
        const value = metadata[key]
        return typeof value === 'number' ? value : undefined
      }

      const standardData: StandardPromptData = {
        messages: standardMessages,
        model: getMetadataString('model'),
        temperature: getMetadataNumber('temperature'),
        tools: extractedTools.length > 0 ? extractedTools : undefined,
        metadata: {
          source: 'langfuse',
          template_info: {
            name: getMetadataString('name')
          },
          timestamp: getMetadataString('timestamp'),
          langfuse_trace_id: getMetadataString('langfuse_trace_id'),
          usage: metadata['usage'],
          extracted_tools_count: extractedTools.length
        }
      }

      return {
        success: true,
        data: standardData
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert LangFuse data: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 从OpenAI请求格式转换为标准格式
   */
  fromOpenAI(request: OpenAIRequest): ConversionResult<StandardPromptData> {
    try {
      if (!request.messages || !Array.isArray(request.messages)) {
        return {
          success: false,
          error: 'Invalid OpenAI request: missing or invalid messages array'
        }
      }

      const standardData: StandardPromptData = {
        messages: request.messages,
        tools: request.tools,
        model: request.model,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop,
        stream: request.stream,
        metadata: {
          source: 'openai',
          timestamp: new Date().toISOString()
        }
      }

      return {
        success: true,
        data: standardData
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert OpenAI data: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 从会话消息格式转换为标准格式
   */
  fromConversationMessages(
    messages: Array<Partial<ConversationMessage>>, 
    metadata?: Record<string, unknown>
  ): ConversionResult<StandardPromptData> {
    try {
      if (!messages || !Array.isArray(messages)) {
        return {
          success: false,
          error: 'Invalid conversation messages: must be an array'
        }
      }

      const standardMessages: StandardMessage[] = messages.map(rawMessage => {
        const normalizedRole = ['system', 'user', 'assistant', 'tool'].includes(rawMessage.role as string)
          ? (rawMessage.role as ConversationMessage['role'])
          : 'user'

        let content = ''
        const rawContent = rawMessage.content
        if (typeof rawContent === 'string') {
          content = rawContent
        } else if (rawContent != null) {
          try {
            content = typeof rawContent === 'object'
              ? JSON.stringify(rawContent)
              : String(rawContent)
          } catch {
            content = String(rawContent)
          }
        }

        const standardMessage: StandardMessage = {
          role: normalizedRole,
          content
        }

        if (typeof rawMessage.name === 'string') {
          standardMessage.name = rawMessage.name
        }

        if (Array.isArray(rawMessage.tool_calls)) {
          standardMessage.tool_calls = rawMessage.tool_calls as StandardMessage['tool_calls']
        }

        if (typeof rawMessage.tool_call_id === 'string') {
          standardMessage.tool_call_id = rawMessage.tool_call_id
        }

        return standardMessage
      })

      const standardData: StandardPromptData = {
        messages: standardMessages,
        metadata: {
          source: 'conversation',
          timestamp: new Date().toISOString(),
          ...(metadata ?? {})
        }
      }

      return {
        success: true,
        data: standardData
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert conversation messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 从标准格式转换为OpenAI请求格式
   */
  toOpenAI(
    data: StandardPromptData, 
    variables?: Record<string, string>
  ): ConversionResult<OpenAIRequest> {
    try {
      if (!data.messages || !Array.isArray(data.messages)) {
        return {
          success: false,
          error: 'Invalid standard data: missing or invalid messages array'
        }
      }

      // 替换变量
      let processedMessages = data.messages
      if (variables) {
        processedMessages = data.messages.map(msg => ({
          ...msg,
          content: this.replaceVariables(msg.content, variables)
        }))
      }

      const openaiRequest: OpenAIRequest = {
        messages: processedMessages,
        model: data.model || 'gpt-3.5-turbo',
        ...(data.tools && { tools: data.tools }),
        ...(data.temperature !== undefined && { temperature: data.temperature }),
        ...(data.max_tokens !== undefined && { max_tokens: data.max_tokens }),
        ...(data.top_p !== undefined && { top_p: data.top_p }),
        ...(data.frequency_penalty !== undefined && { frequency_penalty: data.frequency_penalty }),
        ...(data.presence_penalty !== undefined && { presence_penalty: data.presence_penalty }),
        ...(data.stop !== undefined && { stop: data.stop }),
        ...(data.stream !== undefined && { stream: data.stream })
      }

      return {
        success: true,
        data: openaiRequest
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert to OpenAI format: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 从标准格式转换为会话消息格式
   */
  toConversationMessages(data: StandardPromptData): ConversionResult<ConversationMessage[]> {
    try {
      if (!data.messages || !Array.isArray(data.messages)) {
        return {
          success: false,
          error: 'Invalid standard data: missing or invalid messages array'
        }
      }

      const conversationMessages: ConversationMessage[] = []
      const warnings: string[] = []

      for (const msg of data.messages) {
        if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
          warnings.push(`Filtered out message with unsupported role: ${msg.role}`)
          continue
        }

        const conversationMessage: ConversationMessage = {
          role: msg.role as ConversationMessage['role'],
          content: msg.content
        }

        if (typeof msg.name === 'string') {
          conversationMessage.name = msg.name
        }

        if (Array.isArray(msg.tool_calls)) {
          conversationMessage.tool_calls = msg.tool_calls
        }

        if (typeof msg.tool_call_id === 'string') {
          conversationMessage.tool_call_id = msg.tool_call_id
        }

        conversationMessages.push(conversationMessage)
      }

      return {
        success: true,
        data: conversationMessages,
        warnings
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert to conversation messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * 验证数据格式是否有效
   */
  validate(data: unknown, format: 'standard' | 'langfuse' | 'openai' | 'conversation'): ConversionResult<boolean> {
    try {
      switch (format) {
        case 'standard':
          return this.validateStandardFormat(data)
        case 'langfuse':
          return this.validateLangFuseFormat(data)
        case 'openai':
          return this.validateOpenAIFormat(data)
        case 'conversation':
          return this.validateConversationFormat(data)
        default:
          return {
            success: false,
            error: `Unknown format: ${format}`
          }
      }
    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // 私有方法：替换变量
  private replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content
    for (const [name, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g')
      result = result.replace(pattern, value)
    }
    return result
  }

  // 私有方法：验证标准格式
  private validateStandardFormat(data: unknown): ConversionResult<boolean> {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Data must be an object' }
    }

    const payload = data as { messages?: unknown }

    if (!payload.messages || !Array.isArray(payload.messages)) {
      return { success: false, error: 'Messages must be an array' }
    }

    for (const [index, message] of payload.messages.entries()) {
      if (!message || typeof message !== 'object') {
        return { success: false, error: `Invalid message at index ${index}` }
      }

      const typedMessage = message as { role?: unknown; content?: unknown }

      if (!typedMessage.role || !['system', 'user', 'assistant', 'tool'].includes(String(typedMessage.role))) {
        return { success: false, error: `Invalid role in message ${index}` }
      }
      if (typeof typedMessage.content !== 'string') {
        return { success: false, error: `Invalid content in message ${index}` }
      }
    }

    return { success: true, data: true }
  }

  // 私有方法：验证LangFuse格式
  private validateLangFuseFormat(data: unknown): ConversionResult<boolean> {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'LangFuse data must be an object' }
    }

    const payload = data as { input?: { messages?: unknown } }

    if (!payload.input || !payload.input.messages) {
      return { success: false, error: 'LangFuse data must have input.messages' }
    }

    return this.validateStandardFormat({ messages: payload.input.messages })
  }

  // 私有方法：验证OpenAI格式
  private validateOpenAIFormat(data: unknown): ConversionResult<boolean> {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'OpenAI data must be an object' }
    }

    const payload = data as { messages?: unknown; model?: unknown }

    if (!payload.messages || !Array.isArray(payload.messages)) {
      return { success: false, error: 'OpenAI data must have messages array' }
    }

    if (!payload.model || typeof payload.model !== 'string') {
      return { success: false, error: 'OpenAI data must have model string' }
    }

    return this.validateStandardFormat({ messages: payload.messages })
  }

  // 私有方法：验证会话格式
  private validateConversationFormat(data: unknown): ConversionResult<boolean> {
    if (!Array.isArray(data)) {
      return { success: false, error: 'Conversation data must be an array' }
    }

    for (const [index, message] of data.entries()) {
      if (!message || typeof message !== 'object') {
        return { success: false, error: `Invalid message at index ${index}` }
      }

      const typedMessage = message as { role?: unknown; content?: unknown }

      if (!typedMessage.role || !['system', 'user', 'assistant', 'tool'].includes(String(typedMessage.role))) {
        return { success: false, error: `Invalid role in conversation message ${index}` }
      }
      if (typeof typedMessage.content !== 'string') {
        return { success: false, error: `Invalid content in conversation message ${index}` }
      }
    }

    return { success: true, data: true }
  }
}
