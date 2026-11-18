export type TextComparisonErrorCode =
  | 'INVALID_INPUT'
  | 'ASSET_CONTENT_UNSUPPORTED'
  | 'INVALID_VARIABLE_STORAGE'
  | 'MISSING_VARIABLES'
  | 'FORBIDDEN_TEMPLATE_SYNTAX'
  | 'TEXT_LIMIT'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_DISABLED'
  | 'MODEL_REQUIRES_MIGRATION'
  | 'MODEL_METADATA_MISMATCH'
  | 'MODEL_EXECUTION_UNSUPPORTED'
  | 'MODEL_CONFIGURATION_INVALID'
  | 'REVISION_CONFLICT'
  | 'STALE_PREPARATION'
  | 'PREPARATION_NOT_FOUND'
  | 'PREPARATION_LIMIT'
  | 'RUN_NOT_FOUND'
  | 'COMPARISON_NOT_RUNNING'
  | 'COMPARISON_NOT_COMPLETE'
  | 'COMPARISON_SERVICE_CLOSED'

export class TextComparisonError extends Error {
  constructor(readonly code: TextComparisonErrorCode, readonly missingVariables?: readonly string[]) {
    super(code === 'MISSING_VARIABLES' && missingVariables?.length
      ? 'Missing variables: ' + missingVariables.join(', ')
      : 'Text comparison request failed (' + code + ').')
    this.name = 'TextComparisonError'
  }
}
