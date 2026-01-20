import { Template } from "./types";
import { Message } from "../llm/types";
import { Mustache } from "./minimal";
import { TemplateValidationError } from "./errors";
import type {
  OptimizationMode,
  ConversationMessage,
  ToolDefinition,
} from "../prompt/types";

/**
 * 模板变量上下文
 */
export interface TemplateContext {
  originalPrompt?: string;
  iterateInput?: string;
  lastOptimizedPrompt?: string;
  optimizationMode?: OptimizationMode; // 优化模式
  // 上下文模式（用于区分 system/user 模式，虽然在渲染层面已无差异）
  contextMode?: import("../context/types").ContextMode; // 'system' | 'user'
  // 高级模式上下文（可选）
  customVariables?: Record<string, string>; // 自定义变量
  tools?: ToolDefinition[]; // 工具定义信息
  // 格式化的上下文文本（用于模板注入）
  conversationContext?: string; // 格式化的会话上下文
  toolsContext?: string; // 格式化的工具上下文
  // 消息优化专用字段
  messageRole?: string; // 选中消息的角色（system/user）
  conversationMessages?: any[]; // 带元数据的消息数组（用于模板循环）
  selectedMessage?: any; // 选中消息的详细信息（用于模板显示）
  // Allow additional properties for template flexibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Simplified template processor with organized methods
 */
export class TemplateProcessor {
  /**
   * Process template and return message array
   */
  static processTemplate(
    template: Template,
    context: TemplateContext,
  ): Message[] {
    // Validate template content
    this.validateTemplate(template);

    // Build messages based on template type
    return this.buildMessages(template, context);
  }

  /**
   * Validate template content
   */
  private static validateTemplate(template: Template): void {
    if (!template?.content) {
      throw new TemplateValidationError(
        `Template content is missing or invalid for template: ${template?.id || "unknown"}`,
      );
    }

    // Check for empty array content
    if (Array.isArray(template.content) && template.content.length === 0) {
      throw new TemplateValidationError(
        `Template content cannot be empty for template: ${template.id}`,
      );
    }
  }

  /**
   * Build messages from template
   */
  private static buildMessages(
    template: Template,
    context: TemplateContext,
  ): Message[] {
    // Simple template: no template technology, directly use as system prompt
    if (typeof template.content === "string") {
      const messages: Message[] = [
        { role: "system", content: template.content },
      ];

      // Add user message - pass user content directly without template replacement
      if (context.originalPrompt) {
        messages.push({ role: "user", content: context.originalPrompt });
      }

      return messages;
    }

    // Advanced template: 使用 Mustache 渲染
    if (Array.isArray(template.content)) {
      return template.content.map((msg) => {
        // 统一使用 Mustache 渲染
        // Mustache 会：
        // 1. 替换模板中的内置变量（如 {{originalPrompt}}）
        // 2. 自动保留值中的占位符（如 originalPrompt = "写一首{{风格}}的歌"）
        // 3. 支持条件渲染（{{#var}}...{{/var}}）和循环
        // 确保数组变量至少是空数组，避免 undefined 导致 {{#var}} 块不渲染（Mustache 行为：undefined/null/false 为 false）
        // 但是我们需要区分“不存在”和“空数组”吗？对于 {{^var}} 来说，undefined/null/empty array 都是 true（取反）
        // 只要保证 context 中传递了正确的 key 即可。

        const renderedContent = Mustache.render(msg.content, context);

        return {
          role: msg.role,
          content: renderedContent,
        };
      });
    }

    throw new TemplateValidationError(
      `Invalid template content format for template: ${template.id}`,
    );
  }

  /**
   * Check if template is simple type
   */
  static isSimpleTemplate(template: Template): boolean {
    return typeof template.content === "string";
  }

  /**
   * 创建扩展的模板上下文
   * 合并基础上下文和高级上下文（自定义变量）
   */
  static createExtendedContext(
    baseContext: TemplateContext,
    customVariables?: Record<string, string>,
    conversationMessages?: ConversationMessage[],
  ): TemplateContext {
    // 合并所有变量到上下文中
    const extendedContext: TemplateContext = {
      ...baseContext,
      customVariables,
      conversationMessages,
    };

    // 将自定义变量直接添加到上下文中，以便模板可以直接访问
    if (customVariables) {
      Object.entries(customVariables).forEach(([key, value]) => {
        // 只有当基础上下文中没有该key时才添加（预定义变量优先）
        if (extendedContext[key] === undefined) {
          extendedContext[key] = value;
        }
      });
    }

    return extendedContext;
  }

  /**
   * 处理会话消息：将消息数组转换为文本
   * 用于优化阶段将会话上下文注入到模板中
   */
  static formatConversationAsText(messages: ConversationMessage[]): string {
    if (!messages || messages.length === 0) {
      return "";
    }

    return messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");
  }


  /**
   * 替换会话消息中的变量
   * 用于测试阶段实际替换变量
   */
  static processConversationMessages(
    messages: ConversationMessage[],
    variables: Record<string, string>,
  ): Message[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    return messages.map((msg) => {
      // 使用 Mustache 进行变量替换
      // Mustache 会自动保留值中的占位符，无需特殊处理
      const processedContent = Mustache.render(msg.content, variables);

      return {
        role: msg.role,
        content: processedContent,
      };
    });
  }

  /**
   * 格式化工具信息为文本
   * 用于优化阶段将工具上下文注入到模板中，帮助LLM理解可用工具
   */
  static formatToolsAsText(tools: ToolDefinition[]): string {
    if (!tools || tools.length === 0) {
      return "";
    }

    return tools
      .map((tool) => {
        const func = tool.function;
        let toolText = `工具名称: ${func.name}`;

        if (func.description) {
          toolText += `\n描述: ${func.description}`;
        }

        if (func.parameters) {
          toolText += `\n参数结构: ${JSON.stringify(func.parameters, null, 2)}`;
        }

        return toolText;
      })
      .join("\n\n");
  }
}
