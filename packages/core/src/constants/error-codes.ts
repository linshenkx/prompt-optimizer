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
} as const;

// Model errors | 模型错误
export const MODEL_ERROR_CODES = {
  VALIDATION_ERROR: 'error.model.validation',
  CONFIG_ERROR: 'error.model.config',
} as const;

// Template errors | 模板错误
export const TEMPLATE_ERROR_CODES = {
  LOAD_ERROR: 'error.template.load',
  VALIDATION_ERROR: 'error.template.validation',
  CACHE_ERROR: 'error.template.cache',
  STORAGE_ERROR: 'error.template.storage',
} as const;

// Prompt errors | 提示词错误
export const PROMPT_ERROR_CODES = {
  OPTIMIZATION_ERROR: 'error.prompt.optimization',
  ITERATION_ERROR: 'error.prompt.iteration',
  TEST_ERROR: 'error.prompt.test',
  SERVICE_DEPENDENCY_ERROR: 'error.prompt.service_dependency',
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

// Export all error codes | 导出所有错误代码
export const ERROR_CODES = {
  EVALUATION: EVALUATION_ERROR_CODES,
  LLM: LLM_ERROR_CODES,
  HISTORY: HISTORY_ERROR_CODES,
  COMPARE: COMPARE_ERROR_CODES,
  STORAGE: STORAGE_ERROR_CODES,
  MODEL: MODEL_ERROR_CODES,
  TEMPLATE: TEMPLATE_ERROR_CODES,
  PROMPT: PROMPT_ERROR_CODES,
  FAVORITE: FAVORITE_ERROR_CODES,
} as const;

export type ErrorCode =
  | typeof EVALUATION_ERROR_CODES[keyof typeof EVALUATION_ERROR_CODES]
  | typeof LLM_ERROR_CODES[keyof typeof LLM_ERROR_CODES]
  | typeof HISTORY_ERROR_CODES[keyof typeof HISTORY_ERROR_CODES]
  | typeof COMPARE_ERROR_CODES[keyof typeof COMPARE_ERROR_CODES]
  | typeof STORAGE_ERROR_CODES[keyof typeof STORAGE_ERROR_CODES]
  | typeof MODEL_ERROR_CODES[keyof typeof MODEL_ERROR_CODES]
  | typeof TEMPLATE_ERROR_CODES[keyof typeof TEMPLATE_ERROR_CODES]
  | typeof PROMPT_ERROR_CODES[keyof typeof PROMPT_ERROR_CODES]
  | typeof FAVORITE_ERROR_CODES[keyof typeof FAVORITE_ERROR_CODES];
