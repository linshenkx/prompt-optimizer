/**
 * AI模型跳转服务实现
 */
import type { AiRedirectConfig, RedirectOptions, RedirectResult, UrlBuilder } from './types'
import { DefaultUrlBuilder } from './url-builder'

/**
 * AI跳转服务类
 * 负责处理跳转到各种AI模型对话页面的逻辑
 */
export class AiRedirectService {
  private urlBuilder: UrlBuilder
  private conversationStorage: Map<string, string> = new Map() // 存储对话ID映射
  
  constructor(urlBuilder?: UrlBuilder) {
    this.urlBuilder = urlBuilder || new DefaultUrlBuilder()
  }
  
  /**
   * 跳转到AI模型对话页面
   * @param config AI跳转配置
   * @param options 跳转选项
   * @returns 跳转结果
   */
  async redirectToAi(config: AiRedirectConfig, options: RedirectOptions): Promise<RedirectResult> {
    try {
      // 验证配置
      this.validateConfig(config)
      
      // 处理对话续接逻辑
      const processedOptions = await this.processRedirectOptions(config, options)
      
      // 构建跳转URL
      const url = this.urlBuilder.buildUrl(config, processedOptions)
      
      // 执行跳转
      const success = await this.performRedirect(url, options.openInNewTab)
      
      // 存储对话信息（用于后续续接）
      if (success && processedOptions.isNewConversation) {
        const conversationKey = this.generateConversationKey(config, options.prompt)
        this.conversationStorage.set(conversationKey, url)
      }
      
      return {
        success,
        url,
        conversationId: processedOptions.conversationId
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }
  
  /**
   * 检查是否存在相关的对话
   * @param config AI跳转配置
   * @param promptPrefix 提示词前缀（用于匹配相关对话）
   * @returns 对话ID（如果存在）
   */
  findRelatedConversation(config: AiRedirectConfig, promptPrefix: string): string | null {
    const searchKey = this.generateConversationKey(config, promptPrefix)
    
    // 查找匹配的对话
    for (const [key, url] of this.conversationStorage.entries()) {
      if (key.startsWith(searchKey.substring(0, 20))) { // 模糊匹配
        return this.extractConversationIdFromUrl(url)
      }
    }
    
    return null
  }
  
  /**
   * 清理过期的对话记录
   * @param maxAge 最大保存时间（毫秒）
   */
  cleanupConversations(maxAge: number = 24 * 60 * 60 * 1000): void {
    // 简单实现：清空所有记录（实际项目中可以添加时间戳）
    // TODO: 实现基于maxAge的过期清理逻辑
    console.log(`清理超过 ${maxAge}ms 的对话记录`)
    this.conversationStorage.clear()
  }
  

  
  /**
   * 验证跳转配置
   * @param config AI跳转配置
   */
  private validateConfig(config: AiRedirectConfig): void {
    if (!config.provider) {
      throw new Error('AI提供商不能为空')
    }
    
    if (config.provider === 'custom' && !config.baseUrl) {
      throw new Error('自定义提供商必须提供baseUrl')
    }
  }
  
  /**
   * 处理跳转选项
   * @param config AI跳转配置
   * @param options 原始跳转选项
   * @returns 处理后的跳转选项
   */
  private async processRedirectOptions(
    config: AiRedirectConfig, 
    options: RedirectOptions
  ): Promise<RedirectOptions> {
    const processed = { ...options }
    
    // 如果没有明确指定是否为新对话，尝试查找相关对话
    if (processed.isNewConversation === undefined) {
      const relatedConversationId = this.findRelatedConversation(config, options.prompt.substring(0, 50))
      
      if (relatedConversationId) {
        processed.isNewConversation = false
        processed.conversationId = relatedConversationId
      } else {
        processed.isNewConversation = true
      }
    }
    
    // 设置默认标题
    if (!processed.title && processed.isNewConversation) {
      processed.title = this.generateConversationTitle(options.prompt)
    }
    
    return processed
  }
  
  /**
   * 执行跳转操作
   * @param url 跳转URL
   * @param openInNewTab 是否在新标签页打开
   * @returns 是否成功
   */
  private async performRedirect(url: string, openInNewTab: boolean = true): Promise<boolean> {
    try {
      if (typeof window !== 'undefined') {
        // 浏览器环境
        if (openInNewTab) {
          window.open(url, '_blank', 'noopener,noreferrer')
        } else {
          window.location.href = url
        }
        return true
      } else {
        // 非浏览器环境（如Electron）
        console.log(`跳转URL: ${url}`)
        return true
      }
    } catch (error) {
      console.error('跳转失败:', error)
      return false
    }
  }
  
  /**
   * 生成对话键值
   * @param config AI跳转配置
   * @param prompt 提示词
   * @returns 对话键值
   */
  private generateConversationKey(config: AiRedirectConfig, prompt: string): string {
    const hash = this.simpleHash(prompt)
    return `${config.provider}_${hash}`
  }
  
  /**
   * 生成对话标题
   * @param prompt 提示词
   * @returns 对话标题
   */
  private generateConversationTitle(prompt: string): string {
    // 取提示词前50个字符作为标题
    const title = prompt.substring(0, 50).trim()
    return title.length < prompt.length ? title + '...' : title
  }
  
  /**
   * 从URL中提取对话ID
   * @param url URL字符串
   * @returns 对话ID
   */
  private extractConversationIdFromUrl(url: string): string | null {
    // 简单实现：返回URL的哈希值作为对话ID
    return this.simpleHash(url)
  }
  
  /**
   * 简单哈希函数
   * @param str 输入字符串
   * @returns 哈希值
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }
}