/**
 * AI模型跳转相关的类型定义
 */

// 支持的AI提供商类型
export type SupportedProvider = 'openai' | 'gemini' | 'deepseek' | 'zhipu' | 'claude' | 'custom'

// 跳转配置接口
export interface AiRedirectConfig {
  provider: SupportedProvider // AI提供商
  baseUrl?: string // 自定义基础URL（用于custom类型）
  modelName?: string // 模型名称
  apiKey?: string // API密钥（可选，用于某些平台的直接跳转）
}

// 跳转选项接口
export interface RedirectOptions {
  prompt: string // 要传递的提示词内容
  isNewConversation?: boolean // 是否创建新对话（默认true）
  conversationId?: string // 现有对话ID（用于追加到现有对话）
  title?: string // 对话标题（可选）
  openInNewTab?: boolean // 是否在新标签页打开（默认true）
}

// 跳转结果接口
export interface RedirectResult {
  success: boolean // 跳转是否成功
  url?: string // 跳转的URL
  error?: string // 错误信息
  conversationId?: string // 生成的对话ID（如果适用）
}

// URL构建器接口
export interface UrlBuilder {
  buildUrl(config: AiRedirectConfig, options: RedirectOptions): string
}

// 提供商URL映射配置
export interface ProviderUrlConfig {
  baseUrl: string // 基础URL
  newChatPath: string // 新对话路径
  chatPath?: string // 现有对话路径模板
  promptParam?: string // 提示词参数名
  titleParam?: string // 标题参数名
  supportsContinuation?: boolean // 是否支持对话续接
}

