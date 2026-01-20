/**
 * Centralized error codes for internationalization support.
 * These codes are language-neutral identifiers that the UI layer
 * translates to the user's preferred language.
 *
 * 集中式错误代码，用于国际化支持。
 * 这些代码是语言中立的标识符，UI层会根据用户偏好语言进行翻译。
 */

// Evaluation errors | 评估错误
export const EVALUATION_ERROR_CODES = {
  VALIDATION_ERROR: 'error.evaluation.validation',
  MODEL_NOT_FOUND: 'error.evaluation.model_not_found',
  TEMPLATE_NOT_FOUND: 'error.evaluation.template_not_found',
  PARSE_ERROR: 'error.evaluation.parse',
  EXECUTION_ERROR: 'error.evaluation.execution',
} as const;

// LLM errors | LLM错误
export const LLM_ERROR_CODES = {
  API_ERROR: 'error.llm.api',
  CONFIG_ERROR: 'error.llm.config',
  VALIDATION_ERROR: 'error.llm.validation',
  INITIALIZATION_ERROR: 'error.llm.initialization',
  API_KEY_REQUIRED: 'error.llm.api_key_required',
  MODEL_NOT_FOUND: 'error.llm.model_not_found',
  TEMPLATE_INVALID: 'error.llm.template_invalid',
  EMPTY_INPUT: 'error.llm.empty_input',
  OPTIMIZATION_FAILED: 'error.llm.optimization_failed',
  ITERATION_FAILED: 'error.llm.iteration_failed',
  TEST_FAILED: 'error.llm.test_failed',
  MODEL_KEY_REQUIRED: 'error.llm.model_key_required',
  INPUT_TOO_LONG: 'error.llm.input_too_long',
} as const;

// History errors | 历史记录错误
export const HISTORY_ERROR_CODES = {
  NOT_FOUND: 'error.history.not_found',
  CHAIN_ERROR: 'error.history.chain',
  RECORD_NOT_FOUND: 'error.history.record_not_found',
  STORAGE_ERROR: 'error.history.storage',
  VALIDATION_ERROR: 'error.history.validation',
} as const;

// Compare errors | 对比错误
export const COMPARE_ERROR_CODES = {
  VALIDATION_ERROR: 'error.compare.validation',
  CALCULATION_ERROR: 'error.compare.calculation',
} as const;

// Storage errors | 存储错误
export const STORAGE_ERROR_CODES = {
  READ_ERROR: 'error.storage.read',
  WRITE_ERROR: 'error.storage.write',
  DELETE_ERROR: 'error.storage.delete',
  CLEAR_ERROR: 'error.storage.clear',
  CONFIG_ERROR: 'error.storage.config',
} as const;

// Model errors | 模型错误
export const MODEL_ERROR_CODES = {
  VALIDATION_ERROR: 'error.model.validation',
  CONFIG_ERROR: 'error.model.config',
} as const;

// Template errors | 模板错误
export const TEMPLATE_ERROR_CODES = {
  LOAD_ERROR: 'error.template.load',
  NOT_FOUND: 'error.template.not_found',
  VALIDATION_ERROR: 'error.template.validation',
  CACHE_ERROR: 'error.template.cache',
  STORAGE_ERROR: 'error.template.storage',
} as const;

// Context errors | 上下文错误
export const CONTEXT_ERROR_CODES = {
  NOT_FOUND: 'error.context.not_found',
  MINIMUM_VIOLATION: 'error.context.minimum_violation',
  INVALID_ID: 'error.context.invalid_id',
  IMPORT_FORMAT_ERROR: 'error.context.import_format',
  INVALID_STORE: 'error.context.invalid_store',
  STORAGE_ERROR: 'error.context.storage',
  ELECTRON_API_UNAVAILABLE: 'error.context.electron_api_unavailable',
} as const;

// Prompt errors | 提示词错误
export const PROMPT_ERROR_CODES = {
  OPTIMIZATION_ERROR: 'error.prompt.optimization',
  ITERATION_ERROR: 'error.prompt.iteration',
  TEST_ERROR: 'error.prompt.test',
  SERVICE_DEPENDENCY_ERROR: 'error.prompt.service_dependency',
} as const;

// Variable extraction errors | 变量提取错误
export const VARIABLE_EXTRACTION_ERROR_CODES = {
  VALIDATION_ERROR: 'error.variable_extraction.validation',
  MODEL_NOT_FOUND: 'error.variable_extraction.model_not_found',
  PARSE_ERROR: 'error.variable_extraction.parse',
  EXECUTION_ERROR: 'error.variable_extraction.execution',
} as const;

// Variable value generation errors | 变量值生成错误
export const VARIABLE_VALUE_GENERATION_ERROR_CODES = {
  VALIDATION_ERROR: 'error.variable_value_generation.validation',
  MODEL_NOT_FOUND: 'error.variable_value_generation.model_not_found',
  PARSE_ERROR: 'error.variable_value_generation.parse',
  EXECUTION_ERROR: 'error.variable_value_generation.execution',
} as const;

// Favorite errors | 收藏错误
export const FAVORITE_ERROR_CODES = {
  NOT_FOUND: 'error.favorite.not_found',
  ALREADY_EXISTS: 'error.favorite.already_exists',
  CATEGORY_NOT_FOUND: 'error.favorite.category_not_found',
  VALIDATION_ERROR: 'error.favorite.validation',
  STORAGE_ERROR: 'error.favorite.storage',
  TAG_ERROR: 'error.favorite.tag',
  TAG_ALREADY_EXISTS: 'error.favorite.tag_already_exists',
  TAG_NOT_FOUND: 'error.favorite.tag_not_found',
  MIGRATION_ERROR: 'error.favorite.migration',
  IMPORT_EXPORT_ERROR: 'error.favorite.import_export',
} as const;

// Image errors | 图像错误
export const IMAGE_ERROR_CODES = {
  PROMPT_EMPTY: 'error.image.prompt_empty',
  CONFIG_ID_EMPTY: 'error.image.config_id_empty',
  CONFIG_NOT_FOUND: 'error.image.config_not_found',
  CONFIG_NOT_ENABLED: 'error.image.config_not_enabled',
  CONFIG_ALREADY_EXISTS: 'error.image.config_already_exists',
  CONFIG_DOES_NOT_EXIST: 'error.image.config_does_not_exist',
  CONFIG_INVALID: 'error.image.config_invalid',
  API_KEY_REQUIRED: 'error.image.api_key_required',
  MODEL_ID_REQUIRED: 'error.image.model_id_required',
  CONFIG_PROVIDER_MISMATCH: 'error.image.config_provider_mismatch',
  CONNECTION_CONFIG_MISSING_FIELD: 'error.image.connection_config_missing_field',
  CONNECTION_CONFIG_INVALID_FIELD_TYPE: 'error.image.connection_config_invalid_field_type',
  PROVIDER_NOT_FOUND: 'error.image.provider_not_found',
  DYNAMIC_MODELS_NOT_SUPPORTED: 'error.image.dynamic_models_not_supported',
  UNSUPPORTED_TEST_TYPE: 'error.image.unsupported_test_type',
  INVALID_RESPONSE_FORMAT: 'error.image.invalid_response_format',
  BASE64_DECODING_NOT_SUPPORTED: 'error.image.base64_decoding_not_supported',
  ONLY_SINGLE_IMAGE_SUPPORTED: 'error.image.only_single_image_supported',
  TEXT2IMAGE_INPUT_IMAGE_NOT_ALLOWED: 'error.image.text2image_input_image_not_allowed',
  IMAGE2IMAGE_INPUT_IMAGE_REQUIRED: 'error.image.image2image_input_image_required',
  INPUT_IMAGE_B64_REQUIRED: 'error.image.input_image_b64_required',
  INPUT_IMAGE_URL_NOT_SUPPORTED: 'error.image.input_image_url_not_supported',
  INPUT_IMAGE_INVALID_FORMAT: 'error.image.input_image_invalid_format',
  INPUT_IMAGE_UNSUPPORTED_MIME: 'error.image.input_image_unsupported_mime',
  INPUT_IMAGE_TOO_LARGE: 'error.image.input_image_too_large',
  MODEL_NOT_SUPPORT_TEXT2IMAGE: 'error.image.model_not_support_text2image',
  MODEL_NOT_SUPPORT_IMAGE2IMAGE: 'error.image.model_not_support_image2image',
  MODEL_ONLY_SUPPORTS_IMAGE2IMAGE_NEED_INPUT: 'error.image.model_only_supports_image2image_need_input',
  GENERATION_FAILED: 'error.image.generation_failed',
} as const;

// Import/export errors | 导入导出错误
export const IMPORT_EXPORT_ERROR_CODES = {
  EXPORT_FAILED: 'error.import_export.export_failed',
  IMPORT_FAILED: 'error.import_export.import_failed',
  VALIDATION_ERROR: 'error.import_export.validation',
} as const;

// Data manager errors | 数据管理错误
export const DATA_ERROR_CODES = {
  INVALID_JSON: 'error.data.invalid_json',
  INVALID_FORMAT: 'error.data.invalid_format',
  IMPORT_PARTIAL_FAILED: 'error.data.import_partial_failed',
  EXPORT_FAILED: 'error.data.export_failed',
  ELECTRON_API_UNAVAILABLE: 'error.data.electron_api_unavailable',
} as const;

// Core/internal errors | 核心/内部错误
export const CORE_ERROR_CODES = {
  IPC_SERIALIZATION_FAILED: 'error.core.ipc_serialization_failed',
} as const;

// Export all error codes | 导出所有错误代码
export const ERROR_CODES = {
  EVALUATION: EVALUATION_ERROR_CODES,
  LLM: LLM_ERROR_CODES,
  HISTORY: HISTORY_ERROR_CODES,
  COMPARE: COMPARE_ERROR_CODES,
  STORAGE: STORAGE_ERROR_CODES,
  MODEL: MODEL_ERROR_CODES,
  TEMPLATE: TEMPLATE_ERROR_CODES,
  CONTEXT: CONTEXT_ERROR_CODES,
  PROMPT: PROMPT_ERROR_CODES,
  VARIABLE_EXTRACTION: VARIABLE_EXTRACTION_ERROR_CODES,
  VARIABLE_VALUE_GENERATION: VARIABLE_VALUE_GENERATION_ERROR_CODES,
  FAVORITE: FAVORITE_ERROR_CODES,
  IMAGE: IMAGE_ERROR_CODES,
  IMPORT_EXPORT: IMPORT_EXPORT_ERROR_CODES,
  DATA: DATA_ERROR_CODES,
  CORE: CORE_ERROR_CODES,
} as const;

export type ErrorCode =
  | typeof EVALUATION_ERROR_CODES[keyof typeof EVALUATION_ERROR_CODES]
  | typeof LLM_ERROR_CODES[keyof typeof LLM_ERROR_CODES]
  | typeof HISTORY_ERROR_CODES[keyof typeof HISTORY_ERROR_CODES]
  | typeof COMPARE_ERROR_CODES[keyof typeof COMPARE_ERROR_CODES]
  | typeof STORAGE_ERROR_CODES[keyof typeof STORAGE_ERROR_CODES]
  | typeof MODEL_ERROR_CODES[keyof typeof MODEL_ERROR_CODES]
  | typeof TEMPLATE_ERROR_CODES[keyof typeof TEMPLATE_ERROR_CODES]
  | typeof CONTEXT_ERROR_CODES[keyof typeof CONTEXT_ERROR_CODES]
  | typeof PROMPT_ERROR_CODES[keyof typeof PROMPT_ERROR_CODES]
  | typeof VARIABLE_EXTRACTION_ERROR_CODES[keyof typeof VARIABLE_EXTRACTION_ERROR_CODES]
  | typeof VARIABLE_VALUE_GENERATION_ERROR_CODES[keyof typeof VARIABLE_VALUE_GENERATION_ERROR_CODES]
  | typeof FAVORITE_ERROR_CODES[keyof typeof FAVORITE_ERROR_CODES]
  | typeof IMAGE_ERROR_CODES[keyof typeof IMAGE_ERROR_CODES]
  | typeof IMPORT_EXPORT_ERROR_CODES[keyof typeof IMPORT_EXPORT_ERROR_CODES]
  | typeof DATA_ERROR_CODES[keyof typeof DATA_ERROR_CODES]
  | typeof CORE_ERROR_CODES[keyof typeof CORE_ERROR_CODES];

/**
 * i18n interpolation params for error messages.
 */
export type ErrorParams = Record<
  string,
  string | number | boolean | null | undefined
>;
