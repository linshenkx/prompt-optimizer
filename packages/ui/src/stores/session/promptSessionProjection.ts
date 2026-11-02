import type { useArenaSession } from './useArenaSession'
import {
  createPromptSessionRegistry,
  createPromptSessionSummaryFromLegacySnapshot,
  promptSessionFromLegacySnapshot,
  type LegacyImageResultItem,
  type LegacyPromptSessionSnapshot,
  type PromptSession,
  type PromptSessionRegistry,
  type PromptSessionSummary,
} from '@prompt-optimizer/core'
import { SESSION_SUB_MODE_KEYS, type SubModeKey } from './sessionKeys'
import type { BasicSystemSessionApi } from './useBasicSystemSession'
import type { BasicUserSessionApi } from './useBasicUserSession'
import type { ProMultiMessageSessionApi } from './useProMultiMessageSession'
import type { ProVariableSessionApi } from './useProVariableSession'
import type { ImageText2ImageSessionApi } from './useImageText2ImageSession'
import type { ImageImage2ImageSessionApi } from './useImageImage2ImageSession'
import type { ImageMultiImageSessionApi } from './useImageMultiImageSession'

export type PromptSessionProjectionStoreMap = {
  arena: ReturnType<typeof useArenaSession>
  'basic-system': BasicSystemSessionApi
  'basic-user': BasicUserSessionApi
  'pro-multi': ProMultiMessageSessionApi
  'pro-variable': ProVariableSessionApi
  'image-text2image': ImageText2ImageSessionApi
  'image-image2image': ImageImage2ImageSessionApi
  'image-multiimage': ImageMultiImageSessionApi
}

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const imageInputItemFromFields = (
  assetId: string | null | undefined,
  b64: string | null | undefined,
  mimeType: string | null | undefined,
): LegacyImageResultItem | null => {
  const normalizedAssetId = toTrimmedString(assetId)
  if (normalizedAssetId) {
    return { _type: 'image-ref', id: normalizedAssetId }
  }

  const normalizedB64 = toTrimmedString(b64)
  if (!normalizedB64) return null

  const normalizedMime = toTrimmedString(mimeType) ?? 'image/png'
  return { url: `data:${normalizedMime};base64,${normalizedB64}` }
}

const imageInputItemsFromMultiImageSession = (
  images: ImageMultiImageSessionApi['inputImages'],
): LegacyImageResultItem[] => images
  .map((image) => imageInputItemFromFields(image.assetId, image.b64, image.mimeType))
  .filter((image): image is LegacyImageResultItem => Boolean(image))

const buildTextSnapshot = (
  subModeKey: 'basic-system' | 'basic-user',
  session: BasicSystemSessionApi | BasicUserSessionApi,
): LegacyPromptSessionSnapshot => {
  const snapshot: LegacyPromptSessionSnapshot = {
    subModeKey,
    prompt: session.prompt,
    optimizedPrompt: session.optimizedPrompt,
    reasoning: session.reasoning,
    chainId: session.chainId,
    versionId: session.versionId,
    testContent: session.testContent,
    testVariants: session.testVariants,
    testVariantResults: session.testVariantResults,
    testVariantLastRunFingerprint: session.testVariantLastRunFingerprint,
    selectedOptimizeModelKey: session.selectedOptimizeModelKey,
    selectedTestModelKey: session.selectedTestModelKey,
    selectedTemplateId: session.selectedTemplateId,
    selectedIterateTemplateId: session.selectedIterateTemplateId,
    isCompareMode: session.isCompareMode,
    lastActiveAt: session.lastActiveAt,
    assetBinding: session.assetBinding,
    origin: session.origin,
    ui: {
      layout: session.layout,
    },
  }

  if (subModeKey !== 'basic-system') {
    return snapshot
  }

  const assetId = toTrimmedString((session as BasicSystemSessionApi).testImageAssetId)
  return {
    ...snapshot,
    inputImageId: assetId ?? null,
    inputImages: assetId ? [{ _type: 'image-ref', id: assetId }] : [],
  }
}

const buildProVariableSnapshot = (
  session: ProVariableSessionApi,
): LegacyPromptSessionSnapshot => ({
  subModeKey: 'pro-variable',
  prompt: session.prompt,
  optimizedPrompt: session.optimizedPrompt,
  reasoning: session.reasoning,
  chainId: session.chainId,
  versionId: session.versionId,
  testContent: session.testContent,
  temporaryVariables: session.temporaryVariables,
  testVariants: session.testVariants,
  testVariantResults: session.testVariantResults,
  testVariantLastRunFingerprint: session.testVariantLastRunFingerprint,
  selectedOptimizeModelKey: session.selectedOptimizeModelKey,
  selectedTestModelKey: session.selectedTestModelKey,
  selectedTemplateId: session.selectedTemplateId,
  selectedIterateTemplateId: session.selectedIterateTemplateId,
  isCompareMode: session.isCompareMode,
  lastActiveAt: session.lastActiveAt,
  assetBinding: session.assetBinding,
  origin: session.origin,
  ui: {
    layout: session.layout,
  },
})

const buildProMultiSnapshot = (
  session: ProMultiMessageSessionApi,
): LegacyPromptSessionSnapshot => ({
  subModeKey: 'pro-multi',
  conversationMessagesSnapshot: session.conversationMessagesSnapshot,
  selectedMessageId: session.selectedMessageId,
  optimizedPrompt: session.optimizedPrompt,
  reasoning: session.reasoning,
  chainId: session.chainId,
  versionId: session.versionId,
  temporaryVariables: session.temporaryVariables,
  messageChainMap: session.messageChainMap,
  testVariants: session.testVariants,
  testVariantResults: session.testVariantResults,
  testVariantLastRunFingerprint: session.testVariantLastRunFingerprint,
  selectedOptimizeModelKey: session.selectedOptimizeModelKey,
  selectedTestModelKey: session.selectedTestModelKey,
  selectedTemplateId: session.selectedTemplateId,
  selectedIterateTemplateId: session.selectedIterateTemplateId,
  isCompareMode: session.isCompareMode,
  lastActiveAt: session.lastActiveAt,
  assetBinding: session.assetBinding,
  origin: session.origin,
  ui: {
    layout: session.layout,
  },
})

const buildImageTextSnapshot = (
  subModeKey: 'image-text2image',
  session: ImageText2ImageSessionApi,
): LegacyPromptSessionSnapshot => ({
  subModeKey,
  originalPrompt: session.originalPrompt,
  optimizedPrompt: session.optimizedPrompt,
  reasoning: session.reasoning,
  chainId: session.chainId,
  versionId: session.versionId,
  temporaryVariables: session.temporaryVariables,
  testVariants: session.testVariants,
  testVariantResults: session.testVariantResults,
  testVariantLastRunFingerprint: session.testVariantLastRunFingerprint,
  selectedTextModelKey: session.selectedTextModelKey,
  selectedImageModelKey: session.selectedImageModelKey,
  selectedTemplateId: session.selectedTemplateId,
  selectedIterateTemplateId: session.selectedIterateTemplateId,
  isCompareMode: session.isCompareMode,
  lastActiveAt: session.lastActiveAt,
  assetBinding: session.assetBinding,
  origin: session.origin,
  ui: {
    layout: session.layout,
  },
})

const buildImageImageSnapshot = (
  session: ImageImage2ImageSessionApi,
): LegacyPromptSessionSnapshot => ({
  subModeKey: 'image-image2image',
  originalPrompt: session.originalPrompt,
  optimizedPrompt: session.optimizedPrompt,
  reasoning: session.reasoning,
  chainId: session.chainId,
  versionId: session.versionId,
  temporaryVariables: session.temporaryVariables,
  inputImageId: session.inputImageId,
  inputImages: [
    imageInputItemFromFields(
      session.inputImageId,
      session.inputImageB64,
      session.inputImageMime,
    ),
  ].filter((image): image is LegacyImageResultItem => Boolean(image)),
  testVariants: session.testVariants,
  testVariantResults: session.testVariantResults,
  testVariantLastRunFingerprint: session.testVariantLastRunFingerprint,
  selectedTextModelKey: session.selectedTextModelKey,
  selectedImageModelKey: session.selectedImageModelKey,
  selectedTemplateId: session.selectedTemplateId,
  selectedIterateTemplateId: session.selectedIterateTemplateId,
  isCompareMode: session.isCompareMode,
  lastActiveAt: session.lastActiveAt,
  assetBinding: session.assetBinding,
  origin: session.origin,
  ui: {
    layout: session.layout,
  },
})

const buildImageMultiSnapshot = (
  session: ImageMultiImageSessionApi,
): LegacyPromptSessionSnapshot => ({
  subModeKey: 'image-multiimage',
  originalPrompt: session.originalPrompt,
  optimizedPrompt: session.optimizedPrompt,
  reasoning: session.reasoning,
  chainId: session.chainId,
  versionId: session.versionId,
  temporaryVariables: session.temporaryVariables,
  inputImageIds: session.inputImages
    .map((image) => image.assetId || '')
    .filter((assetId): assetId is string => Boolean(assetId)),
  inputImages: imageInputItemsFromMultiImageSession(session.inputImages),
  testVariants: session.testVariants,
  testVariantResults: session.testVariantResults,
  testVariantLastRunFingerprint: session.testVariantLastRunFingerprint,
  selectedTextModelKey: session.selectedTextModelKey,
  selectedImageModelKey: session.selectedImageModelKey,
  selectedTemplateId: session.selectedTemplateId,
  selectedIterateTemplateId: session.selectedIterateTemplateId,
  isCompareMode: session.isCompareMode,
  lastActiveAt: session.lastActiveAt,
  assetBinding: session.assetBinding,
  origin: session.origin,
  ui: {
    layout: session.layout,
  },
})

export const buildLegacyPromptSessionSnapshot = (
  subModeKey: SubModeKey,
  stores: PromptSessionProjectionStoreMap,
): LegacyPromptSessionSnapshot => {
  switch (subModeKey) {
    case 'arena': return { subModeKey, prompt: stores.arena.state.prompt, inputImages: stores.arena.state.images, lastActiveAt: stores.arena.state.lastActiveAt, metadata: { arena: stores.arena.state } }
    case 'basic-user':
      return buildTextSnapshot(subModeKey, stores[subModeKey])
    case 'pro-multi':
      return buildProMultiSnapshot(stores[subModeKey])
    case 'pro-variable':
      return buildProVariableSnapshot(stores[subModeKey])
    case 'image-text2image':
      return buildImageTextSnapshot(subModeKey, stores[subModeKey])
    case 'image-image2image':
      return buildImageImageSnapshot(stores[subModeKey])
    case 'image-multiimage':
      return buildImageMultiSnapshot(stores[subModeKey])
    case 'basic-system':
    default:
      return buildTextSnapshot('basic-system', stores['basic-system'])
  }
}

export const buildPromptSessionFromStores = (
  subModeKey: SubModeKey,
  stores: PromptSessionProjectionStoreMap,
): PromptSession => {
  const projected = promptSessionFromLegacySnapshot(buildLegacyPromptSessionSnapshot(subModeKey, stores))
  if (subModeKey !== 'arena') return projected
  const arena = stores.arena.state
  projected.draft = { ...projected.draft, content: { kind: 'image-prompt', text: arena.prompt, images: arena.images.map(r => ({ kind: 'asset', assetId: r.id })) } }
  projected.testRuns = [{ id: `${projected.id}:runs`, createdAt: arena.lastActiveAt, runs: Object.values(arena.results).map(r => ({
    id: r.runId, revision: { kind: 'workspace', sessionId: projected.id },
    input: { text: r.prompt, images: r.inputs.map(image => ({ kind: 'asset', assetId: image.id })) },
    output: { text: r.output.result, images: r.images.map(image => ({ kind: 'asset', assetId: image.id })) },
    status: r.status === 'success' ? 'success' : 'error', modelKey: r.model.configKey, modelName: r.model.modelId,
    error: r.error, createdAt: r.startedAt, metadata: { arenaStatus: r.status, fingerprint: r.fingerprint },
  })) }]
  return projected
}

export const buildPromptSessionsFromStores = (
  stores: PromptSessionProjectionStoreMap,
): PromptSession[] => SESSION_SUB_MODE_KEYS.map((subModeKey) =>
  buildPromptSessionFromStores(subModeKey, stores),
)

export const buildPromptSessionSummariesFromStores = (
  stores: PromptSessionProjectionStoreMap,
): PromptSessionSummary[] => SESSION_SUB_MODE_KEYS.map((subModeKey) =>
  createPromptSessionSummaryFromLegacySnapshot(
    buildLegacyPromptSessionSnapshot(subModeKey, stores),
  ),
)

export const buildPromptSessionRegistryFromStores = (
  stores: PromptSessionProjectionStoreMap,
  activeSubModeKey: SubModeKey,
): PromptSessionRegistry => {
  const sessions = buildPromptSessionSummariesFromStores(stores)
  const updatedAt = sessions.reduce(
    (latest, session) => Math.max(latest, session.updatedAt),
    0,
  )

  return createPromptSessionRegistry({
    sessions,
    activeLegacySubModeKey: activeSubModeKey,
    updatedAt,
  })
}
