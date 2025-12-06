/**
 * 连接配置管理工具函数
 * 统一处理文本模型和图像模型的提供商切换时连接配置逻辑
 */

export interface ProviderMeta {
  defaultBaseURL?: string
}

/**
 * 处理提供商切换时的连接配置更新
 *
 * 使用场景：
 * 1. 新建/编辑表单中用户手动切换提供商（resetConnectionConfig: true）
 *    - 重置 baseURL 为新提供商的默认值
 *    - 清空 apiKey 等其他字段（因为不同提供商的凭证不通用）
 *
 * 2. 打开编辑弹窗时的初始化（resetConnectionConfig: false）
 *    - 保留用户已保存的所有配置（baseURL、apiKey 等）
 *    - 仅在 baseURL 为空时补充提供商默认值
 *
 * @param currentConfig 当前的连接配置
 * @param providerMeta 提供商元数据（包含 defaultBaseURL）
 * @param resetConnectionConfig 是否重置连接配置
 * @returns 更新后的连接配置
 */
export function computeConnectionConfig(
  currentConfig: Record<string, unknown> | undefined,
  providerMeta: ProviderMeta | undefined,
  resetConnectionConfig: boolean
): Record<string, unknown> {
  if (resetConnectionConfig) {
    // 用户手动切换提供商：重置为新提供商默认配置，清空凭证
    // 显式将旧字段设为空字符串，确保 Vue 响应式更新输入框
    const result: Record<string, unknown> = {}
    if (currentConfig) {
      for (const key of Object.keys(currentConfig)) {
        result[key] = ''
      }
    }
    if (providerMeta?.defaultBaseURL) {
      result.baseURL = providerMeta.defaultBaseURL
    }
    return result
  }

  // 编辑弹窗初始化：保留已保存配置，仅补充空缺的 baseURL
  if (providerMeta?.defaultBaseURL && !currentConfig?.baseURL) {
    return {
      ...currentConfig,
      baseURL: providerMeta.defaultBaseURL
    }
  }
  return currentConfig ?? {}
}

/**
 * 规范化提供商切换选项
 * 支持布尔值简写和对象形式的参数
 */
export interface NormalizedProviderChangeOptions {
  autoSelectFirstModel: boolean
  resetOverrides: boolean
  resetConnectionConfig: boolean
}

export function normalizeProviderChangeOptions(
  options: boolean | { autoSelectFirstModel?: boolean; resetOverrides?: boolean; resetConnectionConfig?: boolean } = true
): NormalizedProviderChangeOptions {
  if (typeof options === 'boolean') {
    return {
      autoSelectFirstModel: options,
      resetOverrides: options,
      resetConnectionConfig: options
    }
  }

  const autoSelectFirstModel = options.autoSelectFirstModel ?? true
  return {
    autoSelectFirstModel,
    resetOverrides: options.resetOverrides ?? autoSelectFirstModel,
    resetConnectionConfig: options.resetConnectionConfig ?? autoSelectFirstModel
  }
}
