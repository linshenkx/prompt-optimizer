import type { MessageOptions, MessageReactive } from 'naive-ui'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

// 全局消息API实例 - 在NMessageProvider上下文中初始化
type MessageApi = {
  success: (content: string, options?: MessageOptions) => MessageReactive
  error: (content: string, options?: MessageOptions) => MessageReactive
  warning: (content: string, options?: MessageOptions) => MessageReactive
  info: (content: string, options?: MessageOptions) => MessageReactive
}

let globalMessageApi: MessageApi | null = null

// 设置全局消息API（在Toast组件中调用）
export function setGlobalMessageApi(api: MessageApi) {
  globalMessageApi = api
  console.log('[useToast] Global message API set successfully')
}

type ToastOptions = number | MessageOptions

export function useToast() {
  const getMessageApi = (): MessageApi | null => {
    if (!globalMessageApi) {
      console.warn('[useToast] NMessageProvider context not available yet.')
    }
    return globalMessageApi
  }

  const add = (
    content: string,
    type: Toast['type'] = 'info',
    options?: ToastOptions
  ): MessageReactive | undefined => {
    const message = getMessageApi()
    if (!message) return undefined

    const normalizedOptions: MessageOptions = {
      duration: 3000,
      closable: true,
      keepAliveOnHover: true,
      ...(typeof options === 'number' ? { duration: options } : options || {})
    }
    
    switch (type) {
      case 'success':
        return message.success(content, normalizedOptions)
      case 'error':
        return message.error(content, normalizedOptions)
      case 'warning':
        return message.warning(content, normalizedOptions)
      case 'info':
      default:
        return message.info(content, normalizedOptions)
    }
  }

  const remove = (messageReactive?: MessageReactive) => {
    // Naive UI消息实例可以直接调用destroy方法
    if (messageReactive && typeof messageReactive.destroy === 'function') {
      messageReactive.destroy()
    }
  }

  const success = (content: string, options?: ToastOptions) => add(content, 'success', options)
  const error = (content: string, options?: ToastOptions) => add(content, 'error', options)
  const info = (content: string, options?: ToastOptions) => add(content, 'info', options)
  const warning = (content: string, options?: ToastOptions) => add(content, 'warning', options)

  return {
    add,
    remove,
    success,
    error,
    info,
    warning,
    // 向后兼容
    toasts: [] as never[], // Naive UI不需要维护toasts数组
  }
}
