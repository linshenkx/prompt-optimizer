export const VARIABLE_VALIDATION = {
  NAME_PATTERN: /^[^\s{}]+$/,
  NO_NUMBER_START_PATTERN: /^\d/u,
  FORBIDDEN_PREFIX_PATTERN: /^[#/^!>&]/u,
  RESERVED_NAMES: ['__proto__', 'prototype', 'constructor'] as const,
  MAX_NAME_LENGTH: 50,
  MAX_VALUE_LENGTH: 10000,
  VARIABLE_SCAN_PATTERN: /\{\{\s*([^\d{}\s][^{}\s]*)\s*\}\}/g,
} as const
export type ReservedVariableName = (typeof VARIABLE_VALIDATION.RESERVED_NAMES)[number]
export const isReservedVariableName = (name: string): name is ReservedVariableName =>
  (VARIABLE_VALIDATION.RESERVED_NAMES as readonly string[]).includes(name)
export type VariableNameValidationError = 'required' | 'tooLong' | 'forbiddenPrefix' | 'noNumberStart' | 'reservedName' | 'invalidCharacters'
export const getVariableNameValidationError = (name: string): VariableNameValidationError | null => {
  if (!name) return 'required'
  if (name.length > VARIABLE_VALIDATION.MAX_NAME_LENGTH) return 'tooLong'
  if (VARIABLE_VALIDATION.FORBIDDEN_PREFIX_PATTERN.test(name)) return 'forbiddenPrefix'
  if (VARIABLE_VALIDATION.NO_NUMBER_START_PATTERN.test(name)) return 'noNumberStart'
  if (isReservedVariableName(name)) return 'reservedName'
  if (!VARIABLE_VALIDATION.NAME_PATTERN.test(name)) return 'invalidCharacters'
  return null
}
export const isValidVariableName = (name: string): boolean => getVariableNameValidationError(name) === null
