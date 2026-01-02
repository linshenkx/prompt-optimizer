/**
 * 统一的存储键常量定义
 *
 * 这是所有存储键的唯一数据源，UI包和Core包都从这里导入。
 * 集中管理所有存储键，避免在多个地方重复定义导致不一致。
 */

// 核心服务存储键
export const CORE_SERVICE_KEYS = {
  MODELS: "models", // 模型配置存储键
  IMAGE_MODELS: "image-models", // 图像模型配置存储键
  USER_TEMPLATES: "user-templates", // 用户模板存储键
  PROMPT_HISTORY: "prompt_history", // 提示词历史记录存储键
} as const;

// UI设置相关
export const UI_SETTINGS_KEYS = {
  THEME_ID: "app:settings:ui:theme-id",
  PREFERRED_LANGUAGE: "app:settings:ui:preferred-language",
  BUILTIN_TEMPLATE_LANGUAGE: "app:settings:ui:builtin-template-language",
  FUNCTION_MODE: "app:settings:ui:function-mode",

  // 子模式持久化（三种功能模式独立存储）
  BASIC_SUB_MODE: "app:settings:ui:basic-sub-mode", // 基础模式的子模式（system/user）
  PRO_SUB_MODE: "app:settings:ui:pro-sub-mode", // 上下文模式的子模式（system/user）
  IMAGE_SUB_MODE: "app:settings:ui:image-sub-mode", // 图像模式的子模式（text2image/image2image）
} as const;

// 模型选择相关
export const TEMPLATE_SELECTION_KEYS = {
  SYSTEM_OPTIMIZE_TEMPLATE: "app:selected-optimize-template", // 系统优化模板（兼容旧版本）
  USER_OPTIMIZE_TEMPLATE: "app:selected-user-optimize-template", // 用户优化模板
  ITERATE_TEMPLATE: "app:selected-iterate-template", // 迭代模板
  CONTEXT_SYSTEM_OPTIMIZE_TEMPLATE:
    "app:selected-context-system-optimize-template",
  CONTEXT_USER_OPTIMIZE_TEMPLATE: "app:selected-context-user-optimize-template",
  CONTEXT_ITERATE_TEMPLATE: "app:selected-context-iterate-template",
} as const;

// 图像模式选择相关
export const IMAGE_MODE_KEYS = {
  SELECTED_TEXT_MODEL: "app:image-mode:selected-text-model",
  SELECTED_IMAGE_MODEL: "app:image-mode:selected-image-model",
  // 按模式分别存储模板选择
  SELECTED_TEMPLATE_TEXT2IMAGE: "app:image-mode:selected-template:text2image",
  SELECTED_TEMPLATE_IMAGE2IMAGE: "app:image-mode:selected-template:image2image",
  SELECTED_ITERATE_TEMPLATE: "app:image-mode:selected-iterate-template",
  COMPARE_MODE_ENABLED: "app:image-mode:compare-mode-enabled",
} as const;

// 功能模型配置相关
export const FUNCTION_MODEL_KEYS = {
  // 全局评估模型
  EVALUATION_MODEL: "app:function-model:evaluation-model",
} as const;

/**
 * 生成模式覆盖的存储键
 * @param type 模型类型：'optimize' 或 'test'
 * @param functionMode 功能模式：'basic' | 'pro' | 'image'
 * @param subMode 子模式：'system' | 'user' | 'text2image' | 'image2image'
 * @returns 存储键，格式如 "app:function-model:optimize:basic:system"
 */
export function getModeModelKey(
  type: "optimize" | "test",
  functionMode: "basic" | "pro" | "image",
  subMode: "system" | "user" | "text2image" | "image2image"
): string {
  return `app:function-model:${type}:${functionMode}:${subMode}`;
}

// 所有存储键的联合类型
export const ALL_STORAGE_KEYS = {
  ...CORE_SERVICE_KEYS,
  ...UI_SETTINGS_KEYS,
  ...TEMPLATE_SELECTION_KEYS,
  ...IMAGE_MODE_KEYS,
  ...FUNCTION_MODEL_KEYS,
} as const;

// 导出所有键的数组（用于DataManager等需要遍历的场景）
export const ALL_STORAGE_KEYS_ARRAY = Object.values(ALL_STORAGE_KEYS);

// 类型定义
export type CoreServiceKey =
  (typeof CORE_SERVICE_KEYS)[keyof typeof CORE_SERVICE_KEYS];
export type UISettingsKey =
  (typeof UI_SETTINGS_KEYS)[keyof typeof UI_SETTINGS_KEYS];
export type TemplateSelectionKey =
  (typeof TEMPLATE_SELECTION_KEYS)[keyof typeof TEMPLATE_SELECTION_KEYS];
export type ImageModeKey =
  (typeof IMAGE_MODE_KEYS)[keyof typeof IMAGE_MODE_KEYS];
export type FunctionModelKey =
  (typeof FUNCTION_MODEL_KEYS)[keyof typeof FUNCTION_MODEL_KEYS];
export type StorageKey =
  (typeof ALL_STORAGE_KEYS)[keyof typeof ALL_STORAGE_KEYS];
