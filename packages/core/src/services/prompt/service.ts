import {
  IPromptService,
  OptimizationRequest,
  MessageOptimizationRequest,
  CustomConversationRequest,
  ConversationMessage,
  ToolDefinition,
} from "./types";
import { Message, StreamHandlers, ILLMService } from "../llm/types";
import { PromptRecord } from "../history/types";
import { IModelManager } from "../model/types";
import { ITemplateManager } from "../template/types";
import { IHistoryManager } from "../history/types";
import {
  OptimizationError,
  IterationError,
  TestError,
  ServiceDependencyError,
} from "./errors";
import { TemplateProcessor, TemplateContext } from "../template/processor";

/**
 * Default template IDs used by the system
 */
const DEFAULT_TEMPLATES = {
  OPTIMIZE: "general-optimize",
  ITERATE: "iterate",
  TEST: "test-prompt",
} as const;

/**
 * 提示词服务实现
 */
export class PromptService implements IPromptService {
  constructor(
    private modelManager: IModelManager,
    private llmService: ILLMService,
    private templateManager: ITemplateManager,
    private historyManager: IHistoryManager,
  ) {
    this.checkDependencies();
  }

  /**
   * 检查依赖服务是否已初始化
   */
  private checkDependencies() {
    if (!this.modelManager) {
      throw new ServiceDependencyError("ModelManager", "Model manager not initialized");
    }
    if (!this.llmService) {
      throw new ServiceDependencyError("LLMService", "LLM service not initialized");
    }
    if (!this.templateManager) {
      throw new ServiceDependencyError(
        "TemplateManager",
        "Template manager not initialized",
      );
    }
    if (!this.historyManager) {
      throw new ServiceDependencyError(
        "HistoryManager",
        "History manager not initialized",
      );
    }
  }

  /**
   * 验证输入参数
   */
  private validateInput(prompt: string, modelKey: string) {
    if (!prompt?.trim()) {
      throw new OptimizationError(prompt, 'Prompt cannot be empty');
    }

    if (!modelKey?.trim()) {
      throw new OptimizationError(prompt, 'Model key is required');
    }
  }

  /**
   * 验证LLM响应
   */
  private validateResponse(response: string, prompt: string) {
    if (!response?.trim()) {
      throw new OptimizationError(prompt, 'LLM service returned empty result');
    }
  }

  /**
   * 验证消息优化请求参数
   */
  private validateMessageOptimizationRequest(request: MessageOptimizationRequest) {
      if (!request.selectedMessageId?.trim()) {
        throw new OptimizationError("", "Selected message ID is required");
      }

      if (!request.messages || request.messages.length === 0) {
        throw new OptimizationError("", "Messages array is required and cannot be empty");
      }

      if (!request.modelKey?.trim()) {
        throw new OptimizationError("", "Model key is required");
      }

      // 验证选中的消息是否存在
      const selectedMessage = request.messages.find(
        msg => msg.id === request.selectedMessageId
      );

      if (!selectedMessage) {
        throw new OptimizationError(
          "",
          `Message with ID ${request.selectedMessageId} not found in messages array`,
        );
      }

      // 验证消息内容不为空
      if (!selectedMessage.content?.trim()) {
        throw new OptimizationError(
          "",
          "Selected message content cannot be empty",
        );
      }
  }

  /**
   * 优化提示词 - 支持提示词类型和增强功能
   */
  async optimizePrompt(request: OptimizationRequest): Promise<string> {
    try {
      this.validateOptimizationRequest(request);

      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError(request.targetPrompt, "Model not found");
      }

      const template = await this.templateManager.getTemplate(
        request.templateId ||
          (await this.getDefaultTemplateId(
            request.optimizationMode === "user" ? "userOptimize" : "optimize",
          )),
      );

      if (!template?.content) {
        throw new OptimizationError(
          request.targetPrompt,
          "Template not found or invalid",
        );
      }

      const context: TemplateContext = {
        originalPrompt: request.targetPrompt,
        optimizationMode: request.optimizationMode,
        contextMode: request.contextMode,
        // 传递高级上下文信息到模板
        customVariables: request.advancedContext?.variables,
        conversationMessages: request.advancedContext?.messages,
        tools: request.advancedContext?.tools,
      };

      // 如果有会话消息，将其格式化为文本并添加到上下文
      if (
        request.advancedContext?.messages &&
        request.advancedContext.messages.length > 0
      ) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          request.advancedContext.messages,
        );
        context.conversationContext = conversationText;
      }

      // 如果有工具信息，将其格式化为文本并添加到上下文
      if (
        request.advancedContext?.tools &&
        request.advancedContext.tools.length > 0
      ) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          request.advancedContext.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);
      const result = await this.llmService.sendMessage(
        messages,
        request.modelKey,
      );

      this.validateResponse(result, request.targetPrompt);
      // 注意：历史记录保存由UI层的historyManager.createNewChain方法处理
      // 移除重复的saveOptimizationHistory调用以避免重复保存

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        request.targetPrompt,
        `Optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 优化单条消息 - 多轮对话模式专用
   */
  async optimizeMessage(request: MessageOptimizationRequest): Promise<string> {
    try {
      // 验证请求参数
      this.validateMessageOptimizationRequest(request);

      // 获取模型配置
      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError("", "Model not found");
      }

      // 从消息数组中找到选中的消息
      const selectedMessage = request.messages.find(
        msg => msg.id === request.selectedMessageId
      )!;

      // 获取选中消息的索引（从0开始）
      const selectedIndex = request.messages.findIndex(
        msg => msg.id === request.selectedMessageId
      );

      // 获取模板（默认使用 context-message-optimize）
      const template = await this.templateManager.getTemplate(
        request.templateId || "context-message-optimize"
      );

      if (!template?.content) {
        throw new OptimizationError(
          selectedMessage.content,
          "Template not found or invalid",
        );
      }

      // 为消息数组添加元数据（用于模板循环）
      const messagesWithMeta = request.messages.map((msg, idx) => ({
        index: idx + 1,  // 序号从1开始
        roleLabel: msg.role.toUpperCase(),
        content: msg.content,
        isSelected: msg.id === request.selectedMessageId,
      }));

      // 准备选中消息的数据（包含长度判断）
      const maxLength = 200;
      const selectedMessageData = {
        index: selectedIndex + 1,
        roleLabel: selectedMessage.role.toUpperCase(),
        content: selectedMessage.content,
        contentTooLong: selectedMessage.content.length > maxLength,
        contentPreview: selectedMessage.content.length > maxLength
          ? selectedMessage.content.substring(0, 150)
          : undefined,
      };

      // 构建模板上下文
      const context: TemplateContext = {
        originalPrompt: selectedMessage.content,
        messageRole: selectedMessage.role,
        contextMode: request.contextMode,
        customVariables: request.variables,
        tools: request.tools,
        // 🆕 模板驱动的数据
        conversationMessages: messagesWithMeta,
        selectedMessage: selectedMessageData,
      };

      // 如果有工具定义，格式化为工具文本
      if (request.tools && request.tools.length > 0) {
        context.toolsContext = TemplateProcessor.formatToolsAsText(
          request.tools
        );
      }

      // 处理模板并调用 LLM
      const messages = TemplateProcessor.processTemplate(template, context);
      const result = await this.llmService.sendMessage(
        messages,
        request.modelKey,
      );

      // 验证响应
      this.validateResponse(result, selectedMessage.content);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        "",
        `Message optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 迭代优化提示词
   */
  async iteratePrompt(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    templateId?: string,
    contextData?: {
      messages?: ConversationMessage[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: ToolDefinition[];
    },
  ): Promise<string> {
    try {
      // 🔧 迭代模板只需要 lastOptimizedPrompt 和 iterateInput
      // originalPrompt 可以为空（用户直接在工作区编辑后迭代的场景）
      this.validateInput(lastOptimizedPrompt, modelKey);
      this.validateInput(iterateInput, modelKey);

      // 获取模型配置
      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new ServiceDependencyError("ModelManager", "Model not found");
      }

      // 获取迭代提示词
      let template;
      try {
        template = await this.templateManager.getTemplate(
          templateId || DEFAULT_TEMPLATES.ITERATE,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration failed: ${errorMessage}`,
        );
      }

      if (!template?.content) {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          "Iteration failed: Template not found or invalid",
        );
      }

      // 🔧 迭代功能必须使用高级模板（message array 格式）以支持变量替换
      if (typeof template.content === "string") {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration requires advanced template (message array format) for variable substitution.\n` +
            `Template ID: ${template.id}\n` +
            `Current template type: Simple template (string format)\n` +
            `Suggestion: Please use message array format template that supports {{lastOptimizedPrompt}} and {{iterateInput}} variables`,
        );
      }

      // 使用TemplateProcessor处理模板和变量替换
      const context: TemplateContext = {
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        customVariables: contextData?.variables,
        tools: contextData?.tools,
      };

      // 如果有会话消息，将其格式化为文本并添加到上下文
      if (contextData?.messages && contextData.messages.length > 0) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          contextData.messages,
        );
        context.conversationContext = conversationText;
      }

      // 如果有工具信息，将其格式化为文本并添加到上下文
      if (contextData?.tools && contextData.tools.length > 0) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          contextData.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);

      // 发送请求
      const result = await this.llmService.sendMessage(messages, modelKey);

      // 注意：迭代历史记录保存由UI层的historyManager.addIteration方法处理
      // 移除重复的addRecord调用以避免重复保存

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new IterationError(
        originalPrompt,
        iterateInput,
        `Iteration failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 测试提示词 - 支持可选系统提示词
   */
  async testPrompt(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
  ): Promise<string> {
    try {
      // 对于用户提示词优化，systemPrompt 可以为空
      if (!userPrompt?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "User prompt is required");
      }
      if (!modelKey?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "Model key is required");
      }

      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new TestError(systemPrompt, userPrompt, "Model not found");
      }

      const messages: Message[] = [];

      // 只有当 systemPrompt 不为空时才添加 system 消息
      if (systemPrompt?.trim()) {
        messages.push({ role: "system", content: systemPrompt });
      }

      messages.push({ role: "user", content: userPrompt });

      const result = await this.llmService.sendMessage(messages, modelKey);

      // 注意：测试功能不保存历史记录，保持架构一致性
      // 测试是临时性验证，不应与优化历史记录混合

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TestError(
        systemPrompt,
        userPrompt,
        `Test failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 获取历史记录
   */
  async getHistory(): Promise<PromptRecord[]> {
    return await this.historyManager.getRecords();
  }

  /**
   * 获取迭代链
   */
  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    return await this.historyManager.getIterationChain(recordId);
  }

  /**
   * 测试提示词（流式）- 支持可选系统提示词
   */
  async testPromptStream(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      // 对于用户提示词优化，systemPrompt 可以为空
      if (!userPrompt?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "User prompt is required");
      }
      if (!modelKey?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "Model key is required");
      }

      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new TestError(systemPrompt, userPrompt, "Model not found");
      }

      const messages: Message[] = [];

      // 只有当 systemPrompt 不为空时才添加 system 消息
      if (systemPrompt?.trim()) {
        messages.push({ role: "system", content: systemPrompt });
      }

      messages.push({ role: "user", content: userPrompt });

      // 使用新的结构化流式响应
      await this.llmService.sendMessageStream(messages, modelKey, {
        onToken: callbacks.onToken,
        onReasoningToken: callbacks.onReasoningToken, // 支持推理内容流
        onComplete: callbacks.onComplete,
        onError: callbacks.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TestError(
        systemPrompt,
        userPrompt,
        `Test failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 优化提示词（流式）- 支持提示词类型和增强功能
   */
  async optimizePromptStream(
    request: OptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      this.validateOptimizationRequest(request);

      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError(request.targetPrompt, "Model not found");
      }

      const template = await this.templateManager.getTemplate(
        request.templateId ||
          (await this.getDefaultTemplateId(
            request.optimizationMode === "user" ? "userOptimize" : "optimize",
          )),
      );

      if (!template?.content) {
        throw new OptimizationError(
          request.targetPrompt,
          "Template not found or invalid",
        );
      }

      // 创建基础上下文
      const baseContext: TemplateContext = {
        originalPrompt: request.targetPrompt,
        optimizationMode: request.optimizationMode,
        // 🆕 上下文模式和渲染阶段（用于 ContextPromptRenderer）
        contextMode: request.contextMode,
        renderPhase: "optimize", // 优化阶段
      };

      // 扩展上下文以支持高级功能
      const context = TemplateProcessor.createExtendedContext(
        baseContext,
        request.advancedContext?.variables,
        request.advancedContext?.messages,
      );

      // 如果有会话消息，将其格式化为文本并添加到上下文
      if (
        request.advancedContext?.messages &&
        request.advancedContext.messages.length > 0
      ) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          request.advancedContext.messages,
        );
        context.conversationContext = conversationText;
      }

      // 🆕 如果有工具信息，将其格式化为文本并添加到上下文
      if (
        request.advancedContext?.tools &&
        request.advancedContext.tools.length > 0
      ) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          request.advancedContext.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);

      // 使用新的结构化流式响应
      await this.llmService.sendMessageStream(messages, request.modelKey, {
        onToken: callbacks.onToken,
        onReasoningToken: callbacks.onReasoningToken, // 支持推理内容流
        onComplete: async (response) => {
          try {
            if (response) {
              // 验证主要内容
              this.validateResponse(response.content, request.targetPrompt);

              // 注意：历史记录保存由UI层的historyManager.createNewChain方法处理
              // 移除重复的saveOptimizationHistory调用以避免重复保存
            }

            // 调用原始完成回调，传递结构化响应
            callbacks.onComplete(response);
          } catch (error) {
            // 如果验证失败，调用错误回调
            callbacks.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        },
        onError: callbacks.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        request.targetPrompt,
        `Optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 优化单条消息（流式）- 多轮对话模式专用
   */
  async optimizeMessageStream(
    request: MessageOptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      // 验证请求参数
      this.validateMessageOptimizationRequest(request);

      // 获取模型配置
      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError("", "Model not found");
      }

      // 从消息数组中找到选中的消息
      const selectedMessage = request.messages.find(
        msg => msg.id === request.selectedMessageId
      )!;

      // 获取选中消息的索引（从0开始）
      const selectedIndex = request.messages.findIndex(
        msg => msg.id === request.selectedMessageId
      );

      // 获取模板（默认使用 context-message-optimize）
      const template = await this.templateManager.getTemplate(
        request.templateId || "context-message-optimize"
      );

      if (!template?.content) {
        throw new OptimizationError(
          selectedMessage.content,
          "Template not found or invalid",
        );
      }

      // 为消息数组添加元数据（用于模板循环）
      const messagesWithMeta = request.messages.map((msg, idx) => ({
        index: idx + 1,  // 序号从1开始
        roleLabel: msg.role.toUpperCase(),
        content: msg.content,
        isSelected: msg.id === request.selectedMessageId,
      }));

      // 准备选中消息的数据（包含长度判断）
      const maxLength = 200;
      const selectedMessageData = {
        index: selectedIndex + 1,
        roleLabel: selectedMessage.role.toUpperCase(),
        content: selectedMessage.content,
        contentTooLong: selectedMessage.content.length > maxLength,
        contentPreview: selectedMessage.content.length > maxLength
          ? selectedMessage.content.substring(0, 150)
          : undefined,
      };

      // 构建模板上下文
      const context: TemplateContext = {
        originalPrompt: selectedMessage.content,
        messageRole: selectedMessage.role,
        contextMode: request.contextMode,
        customVariables: request.variables,
        tools: request.tools,
        // 🆕 模板驱动的数据
        conversationMessages: messagesWithMeta,
        selectedMessage: selectedMessageData,
      };

      // 如果有工具定义，格式化为工具文本
      if (request.tools && request.tools.length > 0) {
        context.toolsContext = TemplateProcessor.formatToolsAsText(
          request.tools
        );
      }

      // 处理模板
      const messages = TemplateProcessor.processTemplate(template, context);

      // 使用流式发送
      await this.llmService.sendMessageStream(messages, request.modelKey, {
        onToken: callbacks.onToken,
        onReasoningToken: callbacks.onReasoningToken,
        onComplete: async (response) => {
          try {
            if (response) {
              // 验证主要内容
              this.validateResponse(response.content, selectedMessage.content);
            }

            // 调用原始完成回调
            callbacks.onComplete(response);
          } catch (error) {
            // 如果验证失败，调用错误回调
            callbacks.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        },
        onError: callbacks.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        "",
        `Message optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 迭代优化提示词（流式）
   */
  async iteratePromptStream(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    handlers: StreamHandlers,
    templateId: string,
    contextData?: {
      messages?: ConversationMessage[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: ToolDefinition[];
    },
  ): Promise<void> {
    try {
      // 🔧 迭代模板只需要 lastOptimizedPrompt 和 iterateInput
      // originalPrompt 可以为空（用户直接在工作区编辑后迭代的场景）
      this.validateInput(lastOptimizedPrompt, modelKey);
      this.validateInput(iterateInput, modelKey);

      // 获取模型配置
      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new ServiceDependencyError("ModelManager", "Model not found");
      }

      // 获取迭代提示词
      let template;
      try {
        template = await this.templateManager.getTemplate(templateId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration failed: ${errorMessage}`,
        );
      }

      if (!template?.content) {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          "Iteration failed: Template not found or invalid",
        );
      }

      // 🔧 迭代功能必须使用高级模板（message array 格式）以支持变量替换
      if (typeof template.content === "string") {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration requires advanced template (message array format) for variable substitution.\n` +
            `Template ID: ${template.id}\n` +
            `Current template type: Simple template (string format)\n` +
            `Suggestion: Please use message array format template that supports {{lastOptimizedPrompt}} and {{iterateInput}} variables`,
        );
      }

      // 使用TemplateProcessor处理模板和变量替换
      const context: TemplateContext = {
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        customVariables: contextData?.variables,
        tools: contextData?.tools,
      };

      // 如果有会话消息，将其格式化为文本并添加到上下文
      if (contextData?.messages && contextData.messages.length > 0) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          contextData.messages,
        );
        context.conversationContext = conversationText;
      }

      // 如果有工具信息，将其格式化为文本并添加到上下文
      if (contextData?.tools && contextData.tools.length > 0) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          contextData.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);

      // 使用新的结构化流式响应
      await this.llmService.sendMessageStream(messages, modelKey, {
        onToken: handlers.onToken,
        onReasoningToken: handlers.onReasoningToken, // 支持推理内容流
        onComplete: async (response) => {
          try {
            if (response) {
              // 验证迭代结果
              this.validateResponse(response.content, lastOptimizedPrompt);
            }

            // 调用原始完成回调，传递结构化响应
            // 注意：迭代历史记录由UI层的historyManager.addIteration方法处理
            handlers.onComplete(response);
          } catch (error) {
            // 如果验证失败，调用错误回调
            handlers.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        },
        onError: handlers.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new IterationError(
        originalPrompt,
        iterateInput,
        `Iteration failed: ${errorMessage}`,
      );
    }
  }

  // === 新增：支持提示词类型的增强方法 ===

  /**
   * 验证优化请求参数
   */
  private validateOptimizationRequest(request: OptimizationRequest) {
    if (!request.targetPrompt?.trim()) {
      throw new OptimizationError("", "Target prompt is required");
    }
    if (!request.modelKey?.trim()) {
      throw new OptimizationError(request.targetPrompt, "Model key is required");
    }
  }

  /**
   * 获取默认模板ID
   */
  private async getDefaultTemplateId(
    templateType:
      | "optimize"
      | "userOptimize"
      | "text2imageOptimize"
      | "image2imageOptimize"
      | "imageIterate"
      | "iterate"
      | "conversationMessageOptimize"
      | "contextUserOptimize"
      | "contextIterate",
  ): Promise<string> {
    try {
      // 尝试获取指定类型的模板列表
      const templates = await this.templateManager.listTemplatesByType(
        templateType as any,
      );
      if (templates.length > 0) {
        // 返回列表中第一个模板的ID
        return templates[0].id;
      }
    } catch (error) {
      console.warn(`Failed to get templates for type ${templateType}`, error);
    }

    // 如果指定类型没有模板，尝试获取相关类型的模板作为回退
    try {
      let fallbackTypes: (
        | "optimize"
        | "userOptimize"
        | "text2imageOptimize"
        | "image2imageOptimize"
        | "iterate"
      )[] = [];

      if (
        templateType === "optimize" ||
        templateType === "conversationMessageOptimize"
      ) {
        fallbackTypes = ["userOptimize"]; // optimize类型回退到userOptimize
      } else if (
        templateType === "userOptimize" ||
        templateType === "contextUserOptimize"
      ) {
        fallbackTypes = ["optimize"]; // userOptimize类型回退到optimize
      } else if (
        templateType === "iterate" ||
        templateType === "contextIterate"
      ) {
        fallbackTypes = ["optimize", "userOptimize"]; // iterate类型回退到任意优化类型
      } else if (templateType === "text2imageOptimize") {
        fallbackTypes = ["userOptimize", "optimize"]; // 文生图回退到基础优化
      } else if (templateType === "image2imageOptimize") {
        fallbackTypes = ["text2imageOptimize", "userOptimize", "optimize"]; // 图生图优先回退到文生图
      } else if (templateType === "imageIterate") {
        fallbackTypes = ["iterate", "text2imageOptimize", "userOptimize"]; // 图像迭代回退到通用迭代/文生图
      }

      for (const fallbackType of fallbackTypes) {
        const fallbackTemplates =
          await this.templateManager.listTemplatesByType(fallbackType as any);
        if (fallbackTemplates.length > 0) {
          console.log(
            `Using fallback template type ${fallbackType} for ${templateType}`,
          );
          return fallbackTemplates[0].id;
        }
      }

      // 最后的回退：获取所有模板中第一个可用的内置模板
      const allTemplates = await this.templateManager.listTemplates();
      const availableTemplate = allTemplates.find((t) => t.isBuiltin);
      if (availableTemplate) {
        console.warn(
          `Using fallback builtin template: ${availableTemplate.id} for type ${templateType}`,
        );
        return availableTemplate.id;
      }
    } catch (fallbackError) {
      console.error(`Fallback template search failed:`, fallbackError);
    }

    // 如果所有方法都失败，抛出错误
    throw new ServiceDependencyError('TemplateManager', `No templates available for type: ${templateType}`);
  }

  // saveOptimizationHistory 方法已移除
  // 历史记录保存现在由UI层的historyManager.createNewChain方法处理

  // saveTestHistory 方法已移除
  // 测试功能不再保存历史记录，保持架构一致性
  // 测试是临时性验证，不应与优化历史记录混合

  // 注意：迭代历史记录由UI层管理，而非核心服务层
  // 原因：
  // 1. 迭代需要现有的chainId，这个信息由UI层的状态管理器维护
  // 2. 迭代与用户交互紧密结合，需要实时更新UI状态
  // 3. 版本管理逻辑在UI层更容易处理
  //
  // 相比之下，优化操作会创建新的链，所以可以在核心层处理
  // 这种混合架构是经过权衡的设计决策

  /**
   * 自定义会话测试（流式）- 高级模式功能
   */
  async testCustomConversationStream(
    request: CustomConversationRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      // 验证请求
      if (!request.modelKey?.trim()) {
        throw new TestError("", "", "Model key is required");
      }
      if (!request.messages || request.messages.length === 0) {
        throw new TestError("", "", "At least one message is required");
      }

      // 验证模型存在
      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new TestError("", "", "Model not found");
      }

      // 处理会话消息：替换变量
      const processedMessages = TemplateProcessor.processConversationMessages(
        request.messages,
        request.variables,
      );

      if (processedMessages.length === 0) {
        throw new TestError("", "", "No valid messages after processing");
      }

      // 使用流式发送，根据是否有工具选择不同的方法
      if (request.tools && request.tools.length > 0) {
        // 🆕 使用支持工具的流式发送
        await this.llmService.sendMessageStreamWithTools(
          processedMessages,
          request.modelKey,
          request.tools,
          {
            onToken: callbacks.onToken,
            onReasoningToken: callbacks.onReasoningToken,
            onToolCall: callbacks.onToolCall, // 🆕 传递工具调用回调
            onComplete: async (response) => {
              if (response) {
                console.log(
                  "[PromptService] Custom conversation test with tools completed successfully",
                );
                callbacks.onComplete?.(response);
              }
            },
            onError: (error) => {
              console.error(
                "[PromptService] Custom conversation test with tools failed:",
                error,
              );
              callbacks.onError?.(error);
            },
          },
        );
      } else {
        // 传统的流式发送（无工具）
        await this.llmService.sendMessageStream(
          processedMessages,
          request.modelKey,
          {
            onToken: callbacks.onToken,
            onReasoningToken: callbacks.onReasoningToken,
            onComplete: async (response) => {
              if (response) {
                console.log(
                  "[PromptService] Custom conversation test completed successfully",
                );
                callbacks.onComplete?.(response);
              }
            },
            onError: (error) => {
              console.error(
                "[PromptService] Custom conversation test failed:",
                error,
              );
              callbacks.onError?.(error);
            },
          },
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        "[PromptService] Custom conversation test error:",
        errorMessage,
      );

      // 通过回调传递错误
      if (callbacks.onError) {
        callbacks.onError(
          new Error(`Custom conversation test failed: ${errorMessage}`),
        );
        } else {
          throw new TestError(
            "",
            "",
            `Custom conversation test failed: ${errorMessage}`,
          );
        }
    }
  }
}
