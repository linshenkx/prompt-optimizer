import { RequestConfigError } from './errors'
import type { TextRequestEvidence } from './types'

type PublicValue = TextRequestEvidence['parameters'][string]

const own = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key)
const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
const boolean = (value: unknown): value is boolean => typeof value === 'boolean'
const oneOf = (values: string[]) => (value: unknown): value is string =>
  typeof value === 'string' && values.includes(value)

const effort = oneOf(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
const summary = oneOf(['auto', 'concise', 'detailed'])
const visibleParameters: Readonly<Record<string, (value: unknown) => value is PublicValue>> = {
  temperature: finiteNumber,
  top_p: finiteNumber,
  presence_penalty: finiteNumber,
  frequency_penalty: finiteNumber,
  max_tokens: integer,
  max_completion_tokens: integer,
  max_output_tokens: integer,
  n: integer,
  seed: integer,
  logprobs: boolean,
  top_logprobs: integer,
  reasoning_effort: effort,
  service_tier: oneOf(['auto', 'default', 'flex', 'scale', 'priority']),
  store: boolean,
  timeout: integer,
}

function isVisibleParameter(name: string, value: unknown): value is PublicValue {
  return own(visibleParameters, name) && visibleParameters[name](value)
}

/** Use the same allowlist for saved evidence and provider projections. */
export function isPublicTextRequestParameters(value: unknown): value is TextRequestEvidence['parameters'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([name, parameter]) => {
    if (name === 'reasoning.effort') return effort(parameter)
    if (name === 'reasoning.summary') return summary(parameter)
    return isVisibleParameter(name, parameter)
  })
}

export function isPublicTextRequestOmissions(value: unknown): value is string[] {
  return Array.isArray(value) && new Set(value).size === value.length &&
    value.every((name: unknown) => typeof name === 'string' &&
      (name === 'other' || name === 'reasoning' || own(visibleParameters, name)))
}

const envelopeFields = new Set(['model', 'input', 'messages', 'stream'])
const hiddenContextFields = [
  'instructions', 'conversation', 'previous_response_id', 'prompt',
  'tools', 'tool_choice', 'functions', 'function_call', 'extra_body',
]

/** The source of truth is the constructed SDK payload, never the saved metadata. */
export function projectTextRequestEvidence(
  api: TextRequestEvidence['api'],
  request: { model: string }
): TextRequestEvidence {
  const fields = request as Record<string, unknown>
  const hasAdditionalContext = hiddenContextFields.some(key => {
    const value = fields[key]
    return own(fields, key) && value != null && (!Array.isArray(value) || value.length > 0)
  })
  if (hasAdditionalContext || fields.background === true) {
    throw new RequestConfigError('Text comparisons require foreground requests with no tools or extra context')
  }

  const parameters: TextRequestEvidence['parameters'] = {}
  const omitted = new Set<string>()
  for (const key of Object.keys(fields).sort()) {
    if (envelopeFields.has(key)) continue
    const value = fields[key]
    if (value === undefined) continue
    if (key === 'reasoning' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const reasoning = value as Record<string, unknown>
      if (effort(reasoning.effort)) parameters['reasoning.effort'] = reasoning.effort
      if (summary(reasoning.summary)) parameters['reasoning.summary'] = reasoning.summary
      if (Object.keys(reasoning).some(name => name === 'effort' ? !effort(reasoning[name]) : name !== 'summary' || !summary(reasoning[name]))) {
        omitted.add('reasoning')
      }
      continue
    }
    if (!own(visibleParameters, key)) {
      omitted.add('other')
      continue
    }
    if (isVisibleParameter(key, value)) parameters[key] = value
    else omitted.add(key)
  }
  return { modelId: request.model, api, parameters, omittedParameterNames: [...omitted].sort() }
}
