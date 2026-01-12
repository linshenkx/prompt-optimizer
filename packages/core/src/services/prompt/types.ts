import { PromptRecord } from "../history/types";
import { StreamHandlers } from "../llm/types";

/**
 * 工具调用相关类型
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: object;
}

export interface ToolDefinition {
  type: "function";
  function: FunctionDefinition;
}

/**
 * 统一的消息结构
 */
export interface ConversationMessage {
  /**
   * 消息唯一标识符（使用 uuidv4 生成）
   * 用于建立稳定的消息-优化历史映射关系，不受数组操作影响
   */
  id?: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string; // 可包含变量语法 {{variableName}}
  /**
   * 原始内容（首次创建时保存，用于 v0 版本恢复）
   * 该字段创建后永不改变，即使消息被多次优化修改
   */
  originalContent?: string;
  /**
   * 函数调用名称（assistant消息）
   */
  name?: string;
  /**
   * 函数调用列表（assistant消息）
   */
  tool_calls?: ToolCall[];
  /**
   * 工具调用ID（tool消息）
   */
  tool_call_id?: string;
}

/**
 * 优化模式枚举
 * 用于区分不同的提示词优化类型
 */
export type OptimizationMode = "system" | "user";

/**
 * 子模式类型定义（三种功能模式独立）
 * 用于持久化各功能模式下的子模式选择
 */
export type BasicSubMode = "system" | "user"; // 基础模式
export type ProSubMode = "multi" | "variable"; // Pro 模式（多消息/变量）
export type ImageSubMode = "text2image" | "image2image"; // 图像模式

/**
 * 优化请求接口
 */
export interface OptimizationRequest {
  optimizationMode: OptimizationMode;
  targetPrompt: string; // 待优化的提示词
  templateId?: string;
  modelKey: string;
  // 🆕 上下文模式（用于变量替换策略）
  contextMode?: import("../context/types").ContextMode;
  // 新增：高级模式上下文（可选，保持向后兼容）
  advancedContext?: {
    variables?: Record<string, string>; // 自定义变量
    messages?: ConversationMessage[]; // 自定义会话消息
    tools?: ToolDefinition[]; // 🆕 工具定义支持
  };
}

/**
 * 消息优化请求接口（多轮对话模式专用）
 * 用于优化会话中的单条消息内容
 */
export interface MessageOptimizationRequest {
  /** 选中的消息ID（必选） */
  selectedMessageId: string;
  /** 完整的会话消息列表（必选，包含选中的消息） */
  messages: ConversationMessage[];
  /** 模型Key */
  modelKey: string;
  /** 优化模板ID（可选，默认使用 context-message-optimize） */
  templateId?: string;
  /** 上下文模式（用于变量替换策略） */
  contextMode?: import("../context/types").ContextMode;
  /** 自定义变量 */
  variables?: Record<string, string>;
  /** 工具定义 */
  tools?: ToolDefinition[];
}

/**
 * 自定义会话测试请求（与OptimizationRequest保持一致）
 */
export interface CustomConversationRequest {
  modelKey: string;
  messages: ConversationMessage[]; // 使用相同的消息结构
  variables: Record<string, string>; // 包含预定义+自定义变量
  tools?: ToolDefinition[]; // 🆕 工具定义支持
  // 🆕 上下文模式（用于变量替换策略）
  contextMode?: import("../context/types").ContextMode;
}

/**
 * 提示词服务接口
 */
export interface IPromptService {
  /** 优化提示词 - 支持提示词类型和增强功能 */
  optimizePrompt(request: OptimizationRequest): Promise<string>;

  /** 优化单条消息 - 多轮对话模式专用 */
  optimizeMessage(request: MessageOptimizationRequest): Promise<string>;

  /** 迭代优化提示词 */
  iteratePrompt(
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
  ): Promise<string>;

  /** 测试提示词 - 支持可选系统提示词 */
  testPrompt(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
  ): Promise<string>;

  /** 获取历史记录 */
  getHistory(): Promise<PromptRecord[]>;

  /** 获取迭代链 */
  getIterationChain(recordId: string): Promise<PromptRecord[]>;

  /** 优化提示词（流式）- 支持提示词类型和增强功能 */
  optimizePromptStream(
    request: OptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void>;

  /** 优化单条消息（流式）- 多轮对话模式专用 */
  optimizeMessageStream(
    request: MessageOptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void>;

  /** 迭代优化提示词（流式） */
  iteratePromptStream(
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
  ): Promise<void>;

  /** 测试提示词（流式）- 支持可选系统提示词 */
  testPromptStream(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
    callbacks: StreamHandlers,
  ): Promise<void>;

  /** 自定义会话测试（流式）- 高级模式功能 */
  testCustomConversationStream(
    request: CustomConversationRequest,
    callbacks: StreamHandlers,
  ): Promise<void>;
}

export type { StreamHandlers };
