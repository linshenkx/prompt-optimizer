/**
 * AI模型跳转服务
 * 提供跳转到各种AI模型对话页面的功能
 */
export { AiRedirectService } from './service'
export type { 
  AiRedirectConfig, 
  RedirectOptions, 
  RedirectResult,
  SupportedProvider,
  ProviderUrlConfig,
  UrlBuilder
} from './types'