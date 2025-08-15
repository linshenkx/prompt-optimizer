/**
 * URL构建器 - 为不同AI提供商构建跳转URL
 */
import type { AiRedirectConfig, RedirectOptions, UrlBuilder, ProviderUrlConfig } from './types'

// 各AI提供商的URL配置映射
const PROVIDER_CONFIGS: Record<string, ProviderUrlConfig> = {
  openai: {
    baseUrl: 'https://chat.openai.com',
    newChatPath: '/',
    chatPath: '/c/{conversationId}',
    promptParam: 'q',
    supportsContinuation: false // ChatGPT暂不支持URL参数直接传递提示词
  },
  gemini: {
    baseUrl: 'https://gemini.google.com',
    newChatPath: '/app',
    promptParam: 'q',
    supportsContinuation: false
  },
  deepseek: {
    baseUrl: 'https://chat.deepseek.com',
    newChatPath: '/',
    promptParam: 'q',
    supportsContinuation: false
  },
  zhipu: {
    baseUrl: 'https://chatglm.cn',
    newChatPath: '/',
    promptParam: 'q',
    supportsContinuation: false
  },
  claude: {
    baseUrl: 'https://claude.ai',
    newChatPath: '/chat',
    promptParam: 'q',
    supportsContinuation: false
  }
}

/**
 * 默认URL构建器实现
 */
export class DefaultUrlBuilder implements UrlBuilder {
  /**
   * 构建跳转URL
   * @param config AI跳转配置
   * @param options 跳转选项
   * @returns 构建的URL字符串
   */
  buildUrl(config: AiRedirectConfig, options: RedirectOptions): string {
    const providerConfig = this.getProviderConfig(config)
    
    // 构建基础URL
    let url = providerConfig.baseUrl
    
    // 根据是否为新对话选择路径
    if (options.isNewConversation !== false) {
      url += providerConfig.newChatPath
    } else if (options.conversationId && providerConfig.chatPath) {
      url += providerConfig.chatPath.replace('{conversationId}', options.conversationId)
    } else {
      url += providerConfig.newChatPath
    }
    
    // 添加查询参数
    const params = new URLSearchParams()
    
    // 添加提示词参数（如果支持）
    if (providerConfig.promptParam && options.prompt) {
      params.append(providerConfig.promptParam, options.prompt)
    }
    
    // 添加标题参数（如果支持且提供）
    if (providerConfig.titleParam && options.title) {
      params.append(providerConfig.titleParam, options.title)
    }
    
    // 如果有查询参数，添加到URL
    const queryString = params.toString()
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString
    }
    
    return url
  }
  
  /**
   * 获取提供商配置
   * @param config AI跳转配置
   * @returns 提供商URL配置
   */
  private getProviderConfig(config: AiRedirectConfig): ProviderUrlConfig {
    // 如果是自定义提供商，使用自定义配置
    if (config.provider === 'custom' && config.baseUrl) {
      return {
        baseUrl: config.baseUrl,
        newChatPath: '/',
        promptParam: 'q',
        supportsContinuation: false
      }
    }
    
    // 获取预定义的提供商配置
    const providerConfig = PROVIDER_CONFIGS[config.provider]
    if (!providerConfig) {
      throw new Error(`不支持的AI提供商: ${config.provider}`)
    }
    
    return providerConfig
  }
  
  /**
   * 检查提供商是否支持对话续接
   * @param provider 提供商类型
   * @returns 是否支持续接
   */
  supportsContinuation(provider: string): boolean {
    const config = PROVIDER_CONFIGS[provider]
    return config?.supportsContinuation ?? false
  }
}