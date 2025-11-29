import {
  type UnifiedParameterDefinition,
  type UnifiedParameterValueType,
  isSafeCustomKey,
  isValueEmpty
} from './parameter-schema'

/**
 * 智能解析自定义参数值，自动推断类型
 * - true/false -> boolean
 * - null -> null
 * - 整数/浮点数 -> number
 * - JSON 对象/数组 -> object/array
 * - 其他 -> string
 */
export function parseCustomValue(value: string): unknown {
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()

  // 布尔值
  if (lower === 'true') return true
  if (lower === 'false') return false

  // null
  if (lower === 'null') return null

  // 整数
  if (/^-?\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10)
    if (Number.isSafeInteger(num)) return num
  }

  // 浮点数
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    const num = parseFloat(trimmed)
    if (Number.isFinite(num)) return num
  }

  // JSON 对象或数组
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // 解析失败，作为字符串处理
    }
  }

  // 默认作为字符串
  return trimmed
}

export interface SplitOverridesResult {
  builtIn: Record<string, unknown>
  custom: Record<string, unknown>
}

export function splitOverridesBySchema(
  schema: readonly UnifiedParameterDefinition[],
  overrides?: Record<string, unknown>
): SplitOverridesResult {
  const builtIn: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}

  if (!overrides) {
    return { builtIn, custom }
  }

  const schemaMap = new Map(schema.map((def) => [def.name, def]))

  for (const [key, value] of Object.entries(overrides)) {
    if (schemaMap.has(key)) {
      builtIn[key] = value
    } else {
      custom[key] = value
    }
  }

  return { builtIn, custom }
}

export interface MergeOverridesOptions {
  schema: readonly UnifiedParameterDefinition[]
  includeDefaults?: boolean
  builtInOverrides?: Record<string, unknown>
  customOverrides?: Record<string, unknown>
  requestOverrides?: Record<string, unknown>
}

export function mergeOverrides({
  schema,
  includeDefaults = false,
  builtInOverrides,
  customOverrides,
  requestOverrides
}: MergeOverridesOptions): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const schemaMap = new Map(schema.map((def) => [def.name, def]))

  if (includeDefaults) {
    for (const def of schema) {
      const defaultVal = def.defaultValue ?? def.default
      if (defaultVal !== undefined && shouldEmitValue(def, defaultVal)) {
        result[def.name] = defaultVal
      }
    }
  }

  if (customOverrides) {
    for (const [key, value] of Object.entries(customOverrides)) {
      if (!isSafeCustomKey(key) || isValueEmpty(value)) {
        continue
      }
      result[key] = value
    }
  }

  if (builtInOverrides) {
    for (const [key, value] of Object.entries(builtInOverrides)) {
      const def = schemaMap.get(key)
      if (!def) continue
      if (!shouldEmitValue(def, value)) continue
      result[key] = value
    }
  }

  if (requestOverrides) {
    for (const [key, value] of Object.entries(requestOverrides)) {
      const def = schemaMap.get(key)
      if (def) {
        if (!shouldEmitValue(def, value)) continue
      } else {
        if (!isSafeCustomKey(key) || isValueEmpty(value)) continue
      }
      result[key] = value
    }
  }

  return result
}

export interface ParameterValidationError {
  parameterName: string
  parameterValue: unknown
  message: string
  expectedType?: UnifiedParameterValueType
  expectedRange?: string
}

export interface ParameterValidationWarning {
  parameterName: string
  parameterValue: unknown
  message: string
}

export interface ValidateOverridesOptions {
  schema: readonly UnifiedParameterDefinition[]
  overrides?: Record<string, unknown>
  customOverrides?: Record<string, unknown>
  allowUnknown?: boolean
}

export interface ParameterValidationResult {
  errors: ParameterValidationError[]
  warnings: ParameterValidationWarning[]
}

export function validateOverrides({
  schema,
  overrides,
  customOverrides,
  allowUnknown = true
}: ValidateOverridesOptions): ParameterValidationResult {
  const errors: ParameterValidationError[] = []
  const warnings: ParameterValidationWarning[] = []

  const schemaMap = new Map(schema.map((def) => [def.name, def]))

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      const def = schemaMap.get(key)

      if (!def) {
        if (!allowUnknown) {
          errors.push({
            parameterName: key,
            parameterValue: value,
            message: `Parameter '${key}' is not defined in schema.`
          })
        } else {
          if (!isSafeCustomKey(key)) {
            errors.push({
              parameterName: key,
              parameterValue: value,
              message: `Parameter '${key}' is potentially dangerous and not allowed.`
            })
          } else {
            warnings.push({
              parameterName: key,
              parameterValue: value,
              message: `Parameter '${key}' is not defined in schema and will be passed through as-is.`
            })
          }
        }
        continue
      }

      const validationError = validateValueAgainstDefinition(value, def)
      if (validationError) {
        errors.push(validationError)
      }
    }
  }

  if (customOverrides) {
    for (const [key, value] of Object.entries(customOverrides)) {
      if (!isSafeCustomKey(key)) {
        errors.push({
          parameterName: key,
          parameterValue: value,
          message: `Custom parameter '${key}' is potentially dangerous and not allowed.`
        })
        continue
      }

      if (isValueEmpty(value)) {
        warnings.push({
          parameterName: key,
          parameterValue: value,
          message: `Custom parameter '${key}' is empty and will be ignored.`
        })
      }
    }
  }

  return { errors, warnings }
}

function shouldEmitValue(def: UnifiedParameterDefinition, value: unknown): boolean {
  if (value === undefined || value === null) {
    return false
  }

  if (typeof value === 'string') {
    if (value === '') {
      return !!def.sendEmptyString
    }
    return true
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}

function validateValueAgainstDefinition(
  value: unknown,
  def: UnifiedParameterDefinition
): ParameterValidationError | null {
  if (def.tags?.includes('string-array')) {
    if (!Array.isArray(value)) {
      return {
        parameterName: def.name,
        parameterValue: value,
        message: `Parameter '${def.name}' should be a string array, but received ${typeof value}.`,
        expectedType: 'string'
      }
    }

    if (value.length === 0) {
      return {
        parameterName: def.name,
        parameterValue: value,
        message: `Parameter '${def.name}' cannot be an empty array.`,
        expectedType: 'string'
      }
    }

    const allStrings = value.every((item) => typeof item === 'string')
    if (!allStrings) {
      return {
        parameterName: def.name,
        parameterValue: value,
        message: `Parameter '${def.name}' array entries must all be strings.`,
        expectedType: 'string'
      }
    }

    return null
  }

  if (!shouldEmitValue(def, value)) {
    return {
      parameterName: def.name,
      parameterValue: value,
      message: `Parameter '${def.name}' is empty and will be ignored. Provide a value to override.`,
      expectedType: def.type
    }
  }

  if (!validateType(value, def.type)) {
    return {
      parameterName: def.name,
      parameterValue: value,
      message: `Parameter '${def.name}' should be of type ${def.type}, but received ${typeof value}.`,
      expectedType: def.type
    }
  }

  if ((def.type === 'number' || def.type === 'integer') && typeof value === 'number') {
    const min = def.minValue ?? def.min
    const max = def.maxValue ?? def.max

    if (min !== undefined && value < min) {
      return {
        parameterName: def.name,
        parameterValue: value,
        message: `Parameter '${def.name}' value ${value} is less than minimum value ${min}.`,
        expectedType: def.type,
        expectedRange: buildExpectedRange(def)
      }
    }

    if (max !== undefined && value > max) {
      return {
        parameterName: def.name,
        parameterValue: value,
        message: `Parameter '${def.name}' value ${value} is greater than maximum value ${max}.`,
        expectedType: def.type,
        expectedRange: buildExpectedRange(def)
      }
    }
  }

  if (def.allowedValues && def.allowedValues.length > 0) {
    if (typeof value !== 'string' || !def.allowedValues.includes(value)) {
      return {
        parameterName: def.name,
        parameterValue: value,
        message: `Parameter '${def.name}' must be one of: ${def.allowedValues.join(', ')}.`,
        expectedType: def.type
      }
    }
  }

  return null
}

function validateType(value: unknown, expectedType: UnifiedParameterValueType): boolean {
  switch (expectedType) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'string':
    default:
      return typeof value === 'string'
  }
}

function buildExpectedRange(def: UnifiedParameterDefinition): string | undefined {
  const min = def.minValue ?? def.min
  const max = def.maxValue ?? def.max

  if (min !== undefined && max !== undefined) {
    return `${min} - ${max}`
  }
  if (min !== undefined) {
    return `>= ${min}`
  }
  if (max !== undefined) {
    return `<= ${max}`
  }
  return undefined
}
