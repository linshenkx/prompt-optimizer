import {
  buildPromptExecutionContext,
  isValidVariableName,
  MAX_VARIABLE_VALUE_LENGTH,
  PromptRenderLimitError,
  scanVariableNames,
} from '../../utils/prompt-variables'
import { createAssetReadAccess } from '../asset-reader/reader'
import type { AssetReadPagination, AssetReadStorage, PublicStoredModel } from '../asset-reader/types'
import { record, text } from '../asset-reader/validation'
import { PREDEFINED_VARIABLES } from '../context/constants'
import type { TextComparisonLLM } from './types'
import type { ITextAdapterRegistry, TextRequestEvidence } from '../llm/types'
import { projectTextRequestEvidence } from '../llm/request-evidence'
import { isTextModelConfig } from '../model/converter'
import { describeRuntimeModel, resolveRuntimeTextModel } from '../model/runtime-selection'
import type { TextModelConfig } from '../model/types'
import { TextComparisonError } from './errors'
import type { TextComparisonErrorCode } from './errors'
import { object } from './validation'
import type {
  ComparisonExecutionSource,
  PrepareTextComparison,
  TextComparisonPromptSnapshot,
  TextComparisonRequest,
  TextComparisonRun,
  TextComparisonSource,
} from './types'

const MAX_PROMPT_LENGTH = 64 * 1024
const VARIABLE_PREFERENCE_KEY = 'pref:variableManager.storage'
const PREDEFINED_NAMES = new Set<string>(PREDEFINED_VARIABLES)
const SUPPORTED_PROVIDERS = new Set(['openai', 'openai-compatible'])

type UnavailableModelReason = Exclude<PublicStoredModel['unavailableReason'], 'EXECUTION_NOT_CONNECTED'>
  | 'MODEL_EXECUTION_UNSUPPORTED' | 'MODEL_CONFIGURATION_INVALID'

export type ExecutableStoredModel = Omit<PublicStoredModel, 'executable' | 'unavailableReason'> & {
  executable: boolean
  unavailableReason?: UnavailableModelReason
}

interface ModelEntry {
  raw: Record<string, unknown>
  model: PublicStoredModel
}

export interface PreparedComparisonCandidate {
  config: TextModelConfig
  model: TextComparisonRun['model']
  effective: TextComparisonRun['effective'] & { preview: TextRequestEvidence }
}

function optionalRecord(value: unknown) {
  return value === undefined || record(value)
}

function validConfig(value: unknown): value is TextModelConfig {
  return isTextModelConfig(value) && record(value.connectionConfig) &&
    Array.isArray(value.modelMeta.parameterDefinitions) &&
    value.modelMeta.parameterDefinitions.every(item => record(item) && text(item.name) && !['__proto__', 'prototype', 'constructor'].includes(item.name)) &&
    optionalRecord(value.paramOverrides) && optionalRecord(value.customParamOverrides)
}

function isCredentialFieldValid(config: TextModelConfig, field: 'baseURL' | 'apiKey') {
  const value = config.connectionConfig[field]
  return value === undefined || typeof value === 'string'
}

function inspectCandidate(
  entry: ModelEntry,
  registry: ITextAdapterRegistry,
  llm: TextComparisonLLM,
): PreparedComparisonCandidate | UnavailableModelReason {
  const { model, raw } = entry
  if (model.unavailableReason !== 'EXECUTION_NOT_CONNECTED') return model.unavailableReason
  if (!SUPPORTED_PROVIDERS.has(model.providerId)) return 'MODEL_EXECUTION_UNSUPPORTED'
  if (!validConfig(raw) || !isCredentialFieldValid(raw, 'baseURL') || !isCredentialFieldValid(raw, 'apiKey')) {
    return 'MODEL_CONFIGURATION_INVALID'
  }
  try {
    const adapter = registry.getAdapter(model.providerId)
    if (!adapter.describeStreamRequest) return 'MODEL_EXECUTION_UNSUPPORTED'
    if (adapter.getProvider().requiresApiKey && !text(raw.connectionConfig.apiKey)) return 'MODEL_CONFIGURATION_INVALID'

    const config = resolveRuntimeTextModel(structuredClone(raw), { modelId: model.modelId }, registry)
    const preview = llm.describeStreamRequest(config)
    if (!preview || preview.modelId !== model.modelId) return 'MODEL_CONFIGURATION_INVALID'
    const declared = projectTextRequestEvidence(preview.api, { ...describeRuntimeModel(config).parameters, model: model.modelId })
    const effective: PreparedComparisonCandidate['effective'] = {
      parameterCoverage: 'declared',
      parameters: declared.parameters,
      omittedParameterNames: Array.from(new Set([...declared.omittedParameterNames, ...preview.omittedParameterNames])).sort(),
      requestEvidence: 'pending',
      preview,
    }
    return {
      config,
      model: { configKey: model.configKey, name: model.name, providerId: model.providerId, modelId: model.modelId },
      effective,
    }
  } catch {
    // Configuration and adapter errors can contain private connection details.
    return 'MODEL_CONFIGURATION_INVALID'
  }
}

export function validateComparisonSelection(input: PrepareTextComparison) {
  if (!record(input) || !record(input.source) || !record(input.variables) ||
    ![input.source.favoriteId, input.source.assetId, input.source.versionId, input.source.expectedRevision].every(text) ||
    !Array.isArray(input.candidates) || input.candidates.length !== 2 ||
    input.candidates[0]?.id !== 'a' || input.candidates[1]?.id !== 'b' ||
    !input.candidates.every(candidate => text(candidate.configKey) && text(candidate.expectedRevision))) {
    throw new TextComparisonError('INVALID_INPUT')
  }

  const { candidatePrompt, candidates: [baseline, candidate], source } = input
  const sameModel = baseline.configKey === candidate.configKey
  if (candidatePrompt === undefined) {
    if (sameModel) throw new TextComparisonError('INVALID_INPUT')
  } else {
    if (!sameModel || baseline.expectedRevision !== candidate.expectedRevision) throw new TextComparisonError('INVALID_INPUT')
    if (object(candidatePrompt, ['kind', 'text']) && candidatePrompt.kind === 'draft' && text(candidatePrompt.text)) {
      if (candidatePrompt.text.length > MAX_PROMPT_LENGTH) throw new TextComparisonError('TEXT_LIMIT')
    } else if (!object(candidatePrompt, ['kind', 'versionId']) || candidatePrompt.kind !== 'saved-version' ||
      !text(candidatePrompt.versionId) || candidatePrompt.versionId === source.versionId) {
      throw new TextComparisonError('INVALID_INPUT')
    }
  }

  let suppliedLength = 0
  for (const [name, value] of Object.entries(input.variables)) {
    if (!isValidVariableName(name) || PREDEFINED_NAMES.has(name) || typeof value !== 'string' ||
      value.length > MAX_VARIABLE_VALUE_LENGTH) throw new TextComparisonError('INVALID_INPUT')
    suppliedLength += name.length + value.length
    if (suppliedLength > MAX_PROMPT_LENGTH) throw new TextComparisonError('TEXT_LIMIT')
  }
}

async function readSavedVariables(storage: AssetReadStorage): Promise<Record<string, string>> {
  try {
    const raw = await storage.getItem(VARIABLE_PREFERENCE_KEY)
    if (raw === null) return {}
    const data: unknown = JSON.parse(raw)
    if (!record(data) || !record(data.customVariables)) throw new TextComparisonError('INVALID_VARIABLE_STORAGE')
    return Object.fromEntries(Object.entries(data.customVariables).filter(
      (item): item is [string, string] =>
        isValidVariableName(item[0]) && !PREDEFINED_NAMES.has(item[0]) && typeof item[1] === 'string',
    ))
  } catch {
    throw new TextComparisonError('INVALID_VARIABLE_STORAGE')
  }
}

function prepareRequest(
  sourcePrompt: string,
  savedVariables: Record<string, string>,
  suppliedVariables: Record<string, string>,
): TextComparisonRequest {
  const rawPrompt = sourcePrompt.trim()
  if (!rawPrompt) throw new TextComparisonError('ASSET_CONTENT_UNSUPPORTED')
  if (rawPrompt.length > MAX_PROMPT_LENGTH) throw new TextComparisonError('TEXT_LIMIT')

  const merged: Record<string, string> = { ...savedVariables, ...suppliedVariables, currentPrompt: rawPrompt, userQuestion: rawPrompt }
  const used = scanVariableNames(rawPrompt)
  const variables = Object.fromEntries(used.filter(name => Object.prototype.hasOwnProperty.call(merged, name)).map(
    name => [name, merged[name]],
  ))
  if (Object.values(variables).reduce((size, value) => size + value.length, 0) > MAX_PROMPT_LENGTH * 3) {
    throw new TextComparisonError('TEXT_LIMIT')
  }

  try {
    const ctx = buildPromptExecutionContext(rawPrompt, variables, MAX_PROMPT_LENGTH)
    if (ctx.forbiddenTemplateSyntax.length) throw new TextComparisonError('FORBIDDEN_TEMPLATE_SYNTAX')
    if (ctx.missingVariables.length) throw new TextComparisonError('MISSING_VARIABLES', ctx.missingVariables)
    if (!ctx.renderedContent.trim()) throw new TextComparisonError('ASSET_CONTENT_UNSUPPORTED')
    return { rawPrompt, messages: [{ role: 'user', content: ctx.renderedContent }], variables }
  } catch (error) {
    if (error instanceof PromptRenderLimitError) throw new TextComparisonError('TEXT_LIMIT')
    throw error
  }
}

export function createComparisonPreparation(
  storage: AssetReadStorage,
  executionSource: ComparisonExecutionSource,
  registry: ITextAdapterRegistry,
  llm: TextComparisonLLM,
) {
  const access = createAssetReadAccess(storage, executionSource)
  return {
    reader: access.reader,
    listModels(options: AssetReadPagination = {}) {
      return access.listModels(options, ({ model: { unavailableReason, executable, ...description }, raw }): ExecutableStoredModel => {
        const candidate = inspectCandidate({ model: { ...description, unavailableReason, executable }, raw }, registry, llm)
        return typeof candidate === 'string'
          ? { ...description, executable: false, unavailableReason: candidate }
          : { ...description, executable: true }
      })
    },
    async prepare(input: PrepareTextComparison): Promise<{
      source: TextComparisonSource
      request: TextComparisonRequest
      candidatePrompt?: TextComparisonPromptSnapshot
      candidates: [PreparedComparisonCandidate, PreparedComparisonCandidate]
    }> {
      const { candidates, source, variables, candidatePrompt } = input
      const [asset, models, savedVariables] = await Promise.all([
        access.reader.getAssetVersion(source),
        access.readStoredModels(candidates.map(candidate => candidate.configKey)),
        readSavedVariables(storage),
      ])
      if (asset.modeKey !== 'pro-variable') throw new TextComparisonError('ASSET_CONTENT_UNSUPPORTED')

      const request = prepareRequest(asset.content.text, savedVariables, variables)
      let candidateSnapshot: TextComparisonPromptSnapshot | undefined
      if (candidatePrompt?.kind === 'draft') {
        candidateSnapshot = { kind: 'draft', request: prepareRequest(candidatePrompt.text, savedVariables, variables) }
      } else if (candidatePrompt) {
        const selected = await access.reader.getAssetVersion({ ...source, versionId: candidatePrompt.versionId })
        candidateSnapshot = {
          kind: 'saved-version',
          versionId: selected.versionId,
          version: selected.version,
          request: prepareRequest(selected.content.text, savedVariables, variables),
        }
      }
      function resolveCandidate(selection: PrepareTextComparison['candidates'][number]): PreparedComparisonCandidate {
        const entry = models.find(item => item.model.configKey === selection.configKey)
        if (!entry) throw new TextComparisonError('MODEL_NOT_FOUND')
        if (entry.model.revision !== selection.expectedRevision) throw new TextComparisonError('REVISION_CONFLICT')
        const candidate = inspectCandidate(entry, registry, llm)
        if (typeof candidate === 'string') throw new TextComparisonError(candidate satisfies TextComparisonErrorCode)
        return candidate
      }
      const baseline = resolveCandidate(candidates[0])
      return {
        source: {
          favoriteId: asset.favoriteId,
          assetId: asset.assetId,
          versionId: asset.versionId,
          expectedRevision: asset.revision,
          title: asset.title,
        },
        request,
        candidatePrompt: candidateSnapshot,
        candidates: [baseline, candidateSnapshot ? structuredClone(baseline) : resolveCandidate(candidates[1])],
      }
    },
  }
}
