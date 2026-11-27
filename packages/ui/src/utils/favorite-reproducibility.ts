import {
  PROMPT_MODEL_SCHEMA_VERSION,
  promptAssetFromFavorite,
  type ConversationMessage,
  type FavoritePrompt,
  type PromptAsset,
  type PromptExample,
  type PromptImageRef,
  type PromptSourceRef,
  type PromptVariable,
} from '@prompt-optimizer/core'

export type FavoriteReproducibilitySource =
  | 'none'
  | 'garden'
  | 'reproducibility'
  | 'metadata'
  | 'promptAsset'

export type FavoriteReproducibilityVariable = {
  name: string
  description?: string
  type?: 'string' | 'number' | 'boolean' | 'enum'
  required: boolean
  defaultValue?: string
  options: string[]
  source?: string
}

export type FavoriteReproducibilityExample = {
  id?: string
  basedOnVersionId?: string
  text?: string
  description?: string
  source?: PromptSourceRef
  messages?: ConversationMessage[]
  parameters: Record<string, string>
  outputText?: string
  images: string[]
  imageAssetIds: string[]
  inputImages: string[]
  inputImageAssetIds: string[]
  metadata?: Record<string, unknown>
}

export type FavoriteReproducibility = {
  source: FavoriteReproducibilitySource
  variables: FavoriteReproducibilityVariable[]
  examples: FavoriteReproducibilityExample[]
  variableCount: number
  exampleCount: number
  hasInputImages: boolean
  hasData: boolean
}

export type FavoriteReproducibilityDraft = {
  variables: FavoriteReproducibilityVariable[]
  examples: FavoriteReproducibilityExample[]
}

export type FavoriteReproducibilityProjection = {
  promptAsset: PromptAsset | null
  reproducibility: FavoriteReproducibility
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const asTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asTrimmedString(item))
    .filter((item): item is string => Boolean(item))
}

const dedupeStrings = (items: string[]): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

const EXAMPLE_ID_PATTERN = /^ex-(\d+)$/iu

export const isInternalTestRunExampleId = (id: string | undefined): boolean =>
  Boolean(id?.trim().startsWith('test-run:'))

export const formatFavoriteExampleId = (sequence: number): string =>
  `ex-${String(Math.max(1, sequence)).padStart(3, '0')}`

const readFavoriteExampleIdSequence = (id: string | undefined): number => {
  const match = id?.trim().match(EXAMPLE_ID_PATTERN)
  if (!match) return 0
  const sequence = Number(match[1])
  return Number.isFinite(sequence) ? sequence : 0
}

const getNextFavoriteExampleSequence = (
  examples: Array<{ id?: string }>,
): number => {
  const maxExplicitSequence = examples.reduce(
    (max, example) => Math.max(max, readFavoriteExampleIdSequence(example.id)),
    0,
  )
  return Math.max(maxExplicitSequence, examples.length) + 1
}

export const assignSequentialFavoriteExampleIds = (
  existingExamples: FavoriteReproducibilityExample[],
  incomingExamples: FavoriteReproducibilityExample[],
): FavoriteReproducibilityExample[] => {
  let nextSequence = getNextFavoriteExampleSequence(existingExamples)
  const usedIds = new Set(
    existingExamples
      .map((example) => asTrimmedString(example.id))
      .filter((id): id is string => Boolean(id)),
  )

  return incomingExamples.map((example) => {
    const currentId = asTrimmedString(example.id)
    if (currentId && !isInternalTestRunExampleId(currentId) && !usedIds.has(currentId)) {
      usedIds.add(currentId)
      return { ...example, id: currentId }
    }

    while (usedIds.has(formatFavoriteExampleId(nextSequence))) {
      nextSequence += 1
    }
    const id = formatFavoriteExampleId(nextSequence)
    usedIds.add(id)
    nextSequence += 1
    return { ...example, id }
  })
}

const parseParameters = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) return {}

  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = key.trim()
    if (!normalizedKey || raw === undefined || raw === null) continue
    out[normalizedKey] = String(raw)
  }
  return out
}

const parseMessages = (value: unknown): ConversationMessage[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ConversationMessage | null => {
      if (!isPlainObject(item)) return null
      if (
        item.role !== 'system' &&
        item.role !== 'user' &&
        item.role !== 'assistant' &&
        item.role !== 'tool'
      ) {
        return null
      }

      const content = typeof item.content === 'string' ? item.content : ''
      return {
        ...(asTrimmedString(item.id) ? { id: asTrimmedString(item.id) } : {}),
        role: item.role,
        content,
        ...(asTrimmedString(item.originalContent)
          ? { originalContent: asTrimmedString(item.originalContent) }
          : {}),
        ...(asTrimmedString(item.name) ? { name: asTrimmedString(item.name) } : {}),
        ...(Array.isArray(item.tool_calls) ? { tool_calls: item.tool_calls as ConversationMessage['tool_calls'] } : {}),
        ...(asTrimmedString(item.tool_call_id) ? { tool_call_id: asTrimmedString(item.tool_call_id) } : {}),
      }
    })
    .filter((item): item is ConversationMessage => Boolean(item))
}

const parseMetadata = (value: unknown): Record<string, unknown> | undefined =>
  isPlainObject(value) ? { ...value } : undefined

const parseSource = (value: unknown): PromptSourceRef | undefined => {
  if (!isPlainObject(value)) return undefined

  const kind = asTrimmedString(value.kind)
  if (
    kind !== 'workspace' &&
    kind !== 'favorite' &&
    kind !== 'garden' &&
    kind !== 'history' &&
    kind !== 'external' &&
    kind !== 'unknown'
  ) {
    return undefined
  }

  return {
    kind,
    ...(asTrimmedString(value.id) ? { id: asTrimmedString(value.id) } : {}),
    ...(asTrimmedString(value.label) ? { label: asTrimmedString(value.label) } : {}),
    ...(asTrimmedString(value.url) ? { url: asTrimmedString(value.url) } : {}),
    ...(parseMetadata(value.metadata) ? { metadata: parseMetadata(value.metadata) } : {}),
  }
}

const normalizeVariableType = (value: unknown): FavoriteReproducibilityVariable['type'] => {
  return value === 'string' || value === 'number' || value === 'boolean' || value === 'enum'
    ? value
    : undefined
}

const parseVariable = (value: unknown): FavoriteReproducibilityVariable | null => {
  if (!isPlainObject(value)) return null

  const name = asTrimmedString(value.name)
  if (!name) return null

  return {
    name,
    description: asTrimmedString(value.description),
    type: normalizeVariableType(value.type),
    required: value.required === true,
    defaultValue: asTrimmedString(value.defaultValue ?? value.default ?? value.value),
    options: dedupeStrings(asStringArray(value.options)),
    source: asTrimmedString(value.source),
  }
}

const parseVariables = (value: unknown): FavoriteReproducibilityVariable[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseVariable(item))
      .filter((item): item is FavoriteReproducibilityVariable => Boolean(item))
  }

  if (!isPlainObject(value)) return []

  const variables: FavoriteReproducibilityVariable[] = []
  for (const [name, raw] of Object.entries(value)) {
    const normalizedName = name.trim()
    if (!normalizedName) continue

    variables.push({
      name: normalizedName,
      required: false,
      defaultValue: raw === undefined || raw === null ? undefined : String(raw),
      options: [],
    })
  }
  return variables
}

const parseExample = (value: unknown): FavoriteReproducibilityExample | null => {
  if (!isPlainObject(value)) return null

  const url = asTrimmedString(value.url)
  const images = dedupeStrings([
    ...(url ? [url] : []),
    ...asStringArray(value.images),
  ])

  const example: FavoriteReproducibilityExample = {
    id: asTrimmedString(value.id),
    basedOnVersionId: asTrimmedString(value.basedOnVersionId),
    text: asTrimmedString(value.text),
    description: asTrimmedString(value.description),
    source: parseSource(value.source),
    messages: parseMessages(value.messages),
    parameters: parseParameters(value.parameters),
    outputText: asTrimmedString(value.outputText),
    images,
    imageAssetIds: dedupeStrings(asStringArray(value.imageAssetIds)),
    inputImages: dedupeStrings(asStringArray(value.inputImages)),
    inputImageAssetIds: dedupeStrings(asStringArray(value.inputImageAssetIds)),
    metadata: parseMetadata(value.metadata),
  }

  const hasData = Boolean(
    example.id ||
      example.basedOnVersionId ||
      example.text ||
      example.description ||
      example.source ||
      (example.messages && example.messages.length > 0) ||
      Object.keys(example.parameters).length > 0 ||
      example.outputText ||
      example.images.length > 0 ||
      example.imageAssetIds.length > 0 ||
      example.inputImages.length > 0 ||
      example.inputImageAssetIds.length > 0 ||
      example.metadata,
  )

  return hasData ? example : null
}

const parseExamples = (value: unknown): FavoriteReproducibilityExample[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => parseExample(item))
    .filter((item): item is FavoriteReproducibilityExample => Boolean(item))
}

const getPromptAssetMetadata = (metadata: unknown): PromptAsset | null => {
  if (!isPlainObject(metadata)) return null
  const promptAsset = metadata.promptAsset
  if (!isPlainObject(promptAsset) || promptAsset.schemaVersion !== PROMPT_MODEL_SCHEMA_VERSION) {
    return null
  }
  return promptAsset as unknown as PromptAsset
}

const isFavoritePrompt = (value: unknown): value is FavoritePrompt => {
  if (!isPlainObject(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    Array.isArray(value.tags) &&
    typeof value.useCount === 'number' &&
    (value.functionMode === 'basic' ||
      value.functionMode === 'context' ||
      value.functionMode === 'image' ||
      value.functionMode === 'video')
  )
}

export const resolveFavoritePromptAsset = (
  favorite: { metadata?: unknown } | FavoritePrompt | null | undefined,
): PromptAsset | null => {
  if (!favorite) return null
  if (isFavoritePrompt(favorite)) {
    return promptAssetFromFavorite(favorite)
  }
  return getPromptAssetMetadata(favorite.metadata)
}

const promptVariableToReproducibilityVariable = (
  variable: PromptVariable,
): FavoriteReproducibilityVariable | null => {
  const name = asTrimmedString(variable.name)
  if (!name) return null

  return {
    name,
    description: asTrimmedString(variable.description),
    type: normalizeVariableType(variable.type),
    required: variable.required === true,
    defaultValue: asTrimmedString(variable.defaultValue),
    options: dedupeStrings(variable.options || []),
    source: asTrimmedString(variable.source),
  }
}

const splitPromptImageRefs = (
  refs: PromptImageRef[] | undefined,
): { urls: string[]; assetIds: string[] } => {
  const urls: string[] = []
  const assetIds: string[] = []

  for (const ref of refs || []) {
    if (!isPlainObject(ref)) continue
    if (ref.kind === 'url') {
      const url = asTrimmedString(ref.url)
      if (url) urls.push(url)
    }
    if (ref.kind === 'asset') {
      const assetId = asTrimmedString(ref.assetId)
      if (assetId) assetIds.push(assetId)
    }
  }

  return {
    urls: dedupeStrings(urls),
    assetIds: dedupeStrings(assetIds),
  }
}

export const favoriteReproducibilityExampleFromPromptExample = (
  example: PromptExample,
): FavoriteReproducibilityExample | null => {
  if (!isPlainObject(example)) return null

  const outputImages = splitPromptImageRefs(example.output?.images)
  const inputImages = splitPromptImageRefs(example.input?.images)
  const metadata = parseMetadata(example.metadata)
  const mapped: FavoriteReproducibilityExample = {
    id: asTrimmedString(example.id),
    basedOnVersionId: asTrimmedString(example.basedOnVersionId),
    text: asTrimmedString(example.input?.text),
    description: asTrimmedString(example.description ?? example.title),
    source: parseSource(example.source),
    messages: Array.isArray(example.input?.messages)
      ? example.input.messages.map((message) => ({ ...message }))
      : [],
    parameters: parseParameters(example.input?.parameters),
    outputText: asTrimmedString(example.output?.text),
    images: outputImages.urls,
    imageAssetIds: outputImages.assetIds,
    inputImages: inputImages.urls,
    inputImageAssetIds: inputImages.assetIds,
    metadata,
  }

  const hasData = Boolean(
    mapped.id ||
      mapped.basedOnVersionId ||
      mapped.text ||
      mapped.description ||
      mapped.source ||
      (mapped.messages && mapped.messages.length > 0) ||
      Object.keys(mapped.parameters).length > 0 ||
      mapped.outputText ||
      mapped.images.length > 0 ||
      mapped.imageAssetIds.length > 0 ||
      mapped.inputImages.length > 0 ||
      mapped.inputImageAssetIds.length > 0 ||
      mapped.metadata,
  )

  return hasData ? mapped : null
}

export const parseFavoriteReproducibilityFromPromptAsset = (
  asset: PromptAsset,
): FavoriteReproducibility => {
  const assetVariables = Array.isArray(asset.contract?.variables)
    ? asset.contract.variables
    : []
  const assetExamples = Array.isArray(asset.examples) ? asset.examples : []
  const variables = assetVariables
    .map((variable) => promptVariableToReproducibilityVariable(variable))
    .filter((variable): variable is FavoriteReproducibilityVariable => Boolean(variable))
  const examples = assetExamples
    .map((example) => favoriteReproducibilityExampleFromPromptExample(example))
    .filter((example): example is FavoriteReproducibilityExample => Boolean(example))

  return buildReproducibility('promptAsset', variables, examples)
}

const buildReproducibility = (
  source: FavoriteReproducibilitySource,
  variables: FavoriteReproducibilityVariable[],
  examples: FavoriteReproducibilityExample[],
): FavoriteReproducibility => {
  const variableCount = variables.length
  const exampleCount = examples.length
  const hasInputImages = examples.some(
    (example) => example.inputImages.length > 0 || example.inputImageAssetIds.length > 0,
  )

  return {
    source: variableCount > 0 || exampleCount > 0 ? source : 'none',
    variables,
    examples,
    variableCount,
    exampleCount,
    hasInputImages,
    hasData: variableCount > 0 || exampleCount > 0,
  }
}

export const parseFavoriteReproducibilityFromMetadata = (
  metadata: unknown,
): FavoriteReproducibility => {
  if (!isPlainObject(metadata)) {
    return buildReproducibility('none', [], [])
  }

  const reproducibility = isPlainObject(metadata.reproducibility)
    ? metadata.reproducibility
    : null
  if (reproducibility) {
    const variables = parseVariables(reproducibility.variables)
    const examples = parseExamples(reproducibility.examples)
    return buildReproducibility('reproducibility', variables, examples)
  }

  const gardenSnapshot = isPlainObject(metadata.gardenSnapshot)
    ? metadata.gardenSnapshot
    : null
  if (gardenSnapshot) {
    const assets = isPlainObject(gardenSnapshot.assets) ? gardenSnapshot.assets : {}
    const variables = parseVariables(gardenSnapshot.variables)
    const examples = parseExamples(assets.examples)
    return buildReproducibility('garden', variables, examples)
  }

  const variables = parseVariables(metadata.variables)
  const examples = parseExamples(metadata.examples)
  return buildReproducibility('metadata', variables, examples)
}

export const parseFavoriteReproducibility = (
  favorite: { metadata?: unknown } | FavoritePrompt | null | undefined,
): FavoriteReproducibility => {
  const promptAsset = resolveFavoritePromptAsset(favorite)
  if (promptAsset) return parseFavoriteReproducibilityFromPromptAsset(promptAsset)

  return parseFavoriteReproducibilityFromMetadata(favorite?.metadata)
}

export const createFavoriteReproducibilityProjection = (
  favorite: { metadata?: unknown } | FavoritePrompt | null | undefined,
): FavoriteReproducibilityProjection => {
  const promptAsset = resolveFavoritePromptAsset(favorite)
  return {
    promptAsset,
    reproducibility: promptAsset
      ? parseFavoriteReproducibilityFromPromptAsset(promptAsset)
      : parseFavoriteReproducibilityFromMetadata(favorite?.metadata),
  }
}

export const pickFavoriteReproducibilityExample = (
  examples: FavoriteReproducibilityExample[],
  options: { applyExample?: boolean; exampleId?: string; exampleIndex?: number },
): FavoriteReproducibilityExample | null => {
  if (!options.applyExample || examples.length === 0) return null

  const id = String(options.exampleId || '').trim()
  if (id) {
    const found = examples.find((example) => (example.id || '').trim() === id)
    if (found) return found
  }

  if (typeof options.exampleIndex === 'number' && Number.isInteger(options.exampleIndex)) {
    return examples[options.exampleIndex] || null
  }

  return examples[0] || null
}

const cloneReproducibilityVariable = (
  variable: FavoriteReproducibilityVariable,
): FavoriteReproducibilityVariable => ({
  ...variable,
  options: [...(variable.options || [])],
})

const cloneReproducibilityExample = (
  example: FavoriteReproducibilityExample,
): FavoriteReproducibilityExample => ({
  ...example,
  source: example.source
    ? {
        ...example.source,
        ...(example.source.metadata ? { metadata: { ...example.source.metadata } } : {}),
      }
    : undefined,
  messages: example.messages?.map((message) => ({ ...message })),
  parameters: { ...example.parameters },
  images: [...example.images],
  imageAssetIds: [...example.imageAssetIds],
  inputImages: [...example.inputImages],
  inputImageAssetIds: [...example.inputImageAssetIds],
  metadata: example.metadata ? { ...example.metadata } : undefined,
})

const mergeReproducibilityVariablesByName = (
  existing: FavoriteReproducibilityVariable[],
  incoming: FavoriteReproducibilityVariable[],
): FavoriteReproducibilityVariable[] => {
  const out: FavoriteReproducibilityVariable[] = []
  const seen = new Set<string>()

  for (const variable of [...existing, ...incoming]) {
    const name = variable.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(cloneReproducibilityVariable({ ...variable, name }))
  }

  return out
}

export const appendFavoriteReproducibilityDraftToMetadata = (
  favorite: { metadata?: unknown } | FavoritePrompt,
  draft: FavoriteReproducibilityDraft,
): Record<string, unknown> => {
  const current = parseFavoriteReproducibility(favorite)
  const metadata = isPlainObject(favorite.metadata) ? { ...favorite.metadata } : {}

  return applyFavoriteReproducibilityToMetadata(metadata, {
    variables: mergeReproducibilityVariablesByName(
      current.variables,
      draft.variables || [],
    ),
    examples: [
      ...current.examples.map(cloneReproducibilityExample),
      ...(draft.examples || []).map(cloneReproducibilityExample),
    ],
  })
}

const normalizeVariablesForSave = (
  variables: FavoriteReproducibilityVariable[],
): FavoriteReproducibilityVariable[] => {
  const seen = new Set<string>()

  return variables
    .map((variable) => ({
      name: variable.name.trim(),
      description: asTrimmedString(variable.description),
      type: normalizeVariableType(variable.type),
      required: variable.required === true,
      defaultValue: asTrimmedString(variable.defaultValue),
      options: dedupeStrings(variable.options || []),
      source: asTrimmedString(variable.source),
    }))
    .filter((variable) => {
      if (!variable.name || seen.has(variable.name)) return false
      seen.add(variable.name)
      return true
    })
}

const normalizeExamplesForSave = (
  examples: FavoriteReproducibilityExample[],
): FavoriteReproducibilityExample[] => {
  return examples
    .map((example) => ({
      id: asTrimmedString(example.id),
      basedOnVersionId: asTrimmedString(example.basedOnVersionId),
      text: asTrimmedString(example.text),
      description: asTrimmedString(example.description),
      source: parseSource(example.source),
      messages: parseMessages(example.messages),
      parameters: parseParameters(example.parameters),
      outputText: asTrimmedString(example.outputText),
      images: dedupeStrings(example.images || []),
      imageAssetIds: dedupeStrings(example.imageAssetIds || []),
      inputImages: dedupeStrings(example.inputImages || []),
      inputImageAssetIds: dedupeStrings(example.inputImageAssetIds || []),
      metadata: parseMetadata(example.metadata),
    }))
    .filter((example) =>
      Boolean(
        example.id ||
          example.basedOnVersionId ||
          example.text ||
          example.description ||
          example.source ||
          (example.messages && example.messages.length > 0) ||
          Object.keys(example.parameters).length > 0 ||
          example.outputText ||
          example.images.length > 0 ||
          example.imageAssetIds.length > 0 ||
          example.inputImages.length > 0 ||
          example.inputImageAssetIds.length > 0 ||
          example.metadata,
      ),
    )
}

const toGardenVariable = (variable: FavoriteReproducibilityVariable): Record<string, unknown> => ({
  name: variable.name,
  ...(variable.description ? { description: variable.description } : {}),
  ...(variable.type ? { type: variable.type } : {}),
  ...(variable.required ? { required: true } : {}),
  ...(variable.defaultValue ? { defaultValue: variable.defaultValue } : {}),
  ...(variable.options.length > 0 ? { options: variable.options } : {}),
  ...(variable.source ? { source: variable.source } : {}),
})

const toGardenExample = (example: FavoriteReproducibilityExample): Record<string, unknown> => ({
  ...(example.id ? { id: example.id } : {}),
  ...(example.basedOnVersionId ? { basedOnVersionId: example.basedOnVersionId } : {}),
  ...(example.text ? { text: example.text } : {}),
  ...(example.description ? { description: example.description } : {}),
  ...(example.source ? { source: example.source } : {}),
  ...(example.messages && example.messages.length > 0 ? { messages: example.messages } : {}),
  ...(Object.keys(example.parameters).length > 0 ? { parameters: example.parameters } : {}),
  ...(example.outputText ? { outputText: example.outputText } : {}),
  ...(example.images.length > 0 ? { images: example.images } : {}),
  ...(example.imageAssetIds.length > 0 ? { imageAssetIds: example.imageAssetIds } : {}),
  ...(example.inputImages.length > 0 ? { inputImages: example.inputImages } : {}),
  ...(example.inputImageAssetIds.length > 0 ? { inputImageAssetIds: example.inputImageAssetIds } : {}),
  ...(example.metadata ? { metadata: example.metadata } : {}),
})

export const applyFavoriteReproducibilityToMetadata = (
  metadata: Record<string, unknown>,
  draft: FavoriteReproducibilityDraft,
  options: { preserveEmpty?: boolean } = {},
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...metadata }
  const variables = normalizeVariablesForSave(draft.variables || [])
  const examples = normalizeExamplesForSave(draft.examples || [])
  const hasDraftData = variables.length > 0 || examples.length > 0

  delete next.variables
  delete next.examples

  if (hasDraftData || options.preserveEmpty) {
    next.reproducibility = {
      variables: variables.map(toGardenVariable),
      examples: examples.map(toGardenExample),
    }
  } else {
    delete next.reproducibility
  }

  return next
}
